// ExecOS · Contiguous Memory · visualizer UI and settings
// Copied verbatim from (the app still runs from these originals):
//   frontend/src/AlgorithmStudio.jsx lines 63-63
//   frontend/src/AlgorithmStudio.jsx lines 152-159
//   frontend/src/AlgorithmStudio.jsx lines 239-243
//   frontend/src/AlgorithmStudio.jsx lines 304-309
//   frontend/src/AlgorithmStudio.jsx lines 557-559
// Reference copy: these components use shared helpers (formatNumber, calculate, …) that stay in AlgorithmStudio.jsx.
import { Fragment, useEffect, useMemo, useState } from "react";

const algorithmOptions = {
  "Memory Management": [["first_fit", "First Fit"], ["best_fit", "Best Fit"], ["worst_fit", "Worst Fit"], ["next_fit", "Next Fit"]],
};

const descriptions = {
  "Memory Management": {
    purpose: "Contiguous allocation places each process into one free block. First, Best, Worst, and Next Fit differ in how they search for a suitable region.",
    example: "Next Fit resumes its search after the block used for the previous allocation, wrapping to the beginning only when needed.",
    pseudocode: "for each process:\n  search free blocks using the selected fit policy\n  allocate from the chosen block\n  for Next Fit, resume after that block next time\n  record failure when no block fits",
    advantages: "Simple to reason about and compare; shows how block choices affect the remaining space.",
    disadvantages: "This partition model does not represent paging, compaction, or real physical address translation.",
    complexity: "O(P × B)", space: "O(P × (B + P)) including trace snapshots",
  },
};

const deepTheory = {
  "Memory Management": [
    ["Contiguous allocation", "A process receives a region of contiguous address space from a free block. This model splits blocks as allocations consume space; each process is assigned to at most one block. Internal fragmentation is unused space inside an allocated region, while external fragmentation is free space divided among regions too small for a request. This lab models remaining space within each original block, rather than a full address map."],
    ["Fit policies", "First Fit scans from the beginning and takes the first block with enough free space. Best Fit chooses the smallest block that can satisfy the request, aiming to leave a small remainder. Worst Fit chooses the largest fitting block, leaving a larger remainder. The policy changes placement and future fit options; no policy is universally best because results depend on request order and workload distribution."],
    ["Limits and real systems", "Modern general-purpose systems predominantly combine paging, virtual address spaces, physical frames, and kernel allocators rather than choosing one large contiguous partition per process. Compare the block visualization and allocation table to see whether later requests fail even when total free memory remains: free capacity alone does not guarantee a suitable region."],
  ],
};

const legacyQuizFallback = {
  "Memory Management": [
    { question: "Which fit policy chooses the first adequate block in scan order?", options: ["First Fit", "Best Fit", "Worst Fit"], answer: 0, explanation: "First Fit takes the first free block that satisfies the request." },
    { question: "External fragmentation means...", options: ["Free space is split into separate regions", "A process has no address space", "Every block is fully occupied"], answer: 0, explanation: "The total free amount may be enough, but no individual region may fit." },
    { question: "What does Best Fit select?", options: ["The smallest block that can satisfy the request", "The first block regardless of size", "The largest block always"], answer: 0, explanation: "Best Fit minimizes the chosen block's leftover space for that request." },
    { question: "Where does Next Fit resume its search?", options: ["After its previous allocation", "At the largest free block", "At the beginning for every request"], answer: 0, explanation: "Next Fit carries the search cursor forward and wraps around the block list when needed." },
  ],
};

function MemoryVisualization({ blocks, total }) {
  return <div className="memory-visual" aria-label="Memory blocks">{blocks.map((block) => <div key={block.id} className={`memory-visual-block ${block.free ? "free" : ""}`} style={{ flexGrow: block.size }} title={`${block.id}: ${block.free} free of ${block.size}`}><strong>{block.id}</strong><small>{block.free} free / {block.size}</small>{block.allocations.map((allocation) => <i key={allocation.id} style={{ flexGrow: allocation.size }} title={`${allocation.id} · ${allocation.size}`}><small>{allocation.id} · {allocation.size}</small></i>)}</div>)}<span className="visual-total">{total} units</span></div>;
}
