# Test ExecOS

## Kernel Engine API

From `backend/`, run the Python unit and API suite:

```powershell
python -m compileall -q app tests
python -m unittest discover -s tests -v
```

The suite covers deterministic boot state, FCFS/SJF/SRTF/Priority/Round Robin
workloads, scheduling metrics, physical and virtual memory, filesystem
operations, active/queued I/O, IPC, resources and Banker's safety, interrupt
and syscall records, Engine explanations, API authentication, and the
allowlisted terminal.

## React workbench

From `frontend/`, run the production build:

```powershell
npm run build
```

## Freestanding kernel

From the repository root in Ubuntu on WSL2:

```sh
make test-memory
make test-heap
make test-process
make test-filesystem
make test-shell
make test-trace
make test-boot
```

These validate the real Limine-booted C kernel and its COM1 shell. They do
not validate a browser-to-QEMU telemetry bridge; no such bridge is currently
implemented.
