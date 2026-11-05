import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";

import { db } from "./firebase";

export const AUDIT_ACTIONS = {
  signup: "Signed up",
  login: "Logged in",
  logout: "Logged out",
  login_blocked: "Blocked login (disabled)",
  role_changed: "Role changed",
  status_changed: "Status changed",
  user_created: "Created user",
  password_reset: "Reset password",
};

const AUDIT_WRITE_TIMEOUT_MS = 2500;

/*
 * Never throws: a failed or slow audit write must not block login/logout.
 */
export async function logAuditEvent(user, action, extra = {}) {
  if (!user?.uid) {
    return;
  }

  const write = addDoc(collection(db, "auditLogs"), {
    uid: user.uid,
    username: extra.username || "",
    name: user.displayName || "",
    email: user.email || "",
    action,
    method: extra.method || "",
    targetUid: extra.targetUid || "",
    targetName: extra.targetName || "",
    details: extra.details || "",
    userAgent:
      typeof navigator !== "undefined"
        ? String(navigator.userAgent || "").slice(0, 200)
        : "",
    createdAt: serverTimestamp(),
  }).catch((error) => {
    console.warn("Unable to write audit log:", error);
  });

  await Promise.race([
    write,
    new Promise((resolve) => setTimeout(resolve, AUDIT_WRITE_TIMEOUT_MS)),
  ]);
}

function mapLog(snapshot) {
  return {
    id: snapshot.id,
    ...snapshot.data(),
  };
}

function byNewest(a, b) {
  const dateA = a.createdAt?.toDate?.() || new Date(0);
  const dateB = b.createdAt?.toDate?.() || new Date(0);
  return dateB - dateA;
}

export async function listAuditLogs({ uid = "", max = 300 } = {}) {
  const logsRef = collection(db, "auditLogs");

  if (!uid) {
    const snapshot = await getDocs(
      query(logsRef, orderBy("createdAt", "desc"), limit(max))
    );
    return snapshot.docs.map(mapLog);
  }

  // Two single-field queries avoid needing a composite index.
  const [asActor, asTarget] = await Promise.all([
    getDocs(query(logsRef, where("uid", "==", uid))),
    getDocs(query(logsRef, where("targetUid", "==", uid))),
  ]);

  const merged = new Map();
  [...asActor.docs, ...asTarget.docs].forEach((docSnap) => {
    merged.set(docSnap.id, mapLog(docSnap));
  });

  return [...merged.values()].sort(byNewest).slice(0, max);
}

export function describeDevice(userAgent = "") {
  if (!userAgent) {
    return "—";
  }

  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /OPR\//.test(userAgent)
      ? "Opera"
      : /Chrome\//.test(userAgent)
        ? "Chrome"
        : /Firefox\//.test(userAgent)
          ? "Firefox"
          : /Safari\//.test(userAgent)
            ? "Safari"
            : "Browser";

  const os = /Android/.test(userAgent)
    ? "Android"
    : /iPhone|iPad/.test(userAgent)
      ? "iOS"
      : /Windows/.test(userAgent)
        ? "Windows"
        : /Mac OS X/.test(userAgent)
          ? "macOS"
          : /Linux/.test(userAgent)
            ? "Linux"
            : "";

  return os ? `${browser} · ${os}` : browser;
}
