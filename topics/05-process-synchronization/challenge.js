// ExecOS · Process Synchronization · Challenge Mode scenario
// Copied verbatim from (the app still runs from these originals):
//   frontend/src/challengeQuestions.js lines 13-23

export const challenge = {
    id: "sync-critical-section",
    topic: "Process Synchronization",
    level: "Beginner",
    title: "Protect a shared counter",
    scenario: "Two threads both increment the same counter. Which part should a mutex protect to prevent a lost update?",
    options: ["Only the final write", "The whole read-modify-write operation", "Nothing; integer increments cannot interleave"],
    answer: 1,
    hint: "The operation includes reading the old value, calculating the new value, and storing it.",
    explanation: "A counter increment is a read-modify-write sequence. If both threads read the same old value before either writes, one increment is lost. The mutex must protect the complete sequence.",
  };
