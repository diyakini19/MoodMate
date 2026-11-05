import { useAuth } from "../context/AuthContext";
import { PERMISSIONS } from "../rbac/roles";
import AppHeader from "./AppHeader";

function AdminHeader({ active, backTo = "/admin" }) {
  const { can } = useAuth();

  const links = [
    { to: "/admin", label: "Overview" },
    { to: "/admin/users", label: "Users" },
    can(PERMISSIONS.VIEW_ALL_PLANS) && { to: "/admin/plans", label: "Plans" },
    can(PERMISSIONS.VIEW_AUDIT_LOGS) && {
      to: "/admin/activity",
      label: "Activity",
    },
    { to: "/dashboard", label: "App" },
  ]
    .filter(Boolean)
    .map((link) => ({ ...link, active: link.to === active }));

  return (
    <AppHeader
      backTo={backTo}
      brandTo="/admin"
      brandSuffix="Admin"
      showDashboard={false}
      showAdmin={false}
      links={links}
    />
  );
}

export default AdminHeader;
