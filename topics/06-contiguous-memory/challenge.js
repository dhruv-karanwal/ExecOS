// ExecOS · Contiguous Memory · Challenge Mode scenario
// Copied verbatim from (the app still runs from these originals):
//   frontend/src/challengeQuestions.js lines 35-45

export const challenge = {
    id: "contiguous-fragmentation",
    topic: "Memory Management",
    level: "Beginner",
    title: "Spot external fragmentation",
    scenario: "Free memory is split into blocks of 120 and 100 units. A process requests one contiguous 200-unit region. What happens?",
    options: ["It fits because total free memory is 220", "It cannot fit in either individual block", "It automatically combines the blocks without moving data"],
    answer: 1,
    hint: "A contiguous request must fit in one free block, not in the sum of separate blocks.",
    explanation: "Neither block is at least 200 units, so the contiguous request fails even though total free space is 220. The separated holes demonstrate external fragmentation.",
  };
