import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import AlgorithmStudio from "./AlgorithmStudio.jsx";
import ChallengeMode from "./ChallengeMode.jsx";

const SESSION_KEY = "execos-session";
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const REFRESH_MS = 5000;

function readStoredSession() {
  try {
    return JSON.parse(
      localStorage.getItem(SESSION_KEY)
      || sessionStorage.getItem(SESSION_KEY)
      || "null",
    );
  } catch {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
}

function storeSession(session, remember) {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, JSON.stringify(session));
}

function clearStoredSession() {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
}

function mergeLearningProgress(current, incoming) {
  const merged = { ...current };
  for (const [topic, record] of Object.entries(incoming)) {
    const previous = current[topic] || {};
    merged[topic] = {
      visualization_visited: Boolean(previous.visualization_visited || record.visualization_visited),
      lesson_visited: Boolean(previous.lesson_visited || record.lesson_visited),
      quiz_attempts: Math.max(previous.quiz_attempts || 0, record.quiz_attempts || 0),
      quiz_best_score: Math.max(previous.quiz_best_score || 0, record.quiz_best_score || 0),
      challenge_attempts: Math.max(previous.challenge_attempts || 0, record.challenge_attempts || 0),
      challenge_best_score: Math.max(previous.challenge_best_score || 0, record.challenge_best_score || 0),
      challenge_completed: Boolean(previous.challenge_completed || record.challenge_completed),
    };
  }
  return merged;
}

const navigation = [
  { group: "LEARN", items: ["Overview", "Simulator", "Challenges"] },
  { group: "MANAGE", items: ["Processes", "File System", "Devices", "I/O", "IPC", "Resources"] },
  { group: "INSPECT", items: ["System", "Interrupts", "System Calls", "Execution Trace", "Terminal"] },
  { group: "TOOLS", items: ["ExecAI", "Settings"] },
];
const engineSections = ["File System", "Storage", "Devices", "I/O", "IPC", "Resources", "Deadlocks", "Interrupts", "System Calls", "Execution Trace", "Terminal"];

const learningModules = [
  { title: "System Calls", category: "System Calls", icon: "⚠", detail: "Follow a request from user mode through kernel validation and back.", meta: "Engine calls · fork · exec · wait · exit", count: "Interactive walkthrough" },
  { title: "CPU Scheduling", category: "CPU Scheduling", icon: "▦", detail: "Run a process workload one decision at a time and read its Gantt chart.", meta: "FCFS · SJF · SRTF · Priority · Round Robin", count: "6 algorithms" },
  { title: "Deadlocks", category: "Deadlock", icon: "⚠", detail: "Explore resource allocation, safe sequences, and blocked processes.", meta: "Banker's safety · Deadlock detection", count: "2 algorithms" },
  { title: "Memory Management Techniques", category: "Memory Management Techniques", icon: "▤", detail: "Compare memory layouts, allocation, paging, and compaction.", meta: "MFT · MVT · Paging · Segmentation · Virtual memory", count: "Interactive memory labs" },
  { title: "Process Synchronization", category: "Process Synchronization", icon: "♙", detail: "Watch concurrent processes coordinate around shared resources.", meta: "Producer–Consumer · Readers–Writers · Dining Philosophers", count: "4 walkthroughs" },
  { title: "Contiguous Memory", category: "Memory Management", icon: "▦", detail: "Allocate processes in free blocks and step through each placement.", meta: "First Fit · Best Fit · Worst Fit · Next Fit", count: "4 algorithms" },
  { title: "Page Replacement", category: "Page Replacement", icon: "⚠", detail: "Trace page references, frame hits, page faults, and eviction choices.", meta: "FIFO · LRU · Optimal · LFU · Second Chance", count: "5 algorithms" },
  { title: "Paging & Segmentation", category: "Paging & Segmentation", icon: "☷", detail: "Translate virtual addresses and follow TLB and page-fault steps.", meta: "Paging · Segmentation · TLB · Demand paging", count: "3 translation labs" },
  { title: "Disk Scheduling", category: "Disk Scheduling", icon: "◉", detail: "Move the disk head across requests and compare its seek distance.", meta: "FCFS · SSTF · SCAN · C-SCAN · LOOK · C-LOOK", count: "6 algorithms" },
  { title: "Hierarchical File Organization", category: "Hierarchical File Organization", icon: "▤", detail: "Navigate a directory tree and resolve file paths component by component.", meta: "Directory trees · Path traversal", count: "2 structures" },
  { title: "File Allocation", category: "File Management", icon: "▱", detail: "See how file blocks are placed and linked across a disk.", meta: "Sequential · Linked · Indexed", count: "3 methods" },
  { title: "OS Concepts", category: "OS Concepts", icon: "◇", detail: "Connect processes, memory, files, and devices with guided concept visuals.", meta: "Processes · virtual memory · IPC · files", count: "7 topics" },
];

const moduleLessons = {
  CPU: {
    title: "Scheduling decides who gets the CPU next.",
    body: "Run the same ready queue under different policies to see how fairness, response time, and context switching change.",
    prompt: "Start with Round Robin, then compare its Gantt chart with FCFS.",
  },
  Memory: {
    title: "Allocation policy shapes fragmentation.",
    body: "The Engine places allocations into a bounded memory map; the placement rule determines which free region is selected.",
    prompt: "Allocate the same process with First Fit, Best Fit, and Worst Fit.",
  },
  Storage: {
    title: "A page fault means the requested page is not in a frame.",
    body: "Repeated page accesses update the virtual frame table. Replacement policy determines which resident page leaves next.",
    prompt: "Access one page twice, then compare FIFO and LRU on a new page.",
  },
  Deadlocks: {
    title: "A safe state has at least one completion order.",
    body: "The safety check repeatedly finds a process whose remaining need fits available resources, then returns its resources.",
    prompt: "Run the safety check before and after changing a resource request.",
  },
  "File System": {
    title: "The virtual file system is isolated from your computer.",
    body: "These operations change only the in-memory ExecOS Engine filesystem and are recorded in its execution trace.",
    prompt: "Create a file, read it back, then rename it.",
  },
  Processes: {
    title: "Processes move through an explicit lifecycle.",
    body: "Each process has an Engine-owned control block, resource allocation, and a trace of its state transitions.",
    prompt: "Create a process, dispatch or pause it, then inspect its trace.",
  },
  Devices: {
    title: "I/O can block a process while a device is busy.",
    body: "Requests are queued against simulated devices. Completing an active request updates the Engine and emits an interrupt.",
    prompt: "Request a device, then complete the active I/O operation.",
  },
  IPC: {
    title: "Message queues let processes communicate.",
    body: "Messages are delivered between simulated process IDs and remain visible in the Engine IPC state.",
    prompt: "Send a message to another process, then receive it.",
  },
  "System Calls": {
    title: "System calls are the Engine's controlled operation boundary.",
    body: "Invoke supported process, memory, and file operations and inspect their recorded status and return value.",
    prompt: "Try sys_open, then inspect its descriptor in the result.",
  },
  "Execution Trace": {
    title: "The trace records what the Engine actually did.",
    body: "Filter events by process or module to connect an operation to its state changes.",
    prompt: "Run a scheduler or memory operation, then filter the trace.",
  },
  Terminal: {
    title: "The Engine shell is a safe, allowlisted teaching interface.",
    body: "Commands inspect simulated Engine state only; they never invoke your computer's shell.",
    prompt: "Run help to list the available Engine commands.",
  },
};

const icons = {
  Overview: "◫", Processes: "▤", CPU: "⌁", Memory: "▥", System: "⚙",
  Challenges: "✦",
  "File System": "▱", Storage: "▰", Devices: "⌘", "I/O": "⇄",
  IPC: "⇌", Resources: "◇", Deadlocks: "⊗", Interrupts: "ϟ",
  "System Calls": "⌘", "Execution Trace": "≋", Terminal: ">_",
  ExecAI: "✳", Settings: "⚙",
};

async function apiRequest(path, options = {}) {
  const session = readStoredSession();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && !path.startsWith("/api/auth/")) {
    clearStoredSession();
    window.dispatchEvent(new Event("execos-auth-expired"));
  }
  if (!response.ok) {
    const detail = data.detail;
    throw new Error(Array.isArray(detail) ? detail.map((item) => item.msg).join(", ") : detail || `Request failed (${response.status})`);
  }
  return data;
}

function LoginScreen({ onAuthenticated }) {
  const [lightTheme, setLightTheme] = useState(false);
  return (
    <main className={`auth-screen ${lightTheme ? "auth-light" : ""}`}>
      <section className="auth-hero" aria-label="About ExecOS">
        <div className="auth-hero-content">
          <div className="auth-brand"><ExecOSLogo className="auth-brand-mark" /><span>Exec<span>OS</span></span></div>
          <h1>Smarter Systems.<br />Stronger Tomorrow.</h1>
          <p>Experience the next generation operating system with intelligent self-healing, powerful resource management and an AI assistant built for you.</p>
        </div>
        <div className="auth-benefits">
          <div><span>◈</span><b>Secure<br />&amp; Reliable</b></div>
          <div><span>ϟ</span><b>Self-Healing<br />OS</b></div>
          <div><span>▦</span><b>Smart<br />Resource Mgmt</b></div>
          <div><span>✳</span><b>AI Powered<br />Assistant</b></div>
        </div>
        <small className="auth-quote">“Built for learners. Designed for the future.”</small>
      </section>
      <section className="auth-main">
        <div className="auth-main-top">
          <div className="auth-top-actions">
            <button type="button" aria-label="Use light theme" onClick={() => setLightTheme(true)}>☼</button>
            <button type="button" className={`auth-theme-toggle ${lightTheme ? "enabled" : ""}`} aria-label="Toggle color theme" aria-pressed={lightTheme} onClick={() => setLightTheme((enabled) => !enabled)}><i /></button>
            <button type="button" aria-label="Use dark theme" onClick={() => setLightTheme(false)}>☾</button>
          </div>
        </div>
        <div className="auth-cards">
          <AuthFormCard mode="login" onAuthenticated={onAuthenticated} onSwitch={() => document.querySelector('[data-auth-mode="register"] input')?.focus()} />
          <AuthFormCard mode="register" onAuthenticated={onAuthenticated} onSwitch={() => document.querySelector('[data-auth-mode="login"] input')?.focus()} />
        </div>
      </section>
    </main>
  );
}

function ExecOSLogo({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 64 64" role="img" aria-label="ExecOS">
      <path fill="#3187ff" d="M49 7H29c-7 0-12 3-16 9L5 28c-3 5 0 11 6 12l14 2-12 7c-5 3-4 10 2 12 3 1 6 1 9-1l22-14c7-5 5-14-3-15l-17-2 6-8h14c4 0 7-3 7-7s-2-7-4-7ZM25 24c1-2 3-3 5-3h4l-7 9-13-1 6-8c1-1 3-2 5-2Zm11 17L22 51l-6 2 10-13 10 1Z" />
    </svg>
  );
}

function AuthFormCard({ mode, onAuthenticated, onSwitch }) {
  const isRegister = mode === "register";
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  function explainUnavailable(feature) {
    setError("");
    setNotice(`${feature} is not configured for this installation. Use your email and password instead.`);
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (isRegister && password !== confirmPassword) {
        throw new Error("Passwords do not match.");
      }
      const session = await apiRequest(`/api/auth/${isRegister ? "register" : "login"}`, {
        method: "POST",
        body: JSON.stringify(isRegister
          ? { email, full_name: fullName, password }
          : { email, password }),
      });
      onAuthenticated(session, isRegister || remember);
    } catch (caught) {
      setError(caught.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth-card" data-auth-mode={mode}>
      <ExecOSLogo className="auth-card-logo" />
      <h2>{isRegister ? "Create Account" : "Welcome Back"}</h2>
      <p>{isRegister ? "Join ExecOS and start your journey" : "Sign in to your ExecOS account"}</p>
      <form onSubmit={submit}>
        {isRegister && <label>Full Name
          <span className="auth-input-wrap"><span aria-hidden="true">♙</span><input required minLength="2" maxLength="100" value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" placeholder="Enter your full name" /></span>
        </label>}
        <label>Email Address
          <span className="auth-input-wrap"><span aria-hidden="true">✉</span><input required type="email" maxLength="254" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="Enter your email" /></span>
        </label>
        <label>Password
          <span className="auth-input-wrap"><span aria-hidden="true">▣</span><input required minLength="10" maxLength="256" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={isRegister ? "new-password" : "current-password"} placeholder={isRegister ? "Create a password" : "Enter your password"} /><button className="password-visibility" type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? "Hide" : "◉"}</button></span>
        </label>
        {isRegister && <label>Confirm Password
          <span className="auth-input-wrap"><span aria-hidden="true">▣</span><input required minLength="10" maxLength="256" type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" placeholder="Confirm your password" /><button className="password-visibility" type="button" aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"} onClick={() => setShowConfirmPassword((visible) => !visible)}>{showConfirmPassword ? "Hide" : "◉"}</button></span>
        </label>}
        {isRegister && <small className="auth-password-hint">Use at least 10 characters.</small>}
        {!isRegister && <div className="auth-form-options"><label className="remember-option"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /> Remember me</label><button type="button" onClick={() => explainUnavailable("Password reset")}>Forgot password?</button></div>}
        {error && <p className="inline-error" role="alert">{error}</p>}
        {notice && <p className="auth-unavailable-note" role="status">{notice}</p>}
        <button className="auth-submit" disabled={busy}>{busy ? "Please wait…" : isRegister ? <>Sign Up <span aria-hidden="true">♙</span></> : <>Log In <span aria-hidden="true">↗</span></>}</button>
      </form>
      {!isRegister && <div className="auth-social">
        <div className="auth-divider"><span />or<span /></div>
        <button type="button" onClick={() => explainUnavailable("Google sign-in")}><b className="google-mark">G</b>Continue with Google</button>
        <button type="button" onClick={() => explainUnavailable("GitHub sign-in")}><b className="github-mark">●</b>Continue with GitHub</button>
      </div>}
      <div className="auth-card-footer">{isRegister ? "Already have an account?" : "Don't have an account?"} <button type="button" onClick={onSwitch}>{isRegister ? "Log in" : "Sign up"}</button></div>
    </section>
  );
}

function formatBytes(bytes) {
  if (bytes === null || bytes === undefined) return "Unavailable";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(Math.max(bytes, 1)) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index > 1 ? 2 : 1)} ${units[index]}`;
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return "Unavailable";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = Math.floor(seconds % 60);
  return `${days ? `${days}d ` : ""}${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function Metric({ label, value, detail }) {
  return <div className="metric-row"><span>{label}</span><strong>{value ?? "Unavailable"}</strong>{detail && <small>{detail}</small>}</div>;
}

function Sparkline({ values, label, unit = "%" }) {
  const points = values.map((value, index) => {
    const x = values.length < 2 ? 250 : 12 + index * 476 / (values.length - 1);
    return `${x},${116 - Math.min(Math.max(value, 0), 100)}`;
  }).join(" ");
  return (
    <section className="graph-pane">
      <div className="pane-title"><h2>{label}</h2><span>{values.length ? `${values.at(-1).toFixed(1)}${unit}` : "Collecting samples"}</span></div>
      <svg viewBox="0 0 500 130" role="img" aria-label={`${label} readings from the host operating system`}>
        {[16, 41, 66, 91, 116].map((y) => <line key={y} x1="12" x2="488" y1={y} y2={y} />)}
        {values.length > 1 && <polyline points={points} />}
        {values.length === 1 && <circle cx="250" cy={116 - Math.min(values[0], 100)} r="3" />}
      </svg>
    </section>
  );
}

function App() {
  const [account, setAccount] = useState(() => {
    return readStoredSession()?.user || null;
  });
  const refreshPending = useRef(false);
  const refreshAgain = useRef(false);
  const engineRefreshRevision = useRef(0);
  const [section, setSection] = useState("Overview");
  const [studioCategory, setStudioCategory] = useState("CPU Scheduling");
  const [connection, setConnection] = useState("checking");
  const [snapshot, setSnapshot] = useState({ system: null, processes: null, memoryHistory: null, io: null, errors: [] });
  const [engineState, setEngineState] = useState(null);
  const [engineError, setEngineError] = useState("");
  const [cpuHistory, setCpuHistory] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedPid, setSelectedPid] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [learningProgress, setLearningProgress] = useState({});
  const [learningProgressError, setLearningProgressError] = useState("");

  const refresh = useCallback(async (authoritativeEngineState = null) => {
    if (authoritativeEngineState) {
      engineRefreshRevision.current += 1;
      setEngineState(authoritativeEngineState);
      setEngineError("");
    }
    if (refreshPending.current) {
      refreshAgain.current = true;
      return null;
    }
    const requestRevision = ++engineRefreshRevision.current;
    refreshPending.current = true;
    try {
      const results = await Promise.allSettled([
        apiRequest("/api/host/system"),
        apiRequest("/api/host/processes"),
        apiRequest("/api/v1/memory/history"),
        apiRequest("/api/host/io"),
        apiRequest("/api/kernel/state"),
      ]);
      const [systemResult, processesResult, memoryResult, ioResult, engineResult] = results;
      const next = {
        system: systemResult.status === "fulfilled" ? systemResult.value : null,
        processes: processesResult.status === "fulfilled" ? processesResult.value : null,
        memoryHistory: memoryResult.status === "fulfilled" ? memoryResult.value.samples : null,
        io: ioResult.status === "fulfilled" ? ioResult.value : null,
        errors: results.slice(0, 4).filter((result) => result.status === "rejected").map((result) => result.reason.message),
      };
      setSnapshot(next);
      if (engineResult.status === "fulfilled" && requestRevision === engineRefreshRevision.current) {
        setEngineState(engineResult.value);
        setEngineError("");
      } else if (engineResult.status === "rejected" && requestRevision === engineRefreshRevision.current) {
        setEngineState(null);
        setEngineError(engineResult.reason.message);
      }
      if (next.system) {
        setConnection("online");
        setCpuHistory((history) => [...history, next.system.cpu_percent].slice(-60));
        setLastUpdated(new Date());
      } else {
        setConnection("offline");
      }
      return next;
    } finally {
      refreshPending.current = false;
      if (refreshAgain.current) {
        refreshAgain.current = false;
        window.setTimeout(() => refresh(), 0);
      }
    }
  }, []);

  function acceptSession(session, remember = false) {
    storeSession(session, remember);
    setLearningProgress({});
    setLearningProgressError("");
    setAccount(session.user);
  }

  const saveLearningProgress = useCallback(async (topic, updates) => {
    try {
      const { progress } = await apiRequest("/api/learning/progress", {
        method: "PUT",
        body: JSON.stringify({ topic, progress: updates }),
      });
      setLearningProgress((current) => mergeLearningProgress(current, progress));
      setLearningProgressError("");
      return progress[topic];
    } catch (error) {
      setLearningProgressError(`Learning progress could not be saved: ${error.message}`);
      return null;
    }
  }, []);

  const recordQuizCompletion = useCallback((topic, score, total) => {
    const previous = learningProgress[topic] || {};
    return saveLearningProgress(topic, {
      quiz_attempts: (previous.quiz_attempts || 0) + 1,
      quiz_best_score: Math.round((score / total) * 20),
    });
  }, [learningProgress, saveLearningProgress]);

  const recordChallengeAttempt = useCallback((topic, correct) => {
    const previous = learningProgress[topic] || {};
    return saveLearningProgress(topic, {
      challenge_attempts: (previous.challenge_attempts || 0) + 1,
      challenge_best_score: correct ? 100 : 0,
      challenge_completed: correct,
    });
  }, [learningProgress, saveLearningProgress]);

  async function signOut() {
    try { await apiRequest("/api/auth/logout", { method: "POST" }); } catch { /* Session is removed locally regardless. */ }
    clearStoredSession();
    setLearningProgress({});
    setLearningProgressError("");
    engineRefreshRevision.current += 1;
    setAccount(null);
    setSnapshot({ system: null, processes: null, memoryHistory: null, io: null, errors: [] });
    setEngineState(null);
    setEngineError("");
  }

  async function runStudioScheduler(algorithm, quantum) {
    const response = await apiRequest("/api/kernel/scheduler/run", {
      method: "POST",
      body: JSON.stringify({ algorithm, quantum }),
    });
    await refresh(response.engine_state || null);
    return response;
  }

  async function runStudioSyscall(name, args) {
    const response = await apiRequest("/api/kernel/syscalls", {
      method: "POST",
      body: JSON.stringify({ name, arguments: args }),
    });
    await refresh();
    return response;
  }

  useEffect(() => {
    if (!account) return undefined;
    let active = true;
    setLearningProgress({});
    apiRequest("/api/auth/me")
      .then((user) => {
        if (!active) return;
        setAccount(user);
        refresh();
        return apiRequest("/api/learning/progress")
          .then((result) => {
            if (active) {
              setLearningProgress((current) => mergeLearningProgress(current, result.progress));
              setLearningProgressError("");
            }
          })
          .catch((error) => {
            if (active) setLearningProgressError(`Learning progress could not be loaded: ${error.message}`);
          });
      })
      .catch(() => {
        if (active) {
          engineRefreshRevision.current += 1;
          clearStoredSession();
          setAccount(null);
          setEngineState(null);
        }
      });
    return () => { active = false; };
  }, [account?.username, refresh]);

  useEffect(() => {
    function expire() {
      engineRefreshRevision.current += 1;
      setAccount(null);
      setConnection("offline");
      setEngineState(null);
      setLearningProgress({});
    }
    window.addEventListener("execos-auth-expired", expire);
    return () => window.removeEventListener("execos-auth-expired", expire);
  }, []);

  useEffect(() => {
    if (!account) return undefined;
    const timer = window.setInterval(() => refresh(), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [account?.username, refresh]);

  const processes = snapshot.processes || [];
  const kernelProcesses = engineState ? Object.values(engineState.processes.states).flat() : [];
  const filteredProcesses = useMemo(() => {
    const query = search.trim().toLowerCase();
    return kernelProcesses.filter((process) => !query || process.name.toLowerCase().includes(query) || String(process.pid).includes(query));
  }, [kernelProcesses, search]);
  const selectedProcess = kernelProcesses.find((process) => process.pid === selectedPid) || null;

  if (!account) return <LoginScreen onAuthenticated={acceptSession} />;

  const system = snapshot.system;
  const engineConnection = engineState ? "online" : engineError ? "offline" : "checking";
  const kernelSection = engineSections.includes(section);
  const memoryValues = (snapshot.memoryHistory || []).map((sample) => sample.percent);

  return (
    <div className="workbench">
      <header className="appbar">
        <div className="app-wordmark"><span className="app-glyph">E</span><span>EXECOS<small>OS Simulator &amp; Visualizer</small></span></div>
        <div className="system-readouts">
          <span><small>HOST ARCH</small><b>{system?.architecture || "—"}</b></span>
          <span><small>HOST CPU</small><b>{system?.cpu_count_logical ? `${system.cpu_count_logical} logical` : "—"}</b></span>
          <span><small>HOST MEMORY</small><b>{system ? `${formatBytes(system.memory.used_bytes)} / ${formatBytes(system.memory.total_bytes)}` : "—"}</b></span>
          <span><small>HOST PROCESSES</small><b>{snapshot.processes?.length ?? "—"}</b></span>
          <span><small>HOST UPTIME</small><b>{system ? formatDuration(system.uptime_seconds) : "—"}</b></span>
        </div>
        <div className="connection-status"><i className={`status-dot ${engineConnection}`} />{engineState ? "Kernel Engine running" : engineError ? "Kernel Engine unavailable" : "Connecting Engine"}</div>
        <button className="account-button" onClick={signOut} title={`Sign out ${account.username}`}>{account.username} · Sign out</button>
      </header>
      <div className="workbench-body">
        <aside className="side-nav" aria-label="Workbench navigation">
          {navigation.map((group) => (
            <div className="nav-section" key={group.group}>
              <h2>{group.group}</h2>
              {group.items.map((item) => <button key={item} title={item} aria-current={section === item ? "page" : undefined} className={section === item ? "active" : ""} onClick={() => setSection(item)}><span>{icons[item]}</span>{item}</button>)}
            </div>
          ))}
        </aside>
        <main className="main-workspace">
          <div className="view-toolbar">
            <div className="view-name"><span>{icons[section] || "·"}</span><h1>{section === "Overview" ? "OS Simulator" : section}</h1></div>
            {section === "Processes" && <input className="search-input" aria-label="Search ExecOS engine processes" placeholder="Search engine processes…" value={search} onChange={(event) => setSearch(event.target.value)} />}
            <div className="toolbar-actions"><span className="live-label"><i className={`status-dot ${engineConnection}`} />{section === "Challenges" ? "SAVED LEARNING PROGRESS" : ["Overview", "Simulator", "Processes", "CPU", "Memory", "ExecAI", ...engineSections].includes(section) ? "EXECOS ENGINE STATE" : "HOST DATA"}</span><button className="toolbar-button" onClick={() => refresh()}>Refresh</button></div>
          </div>
          {snapshot.errors.length > 0 && <div className="notice-bar" role="status">{snapshot.errors.join(" · ")}</div>}
          {engineError && <div className="notice-bar" role="alert">Kernel Engine data unavailable: {engineError}</div>}
          {learningProgressError && <div className="notice-bar" role="alert">{learningProgressError}</div>}
          {section === "Overview" ? (
            <EngineOverview state={engineState} hostSystem={system} hostProcesses={processes} hostIo={snapshot.io} onRefresh={refresh} onNavigate={setSection} onStudioCategoryChange={setStudioCategory} />
          ) : section === "Simulator" ? (
            <AlgorithmStudio
              category={studioCategory}
              onCategoryChange={setStudioCategory}
              onOpenModule={setSection}
              engineState={engineState}
              onRunEngineScheduler={runStudioScheduler}
              onRunSystemCall={runStudioSyscall}
              onProgress={saveLearningProgress}
              onQuizComplete={recordQuizCompletion}
            />
          ) : section === "Challenges" ? (
            <ChallengeMode
              progress={learningProgress}
              onProgress={recordChallengeAttempt}
              onOpenSimulator={(topic) => {
                setStudioCategory(topic);
                setSection("Simulator");
              }}
            />
          ) : section === "Processes" ? (
            <ProcessWorkbench processes={filteredProcesses} selected={selectedProcess} state={engineState} onSelect={setSelectedPid} onRefresh={refresh} />
          ) : section === "CPU" ? (
            <CpuWorkbench state={engineState} hostSystem={system} cpuHistory={cpuHistory} onRefresh={refresh} />
          ) : section === "Memory" ? (
            <MemoryWorkbench state={engineState} hostSystem={system} memoryHistory={memoryValues} onRefresh={refresh} />
          ) : kernelSection ? (
            <EnginePanel section={section} state={engineState} onRefresh={refresh} />
          ) : section === "ExecAI" ? (
            <IntelligenceConsole state={engineState} onRefresh={refresh} />
          ) : section === "System" ? (
            <div className="view-content">{system ? <HostDetails system={system} io={snapshot.io} /> : <div className="empty-workspace">Host system telemetry is unavailable.</div>}</div>
          ) : section === "Settings" ? (
            <SettingsPanel account={account} />
          ) : <div className="empty-workspace">No view is available.</div>}
        </main>
      </div>
      <footer className="statusbar"><span><i className={`status-dot ${engineConnection}`} />{engineState ? "EXECOS KERNEL ENGINE · RUNNING" : engineError ? "EXECOS KERNEL ENGINE · UNAVAILABLE" : "CONNECTING EXECOS ENGINE"}</span><span><i className={`status-dot ${connection}`} />Host monitor · {connection === "online" ? "connected · read-only" : "unavailable"}</span><span>QEMU guest · optional</span><span>{lastUpdated ? `Host updated ${lastUpdated.toLocaleTimeString()}` : "Waiting for host data"}</span></footer>
    </div>
  );
}

function useEngineAction(onRefresh) {
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const run = useCallback(async (path, body) => {
    if (busyRef.current) return null;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await apiRequest(path, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setResult(response);
      await onRefresh(response.engine_state || null);
      return response;
    } catch (caught) {
      setError(caught.message);
      return null;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [onRefresh]);

  return { result, error, busy, run };
}

function EngineDataTable({ columns, rows, empty = "No records." }) {
  return (
    <div className="table-scroll"><table><thead><tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead>
      <tbody>{rows.map((row, index) => <tr key={row.pid || row.path || row.id || row.sequence || index}>{columns.map((column) => {
        const value = row[column.key];
        return <td key={column.key}>{value === null || value === undefined ? "—" : typeof value === "object" ? JSON.stringify(value) : String(value)}</td>;
      })}</tr>)}
      {!rows.length && <tr><td colSpan={columns.length} className="empty-cell">{empty}</td></tr>}</tbody>
    </table></div>
  );
}

function EngineProcessTable({ processes, selectedPid, onSelect }) {
  return (
    <div className="table-scroll"><table><thead><tr><th>PID</th><th>PROCESS</th><th>STATE</th><th>PRIORITY</th><th>BURST</th><th>REMAINING</th><th>MEMORY</th><th>WAIT REASON</th></tr></thead>
      <tbody>{processes.map((process) => <tr key={process.pid} className={selectedPid === process.pid ? "selected-row" : ""} onClick={() => onSelect(process.pid)} tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter") onSelect(process.pid); }}>
        <td className="mono">{process.pid}</td><td>{process.name}</td><td><span className={`state-tag ${process.state.toLowerCase()}`}>{process.state}</span></td>
        <td>{process.priority}</td><td>{process.burst_time}</td><td>{process.remaining_time}</td><td>{process.memory_allocation_mb} MB</td><td>{process.wait_reason || "—"}</td>
      </tr>)}
      {!processes.length && <tr><td colSpan="8" className="empty-cell">No engine processes match this query.</td></tr>}</tbody>
    </table></div>
  );
}

function SchedulerForm({ onRefresh }) {
  const [algorithm, setAlgorithm] = useState("round_robin");
  const [quantum, setQuantum] = useState(4);
  const action = useEngineAction(onRefresh);
  return (
    <section className="table-pane">
      <div className="pane-title"><h2>RUN THE ENGINE SCHEDULER</h2><span>OS core executes · AI explains</span></div>
      <form className="engine-form" onSubmit={(event) => { event.preventDefault(); action.run("/api/kernel/scheduler/run", { algorithm, quantum: Number(quantum) }); }}>
        <label>Policy<select value={algorithm} onChange={(event) => setAlgorithm(event.target.value)}>{["fcfs", "sjf", "srtf", "priority", "round_robin"].map((policy) => <option key={policy} value={policy}>{policy.toUpperCase()}</option>)}</select></label>
        {algorithm === "round_robin" && <label>Time quantum<input type="number" min="1" max="10000" value={quantum} onChange={(event) => setQuantum(event.target.value)} /></label>}
        <button className="primary-button" disabled={action.busy}>{action.busy ? "Running…" : "Run scheduler"}</button>
      </form>
      {action.error && <div className="intelligence-error" role="alert">{action.error}</div>}
    </section>
  );
}

function GanttChart({ result }) {
  if (!result?.timeline?.length) return <div className="answer-placeholder">Run a scheduling policy to produce a Gantt timeline.</div>;
  const span = Math.max(1, result.end_tick - result.start_tick);
  return <section className="table-pane"><div className="pane-title"><h2>CPU GANTT · {result.algorithm.toUpperCase()}</h2><span>tick {result.start_tick}–{result.end_tick}</span></div>
    <div className="gantt-track">{result.timeline.map((segment, index) => <div className="gantt-segment" key={`${segment.pid}-${segment.start}-${index}`} style={{ flexGrow: segment.duration, flexBasis: `${Math.max(4, segment.duration / span * 100)}%` }} title={`${segment.pid} · ${segment.start}–${segment.end}`}><strong>{segment.pid}</strong><small>{segment.start}–{segment.end}</small></div>)}</div>
    <div className="summary-strip compact-metrics">{Object.entries(result.metrics).map(([key, value]) => <Metric key={key} label={key.replaceAll("_", " ").toUpperCase()} value={value} />)}</div>
  </section>;
}

function EngineOverview({ state, hostSystem, hostProcesses, hostIo, onRefresh, onNavigate, onStudioCategoryChange }) {
  if (!state) return <div className="empty-workspace">Connecting to the ExecOS Kernel Engine…</div>;
  const byState = state.processes.states;
  return <div className="view-content engine-view learning-hub">
    <section className="learning-hero">
      <div className="learning-hero-copy">
        <span className="eyebrow"><i className="status-dot online" /> EXECOS · INTERACTIVE LEARNING</span>
        <h2>OS Simulator</h2>
        <p>Interactive Operating System Concepts</p>
        <small className="visualizer-learning-path">VISUALIZE <span>→</span> UNDERSTAND <span>→</span> QUIZ</small>
        <div className="learning-hero-actions"><span className="engine-pill"><i className="status-dot online" /> Engine {state.engine.status}</span><span className="engine-tick">Tick {state.engine.clock_tick}</span></div>
      </div>
      <div className="learning-hero-art" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="core-chip"><span>EXEC</span><strong>OS</strong><small>KERNEL ENGINE</small></div><i className="orbit-node node-one">CPU</i><i className="orbit-node node-two">RAM</i><i className="orbit-node node-three">I/O</i></div>
    </section>
    <section className="module-catalog" aria-label="Interactive learning modules">
      <div className="catalog-heading"><div><span className="eyebrow">CHOOSE A MODULE</span><h2>Interactive Operating System Concepts</h2><p>Open a simulator, explore its visual explanation, then test what you learned with a quiz.</p></div><span className="catalog-count">{learningModules.length} MODULES</span></div>
      <div className="module-grid">{learningModules.map((module, index) => <button className="module-card" key={module.category} onClick={() => {
          onStudioCategoryChange(module.category);
          onNavigate("Simulator");
        }}>
          <span className="module-card-icon">{module.icon}</span><strong>{module.title}</strong><span className="module-card-index">Module {index + 1}</span><span className="module-card-detail">{module.detail}</span><small>{module.meta}</small><span className="module-card-count">{module.count}</span>
        </button>)}</div>
    </section>
    <div className="summary-strip learning-stats">
      <Metric label="PROCESSES" value={state.processes.total} detail={`${byState.READY.length} ready · ${byState.WAITING.length} waiting`} />
      <Metric label="ENGINE MEMORY" value={`${state.memory.used_mb} MB`} detail={`${state.memory.free_mb} MB free of ${state.memory.total_mb} MB`} />
      <Metric label="LAST CPU RUN" value={state.scheduler.last_result ? `${state.scheduler.last_result.metrics.cpu_utilization_percent}%` : "Not run"} detail={state.scheduler.last_result ? `${state.scheduler.last_result.metrics.context_switches} context switches` : "Run a policy in CPU Scheduling"} />
      <Metric label="I/O QUEUE" value={state.io.queue_depth} detail="Active or queued requests" />
    </div>
    <section className="learning-live">
      <div className="catalog-heading"><div><span className="eyebrow">LIVE ENGINE</span><h2>Current run</h2><p>Real scheduler output from the shared simulated workload.</p></div><span className="engine-tick">Engine tick {state.engine.clock_tick}</span></div>
      <div className="graph-grid">
        <section className="table-pane"><div className="pane-title"><h2>RUN A CPU POLICY</h2><span>Test it without leaving the dashboard</span></div><SchedulerForm onRefresh={onRefresh} /></section>
        <section className="table-pane"><div className="pane-title"><h2>PROCESS STATES</h2><span>{state.processes.total} records</span></div><EngineDataTable columns={[{ key: "pid", label: "PID" }, { key: "name", label: "PROCESS" }, { key: "state", label: "STATE" }, { key: "priority", label: "PRIORITY" }, { key: "remaining_time", label: "CPU LEFT" }]} rows={Object.values(byState).flat().slice(0, 6)} /></section>
      </div>
      <GanttChart result={state.scheduler.last_result} />
    </section>
    <div className="scope-banner host-scope"><span className={`status-dot ${hostSystem ? "online" : "offline"}`} /><div><strong>Host operating system · {hostSystem ? "read-only monitor connected" : "unavailable"}</strong><span>{hostSystem ? `${hostSystem.system} ${hostSystem.release} · ${hostSystem.cpu_percent}% CPU · ${hostProcesses.length} visible processes` : "Host data does not control or represent Engine state."}</span></div></div>
    {hostSystem && <div className="data-grid"><HostDetails system={hostSystem} io={hostIo} /><section className="table-pane"><div className="pane-title"><h2>RECENT ENGINE EVENTS</h2></div><EngineDataTable columns={[{ key: "tick", label: "TICK" }, { key: "event", label: "EVENT" }, { key: "pid", label: "PID" }, { key: "module", label: "MODULE" }]} rows={state.recent_events.slice(-8).reverse()} /></section></div>}
  </div>;
}

function ModuleGuide({ section }) {
  const lesson = moduleLessons[section];
  if (!lesson) return null;
  return <section className="module-guide"><span className="module-guide-mark">{icons[section] || "◇"}</span><div><span className="eyebrow">LEARNING GOAL</span><h2>{lesson.title}</h2><p>{lesson.body}</p><small><b>TRY THIS</b> {lesson.prompt}</small></div></section>;
}

function ProcessWorkbench({ processes, selected, state, onSelect, onRefresh }) {
  const [name, setName] = useState("");
  const [burst, setBurst] = useState(4);
  const [priority, setPriority] = useState(5);
  const [memory, setMemory] = useState(64);
  const [arrival, setArrival] = useState("");
  const [newPriority, setNewPriority] = useState(5);
  const action = useEngineAction(onRefresh);
  const [traceEvents, setTraceEvents] = useState([]);
  const [traceError, setTraceError] = useState("");
  const [traceLoading, setTraceLoading] = useState(false);

  useEffect(() => {
    if (selected) setNewPriority(selected.priority);
  }, [selected?.pid]);

  async function processAction(type) {
    await action.run(`/api/kernel/processes/${selected.pid}/action`, { action: type, priority: type === "priority" ? Number(newPriority) : null });
  }

  useEffect(() => {
    if (!selected) {
      setTraceEvents([]);
      setTraceError("");
      return undefined;
    }
    let active = true;
    setTraceLoading(true);
    setTraceError("");
    apiRequest(`/api/kernel/trace?pid=${encodeURIComponent(selected.pid)}&limit=250`)
      .then((result) => {
        if (active) setTraceEvents(result.events);
      })
      .catch((caught) => {
        if (active) setTraceError(caught.message);
      })
      .finally(() => {
        if (active) setTraceLoading(false);
      });
    return () => { active = false; };
  }, [selected?.pid, state?.engine?.clock_tick]);

  const lifecycle = ["NEW", "READY", "RUNNING", "WAITING", "TERMINATED"];
  const observedStates = new Set();
  for (const event of traceEvents) {
    if (event.event === "PROCESS_CREATED" || event.event === "PROCESS_FORKED") observedStates.add("NEW");
    if (["PROCESS_ADMITTED", "PROCESS_READY", "PROCESS_RESUMED"].includes(event.event)) observedStates.add("READY");
    if (["PROCESS_RUNNING", "PROCESS_DISPATCHED"].includes(event.event)) observedStates.add("RUNNING");
    if (["PROCESS_WAITING", "PROCESS_PAUSED"].includes(event.event)) observedStates.add("WAITING");
    if (["PROCESS_TERMINATED", "PROCESS_COMPLETED"].includes(event.event)) observedStates.add("TERMINATED");
  }

  return <div className="view-content engine-view process-view">
    <div className="scope-banner"><span className="status-dot online" /><div><strong>ExecOS process table · engine-owned PCBs</strong><span>Lifecycle and scheduling actions change the software Kernel Engine, never host processes.</span></div><span className="scope-timestamp">Tick {state?.engine?.clock_tick ?? "—"} · {processes.length} shown</span></div>
    <section className="table-pane ready-queue-pane"><div className="pane-title"><h2>READY QUEUE</h2><span>Derived from current READY process state</span></div><div className="ready-queue-preview">{state?.scheduler?.ready_queue?.length ? state.scheduler.ready_queue.map((pid) => <button key={pid} className="queue-process" onClick={() => onSelect(pid)}>{pid}</button>) : <span className="answer-placeholder">No processes are READY.</span>}<span className="queue-running">Running: <b>{state?.scheduler?.current_pid || "Idle"}</b></span><span className="queue-running">Last policy: <b>{state?.scheduler?.last_result?.algorithm?.toUpperCase() || "Not run"}</b></span></div></section>
    <section className="table-pane"><div className="pane-title"><h2>CREATE PROCESS</h2><span>Admission allocates engine memory</span></div>
      <form className="engine-form" onSubmit={(event) => { event.preventDefault(); action.run("/api/kernel/processes", { name, burst_time: Number(burst), priority: Number(priority), memory_mb: Number(memory), arrival_time: arrival === "" ? null : Number(arrival) }).then((result) => { if (result) setName(""); }); }}>
        <label>Name<input required maxLength="64" value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label>CPU burst<input type="number" min="1" max="100000" value={burst} onChange={(event) => setBurst(event.target.value)} /></label>
        <label>Priority (1 highest)<input type="number" min="1" max="10" value={priority} onChange={(event) => setPriority(event.target.value)} /></label>
        <label>Memory MB<input type="number" min="1" max="4096" value={memory} onChange={(event) => setMemory(event.target.value)} /></label>
        <label>Arrival tick (blank = now)<input type="number" min="0" value={arrival} onChange={(event) => setArrival(event.target.value)} /></label>
        <button className="primary-button" disabled={action.busy}>Create process</button>
      </form>
      {action.error && <div className="intelligence-error" role="alert">{action.error}</div>}
    </section>
    <section className="table-pane process-table-pane"><div className="pane-title"><h2>PROCESS TABLE</h2><span>Click a PCB to inspect lifecycle data</span></div><EngineProcessTable processes={processes} selectedPid={selected?.pid} onSelect={onSelect} /></section>
    {selected && <div className="pcb-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onSelect(null); }}>
      <aside className="pcb-drawer" role="dialog" aria-modal="true" aria-labelledby="pcb-title">
        <div className="pane-title"><h2 id="pcb-title">PROCESS CONTROL BLOCK</h2><button className="toolbar-button" onClick={() => onSelect(null)} aria-label="Close process details">Close</button></div>
        <strong className="inspector-name">{selected.name} · {selected.pid}</strong>
        <div className="lifecycle-track" aria-label={`Process lifecycle, current state ${selected.state}`}>{lifecycle.map((step) => <span key={step} className={`${step === selected.state ? "current" : ""} ${observedStates.has(step) ? "visited" : ""}`}>{step}</span>)}</div>
        <dl>
          <dt>State</dt><dd><span className={`state-tag ${selected.state.toLowerCase()}`}>{selected.state}</span></dd>
          <dt>Arrival / burst</dt><dd>{selected.arrival_time} / {selected.burst_time} ticks</dd>
          <dt>Remaining CPU</dt><dd>{selected.remaining_time} ticks</dd>
          <dt>Priority</dt><dd>{selected.priority}</dd><dt>Memory</dt><dd>{selected.memory_allocation_mb} MB</dd>
          <dt>PC / SP</dt><dd>{selected.program_counter} / {selected.stack_pointer}</dd>
          <dt>Wait reason</dt><dd>{selected.wait_reason || "None"}</dd>
          <dt>Waiting time</dt><dd>{selected.waiting_time} ticks</dd>
          <dt>Response time</dt><dd>{selected.response_time ?? "—"} ticks</dd>
          <dt>Turnaround time</dt><dd>{selected.turnaround_time ?? "—"} ticks</dd>
          <dt>Start / completion</dt><dd>{selected.start_time ?? "—"} / {selected.completion_time ?? "—"} ticks</dd>
          <dt>Parent</dt><dd>{selected.parent_pid || "Kernel"}</dd>
        </dl>
        <div className="engine-actions">
          {selected.state === "READY" && <button className="toolbar-button" disabled={action.busy} onClick={() => processAction("start")}>Dispatch</button>}
          {["READY", "RUNNING"].includes(selected.state) && <button className="toolbar-button" disabled={action.busy} onClick={() => processAction("pause")}>Pause</button>}
          {selected.state === "WAITING" && selected.wait_reason === "paused" && <button className="toolbar-button" disabled={action.busy} onClick={() => processAction("resume")}>Resume</button>}
          {selected.state !== "TERMINATED" && <button className="toolbar-button danger-button" disabled={action.busy} onClick={() => processAction("terminate")}>Terminate</button>}
        </div>
        {selected.state !== "TERMINATED" && <form className="engine-form compact-form" onSubmit={(event) => { event.preventDefault(); processAction("priority"); }}><label>Set priority<input type="number" min="1" max="10" value={newPriority} onChange={(event) => setNewPriority(event.target.value)} /></label><button className="toolbar-button" disabled={action.busy}>Apply</button></form>}
        {action.error && <div className="intelligence-error" role="alert">{action.error}</div>}
        <section className="pcb-events"><div className="pane-title"><h2>PROCESS EXECUTION TRACE</h2><span>Kernel Engine events · {traceEvents.length}</span></div>
          {traceLoading && <p className="answer-placeholder">Loading process trace…</p>}
          {traceError && <div className="intelligence-error" role="alert">{traceError}</div>}
          {!traceLoading && !traceError && <ol>{traceEvents.slice().reverse().map((event) => <li key={event.sequence}><div><b>{event.event.replaceAll("_", " ")}</b><span>tick {event.tick} · {event.module}</span></div><code>{JSON.stringify(event.details)}</code></li>)}</ol>}
          {!traceLoading && !traceError && traceEvents.length === 0 && <p className="answer-placeholder">No trace events are recorded for this process.</p>}
        </section>
      </aside>
    </div>}
  </div>;
}

function CpuWorkbench({ state, hostSystem, cpuHistory, onRefresh }) {
  return <div className="view-content engine-view">
    <ModuleGuide section="CPU" />
    <div className="scope-banner"><span className="status-dot online" /><div><strong>CPU scheduler · ExecOS Kernel Engine</strong><span>Engine CPU metrics come from deterministic scheduler ticks. Host CPU is shown separately below.</span></div></div>
    {state?.scheduler.last_result && <GanttChart result={state.scheduler.last_result} />}
    <SchedulerForm onRefresh={onRefresh} />
    <div className="summary-strip">
      <Metric label="ENGINE TICK" value={state?.engine.clock_tick ?? "—"} />
      <Metric label="RUNNING PROCESS" value={state?.scheduler.current_pid || "Idle"} />
      <Metric label="READY QUEUE" value={state?.scheduler.ready_queue.join(", ") || "Empty"} />
      <Metric label="LAST POLICY" value={state?.scheduler.last_result?.algorithm.toUpperCase() || "Not run"} />
    </div>
    {hostSystem && <><div className="scope-banner host-scope"><div><strong>Host CPU · read-only, not Engine CPU</strong><span>{hostSystem.processor || "Host processor telemetry"}</span></div></div><div className="summary-strip"><Metric label="HOST CPU" value={`${hostSystem.cpu_percent}%`} detail={`${hostSystem.cpu_count_logical} logical processors`} /><Metric label="PHYSICAL CORES" value={hostSystem.cpu_count_physical ?? "Unavailable"} /><Metric label="FREQUENCY" value={hostSystem.cpu_frequency_mhz?.current ? `${hostSystem.cpu_frequency_mhz.current.toFixed(0)} MHz` : "Unavailable"} /><Metric label="HOST SAMPLE" value={cpuHistory.length} detail="Samples collected" /></div><Sparkline values={cpuHistory} label="Host CPU utilization" /></>}
  </div>;
}

function MemoryWorkbench({ state, hostSystem, memoryHistory, onRefresh }) {
  const [pid, setPid] = useState("P101");
  const [size, setSize] = useState(64);
  const [policy, setPolicy] = useState("first_fit");
  const action = useEngineAction(onRefresh);
  if (!state) return <div className="empty-workspace">Connecting to the ExecOS memory manager…</div>;
  const memory = state.memory;
  return <div className="view-content engine-view">
    <ModuleGuide section="Memory" />
    <div className="scope-banner"><span className="status-dot online" /><div><strong>Contiguous memory manager · engine-owned</strong><span>First Fit, Best Fit, Worst Fit, allocation, coalescing, and fragmentation operate on this 4096 MB Engine arena.</span></div></div>
    <div className="summary-strip"><Metric label="TOTAL" value={`${memory.total_mb} MB`} /><Metric label="ALLOCATED" value={`${memory.used_mb} MB`} detail={`${memory.utilization_percent}%`} /><Metric label="FREE" value={`${memory.free_mb} MB`} /><Metric label="EXTERNAL FRAGMENTATION" value={`${memory.external_fragmentation_percent}%`} /></div>
    <section className="table-pane"><div className="pane-title"><h2>PHYSICAL MEMORY MAP</h2><span>Address range 0–{memory.total_mb} MB</span></div><div className="memory-map">{memory.blocks.map((block) => <div className={`memory-block ${block.pid ? "allocated" : "free"}`} key={`${block.start_mb}-${block.size_mb}`} style={{ flexGrow: block.size_mb }} title={`${block.pid || "FREE"} · ${block.start_mb}–${block.start_mb + block.size_mb} MB`}><strong>{block.pid || "FREE"}</strong><small>{block.size_mb} MB</small></div>)}</div><EngineDataTable columns={[{ key: "start_mb", label: "START MB" }, { key: "size_mb", label: "SIZE MB" }, { key: "pid", label: "OWNER" }]} rows={memory.blocks} /></section>
    <section className="table-pane"><div className="pane-title"><h2>MEMORY OPERATIONS</h2><span>Successful changes are recorded in the trace</span></div><form className="engine-form" onSubmit={(event) => { event.preventDefault(); action.run("/api/kernel/memory/allocate", { pid, size_mb: Number(size), policy }); }}>
      <label>Process<select value={pid} onChange={(event) => setPid(event.target.value)}>{Object.values(state.processes.states).flat().filter((process) => process.state !== "TERMINATED").map((process) => <option key={process.pid} value={process.pid}>{process.pid} · {process.name}</option>)}</select></label>
      <label>Amount MB<input type="number" min="1" value={size} onChange={(event) => setSize(event.target.value)} /></label>
      <label>Allocation policy<select value={policy} onChange={(event) => setPolicy(event.target.value)}>{["first_fit", "best_fit", "worst_fit"].map((value) => <option key={value}>{value}</option>)}</select></label>
      <button className="primary-button" disabled={action.busy}>Allocate</button>
      <button type="button" className="toolbar-button" disabled={action.busy} onClick={() => action.run("/api/kernel/memory/release", { pid, size_mb: Number(size) })}>Release amount</button>
    </form>{action.error && <div className="intelligence-error" role="alert">{action.error}</div>}</section>
    {hostSystem && <><div className="scope-banner host-scope"><div><strong>Host physical memory · separate read-only source</strong><span>{formatBytes(hostSystem.memory.used_bytes)} / {formatBytes(hostSystem.memory.total_bytes)} · {hostSystem.memory.percent}% host use</span></div></div><Sparkline values={memoryHistory} label="Host memory history" /></>}
  </div>;
}

function EnginePanel({ section, state, onRefresh }) {
  const action = useEngineAction(onRefresh);
  const processes = state ? Object.values(state.processes.states).flat().filter((process) => process.state !== "TERMINATED") : [];
  const [pid, setPid] = useState("P101");
  const [path, setPath] = useState("/ExecOS/system/kernel.conf");
  const [content, setContent] = useState("");
  const [toPath, setToPath] = useState("");
  const [policy, setPolicy] = useState("fifo");
  const [page, setPage] = useState(0);
  const [device, setDevice] = useState("Disk");
  const [operation, setOperation] = useState("read");
  const [receiverPid, setReceiverPid] = useState("P102");
  const [message, setMessage] = useState("");
  const [resource, setResource] = useState("CPU");
  const [amount, setAmount] = useState(1);
  const [interruptType, setInterruptType] = useState("Timer");
  const [syscallName, setSyscallName] = useState("sys_open");
  const [syscallArgs, setSyscallArgs] = useState('{"path":"/ExecOS/system/kernel.conf"}');
  const [syscallError, setSyscallError] = useState("");
  const [filterPid, setFilterPid] = useState("");
  const [filterModule, setFilterModule] = useState("");
  const [trace, setTrace] = useState(null);
  const [command, setCommand] = useState("help");
  const [terminalOutput, setTerminalOutput] = useState("");
  if (!state) return <div className="empty-workspace">Connecting to the ExecOS {section} module…</div>;

  const runTerminal = async (event) => {
    event.preventDefault();
    const response = await action.run("/api/kernel/terminal", { command });
    if (response) setTerminalOutput(response.output);
  };
  let contentView;
  const guide = <ModuleGuide section={section} />;
  if (section === "File System") {
    const filesystem = state.filesystem;
    contentView = <><EngineActionForm action={action} title="VIRTUAL FILE SYSTEM" fields={<><label>Operation<select id="fs-action">{["read", "create_file", "create_directory", "write", "delete", "rename"].map((item) => <option key={item}>{item}</option>)}</select></label><label>Path<input id="fs-path" defaultValue={path} onChange={(event) => setPath(event.target.value)} /></label><label>Content<input id="fs-content" value={content} onChange={(event) => setContent(event.target.value)} /></label><label>Destination<input id="fs-to" value={toPath} onChange={(event) => setToPath(event.target.value)} /></label></>} onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; action.run("/api/kernel/filesystem", { action: form.elements["fs-action"].value, path, content, to_path: toPath || null }); }} /><EngineDataTable columns={[{ key: "path", label: "PATH" }, { key: "type", label: "TYPE" }, { key: "owner", label: "OWNER" }, { key: "created_at_tick", label: "CREATED TICK" }, { key: "content", label: "CONTENT" }]} rows={filesystem.entries} /></>;
  } else if (section === "Storage") {
    contentView = <><div className="summary-strip"><Metric label="VIRTUAL FRAMES" value={state.virtual_memory.frames.length} /><Metric label="PAGE FAULTS" value={state.virtual_memory.page_faults} /><Metric label="PAGE HITS" value={state.virtual_memory.page_hits} /><Metric label="HIT RATIO" value={`${state.virtual_memory.hit_ratio_percent}%`} /></div><EngineActionForm action={action} title="PAGE ACCESS" fields={<><label>Process<select id="page-pid" value={pid} onChange={(event) => setPid(event.target.value)}>{processes.map((process) => <option key={process.pid} value={process.pid}>{process.pid} · {process.name}</option>)}</select></label><label>Virtual page<input type="number" min="0" value={page} onChange={(event) => setPage(event.target.value)} /></label><label>Replacement policy<select value={policy} onChange={(event) => setPolicy(event.target.value)}><option value="fifo">FIFO</option><option value="lru">LRU</option></select></label></>} onSubmit={(event) => { event.preventDefault(); action.run("/api/kernel/virtual-memory/access", { pid, page: Number(page), policy }); }} /><div className="data-grid"><section className="table-pane"><div className="pane-title"><h2>FRAME TABLE</h2></div><EngineDataTable columns={[{ key: "frame", label: "FRAME" }, { key: "pid", label: "PID" }, { key: "page", label: "PAGE" }, { key: "last_used", label: "LAST USED" }]} rows={state.virtual_memory.frames} /></section><section className="table-pane"><div className="pane-title"><h2>PAGE TABLE</h2></div><EngineDataTable columns={[{ key: "pid", label: "PID" }, { key: "page", label: "PAGE" }, { key: "frame", label: "FRAME" }, { key: "valid", label: "VALID" }]} rows={state.virtual_memory.page_table} /></section></div></>;
  } else if (section === "Devices" || section === "I/O") {
    const activeRequests = state.io.requests.filter((request) => request.status === "ACTIVE");
    contentView = <><EngineActionForm action={action} title="DEVICE REQUEST" fields={<><label>Process<select id="device-pid" value={pid} onChange={(event) => setPid(event.target.value)}>{processes.map((process) => <option key={process.pid} value={process.pid}>{process.pid} · {process.name}</option>)}</select></label><label>Device<select value={device} onChange={(event) => setDevice(event.target.value)}>{state.devices.devices.map((item) => <option key={item.name}>{item.name}</option>)}</select></label><label>Operation<input value={operation} onChange={(event) => setOperation(event.target.value)} /></label></>} onSubmit={(event) => { event.preventDefault(); action.run("/api/kernel/devices/request", { pid, device, operation }); }} /><div className="data-grid"><section className="table-pane"><div className="pane-title"><h2>DEVICE OWNERSHIP</h2></div><EngineDataTable columns={[{ key: "name", label: "DEVICE" }, { key: "type", label: "TYPE" }, { key: "status", label: "STATUS" }, { key: "owner_pid", label: "OWNER" }, { key: "interrupt", label: "IRQ" }]} rows={state.devices.devices} /></section><section className="table-pane"><div className="pane-title"><h2>I/O REQUEST QUEUE · {state.io.queue_depth}</h2></div><EngineDataTable columns={[{ key: "request_id", label: "ID" }, { key: "pid", label: "PID" }, { key: "device", label: "DEVICE" }, { key: "operation", label: "OPERATION" }, { key: "status", label: "STATUS" }]} rows={state.io.requests} /><div className="engine-actions">{activeRequests.map((request) => <button className="toolbar-button" key={request.request_id} disabled={action.busy} onClick={() => action.run("/api/kernel/io/complete", { request_id: request.request_id })}>Complete active I/O #{request.request_id}</button>)}</div></section></div></>;
  } else if (section === "IPC") {
    contentView = <><EngineActionForm action={action} title="SEND MESSAGE" fields={<><label>Sender<select id="ipc-sender" value={pid} onChange={(event) => setPid(event.target.value)}>{processes.map((process) => <option key={process.pid} value={process.pid}>{process.pid} · {process.name}</option>)}</select></label><label>Receiver<select value={receiverPid} onChange={(event) => setReceiverPid(event.target.value)}>{processes.filter((process) => process.pid !== pid).map((process) => <option key={process.pid} value={process.pid}>{process.pid} · {process.name}</option>)}</select></label><label>Message<input value={message} onChange={(event) => setMessage(event.target.value)} /></label></>} onSubmit={(event) => { event.preventDefault(); action.run("/api/kernel/ipc/send", { sender_pid: pid, receiver_pid: receiverPid, message }); }} /><div className="engine-actions"><button className="toolbar-button" onClick={() => action.run("/api/kernel/ipc/receive", { receiver_pid: receiverPid })}>Receive next message for {receiverPid}</button></div><EngineDataTable columns={[{ key: "id", label: "ID" }, { key: "sender_pid", label: "SENDER" }, { key: "receiver_pid", label: "RECEIVER" }, { key: "message", label: "MESSAGE" }, { key: "status", label: "STATUS" }]} rows={state.ipc.messages} /></>;
  } else if (section === "Resources" || section === "Deadlocks") {
    contentView = <><div className="engine-actions"><button className="primary-button" onClick={() => action.run("/api/kernel/deadlocks/check", {})}>Run Banker's safety check</button><span className={`safe-state ${state.deadlock_check.safe ? "safe" : "unsafe"}`}>{state.deadlock_check.status}</span></div><div className="data-grid"><section className="table-pane"><div className="pane-title"><h2>RESOURCE AVAILABILITY</h2></div><EngineDataTable columns={[{ key: "name", label: "RESOURCE" }, { key: "total", label: "TOTAL" }, { key: "available", label: "AVAILABLE" }, { key: "allocated", label: "ALLOCATED" }, { key: "requested", label: "WAITING" }]} rows={Object.entries(state.resources.resources).map(([name, item]) => ({ name, ...item }))} /></section><section className="table-pane"><div className="pane-title"><h2>BANKER'S SAFETY RESULT</h2></div><dl className="engine-definition-list"><dt>Safe sequence</dt><dd>{state.deadlock_check.safe_sequence.join(" → ") || "None"}</dd><dt>Blocked PIDs</dt><dd>{state.deadlock_check.blocked_pids.join(", ") || "None"}</dd></dl></section></div><EngineActionForm action={action} title="REQUEST OR RELEASE RESOURCES" fields={<><label>Process<select id="res-pid" value={pid} onChange={(event) => setPid(event.target.value)}>{processes.map((process) => <option key={process.pid} value={process.pid}>{process.pid} · {process.name}</option>)}</select></label><label>Resource<select value={resource} onChange={(event) => setResource(event.target.value)}>{["CPU", "Memory", "Disk"].map((item) => <option key={item}>{item}</option>)}</select></label><label>Amount<input type="number" min="1" value={amount} onChange={(event) => setAmount(event.target.value)} /></label></>} onSubmit={(event) => { event.preventDefault(); action.run("/api/kernel/resources/request", { pid, resource, amount: Number(amount) }); }} /><div className="engine-actions"><button className="toolbar-button" onClick={() => action.run("/api/kernel/resources/release", { pid, resource, amount: Number(amount) })}>Release selected resource</button></div></>;
  } else if (section === "Interrupts") {
    contentView = <><EngineActionForm action={action} title="TRIGGER HANDLED INTERRUPT" fields={<><label>Interrupt<select value={interruptType} onChange={(event) => setInterruptType(event.target.value)}>{["Timer", "Keyboard", "Disk", "I/O"].map((item) => <option key={item}>{item}</option>)}</select></label><label>Process (optional)<select value={pid} onChange={(event) => setPid(event.target.value)}>{processes.map((process) => <option key={process.pid} value={process.pid}>{process.pid} · {process.name}</option>)}</select></label></>} onSubmit={(event) => { event.preventDefault(); action.run("/api/kernel/interrupts/trigger", { interrupt_type: interruptType, pid, details: { source: "workbench" } }); }} /><EngineDataTable columns={[{ key: "id", label: "ID" }, { key: "type", label: "TYPE" }, { key: "pid", label: "PID" }, { key: "tick", label: "TICK" }, { key: "status", label: "STATUS" }, { key: "details", label: "DETAILS" }]} rows={state.interrupts.interrupts} /></>;
  } else if (section === "System Calls") {
    contentView = <><EngineActionForm action={action} title="INVOKE ENGINE SYSTEM CALL" fields={<><label>Call<select value={syscallName} onChange={(event) => { setSyscallName(event.target.value); setSyscallError(""); setSyscallArgs(event.target.value === "sys_open" ? '{"path":"/ExecOS/system/kernel.conf"}' : event.target.value === "sys_read" || event.target.value === "sys_close" ? '{"fd":3}' : '{"pid":"P101","size_mb":64}'); }}>{["sys_open", "sys_read", "sys_write", "sys_close", "sys_create_process", "sys_terminate_process", "sys_allocate_memory", "sys_release_memory"].map((item) => <option key={item}>{item}</option>)}</select></label><label>Arguments JSON<textarea value={syscallArgs} onChange={(event) => { setSyscallArgs(event.target.value); setSyscallError(""); }} rows={3} /></label></>} onSubmit={(event) => { event.preventDefault(); try { action.run("/api/kernel/syscalls", { name: syscallName, arguments: JSON.parse(syscallArgs) }); } catch (caught) { setSyscallError(`Arguments must be valid JSON: ${caught.message}`); } }} />{syscallError && <div className="intelligence-error" role="alert">{syscallError}</div>}<EngineDataTable columns={[{ key: "name", label: "CALL" }, { key: "status", label: "STATUS" }, { key: "tick", label: "TICK" }, { key: "duration_ms", label: "DURATION MS" }, { key: "error", label: "ERROR" }, { key: "result", label: "RESULT" }]} rows={state.syscalls} /></>;
  } else if (section === "Execution Trace") {
    contentView = <><EngineActionForm action={action} title="FILTER EXECUTION TRACE" fields={<><label>PID<input value={filterPid} onChange={(event) => setFilterPid(event.target.value)} placeholder="Any" /></label><label>Module<input value={filterModule} onChange={(event) => setFilterModule(event.target.value)} placeholder="scheduler, memory…" /></label><label>Event<input id="trace-event" placeholder="Exact event name" /></label></>} onSubmit={async (event) => { event.preventDefault(); const eventName = event.currentTarget.elements["trace-event"].value; const params = new URLSearchParams({ limit: "250" }); if (filterPid) params.set("pid", filterPid); if (filterModule) params.set("module", filterModule); if (eventName) params.set("event", eventName); try { setTrace(await apiRequest(`/api/kernel/trace?${params}`)); } catch (caught) { setTrace({ error: caught.message, events: [] }); } }} />{trace?.error && <div className="intelligence-error" role="alert">{trace.error}</div>}<EngineDataTable columns={[{ key: "sequence", label: "SEQ" }, { key: "tick", label: "TICK" }, { key: "event", label: "EVENT" }, { key: "pid", label: "PID" }, { key: "module", label: "MODULE" }, { key: "details", label: "DETAILS" }]} rows={(trace?.events || state.recent_events).slice().reverse()} /></>;
  } else if (section === "Terminal") {
    contentView = <><section className="table-pane"><div className="pane-title"><h2>EXECOS KERNEL SHELL</h2><span>Allowlisted Engine commands only · no host shell</span></div><div className="terminal-output">{terminalOutput || "Type help to list available Kernel Engine commands."}</div><form className="terminal-form" onSubmit={runTerminal}><span>execos&gt;</span><input aria-label="Kernel command" value={command} onChange={(event) => setCommand(event.target.value)} /><button className="toolbar-button" disabled={action.busy}>Run</button></form></section></>;
  }
  return <div className="view-content engine-view">{guide}{action.error && <div className="intelligence-error" role="alert">{action.error}</div>}{contentView || <div className="empty-workspace">No module view is available.</div>}{action.result && <details className="table-pane action-result"><summary>Latest operation result</summary><pre>{JSON.stringify(action.result, null, 2)}</pre></details>}</div>;
}

function EngineActionForm({ action, title, fields, onSubmit }) {
  return <section className="table-pane"><div className="pane-title"><h2>{title}</h2><span>Writes only to in-memory ExecOS Engine state</span></div><form className="engine-form" onSubmit={onSubmit}>{fields}<button className="primary-button" disabled={action.busy}>{action.busy ? "Applying…" : "Apply operation"}</button></form></section>;
}

function SettingsPanel({ account }) {
  return <div className="view-content engine-view"><div className="scope-banner"><span className="status-dot online" /><div><strong>ExecOS Workbench settings</strong><span>Kernel Engine is an in-memory, deterministic software core. Restarting the backend resets its demo state.</span></div></div><section className="details-pane"><div className="pane-title"><h2>SESSION & DATA SOURCES</h2></div><dl><dt>Signed-in account</dt><dd>{account.username}</dd><dt>Kernel Engine</dt><dd>Running · software Engine</dd><dt>Host monitor</dt><dd>Read-only · separate data source</dd><dt>QEMU</dt><dd>Optional · not required by the workbench Engine</dd><dt>AI boundary</dt><dd>Read-only explanations and recommendations; no OS control</dd></dl></section></div>;
}

const intelligenceModes = [
  { id: "explain", label: "Explain", description: "Explain an observed result" },
  { id: "analyze", label: "Analyze", description: "Analyze measured data" },
  { id: "recommend", label: "Recommend", description: "Suggest safe next steps" },
  { id: "teach", label: "Teach", description: "Learn an OS concept" },
];

const intelligenceQuestions = [
  "Which engine process owns the most memory?",
  "Why is P102 waiting?",
  "Why was the most recent process selected?",
  "Explain the current scheduling result",
  "Explain this context switch",
  "Why is Engine CPU utilization low?",
  "Explain external memory fragmentation",
];

function renderTutorInline(text, keyPrefix) {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, index) => {
    const key = `${keyPrefix}-${index}`;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={key}>{part.slice(1, -1)}</code>;
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={key}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*")) return <em key={key}>{part.slice(1, -1)}</em>;
    return part;
  });
}

function renderTutorAnswer(markdown) {
  const lines = String(markdown).split(/\r?\n/);
  const blocks = [];
  let paragraph = [];
  let list = [];
  let listType = "";
  let index = 0;
  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push(<p key={`p-${index++}`}>{renderTutorInline(paragraph.join("\n"), `p-${index}`)}</p>);
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list.length) {
      const List = listType === "ordered" ? "ol" : "ul";
      blocks.push(<List key={`list-${index++}`}>{list.map((item, itemIndex) => <li key={itemIndex}>{renderTutorInline(item, `list-${index}-${itemIndex}`)}</li>)}</List>);
      list = [];
      listType = "";
    }
  };
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    if (/^\s*```/.test(line)) {
      flushParagraph();
      flushList();
      const language = line.replace(/^\s*```/, "").trim();
      const codeLines = [];
      lineIndex += 1;
      while (lineIndex < lines.length && !/^\s*```\s*$/.test(lines[lineIndex])) {
        codeLines.push(lines[lineIndex]);
        lineIndex += 1;
      }
      blocks.push(<pre key={`code-${index++}`}><code className={language ? `language-${language}` : undefined}>{codeLines.join("\n")}</code></pre>);
      continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const Heading = `h${heading[1].length}`;
      blocks.push(<Heading key={`heading-${index++}`}>{renderTutorInline(heading[2], `heading-${index}`)}</Heading>);
      continue;
    }
    const listItem = line.match(/^\s*(?:(?:[-*+])\s+|(\d+)[.)]\s+)(.+)$/);
    if (listItem) {
      flushParagraph();
      const nextListType = listItem[1] ? "ordered" : "unordered";
      if (listType && listType !== nextListType) flushList();
      listType = nextListType;
      list.push(listItem[2]);
      continue;
    }
    flushList();
    if (!line.trim()) flushParagraph();
    else paragraph.push(line);
  }
  flushParagraph();
  flushList();
  return blocks;
}

function IntelligenceConsole({ state, onRefresh }) {
  const [mode, setMode] = useState("explain");
  const [assistantMode, setAssistantMode] = useState("ollama");
  const [domain, setDomain] = useState("os_expert");
  const [question, setQuestion] = useState("");
  const [execaiConversation, setExecaiConversation] = useState([]);
  const [ollamaConversation, setOllamaConversation] = useState([]);
  const conversation = assistantMode === "ollama" ? ollamaConversation : execaiConversation;
  const setConversation = assistantMode === "ollama" ? setOllamaConversation : setExecaiConversation;
  const [ollamaStatus, setOllamaStatus] = useState(null);
  const [queryError, setQueryError] = useState("");
  const [busy, setBusy] = useState(false);
  const [insights, setInsights] = useState([]);
  const [insightError, setInsightError] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);
  const [diagnosis, setDiagnosis] = useState(null);
  const [diagnosisError, setDiagnosisError] = useState("");
  const [diagnosing, setDiagnosing] = useState(false);
  const [whatIf, setWhatIf] = useState(null);
  const [whatIfError, setWhatIfError] = useState("");
  const [whatIfBusy, setWhatIfBusy] = useState(false);
  const [algorithm, setAlgorithm] = useState("round_robin");
  const [quantum, setQuantum] = useState(4);
  const [processPid, setProcessPid] = useState("");
  const [priority, setPriority] = useState("");
  const [burstTime, setBurstTime] = useState("");
  const [arrivalTime, setArrivalTime] = useState("");
  const [allocationPolicy, setAllocationPolicy] = useState("");
  const [memorySize, setMemorySize] = useState("");
  const [allocationPid, setAllocationPid] = useState("");
  const [applyBusy, setApplyBusy] = useState(false);
  const [applyMessage, setApplyMessage] = useState("");
  const [activity, setActivity] = useState([]);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [recoveryPlan, setRecoveryPlan] = useState(null);
  const [recoveryResult, setRecoveryResult] = useState(null);
  const [recoveryError, setRecoveryError] = useState("");
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const whatIfRef = useRef(null);
  const questionRef = useRef(null);
  const conversationEndRef = useRef(null);
  const assistantModeChosen = useRef(false);

  function recordActivity(item) {
    const entry = { ...item, id: `${Date.now()}-${Math.random()}` };
    setActivity((current) => [entry, ...current].slice(0, 12));
    setSelectedActivity(entry);
  }

  const refreshInsights = useCallback(async () => {
    const response = await apiRequest("/api/intelligence/insights");
    setInsights(response.insights);
    setUpdatedAt(response.timestamp);
    setInsightError("");
  }, []);

  useEffect(() => {
    let active = true;
    const load = () => refreshInsights().catch((error) => {
      if (active) setInsightError(error.message);
    });
    apiRequest("/api/intelligence/chat/status")
      .then((result) => {
        if (active) {
          setOllamaStatus(result);
          if (result.available && !assistantModeChosen.current) {
            setAssistantMode("ollama");
          }
        }
      })
      .catch((error) => { if (active) setOllamaStatus({ available: false, model: null, message: error.message }); });
    load();
    const timer = window.setInterval(load, 15000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [refreshInsights]);

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [conversation, busy]);

  async function askQuestion(text, functionMode = mode, domainMode = domain) {
    const submittedQuestion = text.trim();
    if (!submittedQuestion || busy) return;
    const useOllama = assistantMode === "ollama";
    const pendingUserMessage = {
      id: `user-${Date.now()}-${Math.random()}`,
      role: "user",
      text: submittedQuestion,
      domain: useOllama ? "os_tutor" : domainMode,
      function: useOllama ? "chat" : functionMode,
    };
    setBusy(true);
    setQueryError("");
    setConversation((current) => [...current, pendingUserMessage]);
    try {
      const history = conversation.slice(-8).map((message) => ({
        role: message.role,
        content: (message.role === "user" ? message.text : message.result.answer).slice(0, 4000),
      }));
      const result = await apiRequest(useOllama ? "/api/intelligence/chat" : "/api/intelligence/query", {
        method: "POST",
        body: JSON.stringify(useOllama
          ? { question: submittedQuestion, history }
          : { question: submittedQuestion, function: functionMode, domain: domainMode }),
      });
      setConversation((current) => [...current, { role: "assistant", result }]);
      recordActivity({
        title: useOllama ? "Answered · LOCAL OLLAMA" : `Answered · ${functionMode.toUpperCase()}`,
        summary: submittedQuestion,
        details: result,
        kind: "query",
      });
      setQuestion("");
    } catch (error) {
      setConversation((current) => current.filter((message) => message.id !== pendingUserMessage.id));
      setQueryError(error.message);
    } finally {
      setBusy(false);
    }
  }

  function submitQuestion(event) {
    event.preventDefault();
    void askQuestion(question);
  }

  async function runDiagnosis() {
    setDiagnosing(true);
    setDiagnosisError("");
    try {
      const result = await apiRequest("/api/intelligence/diagnose");
      setDiagnosis(result);
      if (result.kernel_state) await onRefresh(result.kernel_state);
      const firstReady = result.processes.find((process) => process.state === "READY");
      if (firstReady) {
        setProcessPid((current) => current || firstReady.pid);
        setAllocationPid((current) => current || firstReady.pid);
      }
      recordActivity({
        title: `Diagnosis · ${result.severity}`,
        summary: result.primary_issue,
        details: result,
        kind: "diagnosis",
      });
      refreshInsights().catch((error) => setInsightError(error.message));
    } catch (error) {
      setDiagnosisError(error.message);
      setDiagnosis(null);
    }
    finally {
      setDiagnosing(false);
    }
  }

  async function createRecoveryPlan() {
    setRecoveryBusy(true);
    setRecoveryError("");
    setRecoveryResult(null);
    try {
      const result = await apiRequest("/api/intelligence/recovery/plan", { method: "POST" });
      setRecoveryPlan(result);
      recordActivity({
        title: "Recovery plan created",
        summary: result.summary,
        details: result,
        kind: "recovery-plan",
      });
    } catch (error) {
      setRecoveryError(error.message);
    } finally {
      setRecoveryBusy(false);
    }
  }

  async function approveRecovery() {
    if (!recoveryPlan || recoveryPlan.status !== "awaiting_approval" || recoveryBusy) return;
    setRecoveryBusy(true);
    setRecoveryError("");
    try {
      const result = await apiRequest("/api/intelligence/recovery/execute", {
        method: "POST",
        body: JSON.stringify({ plan_id: recoveryPlan.plan_id, approved: true }),
      });
      setRecoveryResult(result);
      setRecoveryPlan(null);
      await onRefresh(result.result.engine_state);
      refreshInsights().catch((error) => setInsightError(error.message));
      recordActivity({
        title: result.verification.verified ? "Recovery verified" : "Recovery verification warning",
        summary: `${result.plan.action.algorithm.toUpperCase()} completed; verification ${result.verification.verified ? "passed" : "failed"}.`,
        details: result,
        kind: "recovery-result",
      });
      await runDiagnosis();
    } catch (error) {
      setRecoveryError(error.message);
    } finally {
      setRecoveryBusy(false);
    }
  }

  async function runWhatIf(event) {
    if (event) event.preventDefault();
    setWhatIfBusy(true);
    setWhatIfError("");
    setApplyMessage("");
    try {
      const result = await apiRequest("/api/intelligence/what-if", {
        method: "POST",
        body: JSON.stringify({
          algorithm,
          quantum: Number(quantum),
          ...(priority !== "" || burstTime !== "" || arrivalTime !== "" ? { process_pid: processPid } : {}),
          ...(priority !== "" ? { priority: Number(priority) } : {}),
          ...(burstTime !== "" ? { burst_time: Number(burstTime) } : {}),
          ...(arrivalTime !== "" ? { arrival_time: Number(arrivalTime) } : {}),
          ...(allocationPolicy ? {
            allocation_policy: allocationPolicy,
            allocation_pid: allocationPid,
            memory_size_mb: Number(memorySize),
          } : {}),
        }),
      });
      setWhatIf(result);
      recordActivity({
        title: "What-If simulation",
        summary: `${result.current.algorithm.toUpperCase()} vs ${result.simulated.algorithm.toUpperCase()} on an isolated Engine copy.`,
        details: result,
        kind: "what-if",
      });
    } catch (error) {
      setWhatIfError(error.message);
      setWhatIf(null);
    } finally {
      setWhatIfBusy(false);
    }
  }

    async function confirmRecommendation() {
      const recommendation = diagnosis?.optimizer;
      if (!recommendation || applyBusy) return;
      setApplyBusy(true);
      setApplyMessage("");
      setDiagnosisError("");
      try {
        const result = await apiRequest("/api/kernel/scheduler/run", {
          method: "POST",
          body: JSON.stringify({
            algorithm: recommendation.recommended_algorithm,
            quantum: recommendation.recommended_quantum || 4,
          }),
        });
        setApplyMessage(
          `${result.algorithm.toUpperCase()} ran on the live Engine: ${result.completed_pids.length} processes completed; ${result.timeline.length} trace segments recorded.`,
        );
        await onRefresh(result.engine_state || null);
        await runDiagnosis();
        await refreshInsights();
      } catch (error) {
        setDiagnosisError(error.message);
      } finally {
        setApplyBusy(false);
      }
    }

    const optimizer = diagnosis?.optimizer;
    const metricLabels = [
      ["average_waiting_time", "WAIT"],
      ["average_turnaround_time", "TURNAROUND"],
      ["average_response_time", "RESPONSE"],
      ["cpu_utilization_percent", "CPU %"],
      ["context_switches", "SWITCHES"],
      ["throughput_per_tick", "THROUGHPUT"],
    ];

  const processStates = state?.processes?.states || {};
  const availableProcesses = diagnosis?.processes || Object.values(processStates).flat();
  const lastRun = state?.scheduler?.last_result;
  const currentPolicy = lastRun?.algorithm || state?.scheduler?.default_algorithm || "not run";
  const latestTraceEvent = state?.recent_events?.slice().reverse().find((event) => event.event === "PROCESS_SELECTED");
  const explainDecision = () => {
    const pid = state?.scheduler?.current_pid || latestTraceEvent?.pid;
    const prompt = pid
      ? `Why was ${pid} selected?`
      : "Explain the current scheduling result";
    void askQuestion(prompt, "explain", "os_expert");
  };
  const liveStatus = state ? "Kernel Connected" : insightError ? "Kernel Unavailable" : "Connecting";
  const liveCpu = diagnosis?.metrics?.cpu_utilization_percent;
  const liveMemory = state?.memory?.utilization_percent;

  return (
    <div className={`view-content intelligence-view ${assistantMode === "ollama" ? "ollama-chat-view" : ""}`}>
      <header className="execai-header">
        <div className="execai-title"><span className="intelligence-mark">✳</span><div><h2>{assistantMode === "ollama" ? "ExecAI · Local Assistant" : "ExecAI"}</h2><strong>{assistantMode === "ollama" ? "Powered by your local Ollama model" : "Intelligent Operating System Engine"}</strong><span>{assistantMode === "ollama" ? "Ask about operating systems, programming, or other topics." : "Understand. Analyze. Diagnose. Explain. Recover."}</span></div></div>
        <div className="execai-status">
          <span><i className={`status-dot ${state ? "online" : insightError ? "offline" : "checking"}`} />{liveStatus}</span>
          <span>Engine tick <b>{state?.engine?.clock_tick ?? "—"}</b></span>
          <span>Last analysis <b>{diagnosis?.timestamp ? new Date(diagnosis.timestamp).toLocaleTimeString() : "—"}</b></span>
          <span>AI status <b>{busy || diagnosing ? "Analyzing" : queryError || diagnosisError ? "Attention" : "Ready"}</b></span>
        </div>
        <label className="execai-domain">MODE<select value={domain} onChange={(event) => setDomain(event.target.value)}><option value="os_expert">OS EXPERT</option><option value="general">GENERAL</option><option value="debug">DEBUG</option><option value="learning">LEARNING</option></select></label>
      </header>
      {assistantMode === "execai" && <section className="quick-actions" aria-label="ExecAI quick actions">
        <button onClick={() => void askQuestion("Explain the current ExecOS state", "explain", "os_expert")} disabled={busy}><span>⌕</span><b>ASK OS</b><small>Ask from live Engine context</small></button>
        <button onClick={() => { setMode("analyze"); void runDiagnosis(); }}><span>⌁</span><b>ANALYZE SYSTEM</b><small>Inspect measured Engine state</small></button>
        <button onClick={() => void runDiagnosis()}><span>◉</span><b>DIAGNOSE ISSUE</b><small>Collect snapshot, trace and evidence</small></button>
        <button onClick={explainDecision} disabled={busy}><span>↳</span><b>EXPLAIN DECISION</b><small>Explain an actual scheduler choice</small></button>
        <button onClick={() => { if (whatIfRef.current) whatIfRef.current.open = true; void runWhatIf(); }} disabled={whatIfBusy}><span>⇄</span><b>SIMULATE WHAT-IF</b><small>Run policy on an isolated copy</small></button>
        <button onClick={() => void createRecoveryPlan()} disabled={recoveryBusy}><span>⟲</span><b>SELF-HEAL</b><small>Plan recovery for user approval</small></button>
      </section>}
      {assistantMode === "execai" && <section className="table-pane diagnosis-toolbar">
        <div>
          <strong>DIAGNOSE EXECOS</strong>
          <span>Fresh Engine snapshot + execution trace · deterministic analysis</span>
        </div>
        <button className="primary-button" type="button" disabled={diagnosing} onClick={runDiagnosis}>
          {diagnosing ? "Analyzing snapshot…" : "Diagnose ExecOS"}
        </button>
      </section>}
      {assistantMode === "execai" && diagnosisError && <div className="intelligence-error" role="alert">{diagnosisError}</div>}
      {assistantMode === "execai" && <section className="table-pane self-heal-panel">
        <div className="pane-title"><h2>SELF-HEALING · RECOVERY MANAGER</h2><span>ExecAI recommends · you approve · Engine executes</span></div>
        <div className="recovery-pipeline">{["DETECT", "ANALYZE", "DIAGNOSE", "RECOMMEND", "APPROVE", "RECOVER", "VERIFY"].map((step, index) => <Fragment key={step}><span className={recoveryResult && index >= 5 ? "complete" : recoveryPlan && index <= 3 ? "complete" : ""}>{step}</span>{index < 6 && <i>→</i>}</Fragment>)}</div>
        {recoveryPlan ? <div className="recovery-plan">
          <strong>{recoveryPlan.status === "awaiting_approval" ? "APPROVAL REQUIRED" : "NO AUTOMATED RECOVERY ACTION"}</strong>
          <span>{recoveryPlan.summary}</span><small>{recoveryPlan.reason}</small>
          <div className="evidence-block"><strong>Plan evidence</strong>{recoveryPlan.evidence.map((item, index) => <span key={index}>{item}</span>)}</div>
          {recoveryPlan.status === "awaiting_approval" && <button className="primary-button" disabled={recoveryBusy} onClick={() => void approveRecovery()}>{recoveryBusy ? "Recovery Manager working…" : "Approve and recover"}</button>}
        </div> : <p className="recovery-empty">No recovery operation runs without an explicit approval of a fresh plan.</p>}
        {recoveryError && <div className="intelligence-error" role="alert">{recoveryError}</div>}
        {recoveryResult && <div className={`recovery-verification ${recoveryResult.verification.verified ? "verified" : "unverified"}`} role="status">
          <strong>{recoveryResult.verification.verified ? "VERIFICATION PASSED" : "VERIFICATION FAILED"}</strong>
          <span>{recoveryResult.plan.action.algorithm.toUpperCase()} executed by the Recovery Manager at tick {recoveryResult.verification.engine_tick}.</span>
          <small>READY queue/process table: {recoveryResult.verification.ready_queue_matches_process_table ? "consistent" : "inconsistent"} · CPU owner/process table: {recoveryResult.verification.running_owner_matches_process_table ? "consistent" : "inconsistent"}</small>
        </div>}
      </section>}
      {assistantMode === "execai" && diagnosis && (
        <section className="diagnosis-grid">
          <article className="table-pane diagnosis-health">
            <div className="pane-title"><h2>EXECOS HEALTH SCORE</h2><span>{diagnosis.health_coverage} · {diagnosis.system_health}</span></div>
            <div className="health-score"><strong>{diagnosis.health_score ?? "—"}</strong><span>/ 100</span></div>
            <small className="health-scoring">{diagnosis.health_scoring}</small>
            <div className="health-dimensions">
              {Object.entries(diagnosis.health_dimensions).map(([name, score]) => (
                <div key={name}><span>{name.toUpperCase()}</span><strong>{score === null ? "N/A" : `${Math.round(score)}/100`}</strong></div>
              ))}
            </div>
            <div className="diagnosis-warnings">
              {diagnosis.warnings.length
                ? diagnosis.warnings.map((warning) => <span key={warning}>{warning}</span>)
                : <span>No threshold-based warnings detected.</span>}
            </div>
          </article>
          <article className="table-pane diagnosis-primary">
            <div className="pane-title"><h2>PRIMARY DIAGNOSIS</h2><span>{diagnosis.severity}</span></div>
            <strong className="diagnosis-issue">{diagnosis.primary_issue}</strong>
            <div className="diagnosis-facts">
              <span><b>AFFECTED</b> {diagnosis.affected_processes.join(", ") || "None identified"}</span>
              <span><b>ROOT CAUSE</b> {diagnosis.root_cause}</span>
              <span><b>RECOMMENDATION</b> {diagnosis.recommendation}</span>
            </div>
            <div className="evidence-block"><strong>Measured evidence</strong>{diagnosis.evidence.map((item, index) => <span key={index}>{item}</span>)}</div>
            {!!diagnosis.causal_chain.length && <div className="causal-chain" aria-label="Root cause causal chain">
              <strong>ROOT CAUSE CHAIN</strong>
              {diagnosis.causal_chain.map((step, index) => <Fragment key={`${index}-${step}`}>
                {index > 0 && <span className="causal-arrow">↓</span>}
                <span className="causal-step">{step}</span>
              </Fragment>)}
            </div>}
          </article>
          <article className="table-pane diagnosis-predictions">
            <div className="pane-title"><h2>PREDICTION LAYER</h2><span>History-based · no LLM metrics</span></div>
            {diagnosis.predictions.map((prediction, index) => (
              <div className="prediction-row" key={`${prediction.risk}-${index}`}>
                <strong>{prediction.risk}</strong><small>{prediction.confidence} · {prediction.method}</small>
                {prediction.evidence.map((item) => <span key={item}>{item}</span>)}
              </div>
            ))}
          </article>
          {optimizer && <article className="table-pane diagnosis-optimizer">
            <div className="pane-title"><h2>AI SCHEDULER OPTIMIZER</h2><span>{optimizer.workload_size} identical runnable processes</span></div>
            <div className="table-scroll"><table><thead><tr><th>POLICY</th>{metricLabels.map(([, label]) => <th key={label}>{label}</th>)}</tr></thead>
              <tbody>{optimizer.candidates.map((candidate) => <tr key={candidate.algorithm} className={candidate.algorithm === optimizer.recommended_algorithm ? "selected-row" : ""}>
                <td>{candidate.algorithm.toUpperCase()}{candidate.quantum ? ` · Q${candidate.quantum}` : ""}</td>
                {metricLabels.map(([key]) => <td key={key}>{candidate.metrics[key]}</td>)}
              </tr>)}</tbody>
            </table></div>
            <div className="optimizer-recommendation">
              <span>RECOMMENDED · {optimizer.recommended_algorithm.toUpperCase()}{optimizer.recommended_quantum ? ` · QUANTUM ${optimizer.recommended_quantum}` : ""}</span>
              <small>{optimizer.recommendation_reason}</small>
              <button className="primary-button" type="button" disabled={applyBusy} onClick={confirmRecommendation}>
                {applyBusy ? "Running live scheduler…" : "Confirm and run on ExecOS"}
              </button>
              {applyMessage && <strong className="apply-success" role="status">{applyMessage}</strong>}
            </div>
          </article>}
          <article className="table-pane diagnosis-metrics">
            <div className="pane-title"><h2>MEASURED ENGINE METRICS</h2><span>{diagnosis.trace_events} trace events inspected</span></div>
            <div className="diagnosis-metric-grid">{[
              ["CPU UTILIZATION", diagnosis.metrics.cpu_utilization_percent, "%"],
              ["READY QUEUE", diagnosis.metrics.ready_queue_length, ""],
              ["AVG WAIT", diagnosis.metrics.average_waiting_time, " ticks"],
              ["AVG RESPONSE", diagnosis.metrics.average_response_time, " ticks"],
              ["CONTEXT SWITCHES", diagnosis.metrics.context_switches, ""],
              ["MEMORY", diagnosis.metrics.memory_utilization_percent, "%"],
              ["FRAGMENTATION", diagnosis.metrics.external_fragmentation_percent, "%"],
              ["PAGE FAULTS", diagnosis.metrics.page_faults, ""],
              ["I/O QUEUE", diagnosis.metrics.io_queue_length, ""],
              ["BANKER SAFE", diagnosis.metrics.resource_state_safe === null ? null : diagnosis.metrics.resource_state_safe ? "YES" : "NO", ""],
            ].map(([label, value, suffix]) => <div key={label}><span>{label}</span><strong>{value === null || value === undefined ? "N/A" : `${value}${suffix}`}</strong></div>)}</div>
            <div className="scheduler-metric-note">
              <strong>LAST SCHEDULER RUN · {diagnosis.last_scheduler_run.algorithm?.toUpperCase() || "NOT RUN"}</strong>
              <span>{diagnosis.last_scheduler_run.note}</span>
              {diagnosis.last_scheduler_run.metrics && <span>
                Historical result: CPU {diagnosis.last_scheduler_run.metrics.cpu_utilization_percent}% ·
                response {diagnosis.last_scheduler_run.metrics.average_response_time} ticks ·
                {diagnosis.last_scheduler_run.metrics.context_switches} context switches
              </span>}
            </div>
          </article>
        </section>
      )}
      {assistantMode === "execai" && diagnosis?.findings.length > 0 && <section className="table-pane diagnosis-findings">
        <div className="pane-title"><h2>FINDINGS & EVIDENCE</h2><span>Every finding is derived from this diagnosis snapshot</span></div>
        <div className="diagnosis-finding-list">{diagnosis.findings.map((finding, index) => <article key={`${finding.issue}-${index}`}>
          <div className="finding-heading"><strong>{finding.issue}</strong><span>{finding.severity}</span></div>
          <span><b>AFFECTED</b> {finding.affected_processes.join(", ") || "None identified"}</span>
          <span><b>ROOT CAUSE</b> {finding.root_cause}</span>
          <span><b>RECOMMENDATION</b> {finding.recommendation}</span>
          <div className="evidence-block"><strong>Evidence</strong>{finding.evidence.map((item) => <span key={item}>{item}</span>)}</div>
        </article>)}</div>
      </section>}
      {assistantMode === "execai" && <details className="table-pane what-if-panel" ref={whatIfRef}>
        <summary>WHAT-IF LAB <span>Runs isolated copies; live Engine state and trace are unchanged</span></summary>
        <form className="engine-form" onSubmit={runWhatIf}>
          <label>Scheduling policy<select value={algorithm} onChange={(event) => setAlgorithm(event.target.value)}>{["fcfs", "sjf", "srtf", "priority", "round_robin"].map((item) => <option key={item} value={item}>{item.toUpperCase()}</option>)}</select></label>
          {algorithm === "round_robin" && <label>Time quantum<input type="number" min="1" max="10000" value={quantum} onChange={(event) => setQuantum(event.target.value)} /></label>}
          <label>Process for overrides<select value={processPid} onChange={(event) => setProcessPid(event.target.value)}><option value="">Select process</option>{availableProcesses.filter((process) => process.state === "READY").map((process) => <option key={process.pid} value={process.pid}>{process.pid} · {process.name}</option>)}</select></label>
          <label>Priority override<input type="number" min="1" max="10" value={priority} onChange={(event) => setPriority(event.target.value)} placeholder="Unchanged" /></label>
          <label>CPU burst override<input type="number" min="1" max="10000" value={burstTime} onChange={(event) => setBurstTime(event.target.value)} placeholder="Unchanged" /></label>
          <label>Arrival tick override<input type="number" min="0" max="10000" value={arrivalTime} onChange={(event) => setArrivalTime(event.target.value)} placeholder="Unchanged" /></label>
          <label>Memory allocation strategy<select value={allocationPolicy} onChange={(event) => setAllocationPolicy(event.target.value)}><option value="">No allocation test</option>{["first_fit", "best_fit", "worst_fit"].map((item) => <option key={item} value={item}>{item.replace("_", " ").toUpperCase()}</option>)}</select></label>
          {allocationPolicy && <>
            <label>Allocation process<select value={allocationPid} onChange={(event) => setAllocationPid(event.target.value)}><option value="">Select process</option>{availableProcesses.filter((process) => process.state !== "TERMINATED").map((process) => <option key={process.pid} value={process.pid}>{process.pid} · {process.name}</option>)}</select></label>
            <label>Additional memory (MB)<input type="number" min="1" max="4096" value={memorySize} onChange={(event) => setMemorySize(event.target.value)} required /></label>
          </>}
          <button className="primary-button" disabled={whatIfBusy}>{whatIfBusy ? "Simulating copy…" : "Run What-If"}</button>
        </form>
        {whatIfError && <div className="intelligence-error" role="alert">{whatIfError}</div>}
        {whatIf && <div className="what-if-results">
          <div className="what-if-heading"><strong>CURRENT · {whatIf.current.algorithm.toUpperCase()}</strong><span>VS</span><strong>SIMULATED · {whatIf.simulated.algorithm.toUpperCase()}</strong></div>
          <div className="table-scroll"><table><thead><tr><th>METRIC</th><th>CURRENT</th><th>SIMULATED</th><th>DELTA</th></tr></thead><tbody>
            {metricLabels.map(([key, label]) => <tr key={key}><td>{label}</td><td>{whatIf.current.metrics[key]}</td><td>{whatIf.simulated.metrics[key]}</td><td>{whatIf.delta[key] > 0 ? "+" : ""}{whatIf.delta[key]}</td></tr>)}
          </tbody></table></div>
          <div className="what-if-explanation"><strong>EXECOS EXPLAINS THE RESULT</strong><span>{whatIf.explanation}</span></div>
          {whatIf.memory && <div className="memory-comparison">
            <strong>MEMORY ALLOCATION COPY · {whatIf.changes.allocation_policy.toUpperCase()}</strong>
            <span>Current: {whatIf.memory.current.used_mb}/{whatIf.memory.current.total_mb} MB used · {whatIf.memory.current.external_fragmentation_percent}% fragmented</span>
            <span>Simulated: {whatIf.memory.simulated.used_mb}/{whatIf.memory.simulated.total_mb} MB used · {whatIf.memory.simulated.external_fragmentation_percent}% fragmented</span>
          </div>}
          <small className="what-if-note">Measured by the scheduler engine on isolated state copies. Positive/negative deltas are simulated minus current.</small>
        </div>}
      </details>}
      <div className="execai-workspace">
        <section className={`intelligence-ask table-pane ${assistantMode === "ollama" ? "ollama-chat-panel" : ""}`}>
          <div className="pane-title"><h2>{assistantMode === "ollama" ? "LOCAL AI CHAT" : "ASK EXECOS"}</h2>{assistantMode === "ollama" ? <div className="tutor-chat-actions"><span className={`tutor-model-state ${ollamaStatus?.available ? "ready" : ""}`}><i className={`status-dot ${ollamaStatus?.available ? "online" : "offline"}`} />{ollamaStatus?.model || "Ollama"}</span><button type="button" className="tutor-new-chat" disabled={busy} onClick={() => { setConversation([]); setQuestion(""); setQueryError(""); questionRef.current?.focus(); }}>＋ New chat</button></div> : <span>{`${domain.replace("_", " ").toUpperCase()} · ${mode.toUpperCase()}`}</span>}</div>
          <div className="assistant-mode-switch" role="group" aria-label="Choose assistant">
            <button type="button" className={assistantMode === "execai" ? "selected" : ""} aria-pressed={assistantMode === "execai"} disabled={busy} onClick={() => { assistantModeChosen.current = true; setAssistantMode("execai"); }}>ExecAI · Live Engine</button>
            <button type="button" className={assistantMode === "ollama" ? "selected" : ""} aria-pressed={assistantMode === "ollama"} disabled={busy} onClick={() => { assistantModeChosen.current = true; setAssistantMode("ollama"); }}>Local AI · Ollama</button>
          </div>
          {assistantMode === "ollama" && <div className={`ollama-status ${ollamaStatus?.available ? "ready" : "unavailable"}`} role="status"><i className={`status-dot ${ollamaStatus?.available ? "online" : "offline"}`} /><span>{ollamaStatus?.message || "Checking local Ollama availability…"}</span><button type="button" className="ollama-refresh" disabled={busy} onClick={() => apiRequest("/api/intelligence/chat/status").then(setOllamaStatus).catch((error) => setOllamaStatus({ available: false, model: null, message: error.message }))}>Recheck</button></div>}
          {assistantMode === "execai" && <div className="intelligence-modes" role="group" aria-label="ExecAI function">
            {intelligenceModes.map((item) => <button key={item.id} className={mode === item.id ? "selected" : ""} onClick={() => setMode(item.id)} title={item.description} type="button">{item.label}</button>)}
          </div>}
          <div className="conversation-stream" aria-live="polite">
            {!conversation.length && <div className={`conversation-empty ${assistantMode === "ollama" ? "tutor-welcome" : ""}`}><span className="intelligence-mark">✳</span><strong>{assistantMode === "ollama" ? "What OS concept can I help with?" : "Kernel context is ready"}</strong><p>{assistantMode === "ollama" ? "Ask anything about operating systems. Your local tutor can explain concepts, work through examples, compare algorithms, and answer follow-up questions." : "Ask about live ExecOS behavior or choose a technical topic. Answers show the data source and evidence used."}</p><div className="prompt-examples"><span>{assistantMode === "ollama" ? "EXPLORE A TOPIC" : "START WITH A QUESTION"}</span>{(assistantMode === "ollama" ? ["Explain virtual memory with an example", "Compare FCFS and Round Robin", "How does a page fault work?", "Explain deadlock and Banker's algorithm", "What happens during a system call?", "How do mutexes prevent race conditions?"] : domain === "general" ? ["Explain database transactions", "What is TCP?", "Explain Big-O complexity"] : domain === "learning" ? ["What is a PCB?", "Explain Round Robin", "What is a system call?"] : intelligenceQuestions.slice(0, 4)).map((prompt) => <button key={prompt} type="button" onClick={() => setQuestion(prompt)}>{prompt}<span aria-hidden="true">↗</span></button>)}</div></div>}
            {conversation.map((message, index) => assistantMode === "ollama" ? message.role === "user"
              ? <article className="tutor-turn tutor-user" key={`user-${index}`}><span className="tutor-avatar">You</span><div className="tutor-message-content"><p>{message.text}</p></div></article>
              : <article className="tutor-turn tutor-assistant" key={`answer-${index}`}><span className="tutor-avatar assistant-avatar">✳</span><div className="tutor-message-content"><div className="tutor-answer-meta"><strong>ExecAI</strong><span>LOCAL · {message.result.model}</span></div><div className="tutor-markdown">{renderTutorAnswer(message.result.answer)}</div><small className="tutor-answer-note">Generated locally · verify critical details</small></div></article>
              : message.role === "user"
              ? <article className="conversation-user" key={`user-${index}`}><span>{message.domain.replace("_", " ").toUpperCase()} · {message.function.toUpperCase()}</span><p>{message.text}</p></article>
              : <article className="conversation-response" key={`answer-${index}`}><div className="answer-meta"><span>{message.result.source === "local-ollama" ? "EXECOS LOCAL AI" : "EXECOS INTELLIGENCE"}</span><span>{message.result.source}{message.result.model ? ` · ${message.result.model}` : ""}</span></div><strong>{message.result.domain === "general" ? "TECHNICAL EXPLANATION" : message.result.domain === "learning" ? "CONCEPT" : message.result.function.toUpperCase()}</strong><p>{message.result.answer}</p><div className="evidence-block"><strong>{message.result.source === "local-ollama" ? "SOURCE" : message.result.domain === "general" || message.result.domain === "learning" ? "REFERENCE / KEY POINT" : "WHY · ENGINE EVIDENCE"}</strong>{message.result.evidence.map((item, evidenceIndex) => <span key={evidenceIndex}>{item}</span>)}</div><small className="response-scope">{message.result.read_only ? "READ ONLY · NO KERNEL ACTION TAKEN" : "Engine context"}</small></article>)}
            {busy && (assistantMode === "ollama" ? <div className="tutor-turn tutor-assistant"><span className="tutor-avatar assistant-avatar">✳</span><div className="tutor-message-content"><div className="tutor-answer-meta"><strong>ExecAI</strong><span>THINKING</span></div><div className="response-working"><span className="typing-indicator"><i /><i /><i /></span><span>Thinking through your question…</span></div></div></div> : <div className="response-working"><span className="typing-indicator"><i /><i /><i /></span><span>Reading current ExecOS context…</span></div>)}
            <div ref={conversationEndRef} />
          </div>
          {queryError && <div className="intelligence-error" role="alert">{queryError}</div>}
          <form className={`intelligence-form ${assistantMode === "ollama" ? "tutor-composer" : ""}`} onSubmit={submitQuestion}>
            <label htmlFor="intelligence-question" className={assistantMode === "ollama" ? "visually-hidden" : ""}>Question</label>
            <div className={assistantMode === "ollama" ? "tutor-input-shell" : ""}>
              <textarea ref={questionRef} id="intelligence-question" value={question} maxLength={assistantMode === "ollama" ? 2000 : 500} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form.requestSubmit(); } }} placeholder={assistantMode === "ollama" ? "Ask about OS, coding, or anything else…" : "Ask ExecAI about ExecOS, operating systems, debugging or technical concepts…"} rows={assistantMode === "ollama" ? 2 : 3} />
              {assistantMode === "ollama" && <button type="submit" className="tutor-send-button" aria-label="Send message" disabled={busy || !question.trim()}>{busy ? "…" : "↑"}</button>}
            </div>
            <div className="intelligence-submit-row"><small>{assistantMode === "ollama" ? "Enter to send · Shift + Enter for a new line · " : "Enter to send · Shift + Enter for a new line · "}{question.length}/{assistantMode === "ollama" ? 2000 : 500}</small>{domain === "learning" && assistantMode === "execai" && <button className="subtle-button" type="button" onClick={() => setQuestion("Explain the current Engine state using a simple operating-systems example.")}>Use my current system</button>}{assistantMode === "execai" && <button className="primary-button" disabled={busy || !question.trim()}>Send to ExecAI</button>}</div>
            {assistantMode === "ollama" && <small className="tutor-disclaimer">Answers are generated by your local model, not a live web search. Check important facts.</small>}
          </form>
        </section>
        {assistantMode === "execai" && <aside className="execai-side">
          <section className="table-pane live-kernel">
            <div className="pane-title"><h2>LIVE KERNEL</h2><span><i className={`status-dot ${state ? "online" : "offline"}`} />{state ? "LIVE SNAPSHOT" : "UNAVAILABLE"}</span></div>
            {!state ? <div className="answer-placeholder">Waiting for the central Kernel Engine snapshot.</div> : <>
              <div className="live-kernel-top"><div><span>CPU · LAST MEASURED RUN</span><strong>{liveCpu == null ? "Not measured" : `${liveCpu}%`}</strong></div><div><span>ENGINE MEMORY</span><strong>{liveMemory == null ? "—" : `${liveMemory}%`}</strong></div></div>
              <div className="live-kernel-grid">
                <div><span>PROCESS COUNT</span><b>{state.processes.total}</b></div>
                <div><span>RUNNING</span><b>{state.scheduler.current_pid || "Idle"}</b></div>
                <div><span>SCHEDULER</span><b>{currentPolicy.toUpperCase()}</b></div>
                <div><span>QUANTUM</span><b>{lastRun?.algorithm === "round_robin" ? lastRun.quantum : !lastRun ? state.scheduler.default_quantum : "—"}</b></div>
                <div><span>CONTEXT SWITCHES · LAST RUN</span><b>{lastRun?.metrics?.context_switches ?? "—"}</b></div>
                <div><span>I/O QUEUE</span><b>{state.io.queue_depth}</b></div>
                <div><span>DEADLOCK CHECK</span><b className={state.deadlock_check.safe ? "value-safe" : "value-warning"}>{state.deadlock_check.status}</b></div>
                <div><span>ENGINE TICK</span><b>{state.engine.clock_tick}</b></div>
              </div>
              <div className="live-queue-row"><span>READY</span><div>{state.scheduler.ready_queue.length ? state.scheduler.ready_queue.map((pid) => <b key={pid}>{pid}</b>) : <small>Empty</small>}</div></div>
              <div className="live-queue-row waiting"><span>WAITING</span><div>{(processStates.WAITING || []).length ? processStates.WAITING.map((process) => <b key={process.pid} title={process.wait_reason || "No wait reason recorded"}>{process.pid}</b>) : <small>None</small>}</div></div>
              <small className="live-source-note">Source: shared ExecOS Kernel Engine state · refreshed with the workbench</small>
            </>}
          </section>
          <section className="intelligence-insights">
            <div className="pane-title"><h2>EXECOS INTELLIGENCE</h2><button className="subtle-button" type="button" onClick={() => refreshInsights().catch((error) => setInsightError(error.message))}>Refresh</button></div>
            <div className="insight-meta"><span><i className="status-dot online" />Measured Engine observations</span><span>{updatedAt ? new Date(updatedAt).toLocaleTimeString() : "Loading"}</span></div>
            {insightError && <div className="intelligence-error" role="alert">{insightError}</div>}
            <div className="insight-list">{insights.map((insight) => <article className={`insight-card ${insight.available ? "" : "unavailable"}`} key={insight.id}><div className="insight-card-heading"><span className="insight-icon">{insight.available ? "◈" : "—"}</span><div><small>{insight.category}</small><strong>{insight.title}</strong></div><span className={`insight-state ${insight.available ? "measured" : ""}`}>{insight.available ? "MEASURED" : "NO DATA"}</span></div><p>{insight.summary}</p><small className="insight-evidence">{insight.evidence}</small></article>)}{!insights.length && !insightError && <div className="answer-placeholder">Reading current Kernel Engine state…</div>}</div>
          </section>
          <section className="table-pane recent-activity">
            <div className="pane-title"><h2>RECENT AI ACTIVITY</h2><span>{activity.length} this session</span></div>
            {activity.length ? <div className="activity-list">{activity.map((item) => <button key={item.id} className={selectedActivity?.id === item.id ? "selected" : ""} onClick={() => setSelectedActivity(item)}><span>{item.kind === "diagnosis" ? "◉" : item.kind.startsWith("recovery") ? "⟲" : item.kind === "what-if" ? "⇄" : "✳"}</span><div><b>{item.title}</b><small>{item.summary}</small></div></button>)}</div> : <p className="activity-empty">No AI operations recorded in this session yet.</p>}
            {selectedActivity && <div className="activity-detail"><strong>{selectedActivity.title}</strong><p>{selectedActivity.summary}</p>{selectedActivity.details?.evidence?.map((item, index) => <small key={index}>{item}</small>)}{selectedActivity.details?.verification && <small>Verification: {selectedActivity.details.verification.verified ? "passed" : "not passed"}</small>}{selectedActivity.details?.answer && <small>{selectedActivity.details.answer}</small>}{selectedActivity.details?.explanation && <small>{selectedActivity.details.explanation}</small>}</div>}
          </section>
          <div className="intelligence-boundary"><strong>OS core acts · intelligence explains</strong><span>ExecAI analyzes and recommends. Only the Kernel Engine or the approved Recovery Manager performs OS operations.</span></div>
        </aside>}
      </div>
    </div>
  );
}

function ProcessTable({ processes, onSelect, selectedPid }) {
  return (
    <div className="table-scroll"><table><thead><tr><th>PID</th><th>PROCESS</th><th>USER</th><th>HOST STATE</th><th>CPU</th><th>MEMORY</th><th>THREADS</th><th>RUNTIME</th></tr></thead>
      <tbody>{processes.map((process) => <tr key={process.pid} className={selectedPid === process.pid ? "selected-row" : ""} onClick={() => onSelect(process.pid)} tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter") onSelect(process.pid); }}>
        <td className="mono">{process.pid}</td><td>{process.name}</td><td>{process.user || "Unavailable"}</td><td><span className={`state-tag ${process.status}`}>{process.status}</span></td>
        <td>{process.cpu_percent === null || process.cpu_percent === undefined ? "—" : `${process.cpu_percent.toFixed(1)}%`}</td>
        <td>{formatBytes(process.memory_bytes)}</td><td>{process.thread_count ?? "—"}</td>
        <td>{process.runtime_seconds === null || process.runtime_seconds === undefined ? "—" : formatDuration(process.runtime_seconds)}</td>
      </tr>)}
      {!processes.length && <tr><td colSpan="8" className="empty-cell">No visible host processes match this query.</td></tr>}</tbody>
    </table></div>
  );
}

function ProcessInspector({ process, onClose }) {
  return <aside className="inspector"><div className="pane-title"><h2>HOST PROCESS</h2><button className="subtle-button" onClick={onClose}>Close</button></div><strong className="inspector-name">{process.name}</strong><dl>
    <dt>PID</dt><dd>{process.pid}</dd><dt>User</dt><dd>{process.user || "Unavailable"}</dd><dt>Parent PID</dt><dd>{process.parent_pid ?? "Unavailable"}</dd><dt>State</dt><dd>{process.status}</dd><dt>CPU</dt><dd>{process.cpu_percent === null || process.cpu_percent === undefined ? "Unavailable" : `${process.cpu_percent.toFixed(1)}%`}</dd>
    <dt>Resident memory</dt><dd>{formatBytes(process.memory_bytes)}</dd><dt>Threads</dt><dd>{process.thread_count ?? "Unavailable"}</dd><dt>Runtime</dt><dd>{process.runtime_seconds == null ? "Unavailable" : formatDuration(process.runtime_seconds)}</dd><dt>Open files</dt><dd>{process.open_file_count ?? "Unavailable"}</dd><dt>OS priority</dt><dd>{process.priority ?? "Unavailable"}</dd>
  </dl><p className="read-only-note">Read-only host information. This tool cannot modify or terminate host processes.</p></aside>;
}

function HostDetails({ system, io }) {
  return <section className="details-pane"><div className="pane-title"><h2>HOST DETAILS</h2><span>READ ONLY</span></div><dl>
    <dt>Operating system</dt><dd>{system.system} {system.release}</dd><dt>Architecture</dt><dd>{system.architecture}</dd><dt>Processor</dt><dd>{system.processor || "Unavailable"}</dd><dt>Logical processors</dt><dd>{system.cpu_count_logical ?? "Unavailable"}</dd><dt>System disk</dt><dd>{system.disk.root}</dd><dt>Disk capacity</dt><dd>{formatBytes(system.disk.used_bytes)} / {formatBytes(system.disk.total_bytes)}</dd>
  </dl>
  <div className="io-summary"><h3>HOST I/O COUNTERS</h3>{io ? <><div><span>Disk read</span><b>{formatBytes(io.disk.read_bytes)}</b></div><div><span>Disk written</span><b>{formatBytes(io.disk.write_bytes)}</b></div><div><span>Network received</span><b>{formatBytes(io.network.bytes_received)}</b></div><div><span>Network sent</span><b>{formatBytes(io.network.bytes_sent)}</b></div></> : <p>Host I/O counters are unavailable.</p>}</div>
  </section>;
}

export default App;
