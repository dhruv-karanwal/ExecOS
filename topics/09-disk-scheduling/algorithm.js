// ExecOS · Disk Scheduling · simulation algorithms
// Copied verbatim from (the app still runs from these originals):
//   frontend/src/algorithms.js lines 155-163
//   frontend/src/algorithms.js lines 165-233

import { parseIntegerList } from "../_shared/algorithm-helpers.js";

export function parseDiskInput(requests, head, diskSize) {
  const queue = parseIntegerList(requests, "Request queue", { maxItems: 1000 });
  const start = Number(head);
  const size = Number(diskSize);
  if (!Number.isSafeInteger(size) || size < 2 || size > 1000000) throw new Error("Disk size must be a whole number between 2 and 1,000,000 cylinders.");
  if (!Number.isSafeInteger(start) || start < 0 || start >= size) throw new Error(`Initial head must be between 0 and ${size - 1}.`);
  if (queue.some((item) => item >= size)) throw new Error(`Every request must be between 0 and ${size - 1}.`);
  return { requests: queue, head: start, diskSize: size };
}

export function simulateDisk(requests, head, diskSize, algorithm, direction = "up") {
  if (!requests.length) throw new Error("Add at least one disk request.");
  const indexed = requests.map((position, index) => ({ position, index }));
  const up = direction === "up";
  const targets = [];
  const addRequests = (items) => items.forEach((request) => targets.push({ position: request.position, requestIndex: request.index, kind: "request" }));
  if (algorithm === "fcfs") addRequests(indexed);
  else if (algorithm === "sstf") {
    const pending = indexed.slice();
    let current = head;
    while (pending.length) {
      let nearest = 0;
      for (let index = 1; index < pending.length; index += 1) {
        const distance = Math.abs(pending[index].position - current);
        const nearestDistance = Math.abs(pending[nearest].position - current);
        if (distance < nearestDistance || (distance === nearestDistance && pending[index].index < pending[nearest].index)) nearest = index;
      }
      const [next] = pending.splice(nearest, 1);
      targets.push({ position: next.position, requestIndex: next.index, kind: "request" });
      current = next.position;
    }
  } else if (algorithm === "scan" || algorithm === "cscan" || algorithm === "look" || algorithm === "clook") {
    const low = indexed.filter((request) => request.position < head).sort((a, b) => a.position - b.position || a.index - b.index);
    const high = indexed.filter((request) => request.position >= head).sort((a, b) => a.position - b.position || a.index - b.index);
    const ascending = up ? high : low.slice().reverse();
    const other = up ? low.slice().reverse() : high;
    addRequests(ascending);
    if (algorithm === "scan" || algorithm === "cscan") {
      const edge = up ? diskSize - 1 : 0;
      if (head !== edge && targets.at(-1)?.position !== edge) targets.push({ position: edge, kind: "edge" });
    }
    if (algorithm === "cscan") {
      const wrap = up ? 0 : diskSize - 1;
      if (targets.at(-1)?.position !== wrap) targets.push({ position: wrap, kind: "wrap" });
      addRequests(up ? low : high.slice().reverse());
    } else if (algorithm === "clook") {
      if (other.length) {
        const oppositeSide = up ? low : high.slice().reverse();
        const jumpTarget = oppositeSide[0].position;
        targets.push({ position: jumpTarget, kind: "wrap" });
        addRequests(oppositeSide.slice(1));
      }
    } else {
      addRequests(other);
    }
  } else {
    throw new Error("Choose a supported disk scheduling algorithm.");
  }
  const events = [];
  let current = head;
  for (const target of targets) {
    const distance = Math.abs(target.position - current);
    const kind = target.kind;
    const movementDirection = target.position < current ? "down" : "up";
    const movement = kind === "wrap" ? `The head wraps to cylinder ${target.position} without servicing requests during the jump.` :
      kind === "edge" ? `SCAN continues to the disk boundary at cylinder ${target.position}, then reverses direction.` :
        algorithm === "fcfs" ? `FCFS services request ${target.position} in its original arrival order.` :
          algorithm === "sstf" ? `SSTF selects the nearest pending request at ${target.position} (${distance} cylinders away).` :
            `The head services request ${target.position} while moving ${movementDirection}.`;
    events.push({ from: current, to: target.position, distance, kind, requestIndex: target.requestIndex ?? null, explanation: movement });
    current = target.position;
  }
  return {
    events,
    sequence: [head, ...events.map((event) => event.to)],
    totalSeek: events.reduce((sum, event) => sum + event.distance, 0),
    serviced: events.filter((event) => event.kind === "request").length,
  };
}
