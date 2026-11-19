// ExecOS · CPU Scheduling · Challenge Mode scenario
// Copied verbatim from (the app still runs from these originals):
//   frontend/src/challengeQuestions.js lines 2-12

export const challenge = {
    id: "cpu-srtf-arrival",
    topic: "CPU Scheduling",
    level: "Beginner",
    title: "Give the short job a turn",
    scenario: "P1 arrives at time 0 with a CPU burst of 5. P2 arrives at time 1 with a burst of 2. Under preemptive SRTF, what should the CPU run after P2 arrives?",
    options: ["Continue P1 because it arrived first", "Preempt P1 and run P2", "Run both processes at the same time"],
    answer: 1,
    hint: "At time 1, compare P1's remaining burst with P2's full burst.",
    explanation: "P1 has 4 time units remaining when P2 arrives; P2 needs only 2. SRTF selects the ready process with the shortest remaining time, so it preempts P1 and runs P2.",
  };
