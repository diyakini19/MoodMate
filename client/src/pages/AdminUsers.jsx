import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  listUsers,
  updateUserRole,
  updateUserStatus,
} from "../services/userService";
import { adminApi } from "../services/api";
import { auth } from "../services/firebase";
import {
  ASSIGNABLE_ROLES,
  PERMISSIONS,
  ROLE_LABELS,
  ROLES,
} from "../rbac/roles";
import AdminHeader from "../components/AdminHeader";
import { logAuditEvent } from "../services/auditService";
import "./Admin.css";

const emptyCreateForm = {
  name: "",
  username: "",
  password: "",
  role: ROLES.USER,
};

function AdminUsers() {
  const { user, profile, can, refreshProfile } = useAuth();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState("");

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [creating, setCreating] = useState(false);

  const [resetTarget, setResetTarget] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const canManageUsers = can(PERMISSIONS.MANAGE_USERS);
  const canManageRoles = can(PERMISSIONS.MANAGE_ROLES);
  const canResetPassword = can(PERMISSIONS.RESET_PASSWORD);
  const canViewPlans = can(PERMISSIONS.VIEW_ALL_PLANS);
  const canViewAudit = can(PERMISSIONS.VIEW_AUDIT_LOGS);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await listUsers();
      setUsers(data);
    } catch (loadError) {
      console.error("Admin users error:", loadError);
      setError("Unable to load users from Firestore.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) {
      return users;
    }

    return users.filter((item) => {
      return (
        item.name?.toLowerCase().includes(term) ||
        item.username?.toLowerCase().includes(term) ||
        item.email?.toLowerCase().includes(term) ||
        item.role?.toLowerCase().includes(term) ||
        item.status?.toLowerCase().includes(term)
      );
    });
  }, [users, search]);

  const handleRoleChange = async (targetUser, nextRole) => {
    if (!canManageRoles) {
      return;
    }

    if (targetUser.uid === user?.uid && nextRole !== "admin") {
      setError("You cannot remove your own admin role.");
      return;
    }

    try {
      setBusyId(targetUser.uid);
      setError("");
      setMessage("");
      await updateUserRole(targetUser.uid, nextRole);
      await logAuditEvent(auth.currentUser, "role_changed", {
        username: profile?.username || "",
        targetUid: targetUser.uid,
        targetName: targetUser.username || targetUser.name || "",
        details: `${targetUser.role} → ${nextRole}`,
      });
      setUsers((current) =>
        current.map((item) =>
          item.uid === targetUser.uid
            ? { ...item, role: nextRole }
            : item
        )
      );
      setMessage(`Updated role for ${targetUser.email || targetUser.name}.`);

      if (targetUser.uid === user?.uid) {
        await refreshProfile();
      }
    } catch (updateError) {
      console.error(updateError);
      setError("Unable to update role.");
    } finally {
      setBusyId("");
    }
  };

  const handleStatusToggle = async (targetUser) => {
    if (!canManageUsers) {
      return;
    }

    if (targetUser.uid === user?.uid) {
      setError("You cannot disable your own account.");
      return;
    }

    const nextStatus =
      targetUser.status === "disabled" ? "active" : "disabled";

    try {
      setBusyId(targetUser.uid);
      setError("");
      setMessage("");

      let signInUpdated = true;

      try {
        const idToken = await auth.currentUser.getIdToken();
        await adminApi.setStatus(idToken, {
          uid: targetUser.uid,
          status: nextStatus,
        });
      } catch (serverError) {
        console.warn("Admin API unavailable, updating Firestore only:", serverError);
        await updateUserStatus(targetUser.uid, nextStatus);
        await logAuditEvent(auth.currentUser, "status_changed", {
          username: profile?.username || "",
          targetUid: targetUser.uid,
          targetName: targetUser.username || targetUser.name || "",
          details: `${targetUser.status} → ${nextStatus} (database only)`,
        });
        signInUpdated = false;
      }

      setUsers((current) =>
        current.map((item) =>
          item.uid === targetUser.uid
            ? { ...item, status: nextStatus }
            : item
        )
      );
      setMessage(
        signInUpdated
          ? `${targetUser.email || targetUser.name} is now ${nextStatus}.`
          : `${targetUser.email || targetUser.name} is now ${nextStatus} in the database, but their sign-in access was not changed because the admin server is unavailable (check server/serviceAccountKey.json).`
      );
    } catch (updateError) {
      console.error(updateError);
      setError("Unable to update user status.");
    } finally {
      setBusyId("");
    }
  };

  const openPasswordReset = (targetUser) => {
    setError("");
    setMessage("");
    setShowCreateForm(false);
    setResetTarget(targetUser);
    setNewPassword("");
    setConfirmPassword("");
  };

  const closePasswordReset = () => {
    setResetTarget(null);
    setNewPassword("");
    setConfirmPassword("");
  };

  const openCreateForm = () => {
    setError("");
    setMessage("");
    closePasswordReset();
    setCreateForm(emptyCreateForm);
    setShowCreateForm(true);
  };

  const closeCreateForm = () => {
    setShowCreateForm(false);
    setCreateForm(emptyCreateForm);
  };

  const handleCreateUser = async (event) => {
    event.preventDefault();

    if (!canManageUsers) {
      return;
    }

    if (!createForm.name.trim()) {
      setError("Please enter a name.");
      return;
    }

    if (!createForm.username.trim()) {
      setError("Please enter a username.");
      return;
    }

    if (createForm.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    try {
      setCreating(true);
      setError("");
      setMessage("");

      const idToken = await auth.currentUser.getIdToken();
      const result = await adminApi.createUser(idToken, {
        name: createForm.name.trim(),
        username: createForm.username.trim(),
        password: createForm.password,
        role: canManageRoles ? createForm.role : ROLES.USER,
      });

      if (result.user) {
        setUsers((current) => [result.user, ...current]);
      } else {
        await loadUsers();
      }

      setMessage(
        `Created account for ${result.user?.username || createForm.username}.`
      );
      closeCreateForm();
    } catch (createError) {
      console.error(createError);
      setError(
        createError.message ||
          "Unable to create user. Make sure the API server has Firebase Admin configured."
      );
    } finally {
      setCreating(false);
    }
  };

  const handlePasswordReset = async (event) => {
    event.preventDefault();

    if (!canResetPassword || !resetTarget) {
      return;
    }

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setBusyId(resetTarget.uid);
      setError("");
      setMessage("");

      const idToken = await auth.currentUser.getIdToken();
      await adminApi.resetPassword(idToken, {
        uid: resetTarget.uid,
        newPassword,
      });

      setMessage(
        `Password updated for ${
          resetTarget.username || resetTarget.name || resetTarget.email
        }.`
      );
      closePasswordReset();
    } catch (resetError) {
      console.error(resetError);
      setError(
        resetError.message ||
          "Unable to reset password. Make sure the API server has Firebase Admin configured."
      );
    } finally {
      setBusyId("");
    }
  };

  return (
    <div className="admin-page app-page">
      <AdminHeader active="/admin/users" />

      <main className="admin-main app-page-main">
        <header className="admin-header">
          <div>
            <span className="admin-eyebrow">USER MANAGEMENT</span>
            <h1>Users & roles</h1>
            <p>
              Create accounts, assign roles, reset passwords, and disable access.
            </p>
          </div>
        </header>

        <section className="admin-card admin-toolbar">
          <input
            type="search"
            placeholder="Search by name, username, role..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {canManageUsers && (
            <button type="button" onClick={openCreateForm}>
              Add user
            </button>
          )}
          <button type="button" onClick={loadUsers}>
            Refresh
          </button>
        </section>

        {error && <div className="admin-error">{error}</div>}
        {message && <div className="admin-success">{message}</div>}

        {showCreateForm && canManageUsers && (
          <section className="admin-card admin-reset-card">
            <h2>Add new user</h2>
            <p className="admin-muted">
              Creates a MoodMate username + password account they can log in
              with immediately.
            </p>
            <form className="admin-create-form" onSubmit={handleCreateUser}>
              <input
                type="text"
                placeholder="Full name"
                value={createForm.name}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                disabled={creating}
                autoComplete="off"
              />
              <input
                type="text"
                placeholder="Username"
                value={createForm.username}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    username: event.target.value,
                  }))
                }
                disabled={creating}
                autoComplete="off"
              />
              <input
                type="password"
                placeholder="Temporary password"
                value={createForm.password}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    password: event.target.value,
                  }))
                }
                disabled={creating}
                autoComplete="new-password"
              />
              {canManageRoles && (
                <select
                  value={createForm.role}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      role: event.target.value,
                    }))
                  }
                  disabled={creating}
                >
                  {ASSIGNABLE_ROLES.map((roleValue) => (
                    <option key={roleValue} value={roleValue}>
                      {ROLE_LABELS[roleValue]}
                    </option>
                  ))}
                </select>
              )}
              <div className="admin-actions">
                <button
                  type="submit"
                  className="admin-action-btn"
                  disabled={creating}
                >
                  {creating ? "Creating..." : "Create user"}
                </button>
                <button
                  type="button"
                  className="admin-action-btn secondary"
                  onClick={closeCreateForm}
                  disabled={creating}
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>
        )}

        {resetTarget && (
          <section className="admin-card admin-reset-card">
            <h2>
              Reset password for{" "}
              {resetTarget.username || resetTarget.name || "user"}
            </h2>
            <p className="admin-muted">
              Sets a new password directly. No email is required.
            </p>
            <form className="admin-reset-form" onSubmit={handlePasswordReset}>
              <input
                type="password"
                placeholder="New password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
              />
              <input
                type="password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
              />
              <div className="admin-actions">
                <button
                  type="submit"
                  className="admin-action-btn"
                  disabled={busyId === resetTarget.uid}
                >
                  Save password
                </button>
                <button
                  type="button"
                  className="admin-action-btn secondary"
                  onClick={closePasswordReset}
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="admin-card">
          {loading ? (
            <p>Loading users...</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Username</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Plans</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((item) => (
                    <tr key={item.uid}>
                      <td>{item.name || "—"}</td>
                      <td>{item.username || "—"}</td>
                      <td>
                        {canManageRoles ? (
                          <select
                            value={item.role}
                            disabled={busyId === item.uid}
                            onChange={(event) =>
                              handleRoleChange(item, event.target.value)
                            }
                          >
                            {ASSIGNABLE_ROLES.map((roleValue) => (
                              <option key={roleValue} value={roleValue}>
                                {ROLE_LABELS[roleValue]}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className={`admin-badge role-${item.role}`}>
                            {ROLE_LABELS[item.role] || item.role}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className={`admin-badge status-${item.status}`}>
                          {item.status}
                        </span>
                      </td>
                      <td>{item.planCount}</td>
                      <td>
                        <div className="admin-actions">
                          {canViewPlans && (
                            <Link
                              className="admin-action-btn secondary admin-link-btn"
                              to={`/admin/plans?uid=${encodeURIComponent(item.uid)}`}
                            >
                              Plans
                            </Link>
                          )}

                          {canViewAudit && (
                            <Link
                              className="admin-action-btn secondary admin-link-btn"
                              to={`/admin/activity?uid=${encodeURIComponent(item.uid)}`}
                            >
                              Activity
                            </Link>
                          )}

                          {canResetPassword && (
                            <button
                              type="button"
                              className="admin-action-btn secondary"
                              disabled={busyId === item.uid}
                              onClick={() => openPasswordReset(item)}
                            >
                              Reset password
                            </button>
                          )}

                          {canManageUsers ? (
                            <button
                              type="button"
                              className="admin-action-btn"
                              disabled={
                                busyId === item.uid || item.uid === user?.uid
                              }
                              onClick={() => handleStatusToggle(item)}
                            >
                              {item.status === "disabled"
                                ? "Enable"
                                : "Disable"}
                            </button>
                          ) : !canResetPassword && !canViewPlans ? (
                            <span className="admin-muted">View only</span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredUsers.length === 0 && (
                <p className="admin-muted">No users matched your search.</p>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default AdminUsers;
