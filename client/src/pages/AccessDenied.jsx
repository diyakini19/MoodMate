import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ROLE_LABELS } from "../rbac/roles";
import AppHeader from "../components/AppHeader";
import "./Admin.css";

function AccessDenied({ required = "admin or moderator" }) {
  const { user, role, profile } = useAuth();

  return (
    <div className="admin-page app-page">
      <AppHeader backTo="/dashboard" />

      <main className="admin-main app-page-main">
        <section
          className="admin-card"
          style={{ maxWidth: 560, margin: "40px auto" }}
        >
          <span className="admin-eyebrow">ACCESS DENIED</span>
          <h1 style={{ marginBottom: 12 }}>Admin panel locked</h1>
          <p style={{ marginBottom: 16 }}>
            You need a <strong>{required}</strong> role to open this page.
          </p>

          <div style={{ marginBottom: 20, lineHeight: 1.7 }}>
            <div>
              <strong>Signed in as:</strong>{" "}
              {user?.email || profile?.email || "unknown"}
            </div>
            <div>
              <strong>Current role:</strong>{" "}
              {ROLE_LABELS[role] || role || "user"}
            </div>
          </div>

          <p style={{ marginBottom: 20, color: "#5d6f68" }}>
            In Firebase Console → Firestore → <code>users</code> → your
            document, set field <code>role</code> (string) to{" "}
            <code>admin</code>, then log out and log in again with your
            username.
          </p>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link
              to="/dashboard"
              className="admin-action-btn"
              style={{ textDecoration: "none", display: "inline-block" }}
            >
              Back to dashboard
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}

export default AccessDenied;
