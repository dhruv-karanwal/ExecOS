// ExecOS · OS Concepts · concept lesson, guide and glossary
// Copied verbatim from (the app still runs from these originals):
//   frontend/src/theoryContent.js lines 222-241
//   frontend/src/theoryContent.js lines 302-306
//   frontend/src/theoryContent.js lines 398-405
//   frontend/src/theoryContent.js lines 408-411
//   frontend/src/theoryContent.js lines 413-430
//   frontend/src/theoryContent.js lines 432-475

export const theory = {
  "OS Concepts": {
    overview: "An operating system is a resource manager and a service layer between applications and hardware. Its kernel coordinates CPU execution, memory, devices, files, and communication while enforcing isolation. Processes and threads represent execution; interrupts and system calls provide controlled ways to respond to events and request privileged work.",
    simple: "An operating system coordinates the computer's shared resources and gives programs safe, consistent ways to use the processor, memory, storage, and devices.",
    analogy: "An OS resembles a traffic controller coordinating vehicles through shared roads: it schedules turns, handles events, and prevents conflicts. The analogy is limited—real operating systems use kernel code, hardware protection, device drivers, and many interacting policies.",
    realWorld: "When an application reads a file, the OS validates the request, accesses storage through drivers, and may block the requesting thread while other work runs. A completion event can wake that thread so it can continue.",
    recap: ["The kernel manages resources and enforces isolation; applications request services through defined interfaces.", "Processes, memory, files, devices, and communication interact rather than operating as isolated features.", "ExecOS is an educational simulation; its Engine state is not live state from the host computer."],
    selfCheck: "A process is waiting for disk input. Why can another process still make progress?",
    selfCheckAnswer: "The waiting process is blocked and is not eligible for CPU scheduling. The OS can schedule another READY process while the I/O operation proceeds.",
    objectives: [
      "Explain the roles of the kernel, process, thread, scheduler, and device driver.",
      "Connect virtual memory, filesystems, I/O, interrupts, and IPC as cooperating subsystems.",
      "Distinguish an isolated OS simulation from changes to the host computer.",
    ],
    terms: ["kernel", "process", "thread", "interrupt", "system call", "device driver"],
    rules: ["Applications request privileged services through system-call interfaces.", "The kernel arbitrates shared CPU, memory, storage, and device resources.", "Interrupts notify the CPU about asynchronous events; handlers update state and schedule follow-up work.", "A process blocked on I/O is waiting, not ready; completion can make it runnable again."],
    example: "When a process requests disk data, it uses a system-call interface. The kernel validates the request, queues device I/O, marks the process WAITING, and schedules other READY work. A device interrupt reports completion, allowing the kernel to wake the process and return it to READY.",
    steps: ["Applications request services through defined interfaces.", "The kernel validates and coordinates access to shared CPU, memory, and devices.", "Interrupts notify the kernel about asynchronous events.", "The OS updates process and resource state and records or returns results."],
    pitfalls: ["An operating system is more than its user interface: protection, scheduling, memory, files, and device coordination are core responsibilities.", "ExecOS demonstrates these ideas in an isolated software Engine; its visualized state is not the host machine's live kernel state."],
    connections: ["The module catalog explores scheduling, memory, synchronization, deadlocks, filesystems, and system calls individually.", "Execution traces connect an operation to the state changes it caused."],
  },
};

export const visualizationGuide = {
  "OS Concepts": {
    summary: "Choose a concept model and advance through its states to connect the diagram to a plain-language explanation.",
    focus: ["What each component or state represents", "How the highlighted step changes the system", "Which related ExecOS module can demonstrate the idea in the isolated Engine"],
    scope: "Concept diagrams teach OS behavior; they do not claim that simulated Engine state is the host kernel's state.",
  },
};

export const glossary = {
  "OS Concepts": [
    ["kernel", "The privileged core that manages resources and enforces the operating system's protection rules."],
    ["process", "A running program together with its execution state, address space, and managed resources."],
    ["thread", "A schedulable execution stream that shares its process's address space and resources."],
    ["interrupt", "An event signal that makes the CPU pause its current flow and run an appropriate handler."],
    ["system call", "A controlled request by an application for an operating-system service."],
    ["device driver", "Kernel or system software that translates general I/O requests into device-specific operations."],
  ],
};

export const osFurtherReading = {
  label: "GeeksforGeeks · Operating System Tutorial",
  url: "https://www.geeksforgeeks.org/operating-systems/operating-systems/",
};

export const osStudyRoadmap = [
  ["OS purpose and architecture", "An operating system provides abstractions and manages shared hardware resources. Learn the difference between user programs, the kernel, system libraries, privileged execution, and system-call boundaries.", ["OS Concepts", "System Calls"]],
  ["Boot and startup", "Firmware initializes hardware and selects a boot target; a bootloader loads a kernel, which initializes memory, devices, and early services before starting user-space processes. Exact steps vary by platform and OS.", ["OS Concepts"]],
  ["Processes and threads", "A process is an isolated execution environment with resources; its threads are execution paths that typically share process memory. Study process states, creation, termination, context, and lifecycle transitions.", ["OS Concepts", "CPU Scheduling"]],
  ["CPU scheduling", "The scheduler chooses among runnable work. Compare preemption, fairness, response time, throughput, starvation, and the behavior of FCFS, shortest-job, priority, and time-sliced policies.", ["CPU Scheduling"]],
  ["Concurrency, synchronization, and IPC", "Concurrent work can interleave and race on shared state. Locks and semaphores coordinate critical sections; message passing and shared memory let processes communicate with different tradeoffs.", ["Process Synchronization", "OS Concepts"]],
  ["Deadlocks and resource management", "Circular waiting can prevent progress. Learn the four necessary conditions, prevention, avoidance, detection, recovery, resource-allocation graphs, and safe-sequence reasoning.", ["Deadlock"]],
  ["Memory allocation and protection", "The OS allocates memory while isolating address spaces. Compare partitions and contiguous allocation, fragmentation, paging, segmentation, page tables, and access permissions.", ["Memory Management", "Memory Management Techniques", "Paging & Segmentation"]],
  ["Virtual memory and page replacement", "Virtual memory separates process addresses from physical RAM and can keep pages nonresident until needed. Study TLBs, page faults, locality, working sets, replacement, and swapping.", ["Memory Management Techniques", "Page Replacement", "Paging & Segmentation"]],
  ["File systems and directories", "A file system names data, stores metadata, maps logical file contents to storage, and enforces access rules. Learn path resolution, directories, file allocation, caching, and consistency.", ["File Management", "Hierarchical File Organization"]],
  ["I/O, interrupts, and device drivers", "Applications request I/O through OS interfaces; drivers translate generic requests into device-specific operations. Interrupts, polling, buffering, and DMA are common pieces of the I/O path.", ["OS Concepts", "System Calls"]],
  ["Storage and disk scheduling", "Storage systems combine queues, controllers, and devices. Mechanical-disk scheduling models seek movement, while SSDs and modern storage require different performance assumptions.", ["Disk Scheduling", "File Management"]],
  ["Protection and security", "Protection controls which subjects may access which objects; security also considers threats, authentication, isolation, least privilege, updates, and recovery. No single mechanism guarantees safety.", ["OS Concepts", "System Calls"]],
  ["Operating-system structures and types", "Monolithic, layered, microkernel, modular, and hybrid designs organize OS responsibilities differently. Batch, time-sharing, real-time, embedded, desktop, and server systems prioritize different constraints.", ["OS Concepts"]],
  ["Virtual machines and containers", "A hypervisor virtualizes hardware for guest operating systems; containers isolate processes while sharing a host kernel. Their boundaries, resource controls, and security properties are not interchangeable.", ["OS Concepts"]],
  ["Networked and distributed systems", "Network stacks move data across hosts, while distributed systems coordinate services and failures across machines. They extend OS ideas such as processes, I/O, protection, and resource management beyond one computer.", ["OS Concepts", "System Calls"]],
  ["Reliability, tracing, and performance", "Operating systems expose logs, counters, tracing, and resource metrics to help diagnose behavior. Performance depends on workload and bottlenecks, so measurements should be interpreted with their scope and overhead.", ["OS Concepts"]],
];

export const osReferenceSources = [
  {
    label: "Operating System Tutorial",
    organization: "GeeksforGeeks",
    url: "https://www.geeksforgeeks.org/operating-systems/operating-systems/",
    description: "A broad, approachable topic index for standard OS concepts and algorithms.",
    topics: theoryTopics,
  },
  {
    label: "Operating Systems: Three Easy Pieces",
    organization: "University of Wisconsin–Madison authors",
    url: "https://pages.cs.wisc.edu/~remzi/OSTEP/",
    description: "A free online textbook organized around virtualization, concurrency, and persistence, with chapters on scheduling, memory, and storage.",
    topics: theoryTopics,
  },
  {
    label: "Operating System Engineering (6.1810)",
    organization: "MIT PDOS",
    url: "https://pdos.csail.mit.edu/6.1810/2023/",
    description: "Course materials and xv6-based exercises for learning how operating-system mechanisms are implemented.",
    topics: ["OS Concepts", "CPU Scheduling", "Memory Management Techniques", "System Calls", "Process Synchronization"],
  },
  {
    label: "Linux Kernel Documentation",
    organization: "Linux kernel project",
    url: "https://docs.kernel.org/",
    description: "Primary technical documentation for Linux kernel subsystems, architecture, development, and user-facing interfaces.",
    topics: theoryTopics,
  },
  {
    label: "Linux man-pages",
    organization: "Linux man-pages project",
    url: "https://man7.org/linux/man-pages/",
    description: "Reference documentation for Linux system calls, library interfaces, devices, file formats, and administration tools.",
    topics: ["System Calls", "Hierarchical File Organization", "File Management", "Process Synchronization", "OS Concepts"],
  },
  {
    label: "What is a Driver?",
    organization: "Microsoft Learn",
    url: "https://learn.microsoft.com/en-us/windows-hardware/drivers/gettingstarted/what-is-a-driver-",
    description: "An official explanation of how drivers let an operating system communicate with devices and how driver stacks can work.",
    topics: ["OS Concepts", "System Calls"],
  },
];
