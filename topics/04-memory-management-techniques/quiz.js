// ExecOS · Memory Management Techniques · 20-question quiz
// Copied verbatim from (the app still runs from these originals):
//   frontend/src/quizQuestions.js lines 78-99
// Format: [question, options, correctIndex, explanation]

export const questionData = {
  "Memory Management Techniques": [
    ["What does paging map?", ["Virtual pages to physical frames", "Files to directory entries", "Processes to CPU quanta"], 0, "Page tables map virtual pages to physical frames."],
    ["What is characteristic of MFT?", ["Fixed partitions may leave internal fragmentation", "Partitions resize for each process", "It manages disk cylinders"], 0, "A process may not use all of its fixed partition."],
    ["What is characteristic of MVT?", ["Variable-sized regions are allocated to processes", "Every partition is permanently equal", "It replaces CPU scheduling"], 0, "MVT sizes regions according to process requests."],
    ["What can compaction do?", ["Combine separated free holes into one larger region", "Increase total physical memory", "Evict the oldest page"], 0, "Moving allocated regions can consolidate free space."],
    ["What does segmentation use to validate an offset?", ["A segment limit", "A Round Robin quantum", "A disk cylinder count"], 0, "The offset must be less than the segment's limit."],
    ["How is a valid segmented address formed?", ["Segment base plus offset", "Page number plus process ID", "Limit minus frame"], 0, "After bounds checking, add the offset to the base."],
    ["What remains unchanged in paging translation?", ["The address offset", "The virtual page number", "The process name"], 0, "Translation replaces the page number with a frame number."],
    ["What kind of fragmentation does paging avoid?", ["External fragmentation", "All internal waste", "CPU fragmentation"], 0, "Fixed-size frames avoid external holes, though internal waste can remain."],
    ["What is a page fault?", ["A referenced page is not resident in memory", "A process used its quantum", "A segment is always valid"], 0, "A missing resident mapping causes a page fault."],
    ["What does virtual memory allow?", ["A protected address-space view backed by physical memory", "Every process to own all RAM", "Files to skip storage"], 0, "Virtual memory separates each process's addresses from physical placement."],
    ["What is a page frame?", ["A fixed-size unit of physical memory", "A process's directory", "A scheduling policy"], 0, "Physical memory is divided into page-sized frames."],
    ["What is a page?", ["A fixed-size unit of virtual memory", "A disk head movement", "A lock owner"], 0, "A process address space is divided into pages."],
    ["What does a page table entry identify?", ["A frame mapping and its status", "The CPU quantum", "A file's parent directory"], 0, "Entries describe the mapping and whether the page is resident."],
    ["What does the TLB cache?", ["Recent address translations", "Recent disk writes only", "Process quiz scores"], 0, "The TLB caches page-to-frame translations."],
    ["What is internal fragmentation in paging often caused by?", ["Unused space in a partially filled final page", "Separated free external holes", "A disk wrap"], 0, "A process may not fill its last allocated page completely."],
    ["What does an MFT partition represent?", ["A fixed-size memory region", "A page reference", "A disk request"], 0, "MFT divides memory into predefined fixed partitions."],
    ["What does MVT release/coalescing do?", ["Returns a process region and may join adjacent free regions", "Moves the disk head", "Changes a process priority"], 0, "Adjacent free holes can be merged after a region is released."],
    ["Why can segmentation match program structure?", ["Regions can represent code, data, and stack", "Every region has identical fixed size", "It uses future CPU bursts"], 0, "Segments model logical program units with separate bounds."],
    ["Which model needs a page/frame mapping table?", ["Paging", "FCFS scheduling", "Linked file allocation"], 0, "Paging uses page tables to map virtual pages to physical frames."],
    ["What is the purpose of an address-space technique?", ["Organize and translate process memory safely", "Order disk I/O only", "Choose a quiz answer"], 0, "Memory techniques manage process address spaces and their physical mappings."],
  ],
};
