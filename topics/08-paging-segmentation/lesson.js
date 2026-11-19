// ExecOS · Paging & Segmentation · concept lesson, guide and glossary
// Copied verbatim from (the app still runs from these originals):
//   frontend/src/theoryContent.js lines 162-181
//   frontend/src/theoryContent.js lines 277-281
//   frontend/src/theoryContent.js lines 374-381

export const theory = {
  "Paging & Segmentation": {
    overview: "Address translation converts a process-visible logical or virtual address into a physical address. Paging uses fixed-size pages and frames; segmentation uses logical regions with a base and bound. A translation lookaside buffer (TLB) caches recent page-table results to avoid repeated memory lookups.",
    simple: "Programs use addresses in their own address spaces. The system translates those addresses to physical memory and checks that the requested location is valid and permitted.",
    analogy: "A mailroom can translate a room label into a shelf location: paging uses numbered equal-size bins, while segmentation uses named sections with a start and permitted length. This illustrates translation and bounds but not the speed and protection behavior of real hardware.",
    realWorld: "A processor's memory-management hardware checks a TLB for a cached translation and consults page-table information on a miss. A TLB miss can still find a resident page; a page fault occurs when the mapping or required page is not available as expected.",
    recap: ["Paging splits an address into page number and offset; the page table maps the page to a frame.", "Segmentation checks that the offset is within the segment limit before adding the base.", "A TLB miss is a cache miss for translation, not automatically a page fault."],
    selfCheck: "The TLB misses, but the page table says the page is resident. Is this a page fault?",
    selfCheckAnswer: "No. The OS or hardware can obtain the resident page's mapping from the page table and update the TLB. A TLB miss alone only means the translation was not cached.",
    objectives: [
      "Split a virtual address into page number and offset and calculate a physical address.",
      "Check segment bounds before adding an offset to a segment base.",
      "Distinguish a TLB hit, TLB miss with a resident page, and a page fault.",
    ],
    terms: ["virtual address", "page number", "offset", "frame", "segment base", "TLB"],
    rules: ["Paging: page = floor(address ÷ page size); offset = address mod page size.", "Paging: physical address = frame × page size + offset; the offset is unchanged.", "Segmentation: require offset < limit, then physical address = base + offset.", "A TLB miss triggers a page-table lookup; only a nonresident/invalid mapping faults."],
    example: "With page size 1024, virtual address 3456 is page 3, offset 384. If page 3 maps to frame 4, the physical address is 4 × 1024 + 384 = 4480. For a segment with base 8000 and limit 900, offset 899 is valid but offset 900 is out of bounds.",
    steps: ["For paging, divide by page size to get page and remainder offset.", "Check the TLB; on a miss, consult the page table.", "If the page is absent, raise a page fault; otherwise combine frame and unchanged offset.", "For segmentation, validate offset < limit and calculate base + offset."],
    pitfalls: ["A TLB miss only means the translation was not cached; the page may still be resident.", "Paging reduces external fragmentation but has page-table overhead; segmentation matches logical regions but can fragment physical memory."],
    connections: ["Page replacement handles a fault when a required page must be loaded into a full set of frames.", "Memory protection checks permissions as well as whether an address is mapped and in bounds."],
  },
};

export const visualizationGuide = {
  "Paging & Segmentation": {
    summary: "Trace an address through paging or segmentation, and distinguish a TLB miss from a page fault.",
    focus: ["The page/offset or segment/offset split", "The page-table or segment-descriptor lookup and bounds check", "The physical address, or the reason translation fails"],
    scope: "The configured tables, TLB, and frame contents are small teaching examples, not live hardware mappings.",
  },
};

export const glossary = {
  "Paging & Segmentation": [
    ["virtual address", "The process-visible address that must be translated before physical memory access."],
    ["page number", "The high-order part of a paged address used to index the page table."],
    ["offset", "The position within a page or segment; paging preserves it during translation."],
    ["frame", "A physical-memory slot of the same size as a virtual-memory page."],
    ["segment base", "The starting physical address recorded for a segment."],
    ["TLB", "A small cache of recent virtual-page-to-physical-frame translations."],
  ],
};
