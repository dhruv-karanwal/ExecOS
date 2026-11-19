# ExecOS

ExecOS is an operating-systems learning workbench with two distinct cores:

* **ExecOS x86-64 kernel:** a freestanding Limine-booted C kernel, built and
  run separately under QEMU. Its current kernel-mode capabilities include
  physical-frame allocation, a page-backed heap, IDT/PIC/PIT interrupts,
  preemptive round-robin kernel threads, a bounded RAM filesystem, tracing,
  and a COM1 serial shell.
* **ExecOS Kernel Engine:** a deterministic, in-memory software OS engine
  served by the FastAPI backend and displayed in the React workbench. It owns
  the process table and lifecycle, FCFS/SJF/SRTF/Priority/Round Robin
  scheduling, metrics and Gantt timeline, contiguous and virtual memory,
  virtual files, devices and I/O, IPC, resources/Banker's safety checks,
  interrupts, system calls, and execution trace. Restarting the backend
  resets this Engine state. It is not a live QEMU guest or hardware kernel.

**ExecAI is an observability layer, not a control plane.** The Engine performs
OS operations; ExecAI reads Engine snapshots and trace records to explain,
analyze, recommend, or teach. Its diagnosis and health score expose measured
evidence, and its optimizer and What-If Lab run real scheduler algorithms on
isolated copies. No analysis mutates live Engine state; only an explicit user
confirmation runs a recommended policy on the Engine and records the result in
the trace. Prediction trends use retained scheduler history and disclose when
there is not enough history. Host operating-system telemetry
is separately labeled read-only data and is never substituted for Engine
state.

The ExecAI console also provides OS Expert, Debug, Learning, and General
technical-reference modes, a shared live Engine panel, and a session activity
log. General answers come from a small curated reference rather than live
Engine metrics. User-approved self-healing plans are executed by the backend
Recovery Manager only; it rejects stale plans and verifies process/queue and
CPU-owner consistency after the Engine operation.

The authenticated workbench also includes the **ExecOS Interactive Operating
System Simulator & Visualizer**. Its modular Learning Hub covers CPU and disk
scheduling (including preemptive and non-preemptive priority), process
synchronization, memory-management techniques, contiguous allocation, paging
and segmentation/TLB, page replacement, Banker's safety and deadlock detection,
file allocation, single-level and hierarchical directories, system calls, and
core OS concepts. The standalone algorithm labs
validate custom inputs, support play/pause/next/reset, explain each decision,
display algorithm-specific visualizations and metrics, and compare policies
on the same workload. The labs include Next Fit, Second Chance (Clock),
Producer–Consumer, Readers–Writers, Dining Philosophers, MFT/MVT partitioning
with configurable MFT/MVT workloads, release and compaction, editable paging
tables and segment bounds, TLB/page-fault walks, a deadlock detector, and a
conceptual fork/exec/wait/exit lifecycle. Synchronization, address translation,
directory navigation, system-call flow, and OS concept modules each have
dedicated interactive visuals. The Engine supports only its explicitly listed policies
and system calls; conceptual-only operations are labeled and are not claimed to
run on the Engine or host OS. These educational labs are separate from the Engine's
persisted-in-memory state; the CPU lab can optionally run its chosen policy on
the live Engine workload. The existing login/signup flow, Engine workbench,
ExecAI, host monitor, and optional QEMU kernel remain available.

Each simulator topic follows a **visualize → learn the concept → 20-question
topic quiz** learning path. Lessons include a core idea, objectives, vocabulary,
rules and formulas, worked examples, reasoning steps, and common pitfalls; they
also link to the [GeeksforGeeks Operating System Tutorial](https://www.geeksforgeeks.org/operating-systems/operating-systems/)
for further reading. Every quiz gives per-question feedback and ends with a
final score out of 20. System-call and OS-concept topics include their own step-through
diagrams; algorithm topics use the same calculated simulation result for their
step explanations, visualizations, and metrics. CPU Scheduling uses a dedicated
two-panel visualizer with editable process rows, a live CPU/ready-queue state
view, a step-driven Gantt timeline, calculated results, and per-policy
description, formula, advantages, disadvantages, and comparison tabs.
Algorithm visualizers place workload controls beside their live disk-head,
memory-block, page-frame, deadlock, or file-allocation visualization and
calculated results.

The Learning Hub also includes **Challenge Mode** with one deterministic,
scenario-based question for each of the 12 OS topics. Challenges provide hints,
answer feedback, explanations, retry support, and links back to the matching
simulator. Signed-in learners' visualizer visits, lesson visits, quiz attempts
and best scores, and challenge attempts and completions are stored per account
in the existing SQLite database. View the saved topic-by-topic progress from
the Challenges screen; the authenticated `/api/learning/progress` endpoints
read and update these records.

Every topic opens as a long-form study article with a reading outline, a plain-language
overview, topic-specific explanations, a defined glossary, rules and formulas, a worked
example, a step-by-step reasoning guide, common misconceptions, and connections to
other OS topics. The lessons are written in ExecOS's own words and use the external
reference for further reading rather than reproducing its text. The coverage
spans CPU and disk scheduling, contiguous/fixed/variable memory allocation,
paging and segmentation, virtual memory and page replacement, deadlock,
synchronization, file allocation and directory hierarchies, system calls, and
the OS kernel, processes, devices, interrupts, and protection.

The OS Concepts lesson also includes a whole-subject roadmap covering OS
architecture and boot, processes and scheduling, concurrency and deadlocks,
memory and virtual memory, filesystems, I/O and drivers, storage, protection,
virtual machines/containers, distributed systems, and reliability. Roadmap
cards link directly to the matching ExecOS lesson or simulator. The reading
list includes the GeeksforGeeks OS tutorial, the free *Operating Systems:
Three Easy Pieces* textbook, MIT's 6.1810 course, Linux kernel documentation,
Linux man-pages, and Microsoft Learn's driver introduction. ExecOS presents
original summaries and links to these sources rather than copying their text;
platform-specific behavior may differ between the references.

ExecAI remains the evidence-based, Engine-aware assistant. Its open-ended local
assistant uses Ollama for OS tutoring, programming help, and other general questions.
When the configured model is available, the chat panel selects it by default. Its
conversational view is prominent, while live diagnosis and Engine tools remain available below it. Each
assistant request receives a fresh, read-only summary of the actual Kernel Engine
state, grounding questions about current ExecOS processes or scheduling in the
running simulator. The assistant does not browse the web or control the host machine.
Its accuracy and breadth depend on the locally installed model, so verify important
answers. Engine-aware explanations remain available, and unsupported curated answers
are identified instead of being guessed. Install/start Ollama and pull a model if needed:

```powershell
ollama pull qwen2.5:1.5b
$env:EXECOS_OLLAMA_MODEL = "qwen2.5:1.5b"
python -m uvicorn app.main:app --host 127.0.0.1 --reload
```

For stronger general answers, a larger installed model can be selected instead:

```powershell
ollama pull qwen2.5:7b
$env:EXECOS_OLLAMA_MODEL = "qwen2.5:7b"
```

The larger model needs substantially more disk space and memory; either local
model can still make mistakes.

`EXECOS_OLLAMA_URL` defaults to `http://127.0.0.1:11434`; only a localhost
endpoint is accepted. The local assistant reports whether the daemon and
configured model are available. If not, it reports the issue explicitly and
does not substitute a fabricated or curated answer. ExecAI's existing
Engine-aware and curated technical-reference modes continue to work without
Ollama.

## Start the workbench

Run these commands from the ExecOS project folder. Start the backend in one
PowerShell terminal:

```powershell
Set-Location backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --reload
```

In a second PowerShell terminal, start the frontend from its package folder:

```powershell
Set-Location frontend
npm install
npm run dev
```

Do not run `npm run dev` or `npm run build` at the project root: the frontend's
`package.json` is in `frontend`. Open the local URL printed by Vite, normally
`http://localhost:5173`. Health
and interactive API documentation are at
`http://127.0.0.1:8000/api/health` and `http://127.0.0.1:8000/docs`.
Create a workbench account at the welcome screen using your name, email, and
password. Accounts are stored in `backend/data/accounts.sqlite3` with salted
password hashes; set `EXECOS_AUTH_DB_PATH` to choose another SQLite file.
Signing in creates a temporary application session; it is not an OS user and
does not grant host privileges.

The Engine exposes authenticated `/api/kernel/` endpoints. The UI refreshes
its state from `/api/kernel/state`; Engine actions are deterministic and
recorded in the execution trace. `/api/host/` endpoints provide separate,
read-only telemetry about the computer running the API. Bind the API to
loopback unless deploying an independently secured transport. Configure
development CORS with `EXECOS_CORS_ORIGINS`.

ExecAI query and diagnosis endpoints take fresh Engine snapshots and retained
trace records. Diagnosis detects READY queue/process-state mismatches from the
actual identifiers in those sources. Recovery plans use
`/api/intelligence/recovery/plan`; executing one requires its plan ID and
explicit approval through `/api/intelligence/recovery/execute`.

The Processes workbench reads PCBs and the READY queue from the same Engine
snapshot. Selecting a process opens its control block, measured lifecycle
metrics, state progression, and PID-filtered execution trace. Dispatch, pause,
resume, priority changes, and termination return an updated Engine snapshot;
memory allocation/release and process-state changes are also recorded in the
trace.

## Run tests and build

```powershell
cd backend
python -m unittest discover -s tests -v
```

```powershell
cd frontend
npm run build
```

The separate freestanding kernel is built and tested from Ubuntu on WSL2:

```sh
sudo apt update
sudo apt install build-essential git curl xorriso qemu-system-x86
make
make run
```

The serial kernel shell has `help` to list its commands. Kernel validation
targets include `make test-memory`, `make test-heap`, `make test-process`,
`make test-filesystem`, `make test-shell`, `make test-trace`, and
`make test-boot`.

See [`docs/CURRENT_ARCHITECTURE.md`](docs/CURRENT_ARCHITECTURE.md) and
[`docs/UI_BACKEND_MAPPING.md`](docs/UI_BACKEND_MAPPING.md) for the Engine,
QEMU kernel, host monitor, and UI boundaries.
