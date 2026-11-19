// ExecOS · CPU Scheduling · simulation algorithms
// Copied verbatim from (the app still runs from these originals):
//   frontend/src/algorithms.js lines 22-54
//   frontend/src/algorithms.js lines 56-153

import { MAX_TICKS } from "../_shared/algorithm-helpers.js";

export function parseProcesses(value, algorithm) {
  const lines = String(value).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) throw new Error("Add at least one process.");
  if (lines.length > 100) throw new Error("Use 100 processes or fewer.");
  const processes = lines.map((line, index) => {
    const [rawId, ...rawValues] = line.split(",").map((item) => item.trim());
    if (!rawId || rawValues.some((value) => !value)) throw new Error(`Line ${index + 1} contains an empty process field.`);
    const priorityPolicy = ["priority", "priority_np"].includes(algorithm);
    const validLength = priorityPolicy ? rawValues.length === 3 : rawValues.length === 2 || rawValues.length === 3;
    if (!validLength) {
      throw new Error(`Line ${index + 1} must use ${priorityPolicy ? "ID, arrival, burst, priority" : "ID, arrival, burst, with optional priority"}.`);
    }
    const values = rawValues.map(Number);
    if (values.some((item) => !Number.isSafeInteger(item) || item < 0)) {
      throw new Error(`Line ${index + 1} must use non-negative whole numbers.`);
    }
    if (values[1] < 1) throw new Error(`Line ${index + 1} burst time must be at least 1.`);
    if (priorityPolicy && (values[2] < 1 || values[2] > 10)) throw new Error(`Line ${index + 1} priority must be between 1 and 10.`);
    return {
      id: rawId,
      arrival: values[0],
      burst: values[1],
      priority: rawValues.length === 3 ? values[2] : 0,
      order: index,
    };
  });
  if (processes.some((process) => !process.id) || new Set(processes.map((process) => process.id)).size !== processes.length) {
    throw new Error("Process IDs must be non-empty and unique.");
  }
  const endLimit = Math.max(...processes.map((process) => process.arrival)) + processes.reduce((total, process) => total + process.burst, 0);
  if (endLimit > MAX_TICKS) throw new Error(`This workload exceeds the ${MAX_TICKS.toLocaleString()} tick limit.`);
  return processes;
}

export function simulateCpu(processes, algorithm, quantum = 2) {
  if (!Array.isArray(processes) || !processes.length) throw new Error("Add at least one process.");
  if (!["fcfs", "sjf", "srtf", "priority", "priority_np", "round_robin"].includes(algorithm)) throw new Error("Choose a supported CPU scheduling policy.");
  if (algorithm === "round_robin" && (!Number.isSafeInteger(quantum) || quantum < 1)) throw new Error("Time quantum must be a positive whole number.");
  const rows = processes.map((process, order) => ({ ...process, order: process.order ?? order, remaining: process.burst, firstStart: null, completion: null }));
  const totalTicks = Math.max(...rows.map((process) => process.arrival)) + rows.reduce((sum, process) => sum + process.burst, 0);
  if (totalTicks > MAX_TICKS) throw new Error(`This workload exceeds the ${MAX_TICKS.toLocaleString()} tick limit.`);
  const events = [];
  const queue = [];
  const admitted = new Set();
  let running = null;
  let quantumUsed = 0;
  let carryOver = null;
  const preemptive = ["srtf", "priority"].includes(algorithm);

  for (let time = 0; rows.some((process) => process.remaining > 0); time += 1) {
    if (time > MAX_TICKS) throw new Error("Simulation stopped at the tick limit.");
    if (algorithm === "round_robin") {
      const arrivals = rows.filter((process) => process.arrival <= time && process.remaining > 0 && !admitted.has(process.id))
        .sort((left, right) => left.arrival - right.arrival || left.order - right.order);
      arrivals.forEach((process) => {
        queue.push(process);
        admitted.add(process.id);
      });
      if (carryOver) {
        queue.push(carryOver);
        carryOver = null;
      }
      if (!running) {
        running = queue.shift() || null;
        quantumUsed = 0;
      }
    } else {
      const ready = rows.filter((process) => process.arrival <= time && process.remaining > 0);
      if (ready.length && (preemptive || !running)) {
        ready.sort((left, right) => {
          if (algorithm === "srtf") return left.remaining - right.remaining || left.arrival - right.arrival || left.order - right.order;
          if (algorithm === "priority" || algorithm === "priority_np") return left.priority - right.priority || left.arrival - right.arrival || left.order - right.order;
          if (algorithm === "sjf") return left.burst - right.burst || left.arrival - right.arrival || left.order - right.order;
          return left.arrival - right.arrival || left.order - right.order;
        });
        running = ready[0];
      } else if (!ready.length) {
        running = null;
      }
    }

    if (!running) {
      events.push({ start: time, end: time + 1, pid: null, explanation: "CPU is idle; no process has arrived or is ready." });
      continue;
    }
    const selected = running;
    if (selected.firstStart === null) selected.firstStart = time;
    selected.remaining -= 1;
    if (algorithm === "round_robin") quantumUsed += 1;
    let explanation;
    if (algorithm === "fcfs") explanation = `${selected.id} is the earliest arrived process in the ready queue.`;
    else if (algorithm === "sjf") explanation = `${selected.id} has the shortest burst among processes that are ready.`;
    else if (algorithm === "srtf") explanation = `${selected.id} has the shortest remaining time (${selected.remaining + 1} tick${selected.remaining === 0 ? "" : "s"} before this step).`;
    else if (algorithm === "priority" || algorithm === "priority_np") explanation = `${selected.id} has the highest ready priority (priority ${selected.priority}; lower number wins${algorithm === "priority_np" ? ", non-preemptive" : ""}).`;
    else explanation = `${selected.id} is using Round Robin time slice ${quantumUsed} of ${quantum}.`;
    events.push({ start: time, end: time + 1, pid: selected.id, explanation });
    if (selected.remaining === 0) {
      selected.completion = time + 1;
      running = null;
      quantumUsed = 0;
    } else if (algorithm === "round_robin" && quantumUsed === quantum) {
      carryOver = selected;
      running = null;
      quantumUsed = 0;
    }
  }

  const metrics = rows.map((process) => {
    const turnaround = process.completion - process.arrival;
    return {
      id: process.id,
      arrival: process.arrival,
      burst: process.burst,
      priority: ["priority", "priority_np"].includes(algorithm) ? process.priority : "—",
      completion: process.completion,
      turnaround,
      waiting: turnaround - process.burst,
      response: process.firstStart - process.arrival,
    };
  });
  const elapsed = events.at(-1).end - events[0].start;
  return {
    events,
    metrics,
    averages: {
      waiting: metrics.reduce((sum, item) => sum + item.waiting, 0) / metrics.length,
      turnaround: metrics.reduce((sum, item) => sum + item.turnaround, 0) / metrics.length,
      response: metrics.reduce((sum, item) => sum + item.response, 0) / metrics.length,
      throughput: metrics.length / elapsed,
    },
  };
}
