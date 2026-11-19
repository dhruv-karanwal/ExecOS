// ExecOS · Memory Management Techniques · Challenge Mode scenario
// Copied verbatim from (the app still runs from these originals):
//   frontend/src/challengeQuestions.js lines 46-56

export const challenge = {
    id: "paging-translation",
    topic: "Memory Management Techniques",
    level: "Intermediate",
    title: "Translate a paged address",
    scenario: "A page is 1,024 bytes. Virtual address 2,500 maps through page 2 to frame 5. What physical address results?",
    options: ["5,572", "5,500", "2,500"],
    answer: 0,
    hint: "Split the virtual address into page number and remainder offset, then keep the offset.",
    explanation: "2,500 = page 2 with offset 452. Frame 5 starts at 5 × 1,024 = 5,120. Add the unchanged offset: 5,120 + 452 = 5,572.",
  };
