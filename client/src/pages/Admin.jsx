import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getAdminStats } from "../services/userService";
import { ROLE_LABELS } from "../rbac/roles";
import AdminHeader from "../components/AdminHeader";
import "./Admin.css";

function Admin() {
  const { user, role, profile } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadStats = async () => {
      try {
        setLoading(true);
        setError("");
        const data = await getAdminStats();
        setStats(data);
      } catch (loadError) {
        console.error("Admin stats error:", loadError);
        setError(
          "Unable to load admin stats. Make sure Firestore rules allow admins to read users."
        );
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, []);

  return (
    <div className="admin-page app-page">
      <AdminHeader active="/admin" backTo="/dashboard" />

      <main className="admin-main app-page-main">
        <header className="admin-header">
          <div>
            <span className="admin-eyebrow">ROLE-BASED ACCESS</span>
            <h1>Admin panel</h1>
            <p>
              Signed in as {user?.email || profile?.email} ·{" "}
              {ROLE_LABELS[role] || role}
            </p>
          </div>
        </header>

        {loading && <div className="admin-card">Loading stats...</div>}

        {error && <div className="admin-error">{error}</div>}

        {!loading && stats && (
          <>
            <section className="admin-stats-grid">
              <article className="admin-stat-card">
                <span>Total users</span>
                <strong>{stats.totalUsers}</strong>
              </article>
              <article className="admin-stat-card">
                <span>Active</span>
                <strong>{stats.activeUsers}</strong>
              </article>
              <article className="admin-stat-card">
                <span>Disabled</span>
                <strong>{stats.disabledUsers}</strong>
              </article>
              <article className="admin-stat-card">
                <span>Moderators</span>
                <strong>{stats.moderatorUsers}</strong>
              </article>
              <article className="admin-stat-card">
                <span>Admins</span>
                <strong>{stats.adminUsers}</strong>
              </article>
              <article className="admin-stat-card">
                <span>Saved plans</span>
                <strong>{stats.totalPlans}</strong>
              </article>
            </section>

            <section className="admin-card">
              <div className="admin-section-head">
                <h2>Recent users</h2>
                <Link to="/admin/users">Manage users →</Link>
              </div>

              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Username</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Plans</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(stats.recentUsers || []).map((item) => (
                      <tr key={item.uid}>
                        <td>{item.name || "—"}</td>
                        <td>{item.username || "—"}</td>
                        <td>
                          <span className={`admin-badge role-${item.role}`}>
                            {ROLE_LABELS[item.role] || item.role}
                          </span>
                        </td>
                        <td>
                          <span className={`admin-badge status-${item.status}`}>
                            {item.status}
                          </span>
                        </td>
                        <td>{item.planCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default Admin;
