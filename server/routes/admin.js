const express = require("express");
const {
  initFirebaseAdmin,
  verifyAdminRequest,
} = require("../services/firebaseAdmin");
const {
  isValidUsername,
  normalizeRole,
  normalizeUsername,
  usernameToAuthEmail,
} = require("../utils/usernameAuth");
const { writeAuditLog } = require("../services/auditLog");

const router = express.Router();

async function getTargetName(db, uid) {
  try {
    const snapshot = await db.collection("users").doc(uid).get();
    const data = snapshot.data() || {};
    return data.username || data.name || "";
  } catch {
    return "";
  }
}

router.post("/create-user", async (req, res) => {
  let createdUid = null;

  try {
    const adminContext = await verifyAdminRequest(req);
    const { auth, db, FieldValue } = adminContext;
    const {
      name = "",
      username = "",
      password = "",
      role = "user",
    } = req.body || {};

    const displayName = String(name || "").trim();
    const normalizedUsername = normalizeUsername(username);
    const nextPassword = String(password || "");
    const nextRole = normalizeRole(role);

    if (!displayName) {
      return res.status(400).json({
        success: false,
        message: "Name is required.",
      });
    }

    if (!isValidUsername(normalizedUsername)) {
      return res.status(400).json({
        success: false,
        message:
          "Username must be 3–24 characters: letters, numbers, underscore.",
      });
    }

    if (nextPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters.",
      });
    }

    const usernameRef = db.collection("usernames").doc(normalizedUsername);
    const usernameSnap = await usernameRef.get();

    if (usernameSnap.exists) {
      return res.status(409).json({
        success: false,
        message: "That username is already taken.",
      });
    }

    const authEmail = usernameToAuthEmail(normalizedUsername);

    const created = await auth.createUser({
      email: authEmail,
      password: nextPassword,
      displayName,
      emailVerified: true,
      disabled: false,
    });

    createdUid = created.uid;

    const batch = db.batch();
    const userRef = db.collection("users").doc(created.uid);

    batch.set(userRef, {
      name: displayName,
      username: normalizedUsername,
      email: authEmail,
      role: nextRole,
      status: "active",
      planCount: 0,
      authProvider: "password",
      createdByAdmin: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    batch.set(usernameRef, {
      uid: created.uid,
      email: authEmail,
      createdAt: FieldValue.serverTimestamp(),
    });

    await batch.commit();

    await writeAuditLog(adminContext, "user_created", {
      targetUid: created.uid,
      targetName: normalizedUsername,
      details: `role: ${nextRole}`,
      userAgent: req.headers["user-agent"],
    });

    return res.status(201).json({
      success: true,
      message: "User created successfully.",
      user: {
        uid: created.uid,
        name: displayName,
        username: normalizedUsername,
        email: authEmail,
        role: nextRole,
        status: "active",
        planCount: 0,
      },
    });
  } catch (error) {
    console.error("Admin create user error:", error.message);

    if (createdUid) {
      try {
        await initFirebaseAdmin().auth.deleteUser(createdUid);
      } catch (cleanupError) {
        console.error(
          "Failed to roll back Auth user after create error:",
          cleanupError.message
        );
      }
    }

    let status = error.status || 500;
    let message =
      error.message || "Unable to create user. Check Firebase Admin setup.";

    if (error.code === "auth/email-already-exists") {
      status = 409;
      message = "That username is already taken.";
    } else if (error.code === "auth/invalid-password") {
      status = 400;
      message = "Password is too weak. Use at least 6 characters.";
    }

    return res.status(status).json({
      success: false,
      message,
    });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const adminContext = await verifyAdminRequest(req);
    const { auth, db, FieldValue } = adminContext;
    const { uid, newPassword } = req.body || {};

    if (!uid || typeof uid !== "string") {
      return res.status(400).json({
        success: false,
        message: "User id is required.",
      });
    }

    const password = String(newPassword || "");

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters.",
      });
    }

    await auth.updateUser(uid, {
      password,
    });

    await db.collection("users").doc(uid).set(
      {
        passwordUpdatedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    await writeAuditLog(adminContext, "password_reset", {
      targetUid: uid,
      targetName: await getTargetName(db, uid),
      userAgent: req.headers["user-agent"],
    });

    return res.json({
      success: true,
      message: "Password updated successfully.",
    });
  } catch (error) {
    console.error("Admin reset password error:", error.message);

    const status = error.status || 500;

    return res.status(status).json({
      success: false,
      message:
        error.message ||
        "Unable to reset password. Check Firebase Admin setup.",
    });
  }
});

router.post("/set-status", async (req, res) => {
  try {
    const adminContext = await verifyAdminRequest(req);
    const { auth, db, FieldValue, decoded } = adminContext;
    const { uid, status } = req.body || {};

    if (!uid || typeof uid !== "string") {
      return res.status(400).json({
        success: false,
        message: "User id is required.",
      });
    }

    if (status !== "active" && status !== "disabled") {
      return res.status(400).json({
        success: false,
        message: "Status must be active or disabled.",
      });
    }

    if (uid === decoded.uid && status === "disabled") {
      return res.status(400).json({
        success: false,
        message: "You cannot disable your own account.",
      });
    }

    const disabled = status === "disabled";
    const targetSnap = await db.collection("users").doc(uid).get();
    const target = targetSnap.data() || {};
    const previousStatus = target.status || "active";

    await auth.updateUser(uid, { disabled });

    if (disabled) {
      await auth.revokeRefreshTokens(uid);
    }

    await db.collection("users").doc(uid).set(
      {
        status,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    await writeAuditLog(adminContext, "status_changed", {
      targetUid: uid,
      targetName: target.username || target.name || "",
      details: `${previousStatus} → ${status}`,
      userAgent: req.headers["user-agent"],
    });

    return res.json({
      success: true,
      message: disabled ? "User disabled." : "User enabled.",
    });
  } catch (error) {
    console.error("Admin set status error:", error.message);

    let status = error.status || 500;
    let message =
      error.message || "Unable to update user status. Check Firebase Admin setup.";

    if (error.code === "auth/user-not-found") {
      status = 404;
      message = "That user no longer exists in Firebase Authentication.";
    }

    return res.status(status).json({
      success: false,
      message,
    });
  }
});

router.get("/health", async (req, res) => {
  try {
    await verifyAdminRequest(req);
    return res.json({
      success: true,
      message: "Admin API ready.",
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;
