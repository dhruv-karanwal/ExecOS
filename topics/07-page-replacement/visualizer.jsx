// ExecOS · Page Replacement · visualizer UI and settings
// Copied verbatim from (the app still runs from these originals):
//   frontend/src/AlgorithmStudio.jsx lines 64-64
//   frontend/src/AlgorithmStudio.jsx lines 168-175
//   frontend/src/AlgorithmStudio.jsx lines 250-254
//   frontend/src/AlgorithmStudio.jsx lines 316-321
//   frontend/src/AlgorithmStudio.jsx lines 549-555
// Reference copy: these components use shared helpers (formatNumber, calculate, …) that stay in AlgorithmStudio.jsx.
import { Fragment, useEffect, useMemo, useState } from "react";

const algorithmOptions = {
  "Page Replacement": [["fifo", "FIFO"], ["lru", "LRU"], ["optimal", "Optimal"], ["lfu", "LFU"], ["second_chance", "Second Chance (Clock)"]],
};

const descriptions = {
  "Page Replacement": {
    purpose: "When every frame is occupied, the OS chooses a resident page to evict before loading the requested page.",
    example: "FIFO evicts the oldest loaded page; LRU evicts the page whose last access is farthest in the past.",
    pseudocode: "for each page reference:\n  if resident: count a hit\n  else: count a fault\n    use an empty frame or choose a victim\n    load the page and update policy state",
    advantages: "Shows frame contents, hits, faults, and the precise victim decision for every reference.",
    disadvantages: "Optimal uses future references and is a benchmark, not an implementable online policy.",
    complexity: "O(N × F) in this teaching implementation", space: "O(N × F) including frame snapshots",
  },
};

const deepTheory = {
  "Page Replacement": [
    ["Pages and faults", "Virtual memory divides address spaces into pages and physical memory into frames. A page-table mapping tells the CPU where a resident page lives. If a referenced page is absent, a page fault transfers or creates it; when no frame is free, the OS chooses a resident page to evict. A hit ratio measures references served without a fault, while fault count is directly visible in the reference-by-reference trace."],
    ["Replacement choices", "FIFO removes the page loaded earliest. LRU removes the least recently used page and relies on past locality to predict future use. LFU removes the page with the smallest observed reference count; this implementation breaks ties by frame order and does not age old counts. Second Chance (Clock) scans a circular frame queue: a set reference bit is cleared and spared once, while the first clear bit is replaced. Optimal removes the page whose next use is farthest in the future, so it is an offline lower-bound benchmark, not a deployable online policy."],
    ["Tradeoffs", "Replacement decisions influence disk I/O and performance, but a page fault's real cost also depends on storage, dirty-page writeback, and working-set behavior. The same reference string and frame count are used for every policy comparison. More frames do not always reduce faults for every policy: FIFO can exhibit Belady's anomaly."],
  ],
};

const legacyQuizFallback = {
  "Page Replacement": [
    { question: "Which policy uses future references and is not online-implementable?", options: ["Optimal", "LRU", "FIFO"], answer: 0, explanation: "Optimal is a benchmark because it needs knowledge of future accesses." },
    { question: "A page hit occurs when...", options: ["The referenced page is already resident", "Every frame is full", "A process terminates"], answer: 0, explanation: "A resident mapping serves the access without a page fault." },
    { question: "What does LRU evict?", options: ["The least recently used resident page", "The most recently loaded page", "The page with the largest number"], answer: 0, explanation: "LRU uses recency of past references as its replacement signal." },
    { question: "What happens to a referenced frame in Second Chance?", options: ["Its bit is cleared and it gets another turn", "It is always evicted immediately", "It is pinned permanently"], answer: 0, explanation: "Clock scans past frames with a set reference bit after clearing it, replacing the first frame whose bit is clear." },
  ],
};

function PageVisualization({ events, frameCount, algorithm }) {
  const current = events.at(-1);
  return <div className="page-visual">
    <div className="page-frames">{Array.from({ length: frameCount }, (_, index) => <div className={`page-frame ${current?.frameIndex === index ? current.hit ? "hit" : "fault" : ""}`} key={index}><small>FRAME {index + 1}{algorithm === "second_chance" && current ? ` · R${Number(current.referenced[index])}` : ""}</small><strong>{current?.frames[index] ?? "—"}</strong></div>)}</div>
    <div className="page-history">{events.map((event) => <span key={event.index} className={event.hit ? "hit" : "fault"} title={event.explanation}>{event.page}<small>{event.hit ? "HIT" : "FAULT"}</small></span>)}</div>
  </div>;
}
