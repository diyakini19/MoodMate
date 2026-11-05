import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AppHeader from "../components/AppHeader";
import "./Signup.css";

function Signup() {
  const { signup, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");

    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }

    if (!username.trim()) {
      setError("Please enter a username.");
      return;
    }

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    try {
      setLoading(true);
      await signup(name, username, password);
      navigate("/dashboard");
    } catch (error) {
      console.error("Signup error:", error);

      if (
        error.code === "auth/email-already-in-use" ||
        error.code === "username/taken"
      ) {
        setError("That username is already taken.");
      } else if (error.code === "username/invalid") {
        setError(
          "Username must be 3–24 characters: letters, numbers, underscore."
        );
      } else if (error.code === "auth/weak-password") {
        setError("Password is too weak. Use at least 6 characters.");
      } else {
        setError(error.message || "Unable to create account. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    setError("");

    try {
      setGoogleLoading(true);
      await loginWithGoogle();
      navigate("/dashboard");
    } catch (error) {
      console.error("Google signup error:", error);

      switch (error.code) {
        case "auth/popup-closed-by-user":
          setError("Google sign-in was cancelled.");
          break;
        case "auth/popup-blocked":
          setError("Pop-up blocked. Allow pop-ups for this site and try again.");
          break;
        case "auth/unauthorized-domain":
          setError(
            "This domain is not authorized in Firebase. Add localhost in Authentication → Settings."
          );
          break;
        case "auth/operation-not-allowed":
          setError(
            "Google sign-in is not enabled. Turn it on in Firebase Authentication → Sign-in method."
          );
          break;
        case "auth/user-disabled":
          setError("This account has been disabled by an administrator.");
          break;
        default:
          setError(error.message || "Unable to sign up with Google.");
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="auth-page app-page">
      <AppHeader
        backTo="/"
        showDashboard={false}
      />

      <div className="auth-card">

        <div className="auth-header">
          <span className="auth-label">
            JOIN MOODMATE
          </span>

          <h1>
            Create your account.
          </h1>

          <p>
            Pick a username and start planning with friends.
          </p>
        </div>

        {error && (
          <div className="auth-error">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>

          <div className="form-group">
            <label htmlFor="name">Name</label>
            <input
              id="name"
              type="text"
              placeholder="Enter your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading || googleLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              placeholder="e.g. diya_24"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading || googleLoading}
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading || googleLoading}
              autoComplete="new-password"
            />
          </div>

          <button
            type="submit"
            className="auth-submit"
            disabled={loading || googleLoading}
          >
            {loading
              ? "Creating account..."
              : "Create Account →"}
          </button>

        </form>

        <div className="auth-divider">
          <span>or</span>
        </div>

        <button
          type="button"
          className="google-auth-btn"
          onClick={handleGoogleSignup}
          disabled={loading || googleLoading}
        >
          <span className="google-auth-icon" aria-hidden="true">G</span>
          {googleLoading ? "Connecting to Google..." : "Continue with Google"}
        </button>

        <div className="auth-footer">
          <span>Already have an account?</span>
          <Link to="/login">Login</Link>
        </div>

      </div>

    </div>
  );
}

export default Signup;
