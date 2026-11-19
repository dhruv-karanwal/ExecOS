// ExecOS · Deadlocks · visualizer UI and settings
// Copied verbatim from (the app still runs from these originals):
//   frontend/src/AlgorithmStudio.jsx lines 65-65
//   frontend/src/AlgorithmStudio.jsx lines 176-183
//   frontend/src/AlgorithmStudio.jsx lines 255-259
//   frontend/src/AlgorithmStudio.jsx lines 322-327
//   frontend/src/AlgorithmStudio.jsx lines 561-565
// Reference copy: these components use shared helpers (formatNumber, calculate, …) that stay in AlgorithmStudio.jsx.
import { Fragment, useEffect, useMemo, useState } from "react";

const algorithmOptions = {
  Deadlock: [["banker", "Banker's safety algorithm"], ["detection", "Deadlock detection algorithm"]],
};

const descriptions = {
  Deadlock: {
    purpose: "Banker's safety test checks maximum claims before granting resources; deadlock detection checks current outstanding requests to identify processes that cannot finish now.",
    example: "A process can finish when its remaining Need is component-wise no greater than the current Work vector.",
    pseudocode: "Work = Available\nrepeat:\n  find unfinished process with Need <= Work\n  Work += its Allocation\n  mark it finished\nsafe iff all processes finish",
    advantages: "Returns a concrete safe sequence or the blocked processes that prevent one.",
    disadvantages: "Requires known maximum claims in advance and is a safety test, not a full production deadlock detector.",
    complexity: "O(P² × R)", space: "O(P × R)",
  },
};

const deepTheory = {
  Deadlock: [
    ["Deadlock avoidance and detection", "Banker's safety testing is an avoidance technique: it uses declared maximum claims to check whether a proposed allocation preserves a safe completion order. Detection instead examines current outstanding requests and allocations; if no unfinished process can proceed and release its resources, the remaining processes are reported as deadlocked in this snapshot."],
    ["Safety test mechanics", "For each process, Need = Maximum − Allocation. The checker starts with Work = Available, finds an unfinished process whose Need is no greater than Work for every resource type, then simulates that process finishing and returning its Allocation to Work. It repeats until all processes finish or no eligible process remains. If all finish, the order is a safe sequence; otherwise the remainder is the blocked set."],
    ["Assumptions and limits", "The model assumes known maximum resource claims, a fixed set of resource types, and that completed processes release their allocated resources. It is a safety test, not a complete detector for arbitrary resource graphs and not a real Engine resource grant. A currently unsafe state may still run for a while, but it has no guaranteed completion sequence under the assumptions."],
  ],
};

const legacyQuizFallback = {
  Deadlock: [
    { question: "What does a safe sequence demonstrate?", options: ["Every process can finish in that order", "No process ever needs resources", "All requests arrive together"], answer: 0, explanation: "Each next process can obtain its remaining Need and return its Allocation." },
    { question: "How is Need computed in the Banker's safety test?", options: ["Maximum − Allocation", "Available + Maximum", "Allocation − Available"], answer: 0, explanation: "Need is the remaining resource claim for each process." },
    { question: "An unsafe state means...", options: ["No safe completion order was found", "The system has already crashed", "Every process is deadlocked now"], answer: 0, explanation: "Unsafe means completion is not guaranteed under the model; it does not prove an immediate deadlock." },
    { question: "What does deadlock detection examine?", options: ["Current requests and allocations", "Only each process's maximum future claim", "Disk head direction"], answer: 0, explanation: "Detection applies the current outstanding request matrix and available vector, returning released allocations for processes that can finish." },
  ],
};

function ResourceVisualization({ result, complete }) {
  const current = result.events.at(-1);
  const resources = current?.after || (result.events[0]?.before ?? result.availableAfter);
  return <div className={`banker-status ${complete ? result.safe ? "safe" : "unsafe" : ""}`}><strong>{complete ? result.method === "detection" ? result.safe ? "NO DEADLOCK DETECTED" : "DEADLOCK DETECTED" : result.safe ? "SAFE STATE" : "UNSAFE STATE" : result.method === "detection" ? "DETECTION IN PROGRESS" : "SAFETY CHECK IN PROGRESS"}</strong><span>{complete ? result.safe ? result.sequence.join(" → ") || "No processes hold resources" : `Blocked: ${result.blocked.join(", ")}` : current ? `${result.sequence.slice(0, result.events.length).join(" → ")} · checking remaining processes` : "Advance steps to test which process can finish next."}</span><div className="resource-pills">{resources.map((value, index) => <span key={index}>R{index + 1}<b>{value}</b></span>)}</div></div>;
}
