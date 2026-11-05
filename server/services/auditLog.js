/*
 * Records an admin action in the same auditLogs collection the client uses.
 * Never throws: the admin action itself already succeeded.
 */
async function writeAuditLog(
  { db, FieldValue, decoded, profile },
  action,
  { targetUid = "", targetName = "", details = "", userAgent = "" } = {}
) {
  try {
    await db.collection("auditLogs").add({
      uid: decoded.uid,
      username: profile?.username || "",
      name: profile?.name || decoded.name || "",
      email: decoded.email || "",
      action,
      method: "",
      targetUid,
      targetName,
      details,
      userAgent: String(userAgent || "").slice(0, 200),
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error("Unable to write audit log:", error.message);
  }
}

module.exports = {
  writeAuditLog,
};
