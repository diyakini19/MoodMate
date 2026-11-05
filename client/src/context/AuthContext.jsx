import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  updateProfile,
  getAdditionalUserInfo,
} from "firebase/auth";

import { auth } from "../services/firebase";
import { logAuditEvent } from "../services/auditService";
import {
  createUserDocument,
  ensureUserProfile,
  resolveLoginIdentifier,
} from "../services/userService";
import {
  isValidUsername,
  normalizeUsername,
  usernameToAuthEmail,
} from "../services/usernameAuth";
import {
  ROLES,
  canAccessAdmin,
  getPermissionsForRole,
  hasPermission,
  normalizeRole,
} from "../rbac/roles";

const AuthContext = createContext();
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: "select_account",
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);

      if (!currentUser) {
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      try {
        const userProfile = await ensureUserProfile(currentUser);
        setUser(currentUser);
        setProfile(userProfile);
      } catch (error) {
        console.error("Unable to load user profile:", error);
        setUser(currentUser);
        setProfile({
          uid: currentUser.uid,
          email: currentUser.email || "",
          username: "",
          name: currentUser.displayName || "",
          role: ROLES.USER,
          status: "active",
          planCount: 0,
        });
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const signup = async (name, username, password) => {
    const normalized = normalizeUsername(username);

    if (!isValidUsername(normalized)) {
      const error = new Error(
        "Username must be 3–24 characters: letters, numbers, underscore."
      );
      error.code = "username/invalid";
      throw error;
    }

    const authEmail = usernameToAuthEmail(normalized);

    const result = await createUserWithEmailAndPassword(
      auth,
      authEmail,
      password
    );

    await updateProfile(result.user, {
      displayName: name,
    });

    await createUserDocument(result.user, name, normalized);
    const userProfile = await ensureUserProfile(result.user);

    await logAuditEvent(result.user, "signup", {
      method: "password",
      username: userProfile?.username || normalized,
    });

    setUser(result.user);
    setProfile(userProfile);
  };

  const login = async (identifier, password) => {
    const resolved = await resolveLoginIdentifier(identifier);
    const result = await signInWithEmailAndPassword(
      auth,
      resolved.email,
      password
    );
    const userProfile = await ensureUserProfile(result.user);
    const auditExtra = {
      method: "password",
      username: userProfile?.username || resolved.username,
    };

    if (userProfile?.status === "disabled") {
      await logAuditEvent(result.user, "login_blocked", auditExtra);
      await signOut(auth);
      const disabledError = new Error("This account has been disabled.");
      disabledError.code = "auth/user-disabled";
      throw disabledError;
    }

    await logAuditEvent(result.user, "login", auditExtra);

    setUser(result.user);
    setProfile(userProfile);
    return result;
  };

  const loginWithGoogle = async () => {
    const result = await signInWithPopup(auth, googleProvider);
    const userProfile = await ensureUserProfile(result.user);
    const auditExtra = {
      method: "google",
      username: userProfile?.username || "",
    };

    if (userProfile?.status === "disabled") {
      await logAuditEvent(result.user, "login_blocked", auditExtra);
      await signOut(auth);
      const disabledError = new Error("This account has been disabled.");
      disabledError.code = "auth/user-disabled";
      throw disabledError;
    }

    const isNewUser = getAdditionalUserInfo(result)?.isNewUser;
    await logAuditEvent(result.user, isNewUser ? "signup" : "login", auditExtra);

    setUser(result.user);
    setProfile(userProfile);
    return result;
  };

  const logout = async () => {
    await logAuditEvent(auth.currentUser, "logout", {
      username: profile?.username || "",
    });
    await signOut(auth);
    setUser(null);
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (!user) {
      return null;
    }

    const userProfile = await ensureUserProfile(user);
    setProfile(userProfile);
    return userProfile;
  };

  const role = normalizeRole(profile?.role);
  const permissions = useMemo(
    () => getPermissionsForRole(role),
    [role]
  );

  const value = {
    user,
    profile,
    role,
    permissions,
    loading,
    signup,
    login,
    loginWithGoogle,
    logout,
    refreshProfile,
    isAdmin: role === ROLES.ADMIN,
    isModerator: role === ROLES.MODERATOR || role === ROLES.ADMIN,
    canAccessAdmin: canAccessAdmin(role),
    can: (permission) => hasPermission(role, permission),
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
