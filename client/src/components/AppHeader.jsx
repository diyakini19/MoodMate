import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./AppHeader.css";

/**
 * Shared top bar: brand, optional back, dashboard/admin shortcuts, logout.
 */
function AppHeader({
  showBack = true,
  onBack,
  backTo,
  backLabel = "← Back",
  brandTo,
  brandSuffix = null,
  showDashboard = true,
  showAdmin = true,
  links = [],
  sticky = true,
}) {
  const navigate = useNavigate();
  const { user, logout, canAccessAdmin } = useAuth();

  const handleBack = () => {
    if (typeof onBack === "function") {
      onBack();
      return;
    }

    if (backTo) {
      navigate(backTo);
      return;
    }

    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate(user ? "/dashboard" : "/");
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const homePath = brandTo || (user ? "/dashboard" : "/");

  return (
    <header className={`app-header ${sticky ? "is-sticky" : ""}`}>
      <div className="app-header-inner">
        <div className="app-header-left">
          {showBack && (
            <button
              type="button"
              className="app-header-back"
              onClick={handleBack}
            >
              {backLabel}
            </button>
          )}

          <Link to={homePath} className="app-header-brand">
            Mood<span>Mate</span>
            {brandSuffix ? <em>{brandSuffix}</em> : null}
          </Link>
        </div>

        <div className="app-header-right">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`app-header-link ${link.active ? "is-active" : ""}`}
            >
              {link.label}
            </Link>
          ))}

          {user && showDashboard && (
            <button
              type="button"
              className="app-header-link-btn"
              onClick={() => navigate("/dashboard")}
            >
              Dashboard
            </button>
          )}

          {user && canAccessAdmin && showAdmin && (
            <button
              type="button"
              className="app-header-link-btn"
              onClick={() => navigate("/admin")}
            >
              Admin
            </button>
          )}

          {user ? (
            <button
              type="button"
              className="app-header-logout"
              onClick={handleLogout}
            >
              Logout
            </button>
          ) : (
            <button
              type="button"
              className="app-header-logout"
              onClick={() => navigate("/login")}
            >
              Login
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

export default AppHeader;
