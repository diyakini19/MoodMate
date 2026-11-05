import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AppHeader from "../components/AppHeader";
import "./Login.css";

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, loginWithGoogle } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    if (location.state?.disabled) {
      setError("This account has been disabled by an administrator.");
    }
  }, [location.state]);

  const handleLogin = async (e) => {
    e.preventDefault();

    setError("");

    if (!username || !password) {
      setError("Please enter your username and password.");
      return;
    }

    try {
      setLoading(true);

      await login(username, password);

      const from =
        location.state?.from?.pathname || "/dashboard";

      navigate(from, { replace: true });
    } catch (error) {
      console.error("Login error:", error);

      switch (error.code) {
        case "auth/invalid-credential":
        case "auth/user-not-found":
        case "auth/wrong-password":
          setError("Invalid username or password.");
          break;

        case "username/missing":
          setError("Please enter your username.");
          break;

        case "auth/user-disabled":
          setError("This account has been disabled by an administrator.");
          break;

        case "auth/too-many-requests":
          setError(
            "Too many unsuccessful attempts. Please try again later."
          );
          break;

        default:
          setError(error.message || "Unable to login. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError("");

    try {
      setGoogleLoading(true);
      await loginWithGoogle();

      const from =
        location.state?.from?.pathname || "/dashboard";

      navigate(from, { replace: true });
    } catch (error) {
      console.error("Google login error:", error);

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
          setError(error.message || "Unable to sign in with Google.");
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="login-page app-page">
      <AppHeader
        showBack
        backTo="/"
        showDashboard={false}
      />

      <main className="login-main">

        <div className="login-card">

          <div className="login-header">

            <div className="login-eyebrow">
              ✦ WELCOME BACK
            </div>

            <h1>
              Let's get
              <span> planning.</span>
            </h1>

            <p>
              Login with your username to continue
              planning with MoodMate.
            </p>

          </div>

          {error && (
            <div className="login-error">
              {error}
            </div>
          )}

          <form
            className="login-form"
            onSubmit={handleLogin}
          >

            <div className="login-field">

              <label htmlFor="username">
                USERNAME
              </label>

              <input
                id="username"
                type="text"
                placeholder="your_username"
                value={username}
                onChange={(e) =>
                  setUsername(e.target.value)
                }
                autoComplete="username"
              />

            </div>

            <div className="login-field">

              <label htmlFor="password">
                PASSWORD
              </label>

              <input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                autoComplete="current-password"
              />

            </div>

            <button
              type="submit"
              className="login-submit-btn"
              disabled={loading || googleLoading}
            >

              {loading
                ? "Logging in..."
                : "Login →"}

            </button>

          </form>

          <div className="auth-divider">
            <span>or</span>
          </div>

          <button
            type="button"
            className="google-auth-btn"
            onClick={handleGoogleLogin}
            disabled={loading || googleLoading}
          >
            <span className="google-auth-icon" aria-hidden="true">G</span>
            {googleLoading ? "Connecting to Google..." : "Continue with Google"}
          </button>

          <div className="login-bottom">

            <span>
              New to MoodMate?
            </span>

            <Link to="/signup">
              Create an account
            </Link>

          </div>

        </div>

        <div className="login-decoration">

          <div className="login-glow"></div>

          <div className="login-quote-card">

            <div className="login-quote-icon">
              ✦
            </div>

            <h2>
              Your mood.
              <br />
              Your people.
              <br />
              Your place.
            </h2>

            <p>
              One simple plan for everyone.
            </p>

          </div>

          <div className="login-floating-card login-float-one">
            ✦ Mood matched
          </div>

          <div className="login-floating-card login-float-two">
            ⌖ Smart midpoint
          </div>

          <div className="login-floating-card login-float-three">
            ₹ Within budget
          </div>

        </div>

      </main>

    </div>
  );
}

export default Login;
