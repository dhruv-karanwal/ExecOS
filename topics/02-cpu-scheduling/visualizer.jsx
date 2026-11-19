// ExecOS · CPU Scheduling · visualizer UI and settings
// Copied verbatim from (the app still runs from these originals):
//   frontend/src/AlgorithmStudio.jsx lines 47-54
//   frontend/src/AlgorithmStudio.jsx lines 136-143
//   frontend/src/AlgorithmStudio.jsx lines 229-233
//   frontend/src/AlgorithmStudio.jsx lines 294-298
//   frontend/src/AlgorithmStudio.jsx lines 71-114
//   frontend/src/AlgorithmStudio.jsx lines 494-505
//   frontend/src/AlgorithmStudio.jsx lines 507-538
// Reference copy: these components use shared helpers (formatNumber, calculate, …) that stay in AlgorithmStudio.jsx.
import { Fragment, useEffect, useMemo, useState } from "react";

const algorithmOptions = {
  "CPU Scheduling": [
    ["fcfs", "First Come, First Served (FCFS)"],
    ["sjf", "Shortest Job First (SJF)"],
    ["srtf", "Shortest Remaining Time First (SRTF)"],
    ["priority", "Priority (preemptive)"],
    ["priority_np", "Priority (non-preemptive)"],
    ["round_robin", "Round Robin"],
  ],
};

const descriptions = {
  "CPU Scheduling": {
    purpose: "A CPU scheduler chooses which ready process receives the processor. Compare how each policy trades response time, fairness, and waiting.",
    example: "For P1(0,5), P2(1,3), FCFS completes P1 before P2; SRTF can preempt P1 when the shorter P2 arrives.",
    pseudocode: "while work remains:\n  admit arrived processes\n  choose the next process by policy\n  run one tick (or until completion)\n  update remaining time and metrics",
    advantages: "Makes scheduling tradeoffs measurable; supports preemptive and non-preemptive policies.",
    disadvantages: "Real kernels add priorities, I/O, multiple cores, and overhead beyond this deterministic teaching model.",
    complexity: "O(T × P log P)", space: "O(P + T)",
  },
};

const deepTheory = {
  "CPU Scheduling": [
    ["The scheduling problem", "A multiprogramming OS keeps runnable processes in a ready queue and chooses one to own the CPU. A scheduler's decision affects response time (first service), waiting time (time in the ready queue), turnaround time (arrival to completion), throughput, and fairness. These goals can conflict: a policy that improves average waiting can still make a long job wait disproportionately."],
    ["Preemption and policy behavior", "FCFS is non-preemptive and follows arrival order. SJF is non-preemptive and chooses the shortest available burst. SRTF is the preemptive version of shortest-job scheduling: a newly ready process can replace the current one if it has less remaining work. Priority scheduling is available in preemptive and non-preemptive variants; both treat a lower numeric value as higher priority. Round Robin gives each ready process up to a fixed quantum, then returns unfinished work to the queue."],
    ["Reading the results", "The Gantt chart is the execution timeline, not just the final order. Idle intervals appear when no process has arrived. Waiting is turnaround minus CPU burst in this model; response is first start minus arrival. A shorter Round Robin quantum can improve interactive response while increasing scheduling overhead in a real kernel. SJF/SRTF can starve long jobs, and priority scheduling can starve low-priority jobs without aging."],
  ],
};

const legacyQuizFallback = {
  "CPU Scheduling": [
    { question: "A process arrives while a shorter remaining job is running under SRTF. What can happen?", options: ["The new job can preempt it", "The current job always finishes", "The CPU becomes idle"], answer: 0, explanation: "SRTF is preemptive and reselects the ready job with the least remaining time." },
    { question: "How is turnaround time calculated in this lab?", options: ["Completion − arrival", "First start − arrival", "Burst − completion"], answer: 0, explanation: "Turnaround covers the full interval from process arrival through completion." },
    { question: "What is Round Robin's time quantum?", options: ["A maximum CPU turn before rotation", "The number of ready processes", "The total burst of all processes"], answer: 0, explanation: "An unfinished process returns to the ready queue after using its time slice." },
  ],
};

const cpuPolicyGuide = {
  fcfs: {
    description: "The ready process that arrived first runs until it finishes. Processes arriving during that run wait in arrival order.",
    how: ["Processes are admitted in arrival order.", "The queue head runs until its burst completes.", "New arrivals wait at the tail of the ready queue."],
    formula: "next = ready process with the earliest arrival time\nrun until completion",
    advantages: "Simple, predictable FIFO ordering; no preemption overhead.",
    disadvantages: "A long process can hold up short jobs behind it (the convoy effect).",
  },
  sjf: {
    description: "Whenever the CPU becomes free, choose the arrived ready process with the smallest total CPU burst. The selected process runs to completion.",
    how: ["Wait for the CPU to become free.", "Compare the burst lengths of arrived READY processes.", "Run the shortest available process to completion."],
    formula: "next = arg min(burst time)\n         among arrived READY processes",
    advantages: "Can minimize average waiting time when burst lengths are known.",
    disadvantages: "Long jobs may wait a long time; future burst lengths are not generally known in advance.",
  },
  srtf: {
    description: "At each scheduling decision, choose the ready process with the least remaining CPU time. A newly arrived shorter job can preempt the current process.",
    how: ["Check remaining time at each tick.", "Select the READY process with the least remaining burst.", "Preempt the current process when a shorter job is ready."],
    formula: "next = arg min(remaining time)\n         among arrived READY processes",
    advantages: "Short jobs can finish quickly; adapts to newly arriving work.",
    disadvantages: "Long jobs can starve, and frequent preemption adds overhead in real systems.",
  },
  priority: {
    description: "Choose the highest-priority ready process. In this lab, a lower numeric priority value means higher priority, and a newly arrived higher-priority job can preempt.",
    how: ["Compare priority among READY processes.", "A lower number represents a higher priority.", "Preempt when a higher-priority process arrives."],
    formula: "next = arg min(priority number)\n         among arrived READY processes",
    advantages: "Useful when some work must receive preferential service.",
    disadvantages: "Low-priority processes can starve without an aging policy.",
  },
  priority_np: {
    description: "Choose the highest-priority ready process, with lower numeric values representing higher priority. Once selected, it runs to completion.",
    how: ["Compare priority among READY processes.", "A lower number represents a higher priority.", "The selected process runs to completion."],
    formula: "next = arg min(priority number)\n         among arrived READY processes\nrun until completion",
    advantages: "Priority is respected without mid-run preemption.",
    disadvantages: "Low-priority processes can starve; a long job blocks later high-priority work.",
  },
  round_robin: {
    description: "Visit ready processes in queue order and give each up to the configured time quantum. An unfinished process returns to the end of the queue.",
    how: ["Dispatch the next process in the READY queue.", "Run for at most the configured time quantum.", "Return unfinished work to the queue tail."],
    formula: "run duration = min(quantum, remaining time)\nif work remains: enqueue process at tail",
    advantages: "Shares CPU time fairly and gives interactive workloads regular response opportunities.",
    disadvantages: "A very small quantum causes excess context switches; a very large quantum behaves more like FCFS.",
  },
};

function GanttVisualization({ events, total }) {
  const segments = events.reduce((output, event) => {
    const previous = output.at(-1);
    if (previous && previous.pid === event.pid && previous.end === event.start) previous.end = event.end;
    else output.push({ ...event });
    return output;
  }, []);
  return <div className="gantt-visual" aria-label={`Gantt chart showing ${events.length} of ${total} time units`}>
    {segments.map((segment, index) => <div key={`${segment.start}-${index}`} className={`gantt-visual-segment ${segment.pid ? "" : "idle"}`} style={{ flexGrow: segment.end - segment.start }} title={`${segment.pid || "Idle"}: ${segment.start}–${segment.end}`}><strong>{segment.pid || "Idle"}</strong><small>{segment.start}–{segment.end}</small></div>)}
    <div className="gantt-axis"><span>{segments[0]?.start ?? 0}</span><span>{segments.at(-1)?.end ?? 0}</span></div>
  </div>;
}

function CPUProcessStateVisualization({ events, stepCount, result, algorithm }) {
  const visibleEvents = events.slice(0, stepCount);
  const currentTick = visibleEvents.at(-1)?.end ?? 0;
  const lastEvent = visibleEvents.at(-1);
  const executed = visibleEvents.reduce((counts, event) => {
    if (event.pid) counts[event.pid] = (counts[event.pid] || 0) + 1;
    return counts;
  }, {});
  const processes = result.metrics.map((process) => {
    const remaining = process.burst - (executed[process.id] || 0);
    const state = remaining === 0 ? "TERMINATED"
      : process.arrival > currentTick ? "NEW"
        : lastEvent?.pid === process.id ? "RUNNING" : "READY";
    return { ...process, remaining, state };
  });
  const running = processes.find((process) => process.state === "RUNNING");
  const ready = processes.filter((process) => process.state === "READY");
  return <div className="cpu-state-visual">
    <div className={`cpu-running-card ${running ? "active" : ""}`}>
      <span>CPU</span><strong>{running?.id || "IDLE"}</strong>
      <small>{running ? `${running.remaining} ticks remaining` : "No process running at this step"}</small>
      <b>TICK {currentTick}</b>
    </div>
    <div className="cpu-state-lanes">
      <div className="cpu-state-lane"><span>READY QUEUE <b>{ready.length}</b></span><div>{ready.length ? ready.map((process) => <i key={process.id}>{process.id}</i>) : <small>Empty</small>}</div></div>
      <div className="cpu-process-state-list">{processes.map((process) => <div className={`cpu-process-state ${process.state.toLowerCase()}`} key={process.id}>
        <strong>{process.id}</strong><span>{process.state}</span><small>{process.remaining} / {process.burst} ticks left</small>
      </div>)}</div>
      <small className="cpu-state-source">Process states derived from the visible {algorithm.replace("_", " ").toUpperCase()} execution steps.</small>
    </div>
  </div>;
}
