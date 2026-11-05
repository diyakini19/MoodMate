export const ROLES = {
  USER: "user",
  MODERATOR: "moderator",
  ADMIN: "admin",
};

export const ROLE_LABELS = {
  [ROLES.USER]: "User",
  [ROLES.MODERATOR]: "Moderator",
  [ROLES.ADMIN]: "Admin",
};

export const PERMISSIONS = {
  CREATE_PLAN: "create_plan",
  VIEW_OWN_PLANS: "view_own_plans",
  VIEW_ADMIN: "view_admin",
  VIEW_USERS: "view_users",
  MANAGE_USERS: "manage_users",
  MANAGE_ROLES: "manage_roles",
  RESET_PASSWORD: "reset_password",
  VIEW_ALL_PLANS: "view_all_plans",
  VIEW_AUDIT_LOGS: "view_audit_logs",
};

const ROLE_PERMISSIONS = {
  [ROLES.USER]: [
    PERMISSIONS.CREATE_PLAN,
    PERMISSIONS.VIEW_OWN_PLANS,
  ],
  [ROLES.MODERATOR]: [
    PERMISSIONS.CREATE_PLAN,
    PERMISSIONS.VIEW_OWN_PLANS,
    PERMISSIONS.VIEW_ADMIN,
    PERMISSIONS.VIEW_USERS,
    PERMISSIONS.VIEW_ALL_PLANS,
  ],
  [ROLES.ADMIN]: [
    PERMISSIONS.CREATE_PLAN,
    PERMISSIONS.VIEW_OWN_PLANS,
    PERMISSIONS.VIEW_ADMIN,
    PERMISSIONS.VIEW_USERS,
    PERMISSIONS.MANAGE_USERS,
    PERMISSIONS.MANAGE_ROLES,
    PERMISSIONS.RESET_PASSWORD,
    PERMISSIONS.VIEW_ALL_PLANS,
    PERMISSIONS.VIEW_AUDIT_LOGS,
  ],
};

export function normalizeRole(role) {
  const value = String(role || ROLES.USER)
    .trim()
    .toLowerCase();

  if (value === ROLES.ADMIN || value === "administrator") {
    return ROLES.ADMIN;
  }

  if (value === ROLES.MODERATOR || value === "mod" || value === "mods") {
    return ROLES.MODERATOR;
  }

  return ROLES.USER;
}

export function getPermissionsForRole(role) {
  return ROLE_PERMISSIONS[normalizeRole(role)] || ROLE_PERMISSIONS[ROLES.USER];
}

export function hasPermission(role, permission) {
  return getPermissionsForRole(role).includes(permission);
}

export function hasAnyPermission(role, permissions = []) {
  return permissions.some((permission) => hasPermission(role, permission));
}

export function canAccessAdmin(role) {
  return hasPermission(role, PERMISSIONS.VIEW_ADMIN);
}

export const ASSIGNABLE_ROLES = [
  ROLES.USER,
  ROLES.MODERATOR,
  ROLES.ADMIN,
];
