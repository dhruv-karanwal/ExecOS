// ExecOS · Disk Scheduling · 20-question quiz
// Copied verbatim from (the app still runs from these originals):
//   frontend/src/quizQuestions.js lines 34-55
// Format: [question, options, correctIndex, explanation]

export const questionData = {
  "Disk Scheduling": [
    ["What does disk scheduling order?", ["Pending disk-head requests", "CPU process priorities", "Memory page-table entries"], 0, "Disk scheduling chooses the order for servicing I/O requests."],
    ["How does FCFS order disk requests?", ["Original request arrival order", "Nearest cylinder first", "Largest request first"], 0, "FCFS preserves the queue's arrival order."],
    ["What does SSTF select next?", ["The nearest pending cylinder", "The oldest process", "The highest page number"], 0, "SSTF minimizes the next head movement."],
    ["Why can SSTF be unfair?", ["Far requests may wait while nearby ones are chosen", "It never checks head position", "It always visits disk edges"], 0, "Repeated nearby requests can postpone a distant request."],
    ["Where does SCAN travel before reversing?", ["To the disk boundary", "Only to the last request", "Back to the start after each request"], 0, "SCAN sweeps to the physical end before reversing direction."],
    ["Where does LOOK reverse direction?", ["At the last pending request in that direction", "At the disk boundary every time", "At the initial head position"], 0, "LOOK avoids unnecessary travel to an unused boundary."],
    ["What does C-SCAN do after its sweep?", ["Wraps to the opposite disk edge", "Reverses at every request", "Stops servicing all requests"], 0, "C-SCAN returns to the opposite end and continues one-way service."],
    ["What does C-LOOK wrap between?", ["The extreme pending requests", "The disk's physical boundaries", "The first and last processes"], 0, "C-LOOK wraps between request extremes rather than disk edges."],
    ["How is seek distance for a head move calculated?", ["Absolute difference between cylinder numbers", "Sum of queued cylinders", "Number of completed requests"], 0, "Movement from a to b is the absolute distance |a − b|."],
    ["What is the initial head position used for?", ["Starting point for movement calculations", "The disk capacity", "The number of requests"], 0, "Every algorithm begins measuring movement from the current head."],
    ["What does disk size constrain?", ["Valid cylinder numbers", "CPU burst lengths", "Page-table width"], 0, "Requests must fall within the disk's cylinder range."],
    ["Which policies use a sweep direction?", ["SCAN and LOOK family", "FCFS only", "SJF and SRTF"], 0, "SCAN, C-SCAN, LOOK, and C-LOOK use a selected direction."],
    ["What is the main benefit of LOOK over SCAN?", ["It avoids traveling to an unused disk edge", "It never moves the head", "It ignores pending requests"], 0, "LOOK turns at the last request rather than the physical boundary."],
    ["Does a C-SCAN wrap service requests during the jump?", ["No, the wrap itself services none", "Yes, every cylinder is serviced", "Only the first request is serviced"], 0, "The wrap is head travel, not a request-service step."],
    ["What is total seek movement?", ["Sum of all head-move distances", "Largest request multiplied by queue length", "Number of requests minus head position"], 0, "Total movement sums the distances for every transition."],
    ["Which algorithm may favor nearby requests repeatedly?", ["SSTF", "FCFS", "C-SCAN"], 0, "SSTF selects the closest request to the current head."],
    ["If a request equals the current head cylinder, its movement is...", ["Zero cylinders", "One full disk", "The disk capacity"], 0, "The head is already at the requested cylinder."],
    ["What is a disk cylinder in this teaching model?", ["A position the head can seek to", "A process state", "A memory partition"], 0, "Cylinder numbers represent positions in the simulated disk."],
    ["What happens when a sweep has no requests on one side?", ["The policy follows its defined edge or wrap rule", "The request queue is fabricated", "All requests are dropped"], 0, "SCAN-family behavior follows the selected policy's boundary rules."],
    ["Why can SSD scheduling differ from this head model?", ["SSDs have no mechanical seek head", "SSDs have no storage blocks", "SSDs run CPU scheduling"], 0, "An SSD has no moving head, so seek-distance assumptions do not apply."],
  ],
};
