const MAX_ITEMS = 1000;
const MAX_TICKS = 100000;

export function parseIntegerList(value, label, { min = 0, maxItems = MAX_ITEMS } = {}) {
  const source = String(value).trim();
  const tokens = source.includes(",")
    ? source.split(",").flatMap((part) => {
      const entry = part.trim();
      if (!entry) throw new Error(`${label} contains an empty value.`);
      return entry.split(/\s+/);
    })
    : source.split(/\s+/).filter(Boolean);
  if (!tokens.length) throw new Error(`${label} cannot be empty.`);
  if (tokens.length > maxItems) throw new Error(`${label} cannot contain more than ${maxItems} values.`);
  const values = tokens.map((token) => Number(token));
  if (values.some((item) => !Number.isSafeInteger(item) || item < min)) {
    throw new Error(`${label} must contain whole numbers greater than or equal to ${min}.`);
  }
  return values;
}

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

export function parsePageReferences(value, frameCount) {
  const pages = parseIntegerList(value, "Reference string", { maxItems: 1000 });
  const frames = Number(frameCount);
  if (!Number.isSafeInteger(frames) || frames < 1 || frames > 32) throw new Error("Frame count must be a whole number between 1 and 32.");
  return { pages, frameCount: frames };
}

export function simulatePages(pages, frameCount, algorithm) {
  if (!pages.length) throw new Error("Add at least one page reference.");
  if (pages.some((page) => !Number.isSafeInteger(page) || page < 0)) throw new Error("Page references must be non-negative whole numbers.");
  if (!Number.isSafeInteger(frameCount) || frameCount < 1) throw new Error("Frame count must be positive.");
  if (!["fifo", "lru", "optimal", "lfu", "second_chance"].includes(algorithm)) throw new Error("Choose a supported page replacement policy.");
  const positionsByPage = new Map();
  pages.forEach((page, index) => {
    if (!positionsByPage.has(page)) positionsByPage.set(page, []);
    positionsByPage.get(page).push(index);
  });
  const nextPositionByPage = new Map([...positionsByPage.keys()].map((page) => [page, 0]));
  const frames = Array(frameCount).fill(null);
  const loadedAt = Array(frameCount).fill(-1);
  const lastUsed = Array(frameCount).fill(-1);
  const frequencies = Array(frameCount).fill(0);
  const referenced = Array(frameCount).fill(false);
  const events = [];
  let faults = 0;
  let hits = 0;
  let clockHand = 0;
  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index];
    nextPositionByPage.set(page, nextPositionByPage.get(page) + 1);
    const hitFrame = frames.indexOf(page);
    let frameIndex = hitFrame;
    let evicted = null;
    if (hitFrame >= 0) {
      hits += 1;
      lastUsed[hitFrame] = index;
      frequencies[hitFrame] += 1;
      referenced[hitFrame] = true;
    } else {
      faults += 1;
      frameIndex = frames.indexOf(null);
      if (frameIndex < 0) {
        if (algorithm === "fifo") frameIndex = loadedAt.indexOf(Math.min(...loadedAt));
        else if (algorithm === "lru") frameIndex = lastUsed.indexOf(Math.min(...lastUsed));
        else if (algorithm === "lfu") {
          const minFrequency = Math.min(...frequencies);
          frameIndex = frequencies.findIndex((frequency) => frequency === minFrequency);
        } else if (algorithm === "second_chance") {
          while (referenced[clockHand]) {
            referenced[clockHand] = false;
            clockHand = (clockHand + 1) % frameCount;
          }
          frameIndex = clockHand;
          clockHand = (clockHand + 1) % frameCount;
        } else {
          const nextUse = frames.map((resident) => positionsByPage.get(resident)[nextPositionByPage.get(resident)] ?? Infinity);
          frameIndex = nextUse.indexOf(Math.max(...nextUse));
        }
        evicted = frames[frameIndex];
      }
      frames[frameIndex] = page;
      loadedAt[frameIndex] = index;
      lastUsed[frameIndex] = index;
      frequencies[frameIndex] = 1;
      referenced[frameIndex] = true;
    }
    const explanation = hitFrame >= 0
      ? `Page ${page} is already in frame ${frameIndex}; this access is a hit.`
      : evicted === null
        ? `Page ${page} is loaded into empty frame ${frameIndex}; this access is a fault.`
        : algorithm === "second_chance"
          ? `Second Chance checks the clock hand: referenced pages get their bit cleared and another turn; frame ${frameIndex} had a clear bit, so page ${evicted} is replaced with ${page}.`
          : `${algorithm.toUpperCase()} replaces page ${evicted} in frame ${frameIndex} with page ${page}.`;
    events.push({ index, page, hit: hitFrame >= 0, frameIndex, evicted, frames: frames.slice(), referenced: referenced.slice(), clockHand, faults, hits, explanation });
  }
  return { events, faults, hits, hitRatio: hits / pages.length, faultRatio: faults / pages.length };
}

export function simulateTlb(references, frameCount, tlbCapacity) {
  if (!references.length) throw new Error("Add at least one page reference for the TLB simulation.");
  if (!Number.isSafeInteger(frameCount) || frameCount < 1 || frameCount > 32) throw new Error("Frame count must be a whole number between 1 and 32.");
  if (!Number.isSafeInteger(tlbCapacity) || tlbCapacity < 1 || tlbCapacity > 16) throw new Error("TLB capacity must be a whole number between 1 and 16.");
  if (references.some((page) => !Number.isSafeInteger(page) || page < 0)) throw new Error("Page references must be non-negative whole numbers.");
  const frames = Array(frameCount).fill(null);
  const tlb = [];
  const events = [];
  let nextFrame = 0;
  let faults = 0;
  let tlbHits = 0;
  for (const [index, page] of references.entries()) {
    let frameIndex = frames.indexOf(page);
    const tlbIndex = tlb.findIndex((entry) => entry.page === page);
    const tlbHit = tlbIndex >= 0 && frameIndex >= 0;
    if (tlbHit) {
      tlbHits += 1;
      frameIndex = tlb[tlbIndex].frame;
      tlb.unshift(tlb.splice(tlbIndex, 1)[0]);
    }
    const pageFault = frameIndex < 0;
    let evicted = null;
    if (pageFault) {
      faults += 1;
      frameIndex = frames.indexOf(null);
      if (frameIndex < 0) {
        frameIndex = nextFrame;
        evicted = frames[frameIndex];
        nextFrame = (nextFrame + 1) % frameCount;
        const stale = tlb.findIndex((entry) => entry.page === evicted);
        if (stale >= 0) tlb.splice(stale, 1);
      }
      frames[frameIndex] = page;
    }
    if (!tlbHit) {
      const previous = tlb.findIndex((entry) => entry.page === page);
      if (previous >= 0) tlb.splice(previous, 1);
      tlb.unshift({ page, frame: frameIndex });
      if (tlb.length > tlbCapacity) tlb.pop();
    }
    const explanation = pageFault
      ? `Page ${page} missed in the TLB and page table, causing a page fault${evicted === null ? `; it is loaded into free frame ${frameIndex}.` : `; page ${evicted} is evicted from frame ${frameIndex}.`}`
      : tlbHit
        ? `Page ${page} hits in the TLB, so its cached frame ${frameIndex} is used without a page-table lookup.`
        : `Page ${page} misses in the TLB but is resident; the page table maps it to frame ${frameIndex}, and that translation is cached.`;
    events.push({
      index,
      page,
      frameIndex,
      tlbHit,
      pageFault,
      evicted,
      frames: frames.slice(),
      tlb: tlb.map((entry) => ({ ...entry })),
      faults,
      tlbHits,
      explanation,
    });
  }
  return { events, faults, tlbHits, references: references.length, tlbHitRatio: tlbHits / references.length };
}

export function translatePagedAddress(address, pageSize, pageTable) {
  if (!Number.isSafeInteger(address) || address < 0) throw new Error("Virtual address must be a non-negative whole number.");
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 1000000) {
    throw new Error("Page size must be a whole number between 1 and 1,000,000.");
  }
  if (!Array.isArray(pageTable) || !pageTable.length || pageTable.length > 256
    || pageTable.some((frame) => !Number.isSafeInteger(frame) || frame < 0)) {
    throw new Error("Page table must contain 1–256 non-negative frame numbers.");
  }
  const page = Math.floor(address / pageSize);
  const offset = address % pageSize;
  const frame = pageTable[page];
  if (frame === undefined) throw new Error(`Virtual page ${page} is not mapped; this access would cause a page fault.`);
  const physical = frame * pageSize + offset;
  if (!Number.isSafeInteger(physical)) throw new Error("Physical address exceeds the safe integer range.");
  return { page, offset, frame, physical, pageSize };
}

export function translateSegmentedAddress(offset, segment) {
  if (!Number.isSafeInteger(offset) || offset < 0) throw new Error("Segment offset must be a non-negative whole number.");
  if (!segment || typeof segment.name !== "string" || !segment.name.trim()
    || !Number.isSafeInteger(segment.base) || segment.base < 0
    || !Number.isSafeInteger(segment.limit) || segment.limit < 1) {
    throw new Error("Segment base must be non-negative and its limit must be a positive whole number.");
  }
  if (offset >= segment.limit) throw new Error(`Offset ${offset} exceeds the ${segment.name} segment limit (${segment.limit}).`);
  const physical = segment.base + offset;
  if (!Number.isSafeInteger(physical)) throw new Error("Physical address exceeds the safe integer range.");
  return { segment: segment.name, base: segment.base, limit: segment.limit, offset, physical };
}

export function parseMemoryInput(blocks, requests) {
  const blockSizes = parseIntegerList(blocks, "Memory blocks", { min: 1, maxItems: 100 });
  const processSizes = parseIntegerList(requests, "Process sizes", { min: 1, maxItems: 100 });
  return { blockSizes, processSizes };
}

export function simulateMemory(blockSizes, processSizes, algorithm) {
  if (!["first_fit", "best_fit", "worst_fit", "next_fit"].includes(algorithm)) throw new Error("Choose First Fit, Best Fit, Worst Fit, or Next Fit.");
  const blocks = blockSizes.map((size, index) => ({ id: `B${index + 1}`, size, free: size, allocations: [] }));
  const events = [];
  let nextFitStart = 0;
  for (const [index, size] of processSizes.entries()) {
    let selected;
    if (algorithm === "next_fit") {
      for (let offset = 0; offset < blocks.length; offset += 1) {
        const blockIndex = (nextFitStart + offset) % blocks.length;
        if (blocks[blockIndex].free >= size) {
          selected = { ...blocks[blockIndex], blockIndex };
          nextFitStart = (blockIndex + 1) % blocks.length;
          break;
        }
      }
    } else {
      let blockIndex = -1;
      for (let candidate = 0; candidate < blocks.length; candidate += 1) {
        if (blocks[candidate].free < size) continue;
        if (algorithm === "first_fit") {
          blockIndex = candidate;
          break;
        }
        if (blockIndex < 0
          || (algorithm === "best_fit" && blocks[candidate].free < blocks[blockIndex].free)
          || (algorithm === "worst_fit" && blocks[candidate].free > blocks[blockIndex].free)) {
          blockIndex = candidate;
        }
      }
      if (blockIndex >= 0) selected = { ...blocks[blockIndex], blockIndex };
    }
    if (selected) {
      const block = blocks[selected.blockIndex];
      block.free -= size;
      block.allocations.push({ id: `P${index + 1}`, size });
    }
    events.push({
      id: `P${index + 1}`,
      size,
      block: selected?.id || null,
      explanation: selected
        ? `${algorithm.replace("_", " ")} places P${index + 1} (${size}) in ${selected.id}, which has ${selected.free} units before allocation.`
        : `P${index + 1} (${size}) cannot fit in any remaining free block.`,
      blocks: blocks.map((block) => ({ ...block, allocations: block.allocations.map((allocation) => ({ ...allocation })) })),
    });
  }
  const allocated = blocks.reduce((sum, block) => sum + block.size - block.free, 0);
  const free = blocks.reduce((sum, block) => sum + block.free, 0);
  return { events, blocks, allocated, free, utilization: allocated / (allocated + free), allocatedCount: events.filter((event) => event.block).length };
}

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

export function simulateFileAllocation(diskBlocks, fileSizes, algorithm) {
  if (!Number.isSafeInteger(diskBlocks) || diskBlocks < 1 || diskBlocks > 1000) {
    throw new Error("Disk block count must be a whole number between 1 and 1,000.");
  }
  if (!["sequential", "linked", "indexed"].includes(algorithm)) throw new Error("Choose a supported file allocation method.");
  if (!fileSizes.length || fileSizes.some((size) => !Number.isSafeInteger(size) || size < 1)) {
    throw new Error("Each file must request at least one whole block.");
  }
  const blocks = Array(diskBlocks).fill(null);
  const events = [];
  for (const [index, size] of fileSizes.entries()) {
    const file = `F${index + 1}`;
    let dataBlocks = [];
    let indexBlock = null;
    let explanation;
    if (algorithm === "sequential") {
      let runStart = -1;
      let runLength = 0;
      for (let block = 0; block <= blocks.length; block += 1) {
        if (block < blocks.length && blocks[block] === null) {
          if (runStart < 0) runStart = block;
          runLength += 1;
          if (runLength >= size) break;
        } else {
          runStart = -1;
          runLength = 0;
        }
      }
      if (runLength >= size) {
        dataBlocks = Array.from({ length: size }, (_, offset) => runStart + offset);
        dataBlocks.forEach((block) => { blocks[block] = { file, kind: "data" }; });
        explanation = `${file} receives ${size} consecutive blocks beginning at ${runStart}; sequential allocation requires one contiguous run.`;
      } else {
        explanation = `${file} needs ${size} consecutive blocks, but no free contiguous run is large enough.`;
      }
    } else {
      const freeBlocks = blocks.map((value, block) => value === null ? block : -1).filter((block) => block >= 0);
      if (algorithm === "linked" && freeBlocks.length >= size) {
        dataBlocks = freeBlocks.slice(0, size);
        dataBlocks.forEach((block, position) => { blocks[block] = { file, kind: "data", next: dataBlocks[position + 1] ?? null }; });
        explanation = `${file} links ${size} free blocks; the next pointer in each block identifies the next part of the file.`;
      } else if (algorithm === "indexed" && freeBlocks.length >= size + 1) {
        indexBlock = freeBlocks[0];
        dataBlocks = freeBlocks.slice(1, size + 1);
        blocks[indexBlock] = { file, kind: "index", pointsTo: dataBlocks.slice() };
        dataBlocks.forEach((block) => { blocks[block] = { file, kind: "data" }; });
        explanation = `${file} uses block ${indexBlock} as its index, which points to ${size} data blocks.`;
      } else {
        const required = algorithm === "indexed" ? size + 1 : size;
        explanation = `${file} needs ${required} free blocks; only ${freeBlocks.length} are available.`;
      }
    }
    events.push({ file, requested: size, allocated: dataBlocks.length, blocks: dataBlocks, indexBlock, explanation, disk: blocks.map((block) => block ? { ...block, pointsTo: block.pointsTo?.slice() } : null) });
  }
  const used = blocks.filter(Boolean).length;
  return { events, blocks, used, free: blocks.length - used, filesAllocated: events.filter((event) => event.allocated === event.requested).length };
}
