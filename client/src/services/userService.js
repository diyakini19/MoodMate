import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import { db } from "./firebase";
import { ROLES, normalizeRole } from "../rbac/roles";
import {
  isValidUsername,
  looksLikeEmail,
  normalizeUsername,
  suggestUsernameFromIdentity,
  usernameToAuthEmail,
} from "./usernameAuth";

function mapUserDoc(snapshot) {
  const data = snapshot.data() || {};

  return {
    id: snapshot.id,
    uid: snapshot.id,
    name: data.name || "",
    username: data.username || "",
    email: data.email || "",
    role: normalizeRole(data.role),
    status: data.status === "disabled" ? "disabled" : "active",
    planCount: Number(data.planCount) || 0,
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
  };
}

export const claimUsername = async (username, uid, email = "") => {
  const normalized = normalizeUsername(username);

  if (!isValidUsername(normalized)) {
    const error = new Error(
      "Username must be 3–24 characters: letters, numbers, underscore."
    );
    error.code = "username/invalid";
    throw error;
  }

  const usernameRef = doc(db, "usernames", normalized);
  const existing = await getDoc(usernameRef);

  if (existing.exists() && existing.data()?.uid !== uid) {
    const error = new Error("That username is already taken.");
    error.code = "username/taken";
    throw error;
  }

  await setDoc(usernameRef, {
    uid,
    username: normalized,
    email: email || "",
    createdAt: serverTimestamp(),
  });

  return normalized;
};

export const assignAvailableUsername = async (user) => {
  const base = suggestUsernameFromIdentity({
    email: user.email || "",
    displayName: user.displayName || "",
  });

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const candidate =
      attempt === 0
        ? base
        : `${base.slice(0, 18)}_${Math.floor(Math.random() * 900 + 100)}`;

    try {
      return await claimUsername(candidate, user.uid, user.email || "");
    } catch (error) {
      if (error.code !== "username/taken") {
        throw error;
      }
    }
  }

  return claimUsername(
    `user_${Date.now().toString().slice(-8)}`,
    user.uid,
    user.email || ""
  );
};

export const resolveLoginIdentifier = async (identifier) => {
  const value = String(identifier || "").trim();

  if (!value) {
    const error = new Error("Please enter your username.");
    error.code = "username/missing";
    throw error;
  }

  if (looksLikeEmail(value)) {
    return {
      email: value.toLowerCase(),
      username: "",
    };
  }

  const username = normalizeUsername(value);
  const usernameSnap = await getDoc(doc(db, "usernames", username));

  if (usernameSnap.exists()) {
    const mappedEmail =
      usernameSnap.data()?.email || usernameToAuthEmail(username);

    return {
      email: mappedEmail,
      username,
    };
  }

  /*
   * Fallback for accounts created before the usernames index existed.
   */
  return {
    email: usernameToAuthEmail(username),
    username,
  };
};

export const createUserDocument = async (
  user,
  name,
  username = "",
  options = {}
) => {
  const provider = options.provider || "password";

  let normalizedUsername = "";

  if (username) {
    normalizedUsername = await claimUsername(
      username,
      user.uid,
      user.email || ""
    );
  } else if (provider === "google") {
    normalizedUsername = await assignAvailableUsername(user);
  }

  const email = user.email || "";

  await setDoc(
    doc(db, "users", user.uid),
    {
      name: name || user.displayName || "",
      username: normalizedUsername,
      email,
      role: ROLES.USER,
      status: "active",
      planCount: 0,
      authProvider: provider,
      photoURL: user.photoURL || "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  if (normalizedUsername) {
    await setDoc(
      doc(db, "usernames", normalizedUsername),
      {
        uid: user.uid,
        username: normalizedUsername,
        email,
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );
  }
};

export const ensureUserProfile = async (user) => {
  if (!user?.uid) {
    return null;
  }

  const userRef = doc(db, "users", user.uid);
  const snapshot = await getDoc(userRef);
  const isGoogleUser = user.providerData?.some(
    (provider) => provider.providerId === "google.com"
  );

  if (!snapshot.exists()) {
    await createUserDocument(
      user,
      user.displayName || "",
      "",
      { provider: isGoogleUser ? "google" : "password" }
    );
    const created = await getDoc(userRef);
    return mapUserDoc(created);
  }

  const profile = mapUserDoc(snapshot);
  const data = snapshot.data() || {};
  const updates = {};

  if (!data.role) {
    updates.role = ROLES.USER;
  }

  if (!data.status) {
    updates.status = "active";
  }

  if (data.planCount == null) {
    updates.planCount = 0;
  }

  if (!data.username) {
    updates.username = await assignAvailableUsername(user);
  }

  if (isGoogleUser && !data.authProvider) {
    updates.authProvider = "google";
  }

  if (user.photoURL && data.photoURL !== user.photoURL) {
    updates.photoURL = user.photoURL;
  }

  if (Object.keys(updates).length > 0) {
    updates.updatedAt = serverTimestamp();
    await updateDoc(userRef, updates);

    return {
      ...profile,
      ...updates,
      role: normalizeRole(updates.role || profile.role),
      status: updates.status || profile.status,
      username: updates.username || profile.username,
      planCount:
        updates.planCount != null
          ? updates.planCount
          : profile.planCount,
    };
  }

  return profile;
};

export const getUserProfile = async (uid) => {
  const snapshot = await getDoc(doc(db, "users", uid));

  if (!snapshot.exists()) {
    return null;
  }

  return mapUserDoc(snapshot);
};

export const listUsers = async () => {
  const usersRef = collection(db, "users");

  let snapshot;

  try {
    snapshot = await getDocs(query(usersRef, orderBy("createdAt", "desc")));
  } catch {
    snapshot = await getDocs(usersRef);
  }

  const users = snapshot.docs.map(mapUserDoc);

  users.sort((a, b) => {
    const dateA = a.createdAt?.toDate?.() || new Date(0);
    const dateB = b.createdAt?.toDate?.() || new Date(0);
    return dateB - dateA;
  });

  return users;
};

export const updateUserRole = async (uid, role) => {
  await updateDoc(doc(db, "users", uid), {
    role: normalizeRole(role),
    updatedAt: serverTimestamp(),
  });
};

export const updateUserStatus = async (uid, status) => {
  const nextStatus = status === "disabled" ? "disabled" : "active";

  await updateDoc(doc(db, "users", uid), {
    status: nextStatus,
    updatedAt: serverTimestamp(),
  });
};

export const incrementUserPlanCount = async (uid) => {
  if (!uid) {
    return;
  }

  await updateDoc(doc(db, "users", uid), {
    planCount: increment(1),
    updatedAt: serverTimestamp(),
  });
};

export const getAdminStats = async () => {
  const users = await listUsers();

  const totalUsers = users.length;
  const activeUsers = users.filter((user) => user.status === "active").length;
  const disabledUsers = totalUsers - activeUsers;
  const adminUsers = users.filter((user) => user.role === ROLES.ADMIN).length;
  const moderatorUsers = users.filter(
    (user) => user.role === ROLES.MODERATOR
  ).length;
  const totalPlans = users.reduce(
    (sum, user) => sum + (Number(user.planCount) || 0),
    0
  );

  return {
    totalUsers,
    activeUsers,
    disabledUsers,
    adminUsers,
    moderatorUsers,
    totalPlans,
    recentUsers: users.slice(0, 8),
  };
};
