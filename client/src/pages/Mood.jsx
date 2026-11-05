import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useMergedPlan, usePlan } from "../context/PlanContext";
import AppHeader from "../components/AppHeader";
import MoodQuiz from "../components/MoodQuiz";
import { MOODS } from "../services/moodQuiz";
import "./Mood.css";

const HEADINGS = {
  choose: {
    title: "How are you feeling?",
    text: "Take a quick quiz and we'll work out your mood, or pick it yourself.",
  },
  quiz: {
    title: "Mood quiz",
    text: "Answer honestly. There are no wrong answers.",
  },
  manual: {
    title: "How are you feeling?",
    text: "Tell MoodMate your mood and we'll find experiences that match it.",
  },
};

export default function Mood() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { updatePlan } = usePlan();
  const plan = useMergedPlan();
  const [selectedMood, setSelectedMood] = useState(plan.mood || "");
  const [mode, setMode] = useState(plan.mood ? "manual" : "choose");

  const goToGroup = (mood) => {
    if (!mood) return;

    const nextPlan = {
      ...plan,
      mood,
    };

    updatePlan(nextPlan);
    navigate("/group", {
      state: nextPlan,
    });
  };

  const handleHeaderBack = () => {
    if (mode !== "choose") {
      setMode("choose");
      return;
    }

    navigate(user ? "/dashboard" : "/");
  };

  const heading = HEADINGS[mode];

  return (
    <div className="mood-page app-page">
      <AppHeader onBack={handleHeaderBack} />

      <div className="mood-container app-page-main">
        <div className="mood-header">
          <span className="small-label">STEP 1 OF 4</span>
          <h1>{heading.title}</h1>
          <p>{heading.text}</p>
        </div>

        {mode === "choose" && (
          <div className="mood-choice-grid">
            <button
              type="button"
              className="mood-choice-card is-primary"
              onClick={() => setMode("quiz")}
            >
              <span className="mood-choice-tag">Option A</span>
              <span className="mood-choice-emoji">🧠</span>
              <h3>Take a mood quiz</h3>
              <p>Answer 5 quick questions and we'll work out your mood.</p>
              <span className="mood-choice-cta">Start quiz →</span>
            </button>

            <button
              type="button"
              className="mood-choice-card"
              onClick={() => setMode("manual")}
            >
              <span className="mood-choice-tag">Option B</span>
              <span className="mood-choice-emoji">👆</span>
              <h3>Choose my mood manually</h3>
              <p>I already know how I feel.</p>
              <span className="mood-choice-cta">Pick a mood →</span>
            </button>
          </div>
        )}

        {mode === "quiz" && (
          <MoodQuiz
            onExit={() => setMode("choose")}
            onAccept={goToGroup}
            onPickDifferent={(mood) => {
              setSelectedMood(mood);
              setMode("manual");
            }}
          />
        )}

        {mode === "manual" && (
          <>
            <div className="mood-grid">
              {MOODS.map((mood) => (
                <button
                  key={mood.name}
                  type="button"
                  className={`mood-card ${
                    selectedMood === mood.name ? "selected" : ""
                  }`}
                  onClick={() => setSelectedMood(mood.name)}
                >
                  <span className="mood-emoji">{mood.emoji}</span>

                  <div>
                    <h3>{mood.name}</h3>
                    <p>{mood.text}</p>
                  </div>

                  <span className="check">
                    {selectedMood === mood.name ? "✓" : ""}
                  </span>
                </button>
              ))}
            </div>

            <button
              type="button"
              className="continue-btn"
              disabled={!selectedMood}
              onClick={() => goToGroup(selectedMood)}
            >
              Continue →
            </button>
          </>
        )}
      </div>
    </div>
  );
}
