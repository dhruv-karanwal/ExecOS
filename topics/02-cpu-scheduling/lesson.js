// ExecOS · CPU Scheduling · concept lesson, guide and glossary
// Copied verbatim from (the app still runs from these originals):
//   frontend/src/theoryContent.js lines 2-21
//   frontend/src/theoryContent.js lines 247-251
//   frontend/src/theoryContent.js lines 310-317

export const theory = {
  "CPU Scheduling": {
    overview: "CPU scheduling is the OS decision process that selects one runnable process or thread for a processor. It is central to multiprogramming: while one task waits for I/O, another can use the CPU. There is no single best policy for every workload, because responsiveness, throughput, fairness, and overhead can compete.",
    simple: "The CPU can execute only a limited amount of work at a time. The scheduler chooses which ready task gets the next turn, while trying to balance quick response, fairness, and efficient use of the processor.",
    analogy: "Imagine one service counter and several people waiting. FCFS serves the earliest arrival; Round Robin gives each person a short turn and then moves them to the back if they need more time. Real schedulers use more detailed priorities and rules than this queue analogy.",
    realWorld: "When a desktop app waits for disk or network input, the OS can schedule another runnable thread instead of leaving the processor idle. Timer interrupts let a preemptive scheduler regain control and reconsider which thread should run.",
    recap: ["Only READY work can be selected; WAITING work is blocked until an event completes.", "Policies choose in different ways, so one workload can produce different response and waiting times.", "Response time is time until first CPU service; turnaround is arrival to completion."],
    selfCheck: "A short task arrives while a long task is running. Which scheduler property determines whether the short task can begin before the long one finishes?",
    selfCheckAnswer: "Preemption. A preemptive policy can interrupt the running task and choose the newly ready short task; a non-preemptive policy generally waits for the current task to finish or block.",
    objectives: [
      "Distinguish READY, RUNNING, and WAITING processes and explain dispatch and preemption.",
      "Compare FCFS, SJF, SRTF, Priority, and Round Robin on the same workload.",
      "Calculate completion, turnaround, waiting, response, and throughput correctly.",
    ],
    terms: ["ready queue", "dispatcher", "preemption", "time quantum", "context switch", "starvation"],
    rules: ["Turnaround = completion time − arrival time.", "Waiting = turnaround − total CPU burst (for this CPU-only model).", "Response = first CPU start − arrival time.", "Throughput = completed processes ÷ elapsed simulation time."],
    example: "With P1=(arrival 0, burst 5) and P2=(arrival 1, burst 2), FCFS runs P1 from 0 to 5, then P2 from 5 to 7. P2's turnaround is 6, waiting is 4, and response is 4. SRTF instead preempts P1 at time 1 and runs P2 first.",
    steps: ["Admit processes when their arrival time is reached.", "Keep runnable processes in READY; blocked I/O work is WAITING, not schedulable.", "Choose a process using the selected policy and dispatch it.", "On completion, blocking, preemption, or quantum expiry, update state and choose again."],
    pitfalls: ["Waiting time is not response time: a process may wait again after its first CPU service.", "Round Robin's queue order and when new arrivals are admitted affect the exact Gantt chart; state the tie rule when comparing results."],
    connections: ["Timer interrupts give a preemptive kernel a chance to regain CPU control.", "I/O moves a process between WAITING and READY and changes the scheduler's workload."],
  },
};

export const visualizationGuide = {
  "CPU Scheduling": {
    summary: "Follow each dispatch decision from the ready queue into the CPU timeline, then compare the completion metrics.",
    focus: ["Which process is READY, RUNNING, or finished at this tick", "Why the selected policy chose that process", "How preemption or a time quantum changes the Gantt chart"],
    scope: "The lab models CPU bursts and arrivals; it does not model real device interrupts or context-switch duration.",
  },
};

export const glossary = {
  "CPU Scheduling": [
    ["ready queue", "The set of processes that are in memory, able to run, and waiting for CPU time."],
    ["dispatcher", "The kernel component that hands the CPU to the process selected by the scheduler."],
    ["preemption", "Taking the CPU from a running process before its current CPU burst is finished."],
    ["time quantum", "The maximum CPU interval a process may use in one Round Robin turn."],
    ["context switch", "Saving one process's execution state and restoring another's; useful work pauses while this happens."],
    ["starvation", "Indefinite postponement when a policy repeatedly favors other runnable processes."],
  ],
};
