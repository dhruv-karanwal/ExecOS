// ExecOS · Paging & Segmentation · simulation algorithms
// Copied verbatim from (the app still runs from these originals):
//   frontend/src/algorithms.js lines 313-373
//   frontend/src/algorithms.js lines 375-391
//   frontend/src/algorithms.js lines 393-404

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
