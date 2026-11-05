import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { usePlan } from "../context/PlanContext";
import AppHeader from "../components/AppHeader";
import "./Dashboard.css";

function Dashboard() {
  const { user, canAccessAdmin, role } = useAuth();
  const { resetPlan } = usePlan();
  const navigate = useNavigate();

  const handleCreatePlan = () => {
    resetPlan();
    navigate("/mood");
  };

  const handleProfile = () => {
    navigate("/profile");
  };

  return (
    <div className="dashboard-page app-page">
      <AppHeader
        showBack={false}
        showDashboard={false}
        links={[{ to: "/profile", label: "Profile" }]}
      />

      <main className="dashboard-container app-page-main">
        <div className="dashboard-heading">
          <span className="dashboard-label">YOUR MOODMATE</span>

          <h1>
            Welcome back,
            <span>
              {" "}
              {user?.displayName || "there"}.
            </span>
          </h1>

          <p>What would you like to do today?</p>
        </div>

        <div className="dashboard-options">
          <div className="dashboard-option-card">
            <div className="dashboard-option-icon">✦</div>

            <span className="dashboard-option-label">START SOMETHING NEW</span>

            <h2>Create a Plan</h2>

            <p>
              Tell us your mood, add your friends, choose your preferences and
              find the perfect place to meet.
            </p>

            <button
              className="dashboard-primary-btn"
              onClick={handleCreatePlan}
            >
              Create a Plan →
            </button>
          </div>

          <div className="dashboard-option-card">
            <div className="dashboard-option-icon profile-icon">◉</div>

            <span className="dashboard-option-label">YOUR ACCOUNT</span>

            <h2>My Profile</h2>

            <p>
              View your profile, previous plans, saved meeting locations and
              selected places.
            </p>

            <button
              className="dashboard-secondary-btn"
              onClick={handleProfile}
            >
              View Profile →
            </button>
          </div>

          {canAccessAdmin && (
            <div className="dashboard-option-card">
              <div className="dashboard-option-icon">⌂</div>

              <span className="dashboard-option-label">
                ADMIN ACCESS · {String(role).toUpperCase()}
              </span>

              <h2>Admin Panel</h2>

              <p>
                Manage users, roles, and account status with MoodMate RBAC.
              </p>

              <button
                className="dashboard-primary-btn"
                onClick={() => navigate("/admin")}
              >
                Open Admin →
              </button>
            </div>
          )}
        </div>

        <div className="dashboard-footer-message">
          <span>✦</span>
          <p>
            MoodMate makes planning your next hangout simple, personal and fun.
          </p>
        </div>
      </main>
    </div>
  );
}

export default Dashboard;
