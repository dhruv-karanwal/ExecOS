// ExecOS · Deadlocks · Challenge Mode scenario
// Copied verbatim from (the app still runs from these originals):
//   frontend/src/challengeQuestions.js lines 68-78

export const challenge = {
    id: "deadlock-cycle",
    topic: "Deadlock",
    level: "Intermediate",
    title: "Break a resource wait cycle",
    scenario: "P1 holds resource A and waits for B. P2 holds B and waits for A. Neither can proceed. Which deadlock condition is directly visible?",
    options: ["Circular wait", "Paging", "Internal fragmentation"],
    answer: 0,
    hint: "Follow each process's wait to the resource held by the other.",
    explanation: "P1 waits for a resource held by P2, and P2 waits for one held by P1. This forms a cycle (circular wait); together with the other necessary conditions, it can produce deadlock.",
  };
