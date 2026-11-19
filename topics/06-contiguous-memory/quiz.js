// ExecOS · Contiguous Memory · 20-question quiz
// Copied verbatim from (the app still runs from these originals):
//   frontend/src/quizQuestions.js lines 56-77
// Format: [question, options, correctIndex, explanation]

export const questionData = {
  "Memory Management": [
    ["What does First Fit choose?", ["First adequate free block in scan order", "Smallest adequate block", "Largest adequate block"], 0, "First Fit stops at the first block large enough."],
    ["What does Best Fit choose?", ["Smallest block that can satisfy the request", "First block regardless of size", "Largest free block"], 0, "Best Fit selects the tightest fitting free region."],
    ["What does Worst Fit choose?", ["Largest block that can satisfy the request", "Smallest fitting block", "Most recently used block"], 0, "Worst Fit places the process in the largest suitable block."],
    ["Where does Next Fit resume searching?", ["After its previous placement", "At the largest block each time", "At the first block every time"], 0, "Next Fit carries its search position forward."],
    ["What is internal fragmentation?", ["Unused space inside an allocated region", "Free memory split into holes", "Memory in a page table"], 0, "Internal fragmentation is slack inside an assigned region."],
    ["What is external fragmentation?", ["Free memory split into separate holes", "Slack inside one allocated partition", "A missing page-table entry"], 0, "Free space exists but is divided into nonadjacent regions."],
    ["Why may a process fail despite enough total free space?", ["No single free block is large enough", "Free blocks are always combined", "The CPU is currently idle"], 0, "A contiguous request needs one fitting region."],
    ["What happens to a block after a partial allocation?", ["Its remaining free size decreases", "Its size doubles", "It becomes a page table"], 0, "The allocation consumes part of that block's free capacity."],
    ["Which policy can wrap its scan to the beginning?", ["Next Fit", "Best Fit", "Worst Fit"], 0, "Next Fit uses a circular scan through the block list."],
    ["What is the input to a contiguous allocation decision?", ["Process size and available block sizes", "Disk head direction", "Page reference recency"], 0, "The allocator compares the requested size with free blocks."],
    ["Does Best Fit always produce the best overall workload result?", ["No; outcomes depend on allocation order and requests", "Yes, for every workload", "Only when there is one block"], 0, "Fit policies trade off differently across workloads."],
    ["What does utilization describe?", ["Fraction of memory currently allocated", "Number of CPU switches", "Disk head distance"], 0, "Utilization compares allocated capacity with total modeled memory."],
    ["What does a failed allocation mean in the simulator?", ["No remaining block satisfies that request", "The process has terminated", "The page table is full"], 0, "Failure occurs when no available block is large enough."],
    ["Which policy selects the first adequate block?", ["First Fit", "Worst Fit", "Optimal"], 0, "First Fit scans in order and uses the first sufficient block."],
    ["What does Next Fit do after reaching the last block?", ["Wraps around to the beginning", "Stops permanently", "Releases all processes"], 0, "Its circular search continues from the start if needed."],
    ["What unit is used to compare a process request to a block?", ["Memory size units", "CPU ticks only", "Directory levels"], 0, "The request and block capacity must use compatible size units."],
    ["Why can Worst Fit leave a large remainder?", ["It starts with the largest suitable free block", "It chooses the smallest hole", "It allocates all free memory"], 0, "The largest block may retain substantial space after a smaller request."],
    ["What is one risk of First Fit on repeated allocations?", ["Early blocks may be split and reused often", "It requires future reference knowledge", "It always visits disk edges"], 0, "Repeated scans can concentrate allocations and fragments near the front."],
    ["What is a free block?", ["A region not currently allocated to a process", "A terminated process's CPU burst", "A page-fault event"], 0, "Free blocks are available memory regions."],
    ["What does the allocation table help inspect?", ["Process placement and fit success", "Only CPU response time", "Only directory path names"], 0, "It records each process's request, selected block, and allocation status."],
  ],
};
