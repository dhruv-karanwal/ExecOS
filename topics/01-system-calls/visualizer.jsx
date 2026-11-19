// ExecOS · System Calls · visualizer UI and settings
// Copied verbatim from (the app still runs from these originals):
//   frontend/src/AlgorithmStudio.jsx lines 67-67
//   frontend/src/AlgorithmStudio.jsx lines 281-285
//   frontend/src/AlgorithmStudio.jsx lines 350-354
//   frontend/src/AlgorithmStudio.jsx lines 1347-1356
//   frontend/src/AlgorithmStudio.jsx lines 1358-1420
//   frontend/src/AlgorithmStudio.jsx lines 1252-1260
// Reference copy: these components use shared helpers (formatNumber, calculate, …) that stay in AlgorithmStudio.jsx.
import { Fragment, useEffect, useMemo, useState } from "react";

const algorithmOptions = {
  "System Calls": [],
};

const deepTheory = {
  "System Calls": [
    ["The user/kernel boundary", "Applications normally cannot execute privileged operations directly. A system-call interface lets a program request a service such as creating a process, reading a file, or allocating memory. A library wrapper places the service number and arguments in the expected ABI format, then a controlled trap or syscall instruction transfers execution to kernel mode."],
    ["Validation and return", "The kernel checks the operation and its arguments, verifies permissions and resource constraints, performs the service, then returns a result or error code. The transition does not mean every API call enters the kernel: libraries can satisfy some requests in user space. In ExecOS, the workbench exposes a limited authenticated Engine API and records supported calls in its Engine trace; it does not invoke host system calls."],
    ["Why the boundary matters", "Privilege separation protects kernel-owned state from arbitrary application code. The interface must validate pointers, lengths, identifiers, and permissions because caller input is not inherently trustworthy. System-call results, errors, and trace events make the boundary observable without giving this teaching UI access to the host OS."],
  ],
};

const legacyQuizFallback = {
  "System Calls": [
    { question: "Why does a program use a system call?", options: ["To request a protected OS service", "To bypass kernel validation", "To change CPU hardware directly"], answer: 0, explanation: "The syscall interface is the controlled boundary for privileged services." },
    { question: "What typically happens after a syscall enters the kernel?", options: ["Arguments are validated and a result is returned", "The program gains permanent kernel privilege", "The OS ignores the request"], answer: 0, explanation: "The kernel validates the request, performs an allowed operation, and returns a result or error." },
    { question: "Does every library function require a syscall?", options: ["No; some work entirely in user space", "Yes, always", "Only functions with integer arguments"], answer: 0, explanation: "A library wrapper may do work locally or make one or more syscalls as needed." },
  ],
};

const systemCallExamples = {
  sys_open: { path: "/ExecOS/system/kernel.conf" },
  sys_read: { fd: 3 },
  sys_write: { fd: 3, content: "ExecOS learning lab" },
  sys_close: { fd: 3 },
  sys_create_process: { name: "lab-worker", burst_time: 3, priority: 5, memory_mb: 32 },
  sys_terminate_process: { pid: "P104" },
  sys_allocate_memory: { pid: "P101", size_mb: 64 },
  sys_release_memory: { pid: "P101", size_mb: 64 },
};

function SystemCallLab({ engineState, onRunSystemCall, onOpenModule }) {
  const [view, setView] = useState("engine");
  const [name, setName] = useState("sys_open");
  const [argumentsText, setArgumentsText] = useState(JSON.stringify(systemCallExamples.sys_open, null, 2));
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [lifecycleStep, setLifecycleStep] = useState(0);
  const lifecycle = [
    { operation: "fork()", parent: "RUNNING", child: "CREATED", explanation: "fork creates a child process with a separate process identity and inherited execution context. The parent receives the child ID; the child receives a zero return value." },
    { operation: "exec()", parent: "RUNNING", child: "NEW PROGRAM", explanation: "The child calls exec to replace its process image with a new program. The process identity remains; its code, data, stack, and arguments are replaced." },
    { operation: "wait()", parent: "BLOCKED IN WAIT", child: "RUNNING", explanation: "The parent waits for the child to finish. It blocks or reaps an already-terminated child, depending on timing." },
    { operation: "exit()", parent: "AWAKENED / REAPS", child: "TERMINATED", explanation: "The child exits with a status. The kernel records the status and wakes the waiting parent, which collects it with wait." },
  ];
  const steps = [
    ["USER REQUEST", "Choose a supported system call and prepare its arguments in the user-facing request."],
    ["VALIDATE", "ExecOS checks the call name, JSON arguments, process IDs, paths, and resource limits."],
    ["ENGINE SERVICE", "The authenticated Kernel Engine performs the selected simulated OS service."],
    ["RESULT & TRACE", "The result is returned to the UI and the Engine records supported actions in its execution history."],
  ];
  async function invoke() {
    setError("");
    setResult(null);
    let args;
    try {
      args = JSON.parse(argumentsText);
      if (!args || Array.isArray(args) || typeof args !== "object") throw new Error("Arguments must be a JSON object.");
    } catch (caught) {
      setError(`Arguments must be a valid JSON object: ${caught.message}`);
      setStep(1);
      return;
    }
    setBusy(true);
    try {
      const response = await onRunSystemCall(name, args);
      setResult(response);
      setStep(3);
    } catch (caught) {
      setError(caught.message);
      setStep(1);
    } finally {
      setBusy(false);
    }
  }
  return <div className="concept-lab">
    <FlowVisualization title="System-call request path" steps={steps} step={step} onStepChange={setStep} />
    <section className="lab-panel syscall-lab">
      <div className="lab-panel-heading"><div><span className="eyebrow">{view === "engine" ? "LIVE EXECOS KERNEL ENGINE" : "CONCEPTUAL PROCESS MODEL"}</span><h3>{view === "engine" ? "Invoke a supported system call" : "Model process creation and exit"}</h3></div><span>{view === "engine" ? engineState ? `ENGINE TICK ${engineState.engine.clock_tick}` : "ENGINE UNAVAILABLE" : "SIMULATION ONLY"}</span></div>
      <div className="translation-tabs" role="group" aria-label="System call lab mode"><button type="button" className={view === "engine" ? "selected" : ""} aria-pressed={view === "engine"} onClick={() => setView("engine")}>Supported Engine calls</button><button type="button" className={view === "lifecycle" ? "selected" : ""} aria-pressed={view === "lifecycle"} onClick={() => setView("lifecycle")}>fork · exec · wait · exit</button></div>
      {view === "engine" && <>
      <div className="syscall-form">
        <label>System call<select value={name} disabled={busy} onChange={(event) => { const nextName = event.target.value; setName(nextName); setArgumentsText(JSON.stringify(systemCallExamples[nextName], null, 2)); setResult(null); setError(""); setStep(0); }}>{Object.keys(systemCallExamples).map((call) => <option key={call} value={call}>{call}</option>)}</select></label>
        <label>Arguments JSON<textarea rows={5} spellCheck="false" value={argumentsText} disabled={busy} onChange={(event) => { setArgumentsText(event.target.value); setResult(null); setError(""); setStep(0); }} /></label>
        <div className="step-controls"><button type="button" className="lab-primary" onClick={invoke} disabled={busy || !engineState}>{busy ? "Invoking…" : "Invoke in simulated Engine"}</button><button type="button" className="lab-secondary" onClick={() => onOpenModule("System Calls")}>Open full syscall workbench ↗</button><span className="step-counter">Simulation only · does not call host OS APIs</span></div>
      </div>
      {error && <p className="lab-validation" role="alert">{error}</p>}
      {result && <div className="syscall-result" role="status"><div><span className="eyebrow">ENGINE RESULT</span><strong>{result.status || "Call completed"}</strong></div><pre>{JSON.stringify(result, null, 2)}</pre></div>}
      </>}
      {view === "lifecycle" && <div className="syscall-lifecycle"><div className="lab-panel-heading"><div><span className="eyebrow">CONCEPTUAL PROCESS LIFECYCLE</span><h3>{lifecycle[lifecycleStep].operation}</h3></div><span>STEP {lifecycleStep + 1} / {lifecycle.length}</span></div><div className="sync-process-row"><article className="sync-process"><span>PARENT</span><strong>P1</strong><small>{lifecycle[lifecycleStep].parent}</small></article><div className="sync-mutex"><span>SYSTEM CALL</span><strong>{lifecycle[lifecycleStep].operation}</strong><small>user mode → kernel mode → return</small></div><article className="sync-process"><span>CHILD</span><strong>P2</strong><small>{lifecycle[lifecycleStep].child}</small></article></div><div className="how-it-works"><span className="eyebrow">PROCESS CONTROL</span><p>{lifecycle[lifecycleStep].explanation}</p></div><div className="step-controls"><button type="button" className="lab-secondary" disabled={lifecycleStep === 0} onClick={() => setLifecycleStep((index) => index - 1)}>← Previous</button><button type="button" className="lab-primary" onClick={() => setLifecycleStep((index) => (index + 1) % lifecycle.length)}>{lifecycleStep === lifecycle.length - 1 ? "↻ Replay" : "Next lifecycle event →"}</button><span className="step-counter">Concept only · fork/exec/wait/exit are not supported Engine calls</span></div></div>}
    </section>
  </div>;
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
