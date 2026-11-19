// ExecOS · System Calls · concept lesson, guide and glossary
// Copied verbatim from (the app still runs from these originals):
//   frontend/src/theoryContent.js lines 202-221
//   frontend/src/theoryContent.js lines 297-301
//   frontend/src/theoryContent.js lines 390-397

export const theory = {
  "System Calls": {
    overview: "A system call is a controlled interface through which a user program requests a service that requires kernel authority, such as process creation, file access, or device I/O. A wrapper prepares the service identifier and arguments; the CPU enters kernel mode, the kernel validates the request, performs or rejects it, and returns a result.",
    simple: "A system call is a controlled way for an application to ask the kernel to do work that needs OS authority, such as reading a file or creating a process.",
    analogy: "Think of a service desk: a user submits a request, staff check identity and rules, perform an allowed task, and return a result. The analogy emphasizes validation and a controlled boundary; a system call is a CPU/kernel mechanism, not a human conversation.",
    realWorld: "A program can call a read interface to request bytes from an open file. The kernel checks the file handle and memory access, performs or arranges the operation, then returns a byte count or error. Some library functions never cross into the kernel.",
    recap: ["A system call crosses a controlled user/kernel boundary to request a privileged service.", "The kernel validates arguments and permissions before acting and returns a result or error.", "ExecOS system-call demos affect only the simulated Engine, not the host OS."],
    selfCheck: "Is every function in a programming library a system call?",
    selfCheckAnswer: "No. Many library functions execute entirely in user space. A function is a system call only when it requests a kernel service through the system-call interface.",
    objectives: [
      "Describe the user-to-kernel transition and return path.",
      "Explain argument validation, permissions, errors, and syscall results.",
      "Distinguish a library function from a system call and identify process/file examples.",
    ],
    terms: ["user mode", "kernel mode", "system-call interface", "trap", "argument validation", "return value"],
    rules: ["Request → controlled kernel entry → validation/authorization → service or error → return to caller.", "The kernel must validate caller-controlled identifiers, arguments, memory, and permissions.", "A library function may run entirely in user space; it is not automatically a system call.", "ExecOS's teaching calls modify only the simulated Engine, not the host operating system."],
    example: "A program calls a read wrapper with a file descriptor and buffer length. The kernel checks that the descriptor is valid and the buffer is accessible, performs the read if permitted, then returns a byte count or an error.",
    steps: ["A user program invokes a library wrapper with an operation and arguments.", "The syscall mechanism transfers control to a kernel entry point.", "The kernel validates identifiers, memory, permissions, and resource limits.", "The service returns data or an error and may record a trace event."],
    pitfalls: ["Not every library function enters the kernel; some are computed entirely in user space.", "Kernel entry does not grant the caller permanent privilege. ExecOS's teaching calls affect only its simulated Engine, not the host OS."],
    connections: ["fork/exec/wait/exit illustrate process-related interfaces.", "File and device syscalls connect names, permissions, I/O queues, and process blocking."],
  },
};

export const visualizationGuide = {
  "System Calls": {
    summary: "Follow a supported request across validation into the simulated Engine and back with a result or error.",
    focus: ["The user-supplied operation and arguments", "Validation and the controlled user/kernel service boundary", "The Engine result and trace event, without a host OS action"],
    scope: "Only listed calls affect the authenticated ExecOS software Engine; the host operating system is untouched.",
  },
};

export const glossary = {
  "System Calls": [
    ["user mode", "A restricted CPU privilege level in which applications normally execute."],
    ["kernel mode", "A privileged CPU level in which the operating-system kernel can perform protected operations."],
    ["system-call interface", "The defined entry point through which a program requests a kernel service."],
    ["trap", "A controlled synchronous transfer of execution to a kernel handler."],
    ["argument validation", "Kernel checks of caller-provided values, memory references, and permissions before service."],
    ["return value", "The result or error indicator returned to the calling program after a service completes."],
  ],
};
