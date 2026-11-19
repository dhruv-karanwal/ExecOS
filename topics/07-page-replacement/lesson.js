// ExecOS · Page Replacement · concept lesson, guide and glossary
// Copied verbatim from (the app still runs from these originals):
//   frontend/src/theoryContent.js lines 82-101
//   frontend/src/theoryContent.js lines 272-276
//   frontend/src/theoryContent.js lines 342-349

export const theory = {
  "Page Replacement": {
    overview: "Page replacement is needed when a process references a nonresident page and no free physical frame remains. The OS selects a victim, writes it back if necessary, loads the requested page, and updates mappings. A policy influences fault frequency, but real performance also depends on locality, storage speed, dirty pages, and working-set size.",
    simple: "When memory has no free frame and a program needs a page that is not resident, the OS must choose a page to remove so the requested one can be loaded.",
    analogy: "Imagine a small desk with limited space for open books. When a new book is needed, you choose one to put away. FIFO removes the one brought out earliest; LRU removes the one unused longest. A computer's page-in and page-out costs, dirty data, and access patterns make the real decision more complex.",
    realWorld: "With virtual memory, a page fault can cause the OS to retrieve data from storage. If memory pressure requires eviction, the OS's replacement and reclaim policies work with hardware state and workload behavior; Optimal is only a comparison benchmark because it assumes future knowledge.",
    recap: ["A hit means the page is already resident; a fault means it is not.", "Replacement is necessary only when a fault occurs and no free frame is available.", "FIFO, LRU, and Optimal use different information; Optimal cannot be implemented as an ordinary online policy."],
    selfCheck: "A referenced page is absent, but a free frame exists. Must the OS evict another page?",
    selfCheckAnswer: "No. It can load the missing page into the free frame. Replacement is needed only when there is no free frame available.",
    objectives: [
      "Trace FIFO, LRU, Optimal, LFU, and Second Chance frame-by-frame.",
      "Classify each reference as a hit or fault and identify any evicted page.",
      "Compare fault count, hit ratio, and the assumptions each policy makes.",
    ],
    terms: ["page fault", "frame", "locality", "victim page", "reference bit", "working set"],
    rules: ["A hit occurs when the referenced page is resident; otherwise the reference faults.", "On a fault, use a free frame if available; replace a resident page only when all frames are occupied.", "Hit ratio = hits ÷ number of references; fault ratio = faults ÷ number of references.", "FIFO uses load order; LRU uses last-use order; LFU uses frequency; Optimal uses future references."],
    example: "With three empty frames and references 1, 2, 3, 1, 4, 2, 1, the fourth reference to 1 is a hit. On 4, FIFO evicts 1 (oldest loaded), LRU evicts 2 (least recently used), and Optimal evicts 3 (not referenced again).",
    steps: ["Read the next page reference and check whether it is resident.", "On a hit, update the policy's access metadata.", "On a fault, use a free frame or choose a victim according to the policy.", "Load the page, update counters and mappings, and record the full decision."],
    pitfalls: ["Optimal requires future knowledge, so it is a lower-bound benchmark, not an implementable online policy.", "FIFO can exhibit Belady's anomaly; increasing frame count does not guarantee fewer FIFO faults for every reference string."],
    connections: ["The TLB caches address translations; a TLB miss is not automatically a page fault.", "Demand paging connects virtual-memory address translation with storage I/O and process blocking."],
  },
};

export const visualizationGuide = {
  "Page Replacement": {
    summary: "Step through page references to see hits, faults, frame contents, and the victim selected by each policy.",
    focus: ["Whether the next reference is resident", "Which frame is replaced and why", "How cumulative faults and hits change across the same reference string"],
    scope: "Optimal uses future references as an offline benchmark; real operating systems cannot know the future.",
  },
};

export const glossary = {
  "Page Replacement": [
    ["page fault", "An exception raised when a process references a page that is not currently mapped as resident."],
    ["frame", "A fixed-size physical-memory slot that holds a resident page."],
    ["locality", "The tendency of a program to reuse recently accessed data or access nearby addresses."],
    ["victim page", "A resident page selected for eviction to make room for a different page."],
    ["reference bit", "A hardware- or software-maintained indicator that a page has been accessed recently."],
    ["working set", "The pages a process is actively using over a chosen recent interval."],
  ],
};
