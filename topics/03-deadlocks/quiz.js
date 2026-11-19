// ExecOS · Deadlocks · 20-question quiz
// Copied verbatim from (the app still runs from these originals):
//   frontend/src/quizQuestions.js lines 122-143
// Format: [question, options, correctIndex, explanation]

export const questionData = {
  Deadlock: [
    ["What does a safe sequence demonstrate?", ["Processes can finish in that order", "No process needs resources", "Every request arrived together"], 0, "Each process can obtain its remaining need and release resources."],
    ["How is Banker's Need calculated?", ["Maximum minus Allocation", "Available plus Maximum", "Allocation minus Available"], 0, "Need is the remaining resource claim."],
    ["What does Available represent?", ["Currently unallocated resource instances", "All maximum claims", "The number of CPUs"], 0, "Available is the resource vector not currently allocated."],
    ["What does an unsafe state mean?", ["No guaranteed safe completion order was found", "The OS has crashed", "Every process is already deadlocked"], 0, "Unsafe means completion is not guaranteed; it does not itself prove current deadlock."],
    ["What does deadlock detection examine?", ["Current allocations and outstanding requests", "Only maximum future claims", "Disk-head direction"], 0, "Detection tests current requests against available resources."],
    ["When can a process finish in the safety test?", ["Its Need fits the Work vector", "Its ID is the smallest", "Its allocation is largest"], 0, "Every resource need must be no greater than currently available Work."],
    ["What is Work initialized to?", ["Available resources", "Maximum resource claims", "The process count"], 0, "The check begins with the currently available resources."],
    ["What happens to a finishing process's allocation?", ["It is returned to Work", "It is destroyed", "It is doubled"], 0, "The safety simulation assumes completion releases held resources."],
    ["Which is a classic deadlock condition?", ["Mutual exclusion", "Page locality", "Time slicing"], 0, "Mutual exclusion is one of the four classic necessary conditions."],
    ["Which is another classic deadlock condition?", ["Hold and wait", "Page replacement", "Round Robin"], 0, "Hold-and-wait means a process holds resources while requesting more."],
    ["What does no preemption mean in the classic conditions?", ["Resources cannot be forcibly taken away", "A process cannot arrive", "CPU bursts are unknown"], 0, "Resources are released only voluntarily by their holder."],
    ["What is circular wait?", ["Processes form a cycle waiting for one another's resources", "A process executes in a loop", "The disk head wraps"], 0, "A resource-wait cycle satisfies the circular-wait condition."],
    ["What does a blocked set in detection represent?", ["Processes unable to finish from the current resource snapshot", "All completed processes", "Processes with the shortest burst"], 0, "The remaining set cannot satisfy current requests in the detection pass."],
    ["Does unsafe always mean deadlocked right now?", ["No, it means a safe completion is not guaranteed", "Yes, in every case", "Only when there are two resources"], 0, "An unsafe state lacks a guaranteed safe sequence but may still run."],
    ["What does Banker's algorithm require from processes?", ["Maximum resource claims", "Future disk requests", "CPU response times"], 0, "The algorithm checks safety using declared maximum claims."],
    ["When is a request safe to grant under Banker's method?", ["The resulting state still has a safe sequence", "It uses all available resources", "It has the largest process ID"], 0, "A tentative grant should preserve at least one safe completion order."],
    ["What is a resource allocation matrix?", ["Resources currently held by each process", "CPU burst sequence", "Disk seek distances"], 0, "Allocation records current resource ownership per process."],
    ["What does the request matrix show in detection?", ["Current outstanding resource requests", "Maximum future claims only", "Memory block sizes"], 0, "Detection uses each process's current outstanding request."],
    ["How can consistent lock ordering help?", ["Prevent circular wait", "Increase page faults", "Guarantee the shortest CPU burst"], 0, "An ordering rule prevents cyclic resource acquisition."],
    ["What happens if no unfinished process's request fits Work?", ["The remaining processes stay blocked in this snapshot", "All requests are granted", "Work becomes infinite"], 0, "No progress is possible until some resource becomes available."],
  ],
};
