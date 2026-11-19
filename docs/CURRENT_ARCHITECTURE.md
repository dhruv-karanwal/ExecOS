# Current ExecOS architecture

ExecOS contains a separate freestanding x86-64 kernel and a stateful software
Kernel Engine used by the desktop workbench. The Engine is functional and
owns the data shown by its pages, but it is not the QEMU guest and does not
claim to execute in kernel mode. QEMU remains an independent, optional
kernel-development target.

## Repository components

| Area | Current implementation | State source |
| --- | --- | --- |
| `kernel/` | Freestanding x86-64 C kernel booted by Limine and run under QEMU | Guest CPU and kernel-owned structures |
| `kernel/src/process/` | Fixed-capacity ring-0 kernel-thread table, lifecycle and scheduling statistics | Kernel process table |
| `kernel/src/scheduler/` | PIT-driven, preemptive round robin with configurable tick quantum | Kernel timer and scheduler |
| `kernel/src/memory/` | Physical-frame bitmap allocator and page-backed kernel heap | Limine memory map and kernel allocator |
| `kernel/src/filesystem/` | Bounded volatile RAM filesystem | Guest kernel structures |
| `kernel/src/tracing/`, `kernel/src/shell/` | Bounded trace ring and COM1 serial inspection shell | Guest kernel structures |
| `backend/app/kernel_engine.py` | Locked deterministic OS workbench Engine | Engine-owned process, scheduler, memory, device, I/O, filesystem, IPC, resource, interrupt, syscall, and trace state |
| `backend/app/main.py` | Authenticated Engine API, read-only host API, and application sessions | Kernel Engine and host APIs kept distinct |
| `backend/app/intelligence.py` | Deterministic state explanation and educational reference | Engine snapshots and trace records; no OS control |
| `backend/app/analysis.py` | Rule-based diagnosis, health dimensions, evidence chains, and cautious historical trends | Fresh Engine snapshots, trace records, and scheduler-computed candidate metrics |
| `frontend/src/` | Dark React workbench for Engine operations and separate host observations | Backend Engine and host responses |

## Workbench data flow

```text
User -> React workbench -> authenticated FastAPI -> ExecOS Kernel Engine
                                            -> Engine state and execution trace
ExecAI -> Engine snapshot/trace -> evidence-based diagnosis and health score
       -> scheduler comparison/What-If on isolated Engine copies
       -> optional user-confirmed live scheduler run

React workbench -> FastAPI -> host operating-system APIs (read-only, separate)
Limine -> QEMU -> freestanding C kernel -> COM1 serial shell (independent)
```

The Engine supplies the workbench's process states and lifecycle, scheduler
selection and metrics, Gantt data, contiguous and virtual memory, virtual
filesystem, device ownership and I/O queue, IPC messages, resource claims,
Banker's safety result, interrupt records, system calls, and filtered trace.
Engine state is in memory and resets when the backend process restarts.
Scheduler history is bounded to 20 real runs and retains burst/priority
profiles for comparison. Trend predictions require at least two matching
profiles; current-state risk indicators are labeled as rule-based projections,
not probabilities or ML forecasts. Analysis does not attribute an older
scheduler result to a different live workload. Analysis and optimizer
candidates are evaluated on copies and do not append live Engine trace or
mutate live processes. The confirmation action uses the regular scheduler
endpoint and is recorded in the live trace.

Host measurements always refer to the operating system running FastAPI. They
are read-only and are never represented as the Engine's state. The QEMU kernel
is not connected to the React workbench; QEMU is optional for using the
software Engine.

## Freestanding kernel limits

The bootable kernel runs ring-0 threads in one shared address space. It does
not yet provide ring-3 user processes, process address-space isolation,
userspace syscall ABI, persistent filesystem storage, or a GUI telemetry
transport. The software Engine intentionally supplies a separate OS-learning
environment and must not be described as a live QEMU kernel.

## Verification

The Python Engine and API tests are in `backend/tests/` and run with
`python -m unittest discover -s tests -v` from `backend/`. The React
production build uses `npm run build` from `frontend/`. Root `make
test-memory`, `make test-heap`, `make test-process`, `make test-filesystem`,
`make test-shell`, `make test-trace`, and `make test-boot` validate the
freestanding kernel.

See [`UI_BACKEND_MAPPING.md`](UI_BACKEND_MAPPING.md) for the page-to-endpoint
mapping.
