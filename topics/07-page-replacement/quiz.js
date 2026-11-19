// ExecOS · Page Replacement · 20-question quiz
// Copied verbatim from (the app still runs from these originals):
//   frontend/src/quizQuestions.js lines 100-121
// Format: [question, options, correctIndex, explanation]

export const questionData = {
  "Page Replacement": [
    ["What is a page fault?", ["The referenced page is not currently resident", "The page is already in a frame", "The CPU is idle"], 0, "A nonresident reference requires the OS to bring the page into memory."],
    ["What is a page hit?", ["The referenced page is already resident", "Every frame is empty", "The process has terminated"], 0, "A resident page can serve the reference without a fault."],
    ["What does FIFO evict?", ["The page loaded earliest", "The least recently used page", "The page used farthest in the future"], 0, "FIFO replaces the oldest resident page by load time."],
    ["What does LRU evict?", ["The least recently used page", "The newest page always", "The most frequent page"], 0, "LRU uses the oldest recent access as its victim."],
    ["What does LFU consider?", ["Reference frequency", "Arrival time only", "Disk cylinder distance"], 0, "LFU chooses a page with the lowest observed reference count."],
    ["What does Optimal replace?", ["The page whose next use is farthest in the future", "The oldest loaded page", "The page with the lowest number"], 0, "Optimal uses future references and is a theoretical benchmark."],
    ["What happens in Second Chance when a frame's reference bit is set?", ["The bit is cleared and the frame gets another chance", "The frame is pinned forever", "The page is immediately faulted"], 0, "The clock scan clears a set bit and skips that frame once."],
    ["What is a physical frame?", ["A slot that can hold a resident page", "A process control block", "A disk cylinder"], 0, "Frames are fixed-size slots of physical memory."],
    ["What does the hit ratio measure?", ["Hits divided by all references", "Faults divided by frames", "Processes divided by ticks"], 0, "It is the fraction of references served as hits."],
    ["What does the fault ratio measure?", ["Faults divided by all references", "Hits divided by disk size", "Frames divided by processes"], 0, "It is the fraction of references that fault."],
    ["Why is Optimal not generally implementable online?", ["It requires future reference knowledge", "It requires no memory frames", "It ignores the reference string"], 0, "A real online system cannot know the exact future access sequence."],
    ["What is a reference string?", ["The ordered sequence of page accesses", "A list of process priorities", "A directory tree"], 0, "The sequence drives the page replacement simulation."],
    ["When does an algorithm need to evict a page?", ["A fault occurs and all frames are occupied", "Every time there is a hit", "When the reference string is empty"], 0, "An occupied frame must be freed to load a missing page."],
    ["What does FIFO track?", ["Page load order", "Last-used timestamps only", "Segment limits"], 0, "FIFO identifies which resident page entered memory earliest."],
    ["What does LRU approximate?", ["Recent past use as a predictor of future locality", "Future use exactly", "Process arrival order"], 0, "LRU assumes recently used pages may be used again soon."],
    ["What is Belady's anomaly associated with?", ["FIFO fault count can increase with more frames", "LRU never faults", "Optimal needs no future data"], 0, "FIFO can exhibit this counterintuitive behavior for some reference strings."],
    ["What happens to a resident page on a hit?", ["Its frame remains mapped and hit metrics update", "It is always evicted", "The process terminates"], 0, "A hit uses the existing frame without loading a replacement."],
    ["Why compare policies with the same reference string?", ["To compare replacement choices under identical accesses", "To change the page size", "To avoid counting faults"], 0, "Keeping references and frame count fixed isolates policy behavior."],
    ["What does an eviction event identify?", ["The victim page and reused frame", "A process's response time", "A directory path"], 0, "Eviction traces show which resident page leaves and where the new page goes."],
    ["What does Second Chance combine with FIFO order?", ["A reference bit", "A segment base", "A process priority"], 0, "Second Chance gives referenced pages an extra turn using a bit."],
  ],
};
