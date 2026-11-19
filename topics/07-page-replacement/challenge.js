// ExecOS · Page Replacement · Challenge Mode scenario
// Copied verbatim from (the app still runs from these originals):
//   frontend/src/challengeQuestions.js lines 57-67

export const challenge = {
    id: "page-replacement-fifo",
    topic: "Page Replacement",
    level: "Intermediate",
    title: "Select the FIFO victim",
    scenario: "There are two frames. References arrive in this order: 1, 2, 1, 3. FIFO must replace a page on the final reference. Which page leaves?",
    options: ["Page 1, because it was loaded first", "Page 2, because it was used less recently", "Page 3, because it is the new reference"],
    answer: 0,
    hint: "FIFO uses load order; the hit on page 1 does not change its arrival order.",
    explanation: "Page 1 was loaded before page 2. The later reference to page 1 is a hit but does not refresh FIFO order, so page 1 is the oldest loaded page and is evicted.",
  };
