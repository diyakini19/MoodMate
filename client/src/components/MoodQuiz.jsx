import { useState } from "react";
import {
  MOOD_QUIZ_QUESTIONS,
  getMoodInfo,
  scoreMoodQuiz,
} from "../services/moodQuiz";

function MoodQuiz({ onExit, onAccept, onPickDifferent }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});

  const total = MOOD_QUIZ_QUESTIONS.length;
  const finished = step >= total;
  const question = MOOD_QUIZ_QUESTIONS[step];

  const handleAnswer = (optionId) => {
    setAnswers((current) => ({ ...current, [question.id]: optionId }));
    setStep((current) => current + 1);
  };

  const handleBack = () => {
    if (step === 0) {
      onExit();
      return;
    }

    setStep((current) => current - 1);
  };

  if (finished) {
    const result = scoreMoodQuiz(answers);
    const info = getMoodInfo(result.mood);
    const runnerUpInfo = getMoodInfo(result.runnerUp);

    return (
      <section className="quiz-result">
        <span className="quiz-result-emoji">{info?.emoji}</span>
        <span className="small-label">YOUR MOOD</span>
        <h2>Looks like you're feeling {result.mood}</h2>
        {result.reason && (
          <p className="quiz-result-reason">
            Because {result.reason}.
          </p>
        )}
        {runnerUpInfo && (
          <p className="quiz-result-runner">
            You might also be {runnerUpInfo.emoji} {runnerUpInfo.name}.
          </p>
        )}

        <button
          type="button"
          className="continue-btn"
          onClick={() => onAccept(result.mood)}
        >
          Continue with {result.mood} →
        </button>

        <div className="quiz-footer">
          <button type="button" className="mood-link-btn" onClick={handleBack}>
            ← Change my last answer
          </button>
          <button
            type="button"
            className="mood-link-btn"
            onClick={() => onPickDifferent(result.mood)}
          >
            Pick a different mood
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="quiz">
      <div className="quiz-progress">
        <span>
          Question {step + 1} of {total}
        </span>
        <div className="quiz-progress-bar">
          <div style={{ width: `${(step / total) * 100}%` }} />
        </div>
      </div>

      <h2 className="quiz-question">{question.question}</h2>

      <div className="mood-grid">
        {question.options.map((option) => {
          const selected = answers[question.id] === option.id;

          return (
            <button
              key={option.id}
              type="button"
              className={`mood-card quiz-option ${selected ? "selected" : ""}`}
              onClick={() => handleAnswer(option.id)}
            >
              <span className="mood-emoji">{option.emoji}</span>
              <div>
                <h3>{option.label}</h3>
              </div>
              <span className="check">{selected ? "✓" : ""}</span>
            </button>
          );
        })}
      </div>

      <div className="quiz-footer">
        <button type="button" className="mood-link-btn" onClick={handleBack}>
          ← {step === 0 ? "Back to options" : "Previous question"}
        </button>
      </div>
    </section>
  );
}

export default MoodQuiz;
