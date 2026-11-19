// ExecOS · File Allocation · simulation algorithms
// Copied verbatim from (the app still runs from these originals):
//   frontend/src/algorithms.js lines 599-655

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
