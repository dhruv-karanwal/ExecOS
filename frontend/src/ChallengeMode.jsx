import { useState } from "react";
import { osChallenges } from "./challengeQuestions.js";

export default function ChallengeMode({ progress, onProgress, onOpenSimulator }) {
  const [answers, setAnswers] = useState({});
  const [busyChallenge, setBusyChallenge] = useState("");

  const completed = osChallenges.filter(
    (challenge) => progress[challenge.topic]?.challenge_completed,
  ).length;
  const topicsExplored = osChallenges.filter((challenge) => {
    const record = progress[challenge.topic] || {};
    return record.visualization_visited || record.lesson_visited;
  }).length;
  const quizzesTaken = osChallenges.reduce(
    (total, challenge) => total + (progress[challenge.topic]?.quiz_attempts || 0),
    0,
  );

  async function submit(challenge) {
    const selected = answers[challenge.id]?.selected;
    if (!Number.isInteger(selected) || busyChallenge) return;
    setBusyChallenge(challenge.id);
    try {
      const correct = selected === challenge.answer;
      await onProgress(challenge.topic, correct);
      setAnswers((current) => ({
        ...current,
        [challenge.id]: {
          ...current[challenge.id],
          feedback: correct ? "correct" : "incorrect",
        },
      }));
    } finally {
      setBusyChallenge("");
    }
  }

  return (
    <div className="view-content challenge-mode">
      <section className="challenge-hero">
        <div>
          <span className="eyebrow">EXECOS · SCENARIO PRACTICE</span>
          <h2>OS Challenge Mode</h2>
          <p>Apply OS concepts to short, realistic scenarios. Read the hint, choose an action, and learn from the explanation.</p>
        </div>
        <div className="challenge-progress-summary" aria-label={`${completed} of ${osChallenges.length} challenges completed`}>
          <strong>{completed}<span> / {osChallenges.length}</span></strong>
          <small>CHALLENGES CLEARED</small>
          <div className="challenge-progress-track"><span style={{ width: `${(completed / osChallenges.length) * 100}%` }} /></div>
        </div>
      </section>

      <section className="learning-progress-panel" aria-label="Saved learning progress">
        <header>
          <div><span className="eyebrow">YOUR ACCOUNT · SAVED PROGRESS</span><h3>Learning journey</h3></div>
          <span>{topicsExplored} topics explored · {quizzesTaken} quiz attempts</span>
        </header>
        <div className="learning-progress-grid">
          {osChallenges.map((challenge) => {
            const record = progress[challenge.topic] || {};
            return (
              <article key={challenge.topic}>
                <strong>{challenge.topic}</strong>
                <div>
                  <span className={record.visualization_visited ? "earned" : ""}>VISUALIZER</span>
                  <span className={record.lesson_visited ? "earned" : ""}>LESSON</span>
                  <span className={record.quiz_attempts ? "earned" : ""}>QUIZ {record.quiz_attempts ? `${record.quiz_best_score || 0}/20` : "—"}</span>
                  <span className={record.challenge_completed ? "earned" : ""}>CHALLENGE {record.challenge_completed ? "✓" : "—"}</span>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="challenge-grid" aria-label="Operating system challenges">
        {osChallenges.map((challenge, index) => {
          const record = progress[challenge.topic] || {};
          const answer = answers[challenge.id] || {};
          const isComplete = Boolean(record.challenge_completed);
          const isBusy = busyChallenge === challenge.id;
          return (
            <article className={`challenge-card ${isComplete ? "completed" : ""}`} key={challenge.id}>
              <header className="challenge-card-heading">
                <span className="challenge-index">CHALLENGE {String(index + 1).padStart(2, "0")}</span>
                <span className="challenge-level">{challenge.level}</span>
              </header>
              <span className="challenge-topic">{challenge.topic}</span>
              <h3>{challenge.title}</h3>
              <p className="challenge-scenario">{challenge.scenario}</p>
              <div className="challenge-options" role="group" aria-label={`Answers for ${challenge.title}`}>
                {challenge.options.map((option, optionIndex) => (
                  <button
                    type="button"
                    key={option}
                    className={`${answer.selected === optionIndex ? "selected" : ""} ${answer.feedback && optionIndex === challenge.answer ? "correct" : ""} ${answer.feedback === "incorrect" && answer.selected === optionIndex ? "incorrect" : ""}`}
                    aria-pressed={answer.selected === optionIndex}
                    onClick={() => setAnswers((current) => ({
                      ...current,
                      [challenge.id]: { selected: optionIndex, feedback: "" },
                    }))}
                  >
                    <span>{String.fromCharCode(65 + optionIndex)}</span>{option}
                  </button>
                ))}
              </div>
              <details className="challenge-hint"><summary>Show a hint</summary><p>{challenge.hint}</p></details>
              {answer.feedback && (
                <div className={`challenge-feedback ${answer.feedback}`} role="status">
                  <strong>{answer.feedback === "correct" ? "Correct — concept applied" : "Not quite — try again"}</strong>
                  <p>{challenge.explanation}</p>
                </div>
              )}
              <footer className="challenge-card-footer">
                <span>{record.challenge_attempts || 0} attempts · best {record.challenge_best_score || 0}%</span>
                <button
                  type="button"
                  className="lab-primary"
                  disabled={!Number.isInteger(answer.selected) || isBusy}
                  onClick={() => submit(challenge)}
                >
                  {isBusy ? "Saving…" : isComplete ? "Try again" : "Check answer"}
                </button>
              </footer>
              <button type="button" className="challenge-simulator-link" onClick={() => onOpenSimulator(challenge.topic)}>
                Open {challenge.topic} simulator →
              </button>
            </article>
          );
        })}
      </section>
    </div>
  );
}
