// ExecOS · Paging & Segmentation · 20-question quiz
// Copied verbatim from (the app still runs from these originals):
//   frontend/src/quizQuestions.js lines 188-209
// Format: [question, options, correctIndex, explanation]

export const questionData = {
  "Paging & Segmentation": [
    ["What remains unchanged during paging translation?", ["The page offset", "The page number", "The process ID"], 0, "The frame replaces the page number while the offset is preserved."],
    ["What does a segment limit protect?", ["The valid offset range", "Disk head direction", "CPU quantum"], 0, "Offsets outside the segment limit are invalid."],
    ["What does a missing page-table entry cause?", ["A page fault", "A directory lookup", "A completed process"], 0, "A nonresident page requires fault handling."],
    ["What does a TLB hit avoid?", ["A page-table lookup", "Physical memory", "All permissions"], 0, "A TLB hit supplies a cached translation."],
    ["For page size 1024, what is the offset of address 3456?", ["384", "3", "1024"], 0, "3456 modulo 1024 equals an offset of 384."],
    ["How is a valid segmented physical address calculated?", ["Base plus offset", "Frame times process ID", "Limit minus base"], 0, "After bounds checking, add the offset to the segment base."],
    ["What does TLB stand for?", ["Translation Lookaside Buffer", "Task List Boundary", "Temporary Link Block"], 0, "The TLB caches recently used address translations."],
    ["What is the page number for address 3456 with page size 1024?", ["3", "384", "4"], 0, "The page number is floor(3456 / 1024), which is 3."],
    ["How is the page number calculated?", ["Address divided by page size, rounded down", "Address modulo frame count", "Base plus limit"], 0, "Integer division gives the virtual page number."],
    ["How is the page offset calculated?", ["Address modulo page size", "Address plus frame number", "Limit minus base"], 0, "The remainder after dividing by page size is the offset."],
    ["What happens if a segmented offset equals the limit?", ["The address is invalid", "It maps to the next segment", "It is always physical address zero"], 0, "Valid offsets must be strictly less than the segment limit."],
    ["What does a segment base identify?", ["The start of the segment in physical memory", "The number of page faults", "The disk boundary"], 0, "The base is the physical start address used for translation."],
    ["What does a page table map?", ["Virtual page numbers to physical frame numbers", "Disk requests to CPU bursts", "File names to directories"], 0, "Page-table entries provide the page-to-frame mapping."],
    ["What does a page fault handler generally do?", ["Resolve a nonresident page, possibly loading it into a frame", "Grant a CPU quantum", "Rename a directory"], 0, "The OS brings in the missing page and updates its mapping."],
    ["What is one advantage of paging over contiguous allocation?", ["Pages can map to nonadjacent frames", "It eliminates all memory overhead", "It requires one large free run"], 0, "A process's pages need not occupy contiguous physical frames."],
    ["What is one segmentation advantage?", ["It models logical regions such as code and stack", "Every region must be equal-sized", "It removes all bounds checks"], 0, "Segments correspond to logical program units."],
    ["What does a TLB miss mean?", ["The translation is not cached and lookup continues", "The process has terminated", "The disk is full"], 0, "A miss requires a page-table check, and may still be resident."],
    ["Can a TLB miss occur without a page fault?", ["Yes, if the page is resident in the page table", "No, every miss is a fault", "Only when no process exists"], 0, "A page-table lookup can find a resident mapping after a TLB miss."],
    ["What is the physical address in paging?", ["Frame number times page size plus offset", "Page number plus segment limit", "Arrival time plus burst"], 0, "The frame gives the physical page, and the offset is preserved."],
    ["What should happen when an address exceeds the page table's mapped pages?", ["Report an unmapped page/page fault", "Use the last frame automatically", "Wrap to page zero"], 0, "An absent mapping is not a valid physical translation."],
  ],
};
