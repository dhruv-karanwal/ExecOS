// ExecOS · Memory Management Techniques · concept lesson, guide and glossary
// Copied verbatim from (the app still runs from these originals):
//   frontend/src/theoryContent.js lines 62-81
//   frontend/src/theoryContent.js lines 267-271
//   frontend/src/theoryContent.js lines 334-341

export const theory = {
  "Memory Management Techniques": {
    overview: "Memory management gives each process an address space, maps its addresses to physical memory, allocates and reclaims storage, and enforces protection. Fixed and variable partitions are contiguous approaches; paging uses fixed-size pages and frames; segmentation uses variable-sized logical regions. Virtual memory extends this model by keeping some pages nonresident until needed.",
    simple: "Memory management gives programs usable address spaces, finds physical storage for their data, translates addresses, and prevents one program from improperly accessing another's memory.",
    analogy: "A library can organize books in fixed-size bins, variable-size shelves, or sections by subject. Each layout makes different tradeoffs in wasted space and lookup. Paging and segmentation are real address-management techniques, but this organizing analogy cannot show hardware protection or translation costs.",
    realWorld: "A modern OS typically gives each process a virtual address space and maps virtual pages to physical frames. Page tables and hardware translation help isolate processes, while demand paging can bring data into memory when it is first needed.",
    recap: ["Partitions allocate regions; paging maps fixed-size pages to frames; segmentation describes logical regions with bounds.", "Paging avoids external fragmentation for physical frames but can waste space within a page and requires mapping metadata.", "Virtual-to-physical translation and protection are central; this lesson's layouts are teaching models."],
    selfCheck: "What two values are combined to form a physical address in paging, and what happens to the offset?",
    selfCheckAnswer: "The frame number and the page offset are combined. The offset is preserved: physical address = frame × page size + offset.",
    objectives: [
      "Compare MFT, MVT, contiguous allocation, paging, and segmentation.",
      "Explain internal and external fragmentation and when compaction can help.",
      "Trace an address through a page table or segment descriptor and identify a fault or bounds error.",
    ],
    terms: ["partition", "page", "frame", "page table", "segment", "virtual address"],
    rules: ["For paging: page = floor(virtual address ÷ page size); offset = virtual address mod page size.", "If page p maps to frame f: physical address = f × page size + offset.", "For segmentation, accept only 0 ≤ offset < segment limit; physical address = base + offset.", "MFT uses fixed partitions; MVT creates variable-sized regions and can leave external holes."],
    example: "In a 1,000-unit MVT region, allocating 220 units leaves a 780-unit hole. Allocating another 350 leaves a 430-unit hole. Releasing the first allocation creates separated free regions; compaction can move the second allocation and combine the holes.",
    steps: ["Choose an allocation model and define its region sizes.", "Place a process or split a virtual address into page/offset or segment/offset.", "Check availability, residency, permissions, and bounds.", "Update mappings and fragmentation when allocating, releasing, paging, or compacting."],
    pitfalls: ["Paging avoids external fragmentation but can still waste space inside the final page and requires mapping metadata.", "Compaction moves allocated regions; it does not increase total memory and can be costly."],
    connections: ["Page replacement decides which resident page to evict when memory frames are full.", "Address translation and TLB lookup are explored in the dedicated Paging & Segmentation lab."],
  },
};

export const visualizationGuide = {
  "Memory Management Techniques": {
    summary: "Compare partitions, contiguous regions, paging, segmentation, and demand-loaded virtual memory side by side.",
    focus: ["How the selected technique divides or assigns memory", "The mapping or bounds check used to translate an address", "Where internal or external fragmentation and page-fault costs arise"],
    scope: "Partition layouts and address mappings are educational models, isolated from host memory.",
  },
};

export const glossary = {
  "Memory Management Techniques": [
    ["partition", "A region of physical memory reserved for one process or allocation."],
    ["page", "A fixed-size unit into which a virtual address space is divided."],
    ["frame", "A fixed-size unit of physical memory that can hold one page."],
    ["page table", "Per-process mapping metadata that records where virtual pages reside and their access permissions."],
    ["segment", "A variable-sized logical region, such as code or stack, described by a base and a limit."],
    ["virtual address", "An address generated by a process and translated by the memory-management hardware."],
  ],
};
