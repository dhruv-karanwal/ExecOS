// ExecOS · Deadlocks · simulation algorithms
// Copied verbatim from (the app still runs from these originals):
//   frontend/src/algorithms.js lines 464-482
//   frontend/src/algorithms.js lines 484-495
//   frontend/src/algorithms.js lines 497-511
//   frontend/src/algorithms.js lines 513-553
//   frontend/src/algorithms.js lines 555-597

import { parseIntegerList } from "../_shared/algorithm-helpers.js";

function parseMatrix(value, name) {
  const rows = String(value).split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    .map((line, index) => {
      const values = line.includes(",")
        ? line.split(",").flatMap((part) => {
          const entry = part.trim();
          if (!entry) throw new Error(`${name} row ${index + 1} contains an empty value.`);
          return entry.split(/\s+/);
        })
        : line.split(/\s+/);
      return values.map(Number);
    });
  if (!rows.length || rows.some((row) => row.some((value) => !Number.isSafeInteger(value) || value < 0))) {
    throw new Error(`${name} must contain rows of non-negative whole numbers.`);
  }
  const width = rows[0].length;
  if (!width || rows.some((row) => row.length !== width)) throw new Error(`${name} must be a rectangular matrix.`);
  return rows;
}

export function parseBankerInput(allocationInput, maximumInput, availableInput) {
  const allocation = parseMatrix(allocationInput, "Allocation matrix");
  const maximum = parseMatrix(maximumInput, "Maximum matrix");
  const available = parseIntegerList(availableInput, "Available resources", { maxItems: 100 });
  if (allocation.length !== maximum.length || allocation[0].length !== maximum[0].length || allocation[0].length !== available.length) {
    throw new Error("Allocation, maximum, and available resource dimensions must match.");
  }
  if (allocation.some((row, index) => row.some((value, resource) => value > maximum[index][resource]))) {
    throw new Error("An allocation cannot exceed that process's declared maximum.");
  }
  return { allocation, maximum, available };
}

export function parseDeadlockDetectionInput(allocationInput, requestInput, availableInput) {
  const allocation = parseMatrix(allocationInput, "Allocation matrix");
  const request = parseMatrix(requestInput, "Current request matrix");
  const available = parseIntegerList(availableInput, "Available resources", { maxItems: 100 });
  if (allocation.length !== request.length
    || allocation[0].length !== request[0].length
    || allocation[0].length !== available.length) {
    throw new Error("Allocation, request, and available resource dimensions must match.");
  }
  const totalResources = available.map((count, resource) => count + allocation.reduce((sum, row) => sum + row[resource], 0));
  if (request.some((row) => row.some((count, resource) => count > totalResources[resource]))) {
    throw new Error("A current request cannot exceed the total number of instances of that resource.");
  }
  return { allocation, request, available };
}

export function simulateDeadlockDetection(allocation, request, available) {
  if (!allocation.length || allocation.length !== request.length || !available.length
    || allocation.some((row, index) => row.length !== available.length || request[index]?.length !== available.length)) {
    throw new Error("Allocation, request, and available resource dimensions must match.");
  }
  const work = available.slice();
  const finished = allocation.map((row) => row.every((value) => value === 0));
  const sequence = [];
  const events = [];
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (let index = 0; index < allocation.length; index += 1) {
      if (finished[index] || !request[index].every((value, resource) => value <= work[resource])) continue;
      const before = work.slice();
      allocation[index].forEach((value, resource) => { work[resource] += value; });
      finished[index] = true;
      sequence.push(`P${index}`);
      events.push({
        process: `P${index}`,
        need: request[index].slice(),
        before,
        after: work.slice(),
        explanation: `P${index}'s current request fits Work. It can complete and release its allocation back to the available pool.`,
      });
      progressed = true;
    }
  }
  const blocked = finished.map((done, index) => done ? null : `P${index}`).filter(Boolean);
  return {
    safe: blocked.length === 0,
    sequence,
    blocked,
    deadlocked: blocked,
    events,
    availableAfter: work,
    explanation: blocked.length
      ? `No unfinished process can satisfy its current request. The remaining processes are deadlocked under this resource snapshot: ${blocked.join(", ")}.`
      : `All processes can finish in order ${sequence.join(" → ")}; no deadlock is detected.`,
  };
}

export function simulateBanker(allocation, maximum, available) {
  if (!allocation.length || allocation.length !== maximum.length) throw new Error("Allocation and maximum matrices must have matching process rows.");
  if (!available.length || allocation.some((row, index) => row.length !== available.length || maximum[index]?.length !== available.length)) {
    throw new Error("All resource vectors and matrix rows must have the same width.");
  }
  const need = maximum.map((row, index) => row.map((value, resource) => value - allocation[index][resource]));
  const work = available.slice();
  const finished = Array(allocation.length).fill(false);
  const sequence = [];
  const events = [];
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (let process = 0; process < allocation.length; process += 1) {
      if (finished[process]) continue;
      const canFinish = need[process].every((required, resource) => required <= work[resource]);
      if (canFinish) {
        const before = work.slice();
        work.forEach((value, resource) => { work[resource] = value + allocation[process][resource]; });
        finished[process] = true;
        sequence.push(`P${process}`);
        events.push({
          process: `P${process}`,
          need: need[process].slice(),
          before,
          after: work.slice(),
          explanation: `P${process} can finish: its remaining need fits available resources. On completion it releases its allocation back to the pool.`,
        });
        progressed = true;
      }
    }
  }
  const blocked = finished.map((done, index) => done ? null : `P${index}`).filter(Boolean);
  return {
    safe: blocked.length === 0,
    sequence,
    blocked,
    need,
    events,
    availableAfter: work,
    explanation: blocked.length ? `${blocked.join(", ")} cannot finish with the resources currently available; no safe sequence exists.` : `All processes can finish in order ${sequence.join(" → ")}.`,
  };
}
