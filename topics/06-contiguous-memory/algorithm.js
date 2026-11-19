// ExecOS · Contiguous Memory · simulation algorithms
// Copied verbatim from (the app still runs from these originals):
//   frontend/src/algorithms.js lines 406-410
//   frontend/src/algorithms.js lines 412-462

import { parseIntegerList } from "../_shared/algorithm-helpers.js";

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
