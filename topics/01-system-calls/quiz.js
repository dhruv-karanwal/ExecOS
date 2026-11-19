// ExecOS · System Calls · 20-question quiz
// Copied verbatim from (the app still runs from these originals):
//   frontend/src/quizQuestions.js lines 232-253
// Format: [question, options, correctIndex, explanation]

export const questionData = {
  "System Calls": [
    ["Why does a program use a system call?", ["To request a protected OS service", "To bypass validation", "To directly change hardware"], 0, "System calls are the controlled interface to OS services."],
    ["What typically happens after a syscall enters the kernel?", ["Arguments are validated and a result is returned", "The program gains permanent privilege", "The OS ignores it"], 0, "The kernel validates and performs an allowed operation, then returns status."],
    ["Does every library function require a syscall?", ["No, some work entirely in user space", "Yes, always", "Only numeric functions"], 0, "Library routines may operate locally without entering the kernel."],
    ["What privilege transition does a system call request?", ["User mode to a controlled kernel service", "Kernel mode to permanent user control", "One cylinder to another"], 0, "A controlled transition lets the kernel service a request."],
    ["Why validate syscall arguments?", ["Caller input cannot be assumed safe or valid", "Arguments are always hardware-generated", "Validation replaces permissions"], 0, "Validation protects kernel state and enforces allowed operations."],
    ["What can a system call return?", ["A result or an error status", "Only a process ID", "Permanent kernel access"], 0, "The caller receives result data or an error."],
    ["Which action commonly requires a system call?", ["Reading a file", "Adding two local integers", "Changing a local variable"], 0, "File access requests a protected OS service."],
    ["What is the user/kernel boundary for?", ["Controlling access to privileged OS operations", "Running every app as kernel code", "Disabling checks"], 0, "The boundary protects privileged state from arbitrary user code."],
    ["What does fork commonly do in Unix-like systems?", ["Create a child process", "Replace a disk block", "Translate an address"], 0, "fork creates a new process based on the caller."],
    ["What does exec commonly do?", ["Replace a process image with a program", "Create a disk directory", "Return a memory frame"], 0, "exec loads and begins another program in the process."],
    ["What does wait commonly allow a parent to do?", ["Wait for a child process to finish", "Allocate a disk cylinder", "Release every page"], 0, "wait synchronizes with a child process's completion."],
    ["What does exit indicate?", ["A process is finishing", "A page is resident", "A lock is acquired"], 0, "exit ends the calling process."],
    ["Why is a syscall result checked by the caller?", ["The operation may fail and return an error", "Every syscall always succeeds", "It changes the CPU policy"], 0, "OS requests can fail due to invalid input, permissions, or resources."],
    ["Can a user program directly perform every privileged operation?", ["No, the OS mediates protected operations", "Yes, without checks", "Only after a page hit"], 0, "Privilege separation restricts direct access to sensitive kernel operations."],
    ["What is a syscall wrapper?", ["A library interface that prepares a kernel request", "A disk scheduling queue", "A memory partition"], 0, "Wrappers arrange arguments and invoke the system-call mechanism."],
    ["Why are permissions checked?", ["To verify the caller may perform the operation", "To calculate turnaround time", "To choose a page victim"], 0, "Access controls ensure the caller is authorized."],
    ["What does a syscall trace help inspect?", ["The requested operation and its outcome", "Only the CPU's temperature", "Only quiz answers"], 0, "Trace events expose supported calls and their results."],
    ["Does an ExecOS simulated syscall invoke the host OS?", ["No, it updates the isolated Engine", "Yes, it runs arbitrary kernel code", "Only for file reads"], 0, "The learning workbench operates on its simulated Engine state."],
    ["What is a system-call number used for?", ["Identifying the requested kernel service", "Naming a directory", "Choosing a process arrival time"], 0, "The service identifier directs the kernel to the requested operation."],
    ["Why should a kernel avoid trusting raw user pointers?", ["They may be invalid or inaccessible", "They always point to a file", "They indicate the CPU burst"], 0, "Kernel code must safely validate caller-provided memory references."],
  ],
};
