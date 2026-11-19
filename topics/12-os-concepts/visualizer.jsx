// ExecOS · OS Concepts · visualizer UI and settings
// Copied verbatim from (the app still runs from these originals):
//   frontend/src/AlgorithmStudio.jsx lines 68-68
//   frontend/src/AlgorithmStudio.jsx lines 286-290
//   frontend/src/AlgorithmStudio.jsx lines 355-359
//   frontend/src/AlgorithmStudio.jsx lines 218-226
//   frontend/src/AlgorithmStudio.jsx lines 849-907
//   frontend/src/AlgorithmStudio.jsx lines 1272-1345
//   frontend/src/AlgorithmStudio.jsx lines 1252-1260
// Reference copy: these components use shared helpers (formatNumber, calculate, …) that stay in AlgorithmStudio.jsx.
import { Fragment, useEffect, useMemo, useState } from "react";

const algorithmOptions = {
  "OS Concepts": [],
};

const deepTheory = {
  "OS Concepts": [
    ["Processes and concurrency", "A process is an executing program with its own address space and resources. The OS represents it with a process control block containing identifiers, state, scheduling data, and resource references. Threads share a process's address space while holding their own execution context. Context switching saves one execution context and restores another, allowing the CPU to interleave work."],
    ["Memory, storage, and protection", "Virtual memory gives each process a protected address space. Page tables map virtual pages to physical frames; caches and the translation lookaside buffer accelerate address translation. Filesystems present named persistent data while device drivers manage hardware-specific operations. These are connected layers, not a single interchangeable pool of memory."],
    ["Coordination and observability", "Processes communicate through mechanisms such as message queues and shared memory. Locks and semaphores coordinate access to shared state; incorrect acquisition order can create deadlock. Interrupts notify the CPU about asynchronous events, while execution traces record observable transitions. ExecOS visualizes these ideas in an isolated software Engine and does not imply that its simulated state is the host's live kernel state."],
  ],
};

const legacyQuizFallback = {
  "OS Concepts": [
    { question: "What does a process control block primarily hold?", options: ["Execution and resource state for a process", "Only the source code", "Only the file directory"], answer: 0, explanation: "The PCB represents process identity, state, scheduling context, and related resources." },
    { question: "What is a context switch?", options: ["Saving one execution context and restoring another", "Replacing a file allocation method", "A page fault with no frame"], answer: 0, explanation: "The OS switches CPU execution from one process/thread context to another." },
    { question: "What does a page table map?", options: ["Virtual pages to physical frames", "Processes to disk policies", "Interrupts to filenames"], answer: 0, explanation: "Page tables translate a process's virtual addresses into physical memory mappings." },
  ],
};

const conceptCards = [
  ["Process lifecycle", "NEW → READY → RUNNING → WAITING → TERMINATED", "Processes, dispatch, pause/resume, and PCB tracing", "Processes"],
  ["Virtual memory", "Virtual pages map onto physical frames", "Page tables, FIFO/LRU replacement, and page faults", "Storage"],
  ["Synchronization & IPC", "Processes coordinate through shared resources and messages", "Engine message queues, resource requests, and interrupt-driven I/O", "IPC"],
  ["System calls", "A controlled interface between a program and OS services", "Invoke supported process, memory, and filesystem calls", "System Calls"],
  ["Files & devices", "The OS manages named data and shared hardware resources", "Virtual filesystem actions and device request queues", "File System"],
  ["Directory structures", "Directories map names to files and subdirectories", "Follow a path through a hierarchical directory tree", "File System"],
  ["Execution trace", "An event history makes state transitions observable", "Filter events by process and Engine module", "Execution Trace"],
];

const conceptVisuals = [
  { title: "Process lifecycle", section: "Processes", steps: [
    ["NEW", "The OS admits a process and creates its process control block."],
    ["READY", "The process is eligible to run and waits in the scheduler's ready queue."],
    ["RUNNING", "The dispatcher gives the process a CPU time slice."],
    ["WAITING", "An I/O operation or event blocks the process until it can continue."],
    ["TERMINATED", "The process exits and the OS reclaims its resources."],
  ] },
  { title: "Virtual memory", section: "Storage", steps: [
    ["VIRTUAL ADDRESS", "A running process generates an address in its private virtual address space."],
    ["PAGE TABLE", "The memory-management unit consults the process mapping for the virtual page."],
    ["PHYSICAL FRAME", "A resident mapping identifies the physical frame that holds the page."],
    ["PAGE FAULT", "If the page is absent, the OS resolves the fault and may replace a frame."],
  ] },
  { title: "Paging & segmentation", section: "Storage", steps: [
    ["LOGICAL ADDRESS", "A process issues a logical address that the memory manager must validate and translate."],
    ["PAGE OR SEGMENT", "Paging splits the address into page and offset; segmentation identifies a logical region and offset."],
    ["TABLE LOOKUP", "A page table supplies a frame, or a segment descriptor supplies base and limit."],
    ["CHECK & TRANSLATE", "Preserve the page offset or check the segment bound before producing a physical address."],
  ] },
  { title: "Synchronization & IPC", section: "IPC", steps: [
    ["SENDER", "A process prepares data to communicate to another process."],
    ["CHOOSE IPC", "Select message passing or shared memory; shared memory needs synchronization for concurrent access."],
    ["CHANNEL / SHARED REGION", "The OS can mediate a message queue, or map a shared region into both processes."],
    ["RECEIVER", "The receiving process reads the message or shared data after the required coordination."],
  ] },
  { title: "Process synchronization", section: "IPC", steps: [
    ["LOCK AVAILABLE", "The mutex starts unlocked. P1 and P2 are ready to compete for the critical section."],
    ["P1 ACQUIRES", "P1 atomically acquires the mutex; ownership prevents P2 from entering."],
    ["P1 CRITICAL SECTION", "P1 updates shared state while holding exclusive access."],
    ["P2 BLOCKS", "P2 attempts to acquire the held mutex and waits rather than racing P1."],
    ["P1 RELEASES", "P1 leaves the critical section and releases the mutex so the waiter can proceed."],
    ["P2 ENTERS & RELEASES", "P2 acquires the available mutex, enters safely, and releases it when done."],
  ] },
  { title: "System-call boundary", section: "System Calls", steps: [
    ["USER PROGRAM", "Application code asks a library wrapper for an OS service."],
    ["VALIDATE", "The syscall boundary checks the operation and caller-supplied arguments."],
    ["KERNEL SERVICE", "The privileged OS performs an allowed operation or returns an error."],
    ["RESULT", "A result or error code returns to user mode; the trace can record the event."],
  ] },
  { title: "Files & devices", section: "File System", steps: [
    ["APPLICATION REQUEST", "A process asks to read, write, or create a named resource."],
    ["OS ABSTRACTION", "The filesystem or device layer resolves names and checks access."],
    ["DEVICE QUEUE", "A driver or simulated device orders and services work."],
    ["COMPLETION", "The OS reports the result and wakes any waiting process."],
  ] },
  { title: "Directory structures", section: "File System", steps: [
    ["ROOT", "Path resolution begins at the root directory or the process's current directory."],
    ["DIRECTORY ENTRY", "Each path component is looked up in its parent directory."],
    ["SUBDIRECTORY", "Intermediate components lead to a child directory or another namespace."],
    ["FILE METADATA", "The final name resolves to file metadata and its allocated storage blocks."],
  ] },
  { title: "Execution trace", section: "Execution Trace", steps: [
    ["OPERATION", "A scheduler, process, memory, or filesystem action begins."],
    ["EVENT", "The Engine records the operation and its relevant identifiers."],
    ["STATE CHANGE", "The process or subsystem state is updated by the Engine."],
    ["INSPECTION", "A trace view filters the recorded event to explain what changed."],
  ] },
];

function ConceptDiagram({ title, step, steps, onStepChange }) {
  const node = (label, detail, stepIndex, key = label) => (
    <div className={`concept-diagram-node ${stepIndex === step ? "active" : stepIndex < step ? "visited" : ""}`} key={key}>
      <strong>{label}</strong>
      <span>{detail}</span>
    </div>
  );
  const flow = (nodes) => <div className="concept-diagram-flow">{nodes.map(([label, detail, stepIndex], index) => (
    <Fragment key={label}>
      {node(label, detail, stepIndex)}
      {index < nodes.length - 1 && <span className="concept-diagram-arrow" aria-hidden="true">→</span>}
    </Fragment>
  ))}</div>;
  const label = `${title} concept diagram`;
  let diagram;

  if (title === "Process lifecycle") {
    diagram = <>
      {flow([["NEW", "admitted", 0], ["READY", "waiting for CPU", 1], ["RUNNING", "using the CPU", 2], ["TERMINATED", "resources released", 4]])}
      <div className="concept-diagram-branch-label">A running process may block for an event</div>
      {flow([["RUNNING", "I/O request", 2], ["WAITING", "event in progress", 3], ["READY", "event completed", 1]])}
    </>;
  } else if (title === "Virtual memory") {
    diagram = <>
      {flow([["PROCESS", "virtual address", 0], ["MMU", "translate address", 1], ["PAGE TABLE", "find page mapping", 1], ["FRAME", "physical memory", 2]])}
      <div className="concept-diagram-branch-label">If the page is not resident</div>
      {flow([["PAGE TABLE", "no resident mapping", 1], ["PAGE FAULT", "OS loads page", 3], ["FRAME", "mapping is updated", 3]])}
    </>;
  } else if (title === "Paging & segmentation") {
    diagram = <>
      <div className="concept-diagram-lane"><b>Paging</b>{flow([["ADDRESS", "page + offset", 0], ["PAGE TABLE", "page → frame", 2], ["PHYSICAL", "frame + offset", 3]])}</div>
      <div className="concept-diagram-lane"><b>Segmentation</b>{flow([["ADDRESS", "segment + offset", 1], ["DESCRIPTOR", "base + limit", 2], ["PHYSICAL", "base + offset", 3]])}</div>
    </>;
  } else if (title === "Synchronization & IPC") {
    diagram = <>
      {flow([["P1 · SENDER", "prepare data", 0], ["IPC METHOD", "message or shared memory", 1], ["P2 · RECEIVER", "read data", 3]])}
      <div className="concept-diagram-lane"><b>Message passing</b>{flow([["P1", "send(message)", 0], ["KERNEL QUEUE", "buffer / deliver", 2], ["P2", "receive(message)", 3]])}</div>
      <div className="concept-diagram-lane"><b>Shared memory</b>{flow([["P1", "write shared region", 0], ["MUTEX / SEMAPHORE", "coordinate access", 1], ["P2", "read shared region", 3]])}</div>
    </>;
  } else if (title === "Process synchronization") {
    diagram = <>
      {flow([["P1 + P2", "compete for lock", 0], ["MUTEX", "one owner at a time", 1], ["CRITICAL SECTION", "protected shared update", 2]])}
      <div className="concept-diagram-branch-label">The second process waits until the lock is released</div>
      {flow([["P2", "blocked while P1 owns lock", 3], ["MUTEX", "P1 releases ownership", 4], ["P2", "acquires lock and proceeds", 5]])}
    </>;
  } else if (title === "System-call boundary") {
    diagram = flow([["USER MODE", "application request", 0], ["TRAP / SYSCALL", "controlled entry", 1], ["KERNEL MODE", "validate and perform service", 2], ["RETURN", "result or error", 3]]);
  } else if (title === "Files & devices") {
    diagram = flow([["PROCESS", "read or write request", 0], ["OS LAYER", "resolve and check access", 1], ["DEVICE QUEUE", "driver schedules I/O", 2], ["COMPLETION", "wake waiting process", 3]]);
  } else if (title === "Directory structures") {
    diagram = <div className="concept-directory-tree" role="list" aria-label="Example directory hierarchy">
      {node("/", "root directory", 0)}
      <span aria-hidden="true">↓</span>
      {node("home/", "directory entry", 1)}
      <span aria-hidden="true">↓</span>
      {node("student/", "subdirectory", 2)}
      <span aria-hidden="true">↓</span>
      {node("notes.txt", "resolved file", 3)}
    </div>;
  } else {
    diagram = flow([["OPERATION", "request begins", 0], ["EVENT", "Engine records action", 1], ["STATE CHANGE", "subsystem is updated", 2], ["TRACE", "inspect the recorded result", 3]]);
  }

  const current = steps[step];
  return <section className="concept-model-panel" role="group" aria-label={label}>
    <div className="concept-model-heading"><div><span className="eyebrow">INTERACTIVE CONCEPT MODEL</span><strong>{title}</strong></div><span>Step {step + 1} of {steps.length}</span></div>
    <div className="concept-model-canvas">{diagram}</div>
    <div className="how-it-works"><span className="eyebrow">{current[0]}</span><p>{current[1]}</p></div>
    <div className="step-controls">
      <button type="button" className="lab-secondary" onClick={() => onStepChange(Math.max(0, step - 1))} disabled={step === 0}>← Previous</button>
      <button type="button" className="lab-primary" onClick={() => onStepChange((step + 1) % steps.length)}>{step === steps.length - 1 ? "↻ Replay" : "Next step →"}</button>
    </div>
  </section>;
}

function FlowVisualization({ title, steps, step, onStepChange }) {
  const current = steps[step];
  return <section className="lab-panel concept-visual-panel">
    <div className="lab-panel-heading"><div><span className="eyebrow">STEP-THROUGH VISUALIZATION</span><h3>{title}</h3></div><span>{step + 1} / {steps.length}</span></div>
    <div className="concept-flow">{steps.map(([label], index) => <div className={`concept-flow-step ${index === step ? "active" : index < step ? "visited" : ""}`} key={label}><span>{String(index + 1).padStart(2, "0")}</span><strong>{label}</strong></div>)}</div>
    <div className="how-it-works"><span className="eyebrow">WHAT HAPPENS AT THIS STEP</span><p>{current[1]}</p></div>
    <div className="step-controls"><button type="button" className="lab-secondary" onClick={() => onStepChange(Math.max(0, step - 1))} disabled={step === 0}>← Previous</button><button type="button" className="lab-primary" onClick={() => onStepChange((step + 1) % steps.length)}>{step === steps.length - 1 ? "↻ Replay" : "Next step →"}</button></div>
  </section>;
}
