// ExecOS · File Allocation · visualizer UI and settings
// Copied verbatim from (the app still runs from these originals):
//   frontend/src/AlgorithmStudio.jsx lines 66-66
//   frontend/src/AlgorithmStudio.jsx lines 184-191
//   frontend/src/AlgorithmStudio.jsx lines 260-264
//   frontend/src/AlgorithmStudio.jsx lines 328-333
//   frontend/src/AlgorithmStudio.jsx lines 567-569
// Reference copy: these components use shared helpers (formatNumber, calculate, …) that stay in AlgorithmStudio.jsx.
import { Fragment, useEffect, useMemo, useState } from "react";

const algorithmOptions = {
  "File Management": [["sequential", "Sequential allocation"], ["linked", "Linked allocation"], ["indexed", "Indexed allocation"]],
};

const descriptions = {
  "File Management": {
    purpose: "File allocation maps logical file contents to disk blocks using sequential, linked, or indexed organization.",
    example: "Sequential allocation needs a contiguous run; linked allocation can chain free blocks; indexed allocation reserves an index block.",
    pseudocode: "for each file:\n  choose free block(s) using the selected method\n  reserve data blocks (and index block if required)\n  record the resulting address structure",
    advantages: "Compares contiguity, pointer overhead, and direct block lookup using one disk layout.",
    disadvantages: "This simulator uses a bounded block map and does not model permissions or persistent storage.",
    complexity: "O(F × D) in this teaching implementation", space: "O(D)",
  },
};

const deepTheory = {
  "File Management": [
    ["Allocation and access", "A filesystem maps a file's logical byte range to physical storage blocks and maintains names and metadata in directories. Allocation strategy changes how block addresses are organized. Sequential/contiguous allocation stores neighboring file blocks together; linked allocation chains blocks; indexed allocation stores data-block addresses in an index block."],
    ["Compare the layouts", "Contiguous placement supports efficient sequential and direct access but needs a sufficiently large run and can fragment free space. Linked allocation can use scattered blocks and grows easily, but following pointers is required for random access and pointer damage is costly. Indexed allocation supports direct lookup through an index, at the cost of metadata space and index capacity. This lab visualizes bounded block allocation; it does not persist files."],
    ["OS filesystem responsibilities", "A real filesystem must also handle naming, permissions, metadata consistency, caching, concurrent access, crash recovery, and storage-device errors. The simulated block map is deliberately isolated from the user's host files. Compare method outcomes using the same file sizes to see both the allocation layout and whether all requested blocks fit."],
  ],
};

const legacyQuizFallback = {
  "File Management": [
    { question: "Which allocation method follows pointers to traverse a file?", options: ["Linked", "Sequential", "Indexed"], answer: 0, explanation: "Linked allocation chains data blocks through pointers." },
    { question: "What is a common advantage of indexed allocation?", options: ["Direct lookup via an index", "No metadata overhead", "It always needs contiguous blocks"], answer: 0, explanation: "An index maps logical positions to data blocks without traversing the whole chain." },
    { question: "What is a main limitation of contiguous allocation?", options: ["It needs a large enough adjacent free run", "It cannot read sequentially", "It stores no block locations"], answer: 0, explanation: "A file needs adjacent blocks, which may be unavailable despite enough total free blocks." },
    { question: "What does a hierarchical directory organize?", options: ["Names in parent-child paths", "CPU time slices", "Physical memory frames"], answer: 0, explanation: "A directory tree lets the OS resolve a path by traversing names from a starting directory." },
  ],
};

function FileVisualization({ result }) {
  return <div className="file-block-map" aria-label="Disk block allocation">{result.blocks.map((block, index) => <span className={block ? `file-block ${block.kind}` : "file-block"} key={index} title={block ? `${block.file} ${block.kind}${block.next !== undefined ? ` · next ${block.next ?? "END"}` : ""}${block.pointsTo ? ` · points to ${block.pointsTo.join(", ")}` : ""}` : `Block ${index} free`}>{block ? block.kind === "index" ? `${block.file}*` : block.file : index}</span>)}</div>;
}
