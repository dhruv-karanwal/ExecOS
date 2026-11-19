// ExecOS · OS Concepts · 20-question quiz
// Copied verbatim from (the app still runs from these originals):
//   frontend/src/quizQuestions.js lines 254-275
// Format: [question, options, correctIndex, explanation]

export const questionData = {
  "OS Concepts": [
    ["What does a process control block primarily hold?", ["Execution and resource state for a process", "Only source code", "Only directory entries"], 0, "A PCB records process identity, state, scheduling, and resource context."],
    ["What is a context switch?", ["Saving one execution context and restoring another", "Replacing a file allocation method", "A page fault with no frame"], 0, "The CPU switches from one process or thread context to another."],
    ["What does a page table map?", ["Virtual pages to physical frames", "Processes to disk policies", "Interrupts to file names"], 0, "Page tables translate virtual addresses to physical memory."],
    ["What does an OS scheduler choose?", ["Which ready process runs next", "How every file is named", "Application source code"], 0, "The scheduler selects runnable work for CPU time."],
    ["What does an interrupt signal?", ["An event needs processor attention", "A file was deleted", "A process has no address space"], 0, "Interrupts notify the processor about events such as timer or device activity."],
    ["What does virtual memory provide?", ["A protected address-space view for each process", "All RAM to every process", "A dedicated disk head"], 0, "Virtual memory provides process isolation and address translation."],
    ["What is an execution trace for?", ["Recording operations and state changes", "Allocating every file contiguously", "Choosing a burst time"], 0, "Traces make system activity observable."],
    ["What does a device driver do?", ["Mediates communication with a device", "Chooses segment limits", "Calculates quiz scores"], 0, "Drivers provide a device-specific interface to the OS."],
    ["What is a process?", ["A program in execution with state and resources", "A directory entry", "A disk cylinder"], 0, "A process includes executing code, state, and allocated resources."],
    ["How do threads in one process commonly relate?", ["They share the process address space", "They always have separate filesystems", "They cannot run concurrently"], 0, "Threads share process resources while retaining execution contexts."],
    ["What does an operating system manage?", ["Processes, memory, files, and devices", "Only application source code", "Only one CPU register"], 0, "The OS coordinates system resources and provides services."],
    ["What is an operating-system kernel?", ["The privileged core that manages system resources", "A user document", "A disk request"], 0, "The kernel implements core privileged OS functionality."],
    ["What does an I/O device completion interrupt often cause?", ["The OS to handle completion and possibly wake a process", "A page table to disappear", "Every process to terminate"], 0, "Completion handling updates I/O state and may unblock waiting work."],
    ["What does IPC stand for?", ["Inter-process communication", "Internal page counter", "Indexed process context"], 0, "IPC mechanisms let processes exchange data or signals."],
    ["What does a filesystem organize?", ["Named files and directories", "CPU quanta", "Page faults only"], 0, "Filesystems provide a named organization for stored data."],
    ["What is the purpose of memory protection?", ["Prevent unauthorized access between address spaces", "Increase disk seek distance", "Change process arrival time"], 0, "Protection isolates processes and guards memory access."],
    ["What does an OS timer interrupt support?", ["Periodic scheduling and timekeeping", "Directory naming only", "File indexing"], 0, "Timer events allow the OS to regain control and manage execution time."],
    ["What is a ready process?", ["Runnable and waiting for CPU allocation", "Blocked for an event", "Already terminated"], 0, "READY means the process can run when scheduled."],
    ["What does a WAITING process usually need?", ["An event or I/O completion before it can continue", "A second process ID", "A larger page number"], 0, "Waiting processes are blocked until the event they need occurs."],
    ["Why study OS simulations?", ["To observe algorithms and state changes interactively", "To modify the host kernel", "To avoid understanding system behavior"], 0, "Simulation makes abstract OS decisions visible and repeatable."],
  ],
};
