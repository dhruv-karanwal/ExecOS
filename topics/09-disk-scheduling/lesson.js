// ExecOS · Disk Scheduling · concept lesson, guide and glossary
// Copied verbatim from (the app still runs from these originals):
//   frontend/src/theoryContent.js lines 22-41
//   frontend/src/theoryContent.js lines 257-261
//   frontend/src/theoryContent.js lines 318-325

export const theory = {
  "Disk Scheduling": {
    overview: "A disk scheduler chooses which pending block request a mechanical disk services next. For hard disks, moving the head between cylinders costs time, so request order affects seek movement and latency. These algorithms are useful models for mechanical disks; SSDs do not have a moving head and have different constraints.",
    simple: "For a mechanical disk, requests may be waiting at different cylinder locations. The scheduler chooses the next location so the drive can service requests while managing movement and fairness.",
    analogy: "Think of an elevator serving people on different floors. FCFS honors request order, while SCAN moves in one direction and then reverses. Unlike an elevator, a disk head moves across tracks, and the simulator's cylinder distance is only a simplified cost model.",
    realWorld: "A traditional hard drive may have several pending reads and writes. Request ordering can reduce head movement, but modern storage stacks also consider deadlines, device behavior, and fairness; SSDs have no mechanical seek head.",
    recap: ["Movement between cylinders is the absolute distance between positions.", "SCAN travels to a disk boundary; LOOK reverses at the last request in that direction.", "Lower modeled movement is not the same as a complete real-world latency or fairness guarantee."],
    selfCheck: "If there are no pending requests near the physical disk edge, where does LOOK turn compared with SCAN?",
    selfCheckAnswer: "LOOK turns at the last pending request in its current direction. SCAN continues to the physical boundary before reversing.",
    objectives: [
      "Trace the head position and compute movement for each request and boundary trip.",
      "Explain the fairness and seek tradeoffs of FCFS, SSTF, SCAN, C-SCAN, LOOK, and C-LOOK.",
      "Separate request service from a sweep to an edge or a circular wrap.",
    ],
    terms: ["seek", "cylinder", "request queue", "sweep", "starvation", "wrap"],
    rules: ["Movement for one step = |next cylinder − current cylinder|.", "Total head movement = sum of every recorded movement.", "For a disk with N cylinders, valid cylinder numbers are 0 through N−1.", "FCFS preserves order; SSTF chooses the closest current request; sweep policies follow their direction and boundary rules."],
    example: "If the head is at 50 and requests are 10, 20, 70, and 82, SSTF serves 70 first (20 cylinders away), then 82, 20, and 10. An upward LOOK sweep serves 70 and 82, turns at 82, then services 20 and 10 without visiting cylinder 99.",
    steps: ["Validate the current head and every request against disk bounds.", "Apply the policy to select a request or determine the next sweep boundary.", "Record each movement, including boundary travel or wrap if the policy requires it.", "Sum absolute movement and count only actual requests as serviced."],
    pitfalls: ["SCAN reaches the physical edge; LOOK turns at the last request. C-SCAN wraps at disk edges; C-LOOK wraps between request extremes.", "Total head movement includes travel but is not a complete real-world latency model; rotation and controller queues are omitted."],
    connections: ["I/O completion can wake a WAITING process and return it to READY.", "Device drivers and storage firmware may further reorder or merge requests."],
  },
};

export const visualizationGuide = {
  "Disk Scheduling": {
    summary: "Track the disk head as it selects requests, changes direction, and accumulates modeled seek movement.",
    focus: ["The current head and the next request chosen", "Boundary travel for SCAN versus turning at a request for LOOK", "The total movement, including modeled circular wrap distance"],
    scope: "Cylinder movement is a teaching model for mechanical disks, not a complete latency model or SSD scheduler.",
  },
};

export const glossary = {
  "Disk Scheduling": [
    ["seek", "Movement of a mechanical disk's read/write head to a requested track or cylinder."],
    ["cylinder", "The set of tracks at the same radius across a disk's recording surfaces; labs use it as a position number."],
    ["request queue", "Pending disk I/O requests waiting to be selected for service."],
    ["sweep", "A directional pass across disk positions used by SCAN-like scheduling policies."],
    ["starvation", "A request can wait for an unbounded time when the policy repeatedly selects other requests."],
    ["wrap", "The modeled travel from one end of the disk range to the other in a circular sweep policy."],
  ],
};
