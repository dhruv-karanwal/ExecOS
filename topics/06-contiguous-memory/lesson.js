// ExecOS · Contiguous Memory · concept lesson, guide and glossary
// Copied verbatim from (the app still runs from these originals):
//   frontend/src/theoryContent.js lines 42-61
//   frontend/src/theoryContent.js lines 262-266
//   frontend/src/theoryContent.js lines 326-333

export const theory = {
  "Memory Management": {
    overview: "Contiguous memory allocation assigns a process one physically adjacent region. The free-space list changes after every allocation, so placement policy affects whether later processes fit. It is a useful way to understand partitioning and fragmentation, even though general-purpose systems rely heavily on paging and other allocators.",
    simple: "A process requests a region of memory. A contiguous allocator must find one free region large enough, then update the remaining free-space map for later requests.",
    analogy: "Picture cars needing adjacent parking spaces in a row. A request may fail even when the total number of empty spaces is large if no single uninterrupted run is long enough. Real memory allocation includes additional mechanisms, so the parking row is only an illustration of contiguous placement.",
    realWorld: "Operating systems manage memory through virtual address spaces and page-based mappings, while kernels and applications also use specialized allocators. This lab isolates contiguous placement policies to make fragmentation and fit choices easy to observe.",
    recap: ["A contiguous request must fit inside one free block.", "Placement policy changes which block is used and therefore the layout for future requests.", "External fragmentation is separated free space; total free capacity alone does not guarantee a large enough contiguous region."],
    selfCheck: "Why might a request for 200 units fail when the free blocks contain 120 units and 100 units?",
    selfCheckAnswer: "The total is 220 units, but neither free block individually reaches 200. A contiguous request needs one adequate region, not merely enough free space in total.",
    objectives: [
      "Apply First Fit, Best Fit, Worst Fit, and Next Fit to an ordered block list.",
      "Distinguish internal fragmentation from external fragmentation.",
      "Explain why total free memory alone does not determine whether a contiguous request can be satisfied.",
    ],
    terms: ["free block", "partition", "First Fit", "Best Fit", "Worst Fit", "Next Fit"],
    rules: ["A request fits only if one free block has size ≥ requested process size.", "After allocation: remaining block space = previous free space − allocated size.", "First Fit takes the first adequate block; Best Fit the smallest adequate block; Worst Fit the largest adequate block.", "Next Fit resumes at the position after its prior placement and wraps around when needed."],
    example: "For blocks of 100, 500, 200, 300, and 600 units, a 212-unit request fits in the 500, 300, and 600-unit blocks. First Fit takes the 500-unit block; Best Fit takes 300; the remaining layout can change whether later requests succeed.",
    steps: ["Read a process's requested size.", "Search the free blocks using the selected policy and its tie/search order.", "Allocate only if one block can satisfy the request; update its remaining capacity.", "Record placement or failure, then use the updated layout for the next process."],
    pitfalls: ["Internal fragmentation is unused space inside an assigned partition; external fragmentation is free space split across separate holes.", "A fit policy is not universally best: process order and workload sizes determine the outcome."],
    connections: ["MFT/MVT explore fixed versus variable partition layouts in the memory-techniques lesson.", "Paging avoids the need for one contiguous physical region, at the cost of page tables and translation."],
  },
};

export const visualizationGuide = {
  "Memory Management": {
    summary: "See how each allocation policy chooses a free block and changes the space available to later requests.",
    focus: ["The request size and chosen fitting block", "The remaining free space after placement", "Why total free memory may still fail to fit one contiguous request"],
    scope: "This lab models contiguous allocation; it does not represent the host computer's physical memory.",
  },
};

export const glossary = {
  "Memory Management": [
    ["free block", "An available contiguous region that can be considered for a new allocation."],
    ["partition", "A region of memory assigned to a process or managed as an allocation unit."],
    ["First Fit", "Select the first free block, in scan order, that is large enough for the request."],
    ["Best Fit", "Select the smallest free block that can satisfy the request."],
    ["Worst Fit", "Select the largest free block that can satisfy the request."],
    ["Next Fit", "Continue the next search from the position following the previous allocation, wrapping when needed."],
  ],
};
