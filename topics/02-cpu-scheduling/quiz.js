// ExecOS · CPU Scheduling · 20-question quiz
// Copied verbatim from (the app still runs from these originals):
//   frontend/src/quizQuestions.js lines 12-33
// Format: [question, options, correctIndex, explanation]

export const questionData = {
  "CPU Scheduling": [
    ["What does a CPU scheduler select?", ["The next ready process to run", "The next file name", "The next physical frame"], 0, "The scheduler selects runnable work for CPU time."],
    ["Which policy serves ready processes in arrival order?", ["FCFS", "SRTF", "LFU"], 0, "FCFS follows arrival order and is non-preemptive."],
    ["Which policy chooses the shortest available CPU burst?", ["SJF", "SCAN", "FIFO"], 0, "SJF picks the ready process with the smallest total burst."],
    ["Which policy can preempt when a shorter remaining job arrives?", ["SRTF", "FCFS", "Indexed allocation"], 0, "SRTF reselects the ready process with least remaining time."],
    ["What is the Round Robin quantum?", ["Maximum CPU time for one turn", "Total number of processes", "Time spent in a page table"], 0, "A quantum bounds each process's uninterrupted turn."],
    ["What happens to unfinished work after a Round Robin quantum?", ["It returns to the ready queue", "It is terminated", "It becomes a disk request"], 0, "An unfinished process goes to the tail of the ready queue."],
    ["How is turnaround time calculated?", ["Completion time minus arrival time", "First start minus completion", "Burst minus arrival"], 0, "Turnaround measures the full time from arrival to completion."],
    ["How is response time calculated?", ["First CPU start minus arrival", "Completion minus burst", "Arrival minus first start"], 0, "Response measures the delay before first CPU service."],
    ["How is waiting time calculated in this CPU model?", ["Turnaround minus CPU burst", "Arrival plus completion", "Burst minus response"], 0, "Waiting is turnaround less the process's actual CPU burst."],
    ["What does the convoy effect describe?", ["Short jobs waiting behind a long FCFS job", "The CPU running all jobs at once", "A disk head wrapping around"], 0, "A long process can hold up shorter processes in FCFS."],
    ["In this simulator, which priority value is highest?", ["1", "5", "10"], 0, "Lower numeric priority values represent higher priority."],
    ["What is a preemptive scheduler allowed to do?", ["Interrupt a running process to select another", "Run only one process ever", "Ignore newly ready work"], 0, "Preemption allows the scheduler to replace the current process."],
    ["What does an idle Gantt-chart interval mean?", ["No process was ready to run", "All processes were terminated at once", "The quantum was negative"], 0, "The CPU is idle when no arrived process is runnable."],
    ["What does throughput measure?", ["Completed processes per unit time", "Time to first response", "Memory used per process"], 0, "Throughput is a completion rate over the elapsed interval."],
    ["Which policy can starve long jobs when short jobs keep arriving?", ["SJF", "FCFS", "Round Robin"], 0, "Repeatedly prioritizing the shortest burst can postpone long jobs."],
    ["What is a context switch?", ["Saving one execution context and restoring another", "Adding a process's burst to its arrival", "Translating a disk address"], 0, "A context switch changes the CPU from one process context to another."],
    ["When does a process enter the READY state?", ["When it can run but is waiting for CPU time", "When it has completed", "Only when it is doing I/O"], 0, "READY processes are runnable and waiting for scheduling."],
    ["Which policy is non-preemptive by definition?", ["FCFS", "SRTF", "Preemptive priority"], 0, "FCFS continues its selected process until it finishes or blocks."],
    ["What should a scheduler do when no process has arrived yet?", ["Keep the CPU idle until work arrives", "Run a future process", "Mark all future processes terminated"], 0, "No process is runnable before its arrival."],
    ["Why compare policies on the same workload?", ["To isolate how policy changes outcomes", "To change all burst times", "To avoid calculating metrics"], 0, "Using identical inputs makes policy tradeoffs comparable."],
  ],
};
