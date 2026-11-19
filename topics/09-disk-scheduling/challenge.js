// ExecOS · Disk Scheduling · Challenge Mode scenario
// Copied verbatim from (the app still runs from these originals):
//   frontend/src/challengeQuestions.js lines 24-34

export const challenge = {
    id: "disk-look-turn",
    topic: "Disk Scheduling",
    level: "Beginner",
    title: "Choose where LOOK turns",
    scenario: "The disk head is moving upward. There are no more requests after cylinder 120, but the disk ends at cylinder 199. Where does LOOK reverse?",
    options: ["At cylinder 199", "At cylinder 120, the last request in that direction", "At the starting cylinder"],
    answer: 1,
    hint: "LOOK avoids sweeping to an unused physical boundary.",
    explanation: "LOOK reverses at the last pending request in the current direction. SCAN would continue to the physical boundary; LOOK saves that unused travel.",
  };
