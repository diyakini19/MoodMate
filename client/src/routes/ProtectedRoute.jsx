import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { hasAnyPermission, hasPermission } from "../rbac/roles";
import AccessDenied from "../pages/AccessDenied";

function LoadingScreen({ message = "Loading MoodMate..." }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: "15px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ fontSize: "40px" }}>✦</div>
      <p>{message}</p>
    </div>
  );
}

function ProtectedRoute({
  children,
  permission,
  anyPermission,
  adminOnly = false,
}) {
  const { user, profile, role, loading, canAccessAdmin } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: location,
        }}
      />
    );
  }

  if (profile?.status === "disabled") {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          disabled: true,
        }}
      />
    );
  }

  const needsAdmin = adminOnly || permission || anyPermission?.length;

  if (needsAdmin) {
    if (adminOnly && !canAccessAdmin) {
      return <AccessDenied />;
    }

    if (permission && !hasPermission(role, permission)) {
      return <AccessDenied />;
    }

    if (
      Array.isArray(anyPermission) &&
      anyPermission.length > 0 &&
      !hasAnyPermission(role, anyPermission)
    ) {
      return <AccessDenied />;
    }
  }

  return children;
}

export default ProtectedRoute;
