// ExecOS · Process Synchronization · concept lesson, guide and glossary
// Copied verbatim from (the app still runs from these originals):
//   frontend/src/theoryContent.js lines 142-161
//   frontend/src/theoryContent.js lines 252-256
//   frontend/src/theoryContent.js lines 366-373

export const theory = {
  "Process Synchronization": {
    overview: "Synchronization coordinates concurrent processes or threads that access shared data. Because instruction execution can interleave, an unprotected update may lose data or expose an inconsistent intermediate value. Correct solutions aim for mutual exclusion, progress, and bounded waiting while avoiding deadlock and starvation.",
    simple: "When tasks share data, the OS needs rules that keep their operations from interfering. A lock or semaphore can coordinate access, but the complete solution must also consider progress and fairness.",
    analogy: "A shared notebook has one pen. A mutex is like reserving the pen before writing and returning it afterward, so two people do not overwrite the same entry. Real synchronization must handle blocking, scheduling, and failure cases beyond this analogy.",
    realWorld: "Threads in a service may update a shared queue or counter. A mutex can protect a multi-step update, while semaphores can represent available items or signal that work is ready; careless lock ordering can still cause deadlock.",
    recap: ["A race condition occurs when interleaving affects a shared result.", "Protect the whole critical section needed to preserve the data invariant.", "Mutual exclusion alone does not guarantee progress, bounded waiting, or freedom from deadlock."],
    selfCheck: "Two threads increment a shared counter. Why might protecting only the final write still lose an increment?",
    selfCheckAnswer: "The read, increment, and write form one read-modify-write operation. If threads interleave between the read and write, both may compute from the same old value. The protected critical section must cover the whole operation.",
    objectives: [
      "Explain race conditions, critical sections, mutexes, and semaphore operations.",
      "Trace Producer–Consumer, Readers–Writers, and Dining Philosophers states.",
      "Recognize how lock acquisition order can cause or prevent deadlock.",
    ],
    terms: ["race condition", "critical section", "mutex", "semaphore", "bounded buffer", "starvation"],
    rules: ["A mutex protects an invariant by allowing at most one owner in its critical section.", "For a bounded buffer of capacity C: empty slots + occupied slots = C.", "A counting semaphore tracks permits/resources; wait consumes a permit and signal returns one.", "A correct solution must consider mutual exclusion, progress, and bounded waiting—not just lock ownership."],
    example: "If two workers both read counter=7, increment locally, then write 8, one increment is lost. A mutex serializes the read-modify-write sequence: wait(lock), update the counter, signal(lock).",
    steps: ["Identify shared state and the critical section that accesses it.", "Acquire the required lock or semaphore before entering.", "Perform the operation while maintaining the primitive's invariant.", "Release/signal and allow blocked participants to proceed."],
    pitfalls: ["Mutual exclusion alone does not guarantee fairness or freedom from deadlock.", "A semaphore is a counter and may be used for resource counts or event ordering; a mutex normally has an owner."],
    connections: ["Producer–Consumer uses empty/full counts and a mutex to protect a bounded buffer.", "Dining Philosophers shows circular wait; consistent lock ordering can break the cycle."],
  },
};

export const visualizationGuide = {
  "Process Synchronization": {
    summary: "Watch shared work move through a protected critical section while other participants wait for the lock.",
    focus: ["Who currently owns the mutex", "Which process is in the critical section or blocked", "How release allows a waiter to proceed"],
    scope: "The labs illustrate synchronization scenarios; they are not running concurrent host processes.",
  },
};

export const glossary = {
  "Process Synchronization": [
    ["race condition", "A result that depends on the timing or interleaving of concurrent accesses to shared state."],
    ["critical section", "The part of a program that accesses shared data and therefore needs coordination."],
    ["mutex", "An ownership-based lock that allows one thread at a time into a protected region."],
    ["semaphore", "A counter manipulated by atomic wait and signal operations to manage permits or ordering."],
    ["bounded buffer", "A finite-capacity queue shared by producers and consumers."],
    ["starvation", "A participant is continually bypassed and does not receive a resource or turn."],
  ],
};
