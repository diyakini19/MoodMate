import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AppHeader from "../components/AppHeader";
import "./Home.css";

function Home() {
  const { user } = useAuth();

  return (
    <div className="home">
      {user ? (
        <AppHeader showBack={false} />
      ) : (
        <nav className="navbar">
          <Link to="/" className="logo">
            Mood<span>Mate</span>
          </Link>

          <div className="nav-links">
            <a href="#how-it-works">How it works</a>
            <a href="#features">Features</a>

            <Link to="/login" className="login-link">
              Login
            </Link>

            <Link to="/signup" className="signup-btn">
              Get Started
            </Link>
          </div>
        </nav>
      )}

      <section className="hero">
        <div className="hero-content">
          <div className="eyebrow">PLAN AROUND YOUR MOOD</div>

          <h1>
            Meet in the middle.
            <span>Feel it first.</span>
          </h1>

          <p>
            MoodMate helps friends pick a vibe, find a fair midpoint, and land
            on places everyone will actually enjoy.
          </p>

          <div className="hero-buttons">
            <Link
              to={user ? "/dashboard" : "/signup"}
              className="primary-btn"
            >
              {user ? "Go to Dashboard →" : "Start planning →"}
            </Link>

            <a href="#how-it-works" className="secondary-btn">
              See how it works
            </a>
          </div>

          <div className="trust-row">
            <div>
              <strong>Mood first</strong>
              <small>Match the vibe</small>
            </div>
            <div>
              <strong>Fair midpoint</strong>
              <small>Travel that balances</small>
            </div>
            <div>
              <strong>Budget aware</strong>
              <small>Stay in range</small>
            </div>
          </div>
        </div>

        <div className="hero-visual">
          <div className="glow" />

          <div className="main-card">
            <div className="card-top">
              <span>Tonight's plan</span>
              <span className="live-dot">● Live</span>
            </div>

            <div className="mood-emoji">😊</div>

            <h3>Happy hangout</h3>
            <p>Café near your group's midpoint</p>

            <div className="mini-location">
              <span>⌖</span>
              <div>
                <strong>Midpoint ready</strong>
                <small>Balanced for everyone</small>
              </div>
            </div>
          </div>

          <div className="floating-card card-one">✦ Mood matched</div>
          <div className="floating-card card-two">
            ⌖ Smart midpoint <span>ready</span>
          </div>
          <div className="floating-card card-three">
            ₹ Within budget <span>per person</span>
          </div>
        </div>
      </section>

      <section className="how-section" id="how-it-works">
        <div className="section-label">HOW IT WORKS</div>
        <h2>Four steps to a better meet-up.</h2>

        <div className="steps" id="features">
          <div className="step">
            <div className="step-number">01</div>
            <h3>Pick your mood</h3>
            <p>
              Start with how everyone feels so the plan fits the energy of the
              night.
            </p>
          </div>

          <div className="step">
            <div className="step-number">02</div>
            <h3>Add your people</h3>
            <p>
              Share starting points and travel preferences so MoodMate can find
              a fair meeting spot.
            </p>
          </div>

          <div className="step">
            <div className="step-number">03</div>
            <h3>Get recommendations</h3>
            <p>
              Browse places around your midpoint that match budget, vibes, and
              transport.
            </p>
          </div>
        </div>
      </section>

      <section className="cta-section">
        <div>
          <div className="section-label">READY WHEN YOU ARE</div>
          <h2>Turn a vague “let’s hang” into a real plan.</h2>
        </div>

        <Link
          to={user ? "/dashboard" : "/signup"}
          className="primary-btn"
        >
          {user ? "Open Dashboard →" : "Create free account →"}
        </Link>
      </section>

      <footer>
        <Link to="/" className="logo">
          Mood<span>Mate</span>
        </Link>
        <p>Plan with mood, place, and people in mind.</p>
      </footer>
    </div>
  );
}

export default Home;
