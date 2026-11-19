# Workbench data-source mapping

The primary OS workbench uses the in-memory ExecOS Kernel Engine. Host
telemetry is a separate, read-only source. The independent Limine/QEMU kernel
is not connected to the desktop UI.

| Workbench area | Engine/API data source | Behavior |
| --- | --- | --- |
| Overview | `/api/kernel/state` | Engine status, PCB counts, memory, scheduler result/Gantt, I/O and recent trace; separate host snapshot |
| Processes | `/api/kernel/processes`, `/api/kernel/processes/{pid}/action` | Engine process creation and PCB lifecycle/priority controls |
| CPU | `/api/kernel/scheduler`, `/api/kernel/scheduler/run` | Engine scheduler policies, queue, Gantt segments, waiting/turnaround/response and utilization metrics; host CPU separately labeled |
| Memory | `/api/kernel/memory`, `/api/kernel/memory/allocate`, `/api/kernel/memory/release` | Contiguous Engine memory map, First/Best/Worst Fit, fragmentation; host RAM separately labeled |
| Storage | `/api/kernel/virtual-memory`, `/api/kernel/virtual-memory/access` | Engine frame table, page table, FIFO/LRU replacement and hit/fault counts |
| File System | `/api/kernel/filesystem` | Engine virtual filesystem create/read/write/delete/rename actions |
| Devices and I/O | `/api/kernel/devices`, `/api/kernel/devices/request`, `/api/kernel/io`, `/api/kernel/io/complete` | Engine device ownership, I/O queue, process wait and completion interrupts |
| IPC | `/api/kernel/ipc`, `/api/kernel/ipc/send`, `/api/kernel/ipc/receive` | Engine message queues |
| Resources and Deadlocks | `/api/kernel/resources/*`, `/api/kernel/deadlocks/check` | Engine resource claims/allocation, blocked requests and Banker's safety check |
| Interrupts | `/api/kernel/interrupts`, `/api/kernel/interrupts/trigger` | Handled Engine interrupt records |
| System Calls | `/api/kernel/syscalls` | Recorded Engine syscall dispatch, result, and error status |
| Execution Trace | `/api/kernel/trace` | Filterable Engine event history |
| Terminal | `/api/kernel/terminal` | Allowlisted Engine shell commands; never invokes the host shell |
| ExecAI | `/api/intelligence/insights`, `/api/intelligence/query`, `/api/intelligence/diagnose`, `/api/intelligence/optimizer`, `/api/intelligence/what-if` | Evidence-based diagnosis, disclosed health score and history trends, five-policy optimizer, and copy-only what-if. A recommendation reaches the live scheduler only after explicit confirmation |
| System / host readouts | `/api/host/*`, `/api/v1/*` | Actual host operating-system information, read-only and separately labeled |
| QEMU kernel | COM1 serial shell | Independent kernel development target; no GUI telemetry bridge |

All Engine and host data routes require an application session except the
health endpoints. The account/session system is not an OS login and does not
grant host privileges. Keep the API bound to loopback unless a separately
secured deployment is configured. Backend restart resets Engine state.
