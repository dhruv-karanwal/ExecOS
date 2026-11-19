// ExecOS · Page Replacement · simulation algorithms
// Copied verbatim from (the app still runs from these originals):
//   frontend/src/algorithms.js lines 235-240
//   frontend/src/algorithms.js lines 242-311

import { parseIntegerList } from "../_shared/algorithm-helpers.js";

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
