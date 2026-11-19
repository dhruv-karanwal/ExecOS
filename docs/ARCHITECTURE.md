# ExecOS architecture

ExecOS provides a desktop OS workbench backed by a deterministic software
Kernel Engine, alongside an independent freestanding x86-64 kernel project.
The two are deliberately distinguished: the workbench Engine is not a
connection to QEMU, and QEMU is not required to use the workbench.

## Workbench Engine

```text
React workbench -> authenticated FastAPI -> ExecOS Kernel Engine
                                            -> process/scheduler/memory state
                                            -> device/I/O/filesystem/IPC state
                                            -> resource/interrupt/syscall/trace state
ExecAI <- read-only Engine snapshot and trace
       -> deterministic diagnoses, evidence and causal chains
       -> scheduler comparisons / What-If on isolated Engine copies
       -> history-based trend observations (no unsupported forecasts)
```

The Engine owns the operating state. Its scheduler executes FCFS, SJF, SRTF,
Priority, or Round Robin; memory managers perform contiguous allocation and
FIFO/LRU virtual-page replacement; the filesystem, device/I/O, IPC, resource,
interrupt, and syscall modules mutate Engine-owned state. Operations produce
trace records and API responses used by the UI. State is in memory and resets
when the backend restarts.

ExecAI does not perform OS operations during diagnosis, optimization, or
What-If evaluation. Explain, Analyze, Recommend, and Teach remain available.
Diagnosis uses explicit rules and measured Engine evidence; its health score
discloses dimension coverage, and predictions are limited to trends in retained
scheduler history. Optimizer and What-If runs execute the real scheduler on
isolated Engine copies. A recommended policy is applied to the live Engine
only after the user explicitly confirms it.

Host CPU, memory, process, uptime, and I/O measurements are obtained from the
OS running the API. They are read-only and displayed in a separate scope;
they do not describe or control Engine or QEMU state.

## Independent QEMU kernel

```text
Limine -> freestanding x86-64 kernel
       -> memory allocator and kernel heap
       -> IDT, legacy PIC/PIT, kernel-thread scheduler
       -> bounded RAM filesystem and trace ring
       -> COM1 serial shell
```

This real kernel currently runs ring-0 worker threads in one shared address
space. It does not yet have ring-3 execution, isolated process address spaces,
a userspace syscall ABI, persistent filesystem, or a GUI telemetry bridge.
Its state is therefore not fed into the workbench Engine or ExecAI.
