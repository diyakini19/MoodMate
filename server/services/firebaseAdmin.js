const path = require("path");
const fs = require("fs");

let services = null;
let initError = null;

function getServiceAccountPath() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    return path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
  }

  return path.join(__dirname, "..", "serviceAccountKey.json");
}

function initFirebaseAdmin() {
  if (services) {
    return services;
  }

  if (initError) {
    throw initError;
  }

  let appModule;
  let authModule;
  let firestoreModule;

  try {
    // Lazy require so the travel API still works without Admin SDK installed/configured.
    appModule = require("firebase-admin/app");
    authModule = require("firebase-admin/auth");
    firestoreModule = require("firebase-admin/firestore");
  } catch (error) {
    initError = new Error(
      "firebase-admin is not installed. Run npm install in the server folder."
    );
    throw initError;
  }

  if (!appModule.getApps().length) {
    const serviceAccountPath = getServiceAccountPath();

    if (!fs.existsSync(serviceAccountPath)) {
      initError = new Error(
        "Firebase Admin is not configured. Add server/serviceAccountKey.json from Firebase Console → Project settings → Service accounts."
      );
      throw initError;
    }

    const serviceAccount = require(serviceAccountPath);

    appModule.initializeApp({
      credential: appModule.cert(serviceAccount),
    });
  }

  services = {
    auth: authModule.getAuth(),
    db: firestoreModule.getFirestore(),
    FieldValue: firestoreModule.FieldValue,
  };

  return services;
}

async function verifyAdminRequest(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ")
    ? header.slice(7)
    : "";

  if (!token) {
    const error = new Error("Missing auth token.");
    error.status = 401;
    throw error;
  }

  const { auth, db, FieldValue } = initFirebaseAdmin();

  let decoded;

  try {
    decoded = await auth.verifyIdToken(token);
  } catch {
    const error = new Error("Invalid or expired auth token.");
    error.status = 401;
    throw error;
  }

  const userSnap = await db.collection("users").doc(decoded.uid).get();
  const profile = userSnap.exists ? userSnap.data() : null;

  if (profile?.role !== "admin" || profile?.status === "disabled") {
    const error = new Error("Admin access required.");
    error.status = 403;
    throw error;
  }

  return {
    auth,
    db,
    FieldValue,
    decoded,
    profile,
  };
}

module.exports = {
  initFirebaseAdmin,
  verifyAdminRequest,
};
