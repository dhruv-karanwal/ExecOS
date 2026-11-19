// ExecOS · Disk Scheduling · visualizer UI and settings
// Copied verbatim from (the app still runs from these originals):
//   frontend/src/AlgorithmStudio.jsx lines 55-62
//   frontend/src/AlgorithmStudio.jsx lines 144-151
//   frontend/src/AlgorithmStudio.jsx lines 234-238
//   frontend/src/AlgorithmStudio.jsx lines 299-303
//   frontend/src/AlgorithmStudio.jsx lines 540-547
// Reference copy: these components use shared helpers (formatNumber, calculate, …) that stay in AlgorithmStudio.jsx.
import { Fragment, useEffect, useMemo, useState } from "react";

const algorithmOptions = {
  "Disk Scheduling": [
    ["fcfs", "First Come, First Served (FCFS)"],
    ["sstf", "Shortest Seek Time First (SSTF)"],
    ["scan", "SCAN"],
    ["cscan", "C-SCAN"],
    ["look", "LOOK"],
    ["clook", "C-LOOK"],
  ],
};

const descriptions = {
  "Disk Scheduling": {
    purpose: "Disk scheduling orders pending cylinder requests to reduce head movement while balancing request order and fairness.",
    example: "From head 50, an upward SCAN services higher cylinders, reaches the upper disk boundary, then reverses for lower requests.",
    pseudocode: "partition requests around the head\norder each side by direction\nservice the selected side\napply the policy's reverse or wrap rule\nsum every head movement",
    advantages: "Makes seek costs and direction policies visible on the same request queue.",
    disadvantages: "Seek distance is a simplified cost model; modern SSDs do not have mechanical seek heads.",
    complexity: "Varies by policy", space: "O(R)",
  },
};

const deepTheory = {
  "Disk Scheduling": [
    ["Why order requests?", "A mechanical disk has a moving head; seek distance approximates the work of moving between cylinders. The scheduler chooses the order of pending requests to balance total movement, latency, and fairness. This is a teaching cost model: SSDs have no moving head and use different internal scheduling and flash-management behavior."],
    ["Direction and sweep policies", "FCFS preserves request arrival order. SSTF repeatedly selects the nearest pending request, which can favor nearby requests. SCAN sweeps in one direction to the physical end, then reverses; C-SCAN services in one direction and wraps to the opposite end. LOOK and C-LOOK avoid traveling to an unused physical boundary: they turn or wrap at the last request in that direction. The visualized sequence is the source of truth for movement and total seek calculations."],
    ["Interpreting movement", "A request service is different from a boundary trip or circular wrap. SCAN/C-SCAN count the distance traveled to the edge, and C-SCAN counts the wrap distance in this simulator's total head movement. LOOK/C-LOOK avoid unused edge travel. Real schedulers may also consider request age, deadlines, workload shape, and device firmware."],
  ],
};

const legacyQuizFallback = {
  "Disk Scheduling": [
    { question: "Which policy sweeps to the disk end before reversing?", options: ["LOOK", "SCAN", "SSTF"], answer: 1, explanation: "SCAN travels to the physical boundary; LOOK turns at the last request." },
    { question: "What does C-SCAN do after servicing in one direction?", options: ["Wraps to the opposite end", "Reverses at every request", "Stops servicing requests"], answer: 0, explanation: "C-SCAN provides a circular sweep by returning to the opposite boundary." },
    { question: "Why can SSTF be unfair?", options: ["Far requests may wait behind nearby requests", "It ignores head position", "It always travels to both disk edges"], answer: 0, explanation: "Repeatedly choosing the closest request can postpone far-away requests." },
  ],
};

function DiskVisualization({ result, stepCount }) {
  const events = result.events.slice(0, stepCount);
  const sequence = [result.sequence[0], ...events.map((event) => event.to)];
  return <div className="disk-visual">
    <div className="disk-sequence" aria-label="Disk head sequence">{sequence.map((cylinder, index) => <span key={`${index}-${cylinder}`} className="disk-node"><b>{cylinder}</b><small>{index === 0 ? "START" : events[index - 1]?.kind === "wrap" ? "WRAP" : events[index - 1]?.kind === "edge" ? "EDGE" : "REQUEST"}</small></span>)}</div>
    <div className="disk-movements">{events.map((event, index) => <span key={`${event.from}-${event.to}-${index}`} className={event.kind === "wrap" ? "wrap" : ""}>{event.from} → {event.to}<small>{event.kind === "wrap" ? "jump" : `${event.distance} cyl`}</small></span>)}</div>
  </div>;
}
