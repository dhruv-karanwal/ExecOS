// ExecOS · Deadlocks · concept lesson, guide and glossary
// Copied verbatim from (the app still runs from these originals):
//   frontend/src/theoryContent.js lines 102-121
//   frontend/src/theoryContent.js lines 282-286
//   frontend/src/theoryContent.js lines 350-357

export const theory = {
  Deadlock: {
    overview: "A deadlock is a set of processes permanently waiting for resources held by one another. The classic model requires mutual exclusion, hold-and-wait, no preemption, and circular wait. Operating systems can prevent a condition, avoid unsafe allocations, detect deadlocks, or recover after detection.",
    simple: "Deadlock occurs when tasks are stuck waiting on one another in a cycle, so none can make progress without an outside intervention.",
    analogy: "At a narrow intersection, four cars can each hold one space while waiting for the next car to move. The analogy illustrates circular waiting, but real deadlocks involve resource ownership and request rules that must be modeled explicitly.",
    realWorld: "Two threads can deadlock if each holds one lock and waits for the lock held by the other. Consistent lock ordering can prevent that circular wait; systems may also detect some deadlocks and choose a recovery action.",
    recap: ["The four necessary conditions are mutual exclusion, hold-and-wait, no preemption, and circular wait.", "A safe state has a completion order; an unsafe state is not automatically proof of a current deadlock.", "Prevention, avoidance, detection, and recovery are distinct strategies."],
    selfCheck: "If a resource state is unsafe, can you conclude that processes are already deadlocked?",
    selfCheckAnswer: "No. Unsafe means the model cannot establish a safe completion sequence under the assumptions. It does not by itself prove that the current processes are deadlocked.",
    objectives: [
      "Identify the four necessary conditions for deadlock.",
      "Run Banker's safety reasoning using Allocation, Maximum, Need, and Available vectors.",
      "Distinguish an unsafe state from a proven deadlock and explain detection versus avoidance.",
    ],
    terms: ["Allocation", "Maximum", "Need", "Available", "safe sequence", "circular wait"],
    rules: ["Need[i][r] = Maximum[i][r] − Allocation[i][r].", "A process is eligible in the safety check when Need[i] ≤ Work for every resource type.", "On simulated completion, Work = Work + Allocation[i].", "A safe state has at least one ordering in which all processes can finish; unsafe does not by itself prove current deadlock."],
    example: "For each process, Need = Maximum − Allocation. Starting with Work = Available, suppose P1's Need fits Work: P1 can finish and release its Allocation. Add those resources to Work and repeat. If every process can be selected, the recorded order is safe.",
    steps: ["Describe resource instances currently Available and held by each process.", "For Banker’s algorithm, calculate Need and initialize Work from Available.", "Find an unfinished process whose remaining request fits Work.", "Simulate completion by returning its allocation; stop when all finish or no progress is possible."],
    pitfalls: ["An unsafe state means no safe sequence was found; it does not necessarily mean processes are deadlocked now.", "Banker's avoidance needs maximum claims in advance; detection instead evaluates current outstanding requests."],
    connections: ["Lock ordering can prevent circular wait in synchronization code.", "Resource allocation graphs visualize process/resource ownership and wait relationships."],
  },
};

export const visualizationGuide = {
  Deadlock: {
    summary: "Inspect resource claims and allocations to test for a safe completion order or detect a blocked resource cycle.",
    focus: ["Available resources and each process's remaining Need", "Which process can finish and release its allocation", "Why unsafe does not automatically mean a deadlock is already present"],
    scope: "Banker's safety requires declared maximum claims; detection evaluates the model's current requests and allocations.",
  },
};

export const glossary = {
  Deadlock: [
    ["Allocation", "The resources currently held by each process in a resource-allocation model."],
    ["Maximum", "The declared upper bound on the resources a process may request in the Banker's model."],
    ["Need", "The remaining resource claim, calculated as Maximum minus Allocation."],
    ["Available", "The count of resource instances that are free and can be allocated now."],
    ["safe sequence", "An ordering in which each process can finish with available resources plus releases from earlier finishes."],
    ["circular wait", "A cycle of processes where each waits for a resource held by the next process in the cycle."],
  ],
};
