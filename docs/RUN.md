# Run ExecOS

## Desktop OS workbench

Start the API in PowerShell:

```powershell
cd backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --reload
```

In another PowerShell terminal, start the React app:

```powershell
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite. Sign in or create a workbench account.
The deterministic Kernel Engine owns the process, scheduler, memory, virtual
filesystem, device/I/O, IPC, resources, interrupts, syscalls, and trace views.
Engine state is in memory and resets when the backend restarts. The web
Terminal accepts only documented Engine commands (`help`, `ps`, `memory`,
`ls`, `cat`, filesystem operations, `schedule`, and `trace`); it never starts
a host shell or executes arbitrary commands.

Host CPU, memory, process, and I/O readings are a separate read-only view of
the machine running the API. The software Engine does not connect to or claim
to be the QEMU guest.

## Freestanding QEMU kernel

From the repository root in Ubuntu on WSL2, build and start QEMU:

```sh
make
make run
```

QEMU attaches the guest COM1 serial port to the terminal. After the boot
self-tests, the guest enters the in-kernel serial shell. Type `help` to see
supported commands. Current commands include filesystem operations
(`pwd`, `cd`, `ls`, `mkdir`, `touch`, `cat`, `write`, `rm`, `mv`) and kernel
inspection (`ps`, `memory`, `trace`, `uname`). Files live only in the guest's
bounded RAM filesystem and are lost when QEMU exits. Press `Ctrl+C` to stop
QEMU.

This is a separate kernel-mode implementation. It does not currently boot
userspace, provide a ring-3 shell/program loader, or send telemetry to the
desktop workbench.
