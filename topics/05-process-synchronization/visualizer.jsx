// ExecOS · Process Synchronization · visualizer UI and settings
// Copied verbatim from (the app still runs from these originals):
//   frontend/src/AlgorithmStudio.jsx lines 192-199
//   frontend/src/AlgorithmStudio.jsx lines 265-269
//   frontend/src/AlgorithmStudio.jsx lines 334-338
//   frontend/src/AlgorithmStudio.jsx lines 1084-1163
// Reference copy: these components use shared helpers (formatNumber, calculate, …) that stay in AlgorithmStudio.jsx.
import { Fragment, useEffect, useMemo, useState } from "react";

const descriptions = {
  "Process Synchronization": {
    purpose: "Synchronization coordinates concurrent processes that share data or resources, preventing race conditions while avoiding deadlock and starvation.",
    example: "A mutex lets one process enter a critical section while another waits until the lock is released.",
    pseudocode: "wait(mutex)\n  critical section\nsignal(mutex)",
    advantages: "Makes mutual exclusion, blocking, and lock ownership visible one event at a time.",
    disadvantages: "A single mutex demo does not model every memory-ordering or scheduling behavior of a real multicore system.",
    complexity: "O(1) per lock operation", space: "O(P) waiters",
  },
};

const deepTheory = {
  "Process Synchronization": [
    ["The critical-section problem", "Concurrent execution can interleave instructions in surprising orders. A critical section is the part of a program that accesses shared state. Mutual exclusion requires at most one participant in that section at once; progress requires eligible contenders eventually get a chance; bounded waiting prevents indefinite postponement."],
    ["Locks and semaphores", "A mutex has ownership: one participant acquires it and later releases it. A semaphore is a counter controlled by atomic wait/signal operations; it can protect a resource count or coordinate event ordering. The interactive labs demonstrate mutex exclusion, bounded-buffer empty/full counts, shared readers versus exclusive writers, and the Dining Philosophers circular-wait problem. Real implementations must make synchronization operations atomic and handle cancellation and fairness."],
    ["Deadlock and safety", "Locking can itself create deadlock. The classic conditions are mutual exclusion, hold-and-wait, no preemption, and circular wait. Consistent lock ordering can prevent cycles; timeouts or detection can help recovery. This demo illustrates one lock, not a complete proof of a concurrent program."],
  ],
};

const legacyQuizFallback = {
  "Process Synchronization": [
    { question: "What is the goal of mutual exclusion?", options: ["At most one process enters a critical section at once", "All processes run simultaneously", "Every lock is held forever"], answer: 0, explanation: "Mutual exclusion prevents simultaneous access to a protected critical section." },
    { question: "What happens when a process cannot acquire a held mutex?", options: ["It waits until the lock is released", "It enters the critical section anyway", "The mutex duplicates itself"], answer: 0, explanation: "The contender blocks or waits until the lock owner releases it." },
    { question: "Which is one classic deadlock condition?", options: ["Circular wait", "Page locality", "Time slicing"], answer: 0, explanation: "Circular wait is one of the four necessary conditions in the classic deadlock model." },
  ],
};

function SynchronizationLab() {
  const [scenario, setScenario] = useState("producer");
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const scenarios = {
    producer: {
      title: "Producer–Consumer · bounded buffer",
      states: [
        { buffer: [], producer: "READY", consumer: "READY", explanation: "The buffer has three slots. Empty counts available slots; full counts items. A mutex protects buffer updates." },
        { buffer: ["A"], producer: "PRODUCED A", consumer: "READY", explanation: "The producer waits for an empty slot, locks the buffer, adds item A, unlocks, then signals that one slot is full." },
        { buffer: ["A"], producer: "READY", consumer: "CONSUMING A", explanation: "The consumer waits for a full slot, locks the same buffer, removes A, unlocks, then signals an empty slot." },
        { buffer: [], producer: "READY", consumer: "CONSUMED A", explanation: "Item A has been consumed. The buffer is empty again; a consumer would block until a producer supplies another item." },
        { buffer: ["B", "C", "D"], producer: "BLOCKED · FULL", consumer: "READY", explanation: "All three slots are full. The producer waits on empty instead of overwriting unread items; consuming one item wakes it." },
        { buffer: ["C", "D", "E"], producer: "PRODUCED E", consumer: "CONSUMED B", explanation: "After the consumer removes B, an empty slot becomes available. The producer can safely append E." },
      ],
    },
    readers: {
      title: "Readers–Writers · shared data",
      states: [
        { readers: [], writer: "READY", data: "Version 1", explanation: "No reader or writer currently holds the resource lock." },
        { readers: ["R1"], writer: "WAITING", data: "Version 1", explanation: "R1 acquires the reader lock. Readers may share access while no writer is modifying the data." },
        { readers: ["R1", "R2"], writer: "WAITING", data: "Version 1", explanation: "R2 joins the read set. Both readers can observe the same stable version concurrently." },
        { readers: ["R1", "R2"], writer: "BLOCKED", data: "Version 1", explanation: "W1 requests exclusive access but must wait until every active reader leaves; writes cannot overlap reads." },
        { readers: ["R2"], writer: "BLOCKED", data: "Version 1", explanation: "R1 finishes and decrements the reader count. W1 still waits because R2 holds a read lock." },
        { readers: [], writer: "WRITING", data: "Version 1 → 2", explanation: "The final reader exits and wakes W1. The writer now has exclusive access to update shared data." },
        { readers: [], writer: "DONE", data: "Version 2", explanation: "W1 releases the write lock after updating the value. Waiting readers and writers may now compete for access." },
      ],
    },
    dining: {
      title: "Dining Philosophers · deadlock and ordering",
      states: [
        { philosophers: ["THINKING", "THINKING", "THINKING", "THINKING", "THINKING"], explanation: "Each philosopher needs both neighboring forks to eat. Forks are exclusive resources shared by neighbors." },
        { philosophers: ["HOLDING LEFT", "THINKING", "THINKING", "THINKING", "THINKING"], explanation: "P0 picks up its left fork. It still needs its right fork before it can eat." },
        { philosophers: ["HOLDING LEFT", "HOLDING LEFT", "THINKING", "THINKING", "THINKING"], explanation: "P1 takes its left fork, which is P0's right fork. P0 now waits while holding one resource." },
        { philosophers: ["HOLDING LEFT", "HOLDING LEFT", "HOLDING LEFT", "HOLDING LEFT", "HOLDING LEFT"], explanation: "If all five pick up their left fork together, each waits for a right fork held by a neighbor: circular wait and deadlock." },
        { philosophers: ["RELEASES FORK", "WAITING", "WAITING", "WAITING", "WAITING"], explanation: "A recovery action releases one held fork so the cycle can break. Recovery avoids the stuck state but discards work." },
        { philosophers: ["EATING", "WAITING", "THINKING", "THINKING", "THINKING"], explanation: "A prevention rule imposes a global fork order: acquire the lower-numbered fork first. This breaks circular wait and allows progress." },
      ],
    },
    mutex: {
      title: "Mutex · critical-section walkthrough",
      states: [
        { owner: "None", p1: "READY", p2: "READY", waiting: "None", explanation: "The mutex is initially unlocked, so either process may acquire it." },
        { owner: "P1", p1: "ACQUIRED", p2: "READY", waiting: "None", explanation: "P1 performs an atomic wait(mutex) and becomes the lock owner." },
        { owner: "P1", p1: "CRITICAL", p2: "READY", waiting: "None", explanation: "P1 enters the critical section while holding the mutex." },
        { owner: "P1", p1: "CRITICAL", p2: "BLOCKED", waiting: "P2", explanation: "P2 attempts wait(mutex); because P1 owns the lock, P2 blocks outside the critical section." },
        { owner: "P2", p1: "READY", p2: "ACQUIRED", waiting: "None", explanation: "P1 leaves and signals the mutex; the waiting P2 can acquire it." },
        { owner: "P2", p1: "READY", p2: "CRITICAL", waiting: "None", explanation: "P2 now enters the protected region; the two processes never overlap inside it." },
        { owner: "None", p1: "DONE", p2: "DONE", waiting: "None", explanation: "P2 exits and releases the mutex. The critical section is available again." },
      ],
    },
  };
  const states = scenarios[scenario].states;
  const state = states[step];
  useEffect(() => {
    if (!playing) return undefined;
    if (step >= states.length - 1) {
      setPlaying(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setStep((value) => value + 1), 800);
    return () => window.clearTimeout(timer);
  }, [playing, step, states.length]);
  const chooseScenario = (value) => { setScenario(value); setStep(0); setPlaying(false); };
  const start = () => { if (step >= states.length - 1) setStep(0); setPlaying(true); };
  return <section className="lab-panel sync-lab">
    <div className="lab-panel-heading"><div><span className="eyebrow">INTERACTIVE SYNCHRONIZATION LAB</span><h3>{scenarios[scenario].title}</h3></div><span>STEP {step + 1} / {states.length}</span></div>
    <div className="translation-tabs" role="group" aria-label="Synchronization scenario">{[["producer", "Producer–Consumer"], ["readers", "Readers–Writers"], ["dining", "Dining Philosophers"], ["mutex", "Mutex"]].map(([key, label]) => <button type="button" className={scenario === key ? "selected" : ""} aria-pressed={scenario === key} key={key} onClick={() => chooseScenario(key)}>{label}</button>)}</div>
    {scenario === "producer" && <div className="sync-process-row"><article className="sync-process"><span>PRODUCER</span><strong>{state.producer}</strong><small>wait(empty) · signal(full)</small></article><div className="sync-critical"><span>BOUNDED BUFFER · 3 SLOTS</span><div className="sync-buffer">{Array.from({ length: 3 }, (_, index) => <span className="translation-cell" key={index}>{state.buffer[index] || "EMPTY"}</span>)}</div><small>{state.buffer.length} full · {3 - state.buffer.length} empty</small></div><article className="sync-process"><span>CONSUMER</span><strong>{state.consumer}</strong><small>wait(full) · signal(empty)</small></article></div>}
    {scenario === "readers" && <div className="sync-process-row"><article className="sync-process"><span>ACTIVE READERS</span><strong>{state.readers.length ? state.readers.join(", ") : "None"}</strong><small>Shared read lock</small></article><div className="sync-critical"><span>SHARED DATA</span><strong>{state.data}</strong><small>Writer: {state.writer}</small></div></div>}
    {scenario === "dining" && <div className="sync-process-row philosopher-row">{state.philosophers.map((status, index) => <article className={`sync-process ${status === "EATING" ? "critical" : status.includes("WAIT") ? "blocked" : ""}`} key={index}><span>PHILOSOPHER</span><strong>P{index}</strong><small>{status}</small></article>)}</div>}
    {scenario === "mutex" && <div className="sync-process-row">
      {[["P1", state.p1], ["P2", state.p2]].map(([pid, status]) => <article className={`sync-process ${status === "CRITICAL" ? "critical" : status === "BLOCKED" ? "blocked" : ""}`} key={pid}><span>PROCESS</span><strong>{pid}</strong><small>{status}</small></article>)}
      <div className={`sync-mutex ${state.owner !== "None" ? "locked" : ""}`}><span>MUTEX</span><strong>{state.owner === "None" ? "UNLOCKED" : `OWNED BY ${state.owner}`}</strong><small>wait / signal</small></div>
    </div>}
    {scenario === "mutex" && <div className="sync-critical"><span>CRITICAL SECTION · SHARED COUNTER</span><strong>{state.p1 === "CRITICAL" ? "P1 updating" : state.p2 === "CRITICAL" ? "P2 updating" : "No process inside"}</strong><small>Waiting process: {state.waiting}</small></div>}
    <div className="how-it-works"><span className="eyebrow">SYNCHRONIZATION EVENT</span><p>{state.explanation}</p></div>
    <div className="step-controls"><button type="button" className="lab-primary" disabled={playing} onClick={start}>{step === states.length - 1 ? "▶ Replay" : "▶ Start"}</button><button type="button" className="lab-secondary" disabled={!playing} onClick={() => setPlaying(false)}>Ⅱ Pause</button><button type="button" className="lab-secondary" disabled={playing || step === 0} onClick={() => setStep((value) => Math.max(0, value - 1))}>← Previous</button><button type="button" className="lab-secondary" disabled={playing || step === states.length - 1} onClick={() => setStep((value) => Math.min(value + 1, states.length - 1))}>⏭ Next event</button><button type="button" className="lab-secondary" onClick={() => { setPlaying(false); setStep(0); }}>↻ Reset</button></div>
  </section>;
}
