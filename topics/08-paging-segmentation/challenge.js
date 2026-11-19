// ExecOS · Paging & Segmentation · Challenge Mode scenario
// Copied verbatim from (the app still runs from these originals):
//   frontend/src/challengeQuestions.js lines 90-100

export const challenge = {
    id: "tlb-miss",
    topic: "Paging & Segmentation",
    level: "Intermediate",
    title: "Distinguish a TLB miss",
    scenario: "The TLB has no cached entry for a virtual page, but the page table says the page is resident in frame 7. What should happen?",
    options: ["A page fault must occur", "Use the page-table mapping and refill the TLB", "Terminate the process because its address is invalid"],
    answer: 1,
    hint: "A TLB is a cache of translations; check the page table after a cache miss.",
    explanation: "A TLB miss means only that the translation was not cached. Because the page-table entry is resident and valid, the mapping can be used and cached; there is no page fault.",
  };
