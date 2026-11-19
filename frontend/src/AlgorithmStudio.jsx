import { Fragment, useEffect, useMemo, useState } from "react";
import {
  parseBankerInput,
  parseDeadlockDetectionInput,
  parseDiskInput,
  parseIntegerList,
  parseMemoryInput,
  parsePageReferences,
  parseProcesses,
  simulateBanker,
  simulateDeadlockDetection,
  simulateCpu,
  simulateDisk,
  simulateFileAllocation,
  simulateMemory,
  simulatePages,
  simulateTlb,
  translatePagedAddress,
  translateSegmentedAddress,
} from "./algorithms.js";
import { quizzes as quizBank } from "./quizQuestions.js";
import {
  osFurtherReading,
  osReferenceSources,
  osStudyRoadmap,
  topicGlossary,
  topicTheory,
  visualizationGuides,
} from "./theoryContent.js";

const categories = [
  "CPU Scheduling",
  "Process Synchronization",
  "Disk Scheduling",
  "Memory Management",
  "Memory Management Techniques",
  "Page Replacement",
  "Paging & Segmentation",
  "Deadlock",
  "File Management",
  "Hierarchical File Organization",
  "System Calls",
  "OS Concepts",
];

const algorithmOptions = {
  "CPU Scheduling": [
    ["fcfs", "First Come, First Served (FCFS)"],
    ["sjf", "Shortest Job First (SJF)"],
    ["srtf", "Shortest Remaining Time First (SRTF)"],
    ["priority", "Priority (preemptive)"],
    ["priority_np", "Priority (non-preemptive)"],
    ["round_robin", "Round Robin"],
  ],
  "Disk Scheduling": [
    ["fcfs", "First Come, First Served (FCFS)"],
    ["sstf", "Shortest Seek Time First (SSTF)"],
    ["scan", "SCAN"],
    ["cscan", "C-SCAN"],
    ["look", "LOOK"],
    ["clook", "C-LOOK"],
  ],
  "Memory Management": [["first_fit", "First Fit"], ["best_fit", "Best Fit"], ["worst_fit", "Worst Fit"], ["next_fit", "Next Fit"]],
  "Page Replacement": [["fifo", "FIFO"], ["lru", "LRU"], ["optimal", "Optimal"], ["lfu", "LFU"], ["second_chance", "Second Chance (Clock)"]],
  Deadlock: [["banker", "Banker's safety algorithm"], ["detection", "Deadlock detection algorithm"]],
  "File Management": [["sequential", "Sequential allocation"], ["linked", "Linked allocation"], ["indexed", "Indexed allocation"]],
  "System Calls": [],
  "OS Concepts": [],
};

const cpuPolicyGuide = {
  fcfs: {
    description: "The ready process that arrived first runs until it finishes. Processes arriving during that run wait in arrival order.",
    how: ["Processes are admitted in arrival order.", "The queue head runs until its burst completes.", "New arrivals wait at the tail of the ready queue."],
    formula: "next = ready process with the earliest arrival time\nrun until completion",
    advantages: "Simple, predictable FIFO ordering; no preemption overhead.",
    disadvantages: "A long process can hold up short jobs behind it (the convoy effect).",
  },
  sjf: {
    description: "Whenever the CPU becomes free, choose the arrived ready process with the smallest total CPU burst. The selected process runs to completion.",
    how: ["Wait for the CPU to become free.", "Compare the burst lengths of arrived READY processes.", "Run the shortest available process to completion."],
    formula: "next = arg min(burst time)\n         among arrived READY processes",
    advantages: "Can minimize average waiting time when burst lengths are known.",
    disadvantages: "Long jobs may wait a long time; future burst lengths are not generally known in advance.",
  },
  srtf: {
    description: "At each scheduling decision, choose the ready process with the least remaining CPU time. A newly arrived shorter job can preempt the current process.",
    how: ["Check remaining time at each tick.", "Select the READY process with the least remaining burst.", "Preempt the current process when a shorter job is ready."],
    formula: "next = arg min(remaining time)\n         among arrived READY processes",
    advantages: "Short jobs can finish quickly; adapts to newly arriving work.",
    disadvantages: "Long jobs can starve, and frequent preemption adds overhead in real systems.",
  },
  priority: {
    description: "Choose the highest-priority ready process. In this lab, a lower numeric priority value means higher priority, and a newly arrived higher-priority job can preempt.",
    how: ["Compare priority among READY processes.", "A lower number represents a higher priority.", "Preempt when a higher-priority process arrives."],
    formula: "next = arg min(priority number)\n         among arrived READY processes",
    advantages: "Useful when some work must receive preferential service.",
    disadvantages: "Low-priority processes can starve without an aging policy.",
  },
  priority_np: {
    description: "Choose the highest-priority ready process, with lower numeric values representing higher priority. Once selected, it runs to completion.",
    how: ["Compare priority among READY processes.", "A lower number represents a higher priority.", "The selected process runs to completion."],
    formula: "next = arg min(priority number)\n         among arrived READY processes\nrun until completion",
    advantages: "Priority is respected without mid-run preemption.",
    disadvantages: "Low-priority processes can starve; a long job blocks later high-priority work.",
  },
  round_robin: {
    description: "Visit ready processes in queue order and give each up to the configured time quantum. An unfinished process returns to the end of the queue.",
    how: ["Dispatch the next process in the READY queue.", "Run for at most the configured time quantum.", "Return unfinished work to the queue tail."],
    formula: "run duration = min(quantum, remaining time)\nif work remains: enqueue process at tail",
    advantages: "Shares CPU time fairly and gives interactive workloads regular response opportunities.",
    disadvantages: "A very small quantum causes excess context switches; a very large quantum behaves more like FCFS.",
  },
};

const initialInputs = {
  processes: "P1,0,5,2\nP2,1,3,1\nP3,2,1,3\nP4,4,2,2",
  quantum: "2",
  diskQueue: "10, 20, 35, 70, 82",
  diskHead: "50",
  diskSize: "100",
  direction: "up",
  pages: "7, 0, 1, 2, 0, 3, 0, 4, 2, 3, 0, 3, 2",
  frames: "3",
  blocks: "100, 500, 200, 300, 600",
  processSizes: "212, 417, 112, 426",
  allocation: "0 1 0\n2 0 0\n3 0 2\n2 1 1\n0 0 2",
  maximum: "7 5 3\n3 2 2\n9 0 2\n2 2 2\n4 3 3",
  available: "3 3 2",
  currentRequest: "0 0 0\n2 0 0\n0 0 0\n0 1 0\n0 0 2",
  diskBlocks: "24",
  fileSizes: "4, 6, 3, 5",
};

const descriptions = {
  "CPU Scheduling": {
    purpose: "A CPU scheduler chooses which ready process receives the processor. Compare how each policy trades response time, fairness, and waiting.",
    example: "For P1(0,5), P2(1,3), FCFS completes P1 before P2; SRTF can preempt P1 when the shorter P2 arrives.",
    pseudocode: "while work remains:\n  admit arrived processes\n  choose the next process by policy\n  run one tick (or until completion)\n  update remaining time and metrics",
    advantages: "Makes scheduling tradeoffs measurable; supports preemptive and non-preemptive policies.",
    disadvantages: "Real kernels add priorities, I/O, multiple cores, and overhead beyond this deterministic teaching model.",
    complexity: "O(T × P log P)", space: "O(P + T)",
  },
  "Disk Scheduling": {
    purpose: "Disk scheduling orders pending cylinder requests to reduce head movement while balancing request order and fairness.",
    example: "From head 50, an upward SCAN services higher cylinders, reaches the upper disk boundary, then reverses for lower requests.",
    pseudocode: "partition requests around the head\norder each side by direction\nservice the selected side\napply the policy's reverse or wrap rule\nsum every head movement",
    advantages: "Makes seek costs and direction policies visible on the same request queue.",
    disadvantages: "Seek distance is a simplified cost model; modern SSDs do not have mechanical seek heads.",
    complexity: "Varies by policy", space: "O(R)",
  },
  "Memory Management": {
    purpose: "Contiguous allocation places each process into one free block. First, Best, Worst, and Next Fit differ in how they search for a suitable region.",
    example: "Next Fit resumes its search after the block used for the previous allocation, wrapping to the beginning only when needed.",
    pseudocode: "for each process:\n  search free blocks using the selected fit policy\n  allocate from the chosen block\n  for Next Fit, resume after that block next time\n  record failure when no block fits",
    advantages: "Simple to reason about and compare; shows how block choices affect the remaining space.",
    disadvantages: "This partition model does not represent paging, compaction, or real physical address translation.",
    complexity: "O(P × B)", space: "O(P × (B + P)) including trace snapshots",
  },
  "Memory Management Techniques": {
    purpose: "Memory management techniques organize address spaces, translate virtual addresses, allocate physical frames, and enforce process isolation.",
    example: "Paging divides virtual memory into pages and physical RAM into equal-sized frames; a page table connects the two.",
    pseudocode: "choose an address-space model\ntranslate virtual address\ncheck permissions and bounds\nresolve page fault if not resident",
    advantages: "Compare contiguous allocation, paging, segmentation, and virtual memory in one visual map.",
    disadvantages: "The overview is conceptual; detailed allocations and page replacement are available in their dedicated interactive labs.",
    complexity: "O(1) illustrative translation", space: "Model-dependent",
  },
  "Page Replacement": {
    purpose: "When every frame is occupied, the OS chooses a resident page to evict before loading the requested page.",
    example: "FIFO evicts the oldest loaded page; LRU evicts the page whose last access is farthest in the past.",
    pseudocode: "for each page reference:\n  if resident: count a hit\n  else: count a fault\n    use an empty frame or choose a victim\n    load the page and update policy state",
    advantages: "Shows frame contents, hits, faults, and the precise victim decision for every reference.",
    disadvantages: "Optimal uses future references and is a benchmark, not an implementable online policy.",
    complexity: "O(N × F) in this teaching implementation", space: "O(N × F) including frame snapshots",
  },
  Deadlock: {
    purpose: "Banker's safety test checks maximum claims before granting resources; deadlock detection checks current outstanding requests to identify processes that cannot finish now.",
    example: "A process can finish when its remaining Need is component-wise no greater than the current Work vector.",
    pseudocode: "Work = Available\nrepeat:\n  find unfinished process with Need <= Work\n  Work += its Allocation\n  mark it finished\nsafe iff all processes finish",
    advantages: "Returns a concrete safe sequence or the blocked processes that prevent one.",
    disadvantages: "Requires known maximum claims in advance and is a safety test, not a full production deadlock detector.",
    complexity: "O(P² × R)", space: "O(P × R)",
  },
  "File Management": {
    purpose: "File allocation maps logical file contents to disk blocks using sequential, linked, or indexed organization.",
    example: "Sequential allocation needs a contiguous run; linked allocation can chain free blocks; indexed allocation reserves an index block.",
    pseudocode: "for each file:\n  choose free block(s) using the selected method\n  reserve data blocks (and index block if required)\n  record the resulting address structure",
    advantages: "Compares contiguity, pointer overhead, and direct block lookup using one disk layout.",
    disadvantages: "This simulator uses a bounded block map and does not model permissions or persistent storage.",
    complexity: "O(F × D) in this teaching implementation", space: "O(D)",
  },
  "Process Synchronization": {
    purpose: "Synchronization coordinates concurrent processes that share data or resources, preventing race conditions while avoiding deadlock and starvation.",
    example: "A mutex lets one process enter a critical section while another waits until the lock is released.",
    pseudocode: "wait(mutex)\n  critical section\nsignal(mutex)",
    advantages: "Makes mutual exclusion, blocking, and lock ownership visible one event at a time.",
    disadvantages: "A single mutex demo does not model every memory-ordering or scheduling behavior of a real multicore system.",
    complexity: "O(1) per lock operation", space: "O(P) waiters",
  },
  "Paging & Segmentation": {
    purpose: "Paging translates fixed-size virtual pages through a page table; segmentation translates logical segment offsets against a base and bounds.",
    example: "For page size 1024, address 3456 is page 3 plus offset 384; the page table supplies its physical frame.",
    pseudocode: "Paging:\n  page = address / page_size\n  offset = address % page_size\n  physical = frame[page] * page_size + offset\n\nSegmentation:\n  require offset < segment.limit\n  physical = segment.base + offset",
    advantages: "Interactive address translation shows page/frame mapping and segment bounds checking.",
    disadvantages: "This small address-space model does not emulate hardware TLBs, multi-level page tables, or full protection bits.",
    complexity: "O(1) lookup in the shown tables", space: "O(P + S)",
  },
  "Hierarchical File Organization": {
    purpose: "A hierarchical directory tree organizes names into directories and files, allowing paths to be resolved one component at a time.",
    example: "The path /home/student/notes.txt is found by looking up home at root, student inside home, then notes.txt inside student.",
    pseudocode: "node = root\nfor component in path:\n  require component in node.children\n  node = node.children[component]\nreturn node",
    advantages: "Separates namespaces, groups related files, and gives users a navigable path structure.",
    disadvantages: "Path permissions, links, mounts, and concurrent updates are not modeled by this teaching tree.",
    complexity: "O(D) path component lookups", space: "O(N) directory entries",
  },
};

const conceptCards = [
  ["Process lifecycle", "NEW → READY → RUNNING → WAITING → TERMINATED", "Processes, dispatch, pause/resume, and PCB tracing", "Processes"],
  ["Virtual memory", "Virtual pages map onto physical frames", "Page tables, FIFO/LRU replacement, and page faults", "Storage"],
  ["Synchronization & IPC", "Processes coordinate through shared resources and messages", "Engine message queues, resource requests, and interrupt-driven I/O", "IPC"],
  ["System calls", "A controlled interface between a program and OS services", "Invoke supported process, memory, and filesystem calls", "System Calls"],
  ["Files & devices", "The OS manages named data and shared hardware resources", "Virtual filesystem actions and device request queues", "File System"],
  ["Directory structures", "Directories map names to files and subdirectories", "Follow a path through a hierarchical directory tree", "File System"],
  ["Execution trace", "An event history makes state transitions observable", "Filter events by process and Engine module", "Execution Trace"],
];

const deepTheory = {
  "CPU Scheduling": [
    ["The scheduling problem", "A multiprogramming OS keeps runnable processes in a ready queue and chooses one to own the CPU. A scheduler's decision affects response time (first service), waiting time (time in the ready queue), turnaround time (arrival to completion), throughput, and fairness. These goals can conflict: a policy that improves average waiting can still make a long job wait disproportionately."],
    ["Preemption and policy behavior", "FCFS is non-preemptive and follows arrival order. SJF is non-preemptive and chooses the shortest available burst. SRTF is the preemptive version of shortest-job scheduling: a newly ready process can replace the current one if it has less remaining work. Priority scheduling is available in preemptive and non-preemptive variants; both treat a lower numeric value as higher priority. Round Robin gives each ready process up to a fixed quantum, then returns unfinished work to the queue."],
    ["Reading the results", "The Gantt chart is the execution timeline, not just the final order. Idle intervals appear when no process has arrived. Waiting is turnaround minus CPU burst in this model; response is first start minus arrival. A shorter Round Robin quantum can improve interactive response while increasing scheduling overhead in a real kernel. SJF/SRTF can starve long jobs, and priority scheduling can starve low-priority jobs without aging."],
  ],
  "Disk Scheduling": [
    ["Why order requests?", "A mechanical disk has a moving head; seek distance approximates the work of moving between cylinders. The scheduler chooses the order of pending requests to balance total movement, latency, and fairness. This is a teaching cost model: SSDs have no moving head and use different internal scheduling and flash-management behavior."],
    ["Direction and sweep policies", "FCFS preserves request arrival order. SSTF repeatedly selects the nearest pending request, which can favor nearby requests. SCAN sweeps in one direction to the physical end, then reverses; C-SCAN services in one direction and wraps to the opposite end. LOOK and C-LOOK avoid traveling to an unused physical boundary: they turn or wrap at the last request in that direction. The visualized sequence is the source of truth for movement and total seek calculations."],
    ["Interpreting movement", "A request service is different from a boundary trip or circular wrap. SCAN/C-SCAN count the distance traveled to the edge, and C-SCAN counts the wrap distance in this simulator's total head movement. LOOK/C-LOOK avoid unused edge travel. Real schedulers may also consider request age, deadlines, workload shape, and device firmware."],
  ],
  "Memory Management": [
    ["Contiguous allocation", "A process receives a region of contiguous address space from a free block. This model splits blocks as allocations consume space; each process is assigned to at most one block. Internal fragmentation is unused space inside an allocated region, while external fragmentation is free space divided among regions too small for a request. This lab models remaining space within each original block, rather than a full address map."],
    ["Fit policies", "First Fit scans from the beginning and takes the first block with enough free space. Best Fit chooses the smallest block that can satisfy the request, aiming to leave a small remainder. Worst Fit chooses the largest fitting block, leaving a larger remainder. The policy changes placement and future fit options; no policy is universally best because results depend on request order and workload distribution."],
    ["Limits and real systems", "Modern general-purpose systems predominantly combine paging, virtual address spaces, physical frames, and kernel allocators rather than choosing one large contiguous partition per process. Compare the block visualization and allocation table to see whether later requests fail even when total free memory remains: free capacity alone does not guarantee a suitable region."],
  ],
  "Memory Management Techniques": [
    ["Fixed and variable partitions", "MFT divides memory into a fixed set of partitions; each allocated process occupies a whole partition, so unused space inside it is internal fragmentation. MVT creates variable-sized regions as processes arrive, improving fit but leaving external holes when processes exit. The labs show both layouts, releases, and compaction."],
    ["Contiguous allocation", "A process receives one continuous physical region. It is simple and makes address translation easy, but free space can become externally fragmented and a process may require compaction or a larger contiguous region."],
    ["Paging", "Paging splits virtual address spaces into fixed-size pages and physical memory into same-size frames. A page table maps pages to frames, allowing a process's pages to be physically non-contiguous. It avoids external fragmentation at the cost of page tables and possible internal waste in the last page."],
    ["Segmentation and virtual memory", "Segmentation divides an address space into variable-sized logical regions with independent base and limit values. Virtual memory lets processes use protected address spaces larger than available physical RAM by keeping some pages nonresident and loading them on demand. Systems can combine segmentation concepts with paging."],
  ],
  "Page Replacement": [
    ["Pages and faults", "Virtual memory divides address spaces into pages and physical memory into frames. A page-table mapping tells the CPU where a resident page lives. If a referenced page is absent, a page fault transfers or creates it; when no frame is free, the OS chooses a resident page to evict. A hit ratio measures references served without a fault, while fault count is directly visible in the reference-by-reference trace."],
    ["Replacement choices", "FIFO removes the page loaded earliest. LRU removes the least recently used page and relies on past locality to predict future use. LFU removes the page with the smallest observed reference count; this implementation breaks ties by frame order and does not age old counts. Second Chance (Clock) scans a circular frame queue: a set reference bit is cleared and spared once, while the first clear bit is replaced. Optimal removes the page whose next use is farthest in the future, so it is an offline lower-bound benchmark, not a deployable online policy."],
    ["Tradeoffs", "Replacement decisions influence disk I/O and performance, but a page fault's real cost also depends on storage, dirty-page writeback, and working-set behavior. The same reference string and frame count are used for every policy comparison. More frames do not always reduce faults for every policy: FIFO can exhibit Belady's anomaly."],
  ],
  Deadlock: [
    ["Deadlock avoidance and detection", "Banker's safety testing is an avoidance technique: it uses declared maximum claims to check whether a proposed allocation preserves a safe completion order. Detection instead examines current outstanding requests and allocations; if no unfinished process can proceed and release its resources, the remaining processes are reported as deadlocked in this snapshot."],
    ["Safety test mechanics", "For each process, Need = Maximum − Allocation. The checker starts with Work = Available, finds an unfinished process whose Need is no greater than Work for every resource type, then simulates that process finishing and returning its Allocation to Work. It repeats until all processes finish or no eligible process remains. If all finish, the order is a safe sequence; otherwise the remainder is the blocked set."],
    ["Assumptions and limits", "The model assumes known maximum resource claims, a fixed set of resource types, and that completed processes release their allocated resources. It is a safety test, not a complete detector for arbitrary resource graphs and not a real Engine resource grant. A currently unsafe state may still run for a while, but it has no guaranteed completion sequence under the assumptions."],
  ],
  "File Management": [
    ["Allocation and access", "A filesystem maps a file's logical byte range to physical storage blocks and maintains names and metadata in directories. Allocation strategy changes how block addresses are organized. Sequential/contiguous allocation stores neighboring file blocks together; linked allocation chains blocks; indexed allocation stores data-block addresses in an index block."],
    ["Compare the layouts", "Contiguous placement supports efficient sequential and direct access but needs a sufficiently large run and can fragment free space. Linked allocation can use scattered blocks and grows easily, but following pointers is required for random access and pointer damage is costly. Indexed allocation supports direct lookup through an index, at the cost of metadata space and index capacity. This lab visualizes bounded block allocation; it does not persist files."],
    ["OS filesystem responsibilities", "A real filesystem must also handle naming, permissions, metadata consistency, caching, concurrent access, crash recovery, and storage-device errors. The simulated block map is deliberately isolated from the user's host files. Compare method outcomes using the same file sizes to see both the allocation layout and whether all requested blocks fit."],
  ],
  "Process Synchronization": [
    ["The critical-section problem", "Concurrent execution can interleave instructions in surprising orders. A critical section is the part of a program that accesses shared state. Mutual exclusion requires at most one participant in that section at once; progress requires eligible contenders eventually get a chance; bounded waiting prevents indefinite postponement."],
    ["Locks and semaphores", "A mutex has ownership: one participant acquires it and later releases it. A semaphore is a counter controlled by atomic wait/signal operations; it can protect a resource count or coordinate event ordering. The interactive labs demonstrate mutex exclusion, bounded-buffer empty/full counts, shared readers versus exclusive writers, and the Dining Philosophers circular-wait problem. Real implementations must make synchronization operations atomic and handle cancellation and fairness."],
    ["Deadlock and safety", "Locking can itself create deadlock. The classic conditions are mutual exclusion, hold-and-wait, no preemption, and circular wait. Consistent lock ordering can prevent cycles; timeouts or detection can help recovery. This demo illustrates one lock, not a complete proof of a concurrent program."],
  ],
  "Paging & Segmentation": [
    ["Paging translation", "A virtual address splits into a page number and an offset. The page number indexes a process page table, which supplies a physical frame number; the offset is unchanged. For page size S, page = floor(address / S), offset = address mod S, and physical address = frame × S + offset. A missing page-table entry triggers a page fault rather than a valid physical translation."],
    ["TLB lookup and page faults", "A translation lookaside buffer caches recent page-to-frame translations. A TLB hit avoids the page-table memory access; a miss checks the page table. If the page is not resident, a page fault lets the OS load it into a frame, possibly evicting another page and invalidating its old TLB entry. The interactive lab steps through this lookup path with a bounded TLB and FIFO demand paging."],
    ["Segmentation translation", "A segmented logical address identifies a segment and an offset. Each segment descriptor supplies a base and limit. The offset must be less than the segment limit; otherwise the access is invalid. A valid physical address is base + offset. Segments correspond to logical units such as code, stack, or data and can have distinct permissions."],
    ["Compare the schemes", "Paging avoids external fragmentation by allocating fixed-size frames but can waste space in a final partially filled page. Segmentation matches variable-sized logical regions but can leave external holes. Systems can combine the two: segments provide a logical view while each segment is paged into frames."],
  ],
  "Hierarchical File Organization": [
    ["Directories and paths", "A directory maps names to entries representing files or child directories. A path is a sequence of names; an absolute path starts at the root, while a relative path starts at the process's current directory. Resolving a path means searching each component in its parent directory until reaching the target entry."],
    ["Namespace benefits", "Hierarchical directories let separate users and applications reuse simple names without collisions, group related content, and apply permissions at different levels. File metadata identifies ownership and type, while the file's storage mapping is handled separately by allocation and filesystem layers."],
    ["Path traversal and errors", "A path can fail because a component is missing, is not a directory, or is not accessible. Real filesystems also handle symbolic links, mount points, case rules, and concurrent rename operations. This interactive tree demonstrates name resolution only and never reads or writes the host filesystem."],
  ],
  "System Calls": [
    ["The user/kernel boundary", "Applications normally cannot execute privileged operations directly. A system-call interface lets a program request a service such as creating a process, reading a file, or allocating memory. A library wrapper places the service number and arguments in the expected ABI format, then a controlled trap or syscall instruction transfers execution to kernel mode."],
    ["Validation and return", "The kernel checks the operation and its arguments, verifies permissions and resource constraints, performs the service, then returns a result or error code. The transition does not mean every API call enters the kernel: libraries can satisfy some requests in user space. In ExecOS, the workbench exposes a limited authenticated Engine API and records supported calls in its Engine trace; it does not invoke host system calls."],
    ["Why the boundary matters", "Privilege separation protects kernel-owned state from arbitrary application code. The interface must validate pointers, lengths, identifiers, and permissions because caller input is not inherently trustworthy. System-call results, errors, and trace events make the boundary observable without giving this teaching UI access to the host OS."],
  ],
  "OS Concepts": [
    ["Processes and concurrency", "A process is an executing program with its own address space and resources. The OS represents it with a process control block containing identifiers, state, scheduling data, and resource references. Threads share a process's address space while holding their own execution context. Context switching saves one execution context and restores another, allowing the CPU to interleave work."],
    ["Memory, storage, and protection", "Virtual memory gives each process a protected address space. Page tables map virtual pages to physical frames; caches and the translation lookaside buffer accelerate address translation. Filesystems present named persistent data while device drivers manage hardware-specific operations. These are connected layers, not a single interchangeable pool of memory."],
    ["Coordination and observability", "Processes communicate through mechanisms such as message queues and shared memory. Locks and semaphores coordinate access to shared state; incorrect acquisition order can create deadlock. Interrupts notify the CPU about asynchronous events, while execution traces record observable transitions. ExecOS visualizes these ideas in an isolated software Engine and does not imply that its simulated state is the host's live kernel state."],
  ],
};

const legacyQuizFallback = {
  "CPU Scheduling": [
    { question: "A process arrives while a shorter remaining job is running under SRTF. What can happen?", options: ["The new job can preempt it", "The current job always finishes", "The CPU becomes idle"], answer: 0, explanation: "SRTF is preemptive and reselects the ready job with the least remaining time." },
    { question: "How is turnaround time calculated in this lab?", options: ["Completion − arrival", "First start − arrival", "Burst − completion"], answer: 0, explanation: "Turnaround covers the full interval from process arrival through completion." },
    { question: "What is Round Robin's time quantum?", options: ["A maximum CPU turn before rotation", "The number of ready processes", "The total burst of all processes"], answer: 0, explanation: "An unfinished process returns to the ready queue after using its time slice." },
  ],
  "Disk Scheduling": [
    { question: "Which policy sweeps to the disk end before reversing?", options: ["LOOK", "SCAN", "SSTF"], answer: 1, explanation: "SCAN travels to the physical boundary; LOOK turns at the last request." },
    { question: "What does C-SCAN do after servicing in one direction?", options: ["Wraps to the opposite end", "Reverses at every request", "Stops servicing requests"], answer: 0, explanation: "C-SCAN provides a circular sweep by returning to the opposite boundary." },
    { question: "Why can SSTF be unfair?", options: ["Far requests may wait behind nearby requests", "It ignores head position", "It always travels to both disk edges"], answer: 0, explanation: "Repeatedly choosing the closest request can postpone far-away requests." },
  ],
  "Memory Management": [
    { question: "Which fit policy chooses the first adequate block in scan order?", options: ["First Fit", "Best Fit", "Worst Fit"], answer: 0, explanation: "First Fit takes the first free block that satisfies the request." },
    { question: "External fragmentation means...", options: ["Free space is split into separate regions", "A process has no address space", "Every block is fully occupied"], answer: 0, explanation: "The total free amount may be enough, but no individual region may fit." },
    { question: "What does Best Fit select?", options: ["The smallest block that can satisfy the request", "The first block regardless of size", "The largest block always"], answer: 0, explanation: "Best Fit minimizes the chosen block's leftover space for that request." },
    { question: "Where does Next Fit resume its search?", options: ["After its previous allocation", "At the largest free block", "At the beginning for every request"], answer: 0, explanation: "Next Fit carries the search cursor forward and wraps around the block list when needed." },
  ],
  "Memory Management Techniques": [
    { question: "What does paging map?", options: ["Virtual pages to physical frames", "Files to directory paths", "Processes to CPU time slices"], answer: 0, explanation: "A page table maps a virtual page number to a physical frame." },
    { question: "Which technique uses variable-sized logical regions with base and limit?", options: ["Segmentation", "Paging", "Round Robin"], answer: 0, explanation: "A segment descriptor identifies a region's base and valid offset limit." },
    { question: "What kind of fragmentation does paging avoid?", options: ["External fragmentation", "Every form of memory waste", "Internal fragmentation"], answer: 0, explanation: "Fixed-size frames avoid external holes, although partial pages can still cause internal waste." },
    { question: "What is characteristic of MFT?", options: ["Fixed partitions can leave internal fragmentation", "Every process gets page-table frames", "No memory partition exists"], answer: 0, explanation: "A process in a fixed partition may leave unusable slack inside its assigned partition." },
  ],
  "Page Replacement": [
    { question: "Which policy uses future references and is not online-implementable?", options: ["Optimal", "LRU", "FIFO"], answer: 0, explanation: "Optimal is a benchmark because it needs knowledge of future accesses." },
    { question: "A page hit occurs when...", options: ["The referenced page is already resident", "Every frame is full", "A process terminates"], answer: 0, explanation: "A resident mapping serves the access without a page fault." },
    { question: "What does LRU evict?", options: ["The least recently used resident page", "The most recently loaded page", "The page with the largest number"], answer: 0, explanation: "LRU uses recency of past references as its replacement signal." },
    { question: "What happens to a referenced frame in Second Chance?", options: ["Its bit is cleared and it gets another turn", "It is always evicted immediately", "It is pinned permanently"], answer: 0, explanation: "Clock scans past frames with a set reference bit after clearing it, replacing the first frame whose bit is clear." },
  ],
  Deadlock: [
    { question: "What does a safe sequence demonstrate?", options: ["Every process can finish in that order", "No process ever needs resources", "All requests arrive together"], answer: 0, explanation: "Each next process can obtain its remaining Need and return its Allocation." },
    { question: "How is Need computed in the Banker's safety test?", options: ["Maximum − Allocation", "Available + Maximum", "Allocation − Available"], answer: 0, explanation: "Need is the remaining resource claim for each process." },
    { question: "An unsafe state means...", options: ["No safe completion order was found", "The system has already crashed", "Every process is deadlocked now"], answer: 0, explanation: "Unsafe means completion is not guaranteed under the model; it does not prove an immediate deadlock." },
    { question: "What does deadlock detection examine?", options: ["Current requests and allocations", "Only each process's maximum future claim", "Disk head direction"], answer: 0, explanation: "Detection applies the current outstanding request matrix and available vector, returning released allocations for processes that can finish." },
  ],
  "File Management": [
    { question: "Which allocation method follows pointers to traverse a file?", options: ["Linked", "Sequential", "Indexed"], answer: 0, explanation: "Linked allocation chains data blocks through pointers." },
    { question: "What is a common advantage of indexed allocation?", options: ["Direct lookup via an index", "No metadata overhead", "It always needs contiguous blocks"], answer: 0, explanation: "An index maps logical positions to data blocks without traversing the whole chain." },
    { question: "What is a main limitation of contiguous allocation?", options: ["It needs a large enough adjacent free run", "It cannot read sequentially", "It stores no block locations"], answer: 0, explanation: "A file needs adjacent blocks, which may be unavailable despite enough total free blocks." },
    { question: "What does a hierarchical directory organize?", options: ["Names in parent-child paths", "CPU time slices", "Physical memory frames"], answer: 0, explanation: "A directory tree lets the OS resolve a path by traversing names from a starting directory." },
  ],
  "Process Synchronization": [
    { question: "What is the goal of mutual exclusion?", options: ["At most one process enters a critical section at once", "All processes run simultaneously", "Every lock is held forever"], answer: 0, explanation: "Mutual exclusion prevents simultaneous access to a protected critical section." },
    { question: "What happens when a process cannot acquire a held mutex?", options: ["It waits until the lock is released", "It enters the critical section anyway", "The mutex duplicates itself"], answer: 0, explanation: "The contender blocks or waits until the lock owner releases it." },
    { question: "Which is one classic deadlock condition?", options: ["Circular wait", "Page locality", "Time slicing"], answer: 0, explanation: "Circular wait is one of the four necessary conditions in the classic deadlock model." },
  ],
  "Paging & Segmentation": [
    { question: "What stays the same when a virtual page maps to a physical frame?", options: ["The page offset", "The page number", "The process ID"], answer: 0, explanation: "Paging replaces the virtual page number with a frame number; the offset is preserved." },
    { question: "What does a segment limit protect?", options: ["The valid offset range for a segment", "The disk head direction", "The CPU quantum"], answer: 0, explanation: "An offset outside the segment limit is invalid and must not translate." },
    { question: "What does a missing page-table entry normally cause?", options: ["A page fault", "A context switch every time", "A directory lookup"], answer: 0, explanation: "The OS handles the nonresident mapping through a page fault." },
    { question: "What does a TLB hit avoid?", options: ["A page-table lookup", "The need for physical memory", "All permission checks"], answer: 0, explanation: "A TLB hit supplies the cached page-to-frame mapping without a page-table memory access." },
  ],
  "Hierarchical File Organization": [
    { question: "How is an absolute path distinguished?", options: ["It begins at the filesystem root", "It contains only file extensions", "It always names a device"], answer: 0, explanation: "An absolute path is rooted in the namespace rather than the current directory." },
    { question: "What is a directory entry used for?", options: ["Mapping a name to a filesystem object", "Scheduling a process", "Mapping virtual pages to frames"], answer: 0, explanation: "Directory entries associate names with files or child directories." },
    { question: "Which component is resolved first in /home/user/file?", options: ["home under root", "file under root", "user under file"], answer: 0, explanation: "Path traversal starts at the root and resolves one component at a time." },
  ],
  "System Calls": [
    { question: "Why does a program use a system call?", options: ["To request a protected OS service", "To bypass kernel validation", "To change CPU hardware directly"], answer: 0, explanation: "The syscall interface is the controlled boundary for privileged services." },
    { question: "What typically happens after a syscall enters the kernel?", options: ["Arguments are validated and a result is returned", "The program gains permanent kernel privilege", "The OS ignores the request"], answer: 0, explanation: "The kernel validates the request, performs an allowed operation, and returns a result or error." },
    { question: "Does every library function require a syscall?", options: ["No; some work entirely in user space", "Yes, always", "Only functions with integer arguments"], answer: 0, explanation: "A library wrapper may do work locally or make one or more syscalls as needed." },
  ],
  "OS Concepts": [
    { question: "What does a process control block primarily hold?", options: ["Execution and resource state for a process", "Only the source code", "Only the file directory"], answer: 0, explanation: "The PCB represents process identity, state, scheduling context, and related resources." },
    { question: "What is a context switch?", options: ["Saving one execution context and restoring another", "Replacing a file allocation method", "A page fault with no frame"], answer: 0, explanation: "The OS switches CPU execution from one process/thread context to another." },
    { question: "What does a page table map?", options: ["Virtual pages to physical frames", "Processes to disk policies", "Interrupts to filenames"], answer: 0, explanation: "Page tables translate a process's virtual addresses into physical memory mappings." },
  ],
};

function getAlgorithmName(category, algorithm) {
  return algorithmOptions[category]?.find(([key]) => key === algorithm)?.[1] || algorithm;
}

function getComplexity(category, algorithm) {
  if (category === "CPU Scheduling") {
    return {
      time: "O(T × P log P) worst case (P processes, T ticks)",
      space: "O(P + T), including the execution trace",
    };
  }
  if (category === "Disk Scheduling") {
    return {
      time: `${algorithm === "fcfs" ? "O(R)" : algorithm === "sstf" ? "O(R²)" : "O(R log R)"} (R requests)`,
      space: "O(R)",
    };
  }
  if (category === "Memory Management") {
    return {
      time: "O(P × (B + P)) including trace snapshots",
      space: "O(P × (B + P)) including trace snapshots",
    };
  }
  if (category === "Page Replacement") {
    return {
      time: "O(N × F) (N references, F frames)",
      space: "O(N × F) including frame snapshots",
    };
  }
  if (category === "Deadlock") {
    return {
      time: "O(P² × R) (P processes, R resource types)",
      space: "O(P × R)",
    };
  }
  if (category === "File Management") {
    return {
      time: "O(F × D) (F files, D disk blocks)",
      space: "O(F × D) including disk snapshots",
    };
  }
  const description = descriptions[category];
  return { time: description?.complexity || "—", space: description?.space || "—" };
}

function calculate(category, algorithm, inputs) {
  if (category === "CPU Scheduling") return simulateCpu(parseProcesses(inputs.processes, algorithm), algorithm, Number(inputs.quantum));
  if (category === "Disk Scheduling") {
    const disk = parseDiskInput(inputs.diskQueue, inputs.diskHead, inputs.diskSize);
    return simulateDisk(disk.requests, disk.head, disk.diskSize, algorithm, inputs.direction);
  }
  if (category === "Page Replacement") {
    const pages = parsePageReferences(inputs.pages, inputs.frames);
    return simulatePages(pages.pages, pages.frameCount, algorithm);
  }
  if (category === "Memory Management") {
    const memory = parseMemoryInput(inputs.blocks, inputs.processSizes);
    return simulateMemory(memory.blockSizes, memory.processSizes, algorithm);
  }
  if (category === "Deadlock") {
    if (algorithm === "detection") {
      const snapshot = parseDeadlockDetectionInput(inputs.allocation, inputs.currentRequest, inputs.available);
      return { ...simulateDeadlockDetection(snapshot.allocation, snapshot.request, snapshot.available), method: "detection" };
    }
    const banker = parseBankerInput(inputs.allocation, inputs.maximum, inputs.available);
    return { ...simulateBanker(banker.allocation, banker.maximum, banker.available), method: "banker" };
  }
  if (category === "File Management") {
    const sizes = parseIntegerList(inputs.fileSizes, "File sizes", { min: 1, maxItems: 100 });
    const count = Number(inputs.diskBlocks);
    return simulateFileAllocation(count, sizes, algorithm);
  }
  return null;
}

function formatNumber(value) {
  return Number.isFinite(value) ? value.toFixed(2) : "—";
}

function SimulatorInputs({ category, algorithm, inputs, setInputs }) {
  const field = (key, label, hint, type = "text") => (
    <label key={key} className="lab-field">{label}<input type={type} value={inputs[key]} onChange={(event) => setInputs((current) => ({ ...current, [key]: event.target.value }))} /><small>{hint}</small></label>
  );
  const area = (key, label, hint, rows = 4) => (
    <label key={key} className="lab-field lab-field-wide">{label}<textarea rows={rows} value={inputs[key]} onChange={(event) => setInputs((current) => ({ ...current, [key]: event.target.value }))} /><small>{hint}</small></label>
  );
  if (category === "CPU Scheduling") {
    const rows = inputs.processes.split(/\r?\n/).filter((line) => line.trim()).map((line) => line.split(",").map((value) => value.trim()));
    const updateRow = (rowIndex, columnIndex, value) => setInputs((current) => {
      const nextRows = current.processes.split(/\r?\n/).filter((line) => line.trim()).map((line) => line.split(",").map((item) => item.trim()));
      while (nextRows[rowIndex].length < 4) nextRows[rowIndex].push("");
      nextRows[rowIndex][columnIndex] = value;
      return { ...current, processes: nextRows.map((row) => row.slice(0, 4).join(",")).join("\n") };
    });
    const addRow = () => setInputs((current) => {
      const nextRows = current.processes.split(/\r?\n/).filter((line) => line.trim());
      const ids = new Set(nextRows.map((line) => line.split(",")[0].trim()));
      let nextId = nextRows.length + 1;
      while (ids.has(`P${nextId}`)) nextId += 1;
      nextRows.push(`P${nextId},0,4,5`);
      return { ...current, processes: nextRows.join("\n") };
    });
    const removeRow = (rowIndex) => setInputs((current) => ({
      ...current,
      processes: current.processes.split(/\r?\n/).filter((line) => line.trim()).filter((_, index) => index !== rowIndex).join("\n"),
    }));
    return <div className="cpu-process-editor">
      <div className="cpu-process-table" role="table" aria-label="CPU process input">
        <div className="cpu-process-row cpu-process-heading" role="row">
          {["Process", "Arrival", "Burst", "Priority", "Action"].map((label) => <span role="columnheader" key={label}>{label}</span>)}
        </div>
        {rows.map((row, rowIndex) => <div className="cpu-process-row" role="row" key={`${row[0] || "process"}-${rowIndex}`}>
          {[0, 1, 2, 3].map((columnIndex) => <label className="cpu-process-cell" key={columnIndex}>
            <span className="sr-only">{["Process ID", "Arrival time", "CPU burst", "Priority"][columnIndex]} {rowIndex + 1}</span>
            <input aria-label={`${["Process ID", "Arrival time", "CPU burst", "Priority"][columnIndex]} for process ${row[0] || rowIndex + 1}`} type={columnIndex ? "number" : "text"} min={columnIndex === 1 ? 0 : columnIndex ? 1 : undefined} value={row[columnIndex] || ""} onChange={(event) => updateRow(rowIndex, columnIndex, event.target.value)} />
          </label>)}
          <button className="cpu-remove-process" type="button" aria-label={`Remove process ${row[0] || rowIndex + 1}`} onClick={() => removeRow(rowIndex)}>Remove</button>
        </div>)}
        {!rows.length && <p className="cpu-no-processes">Add a process to configure the workload.</p>}
      </div>
      <div className="cpu-process-actions"><button className="lab-secondary" type="button" onClick={addRow}>＋ Add Process</button><small>Arrival, CPU burst, and priority are whole-number values.</small></div>
      {algorithm === "round_robin" && <div className="lab-fields">{field("quantum", "Time quantum", "Maximum CPU ticks in each Round Robin turn.", "number")}</div>}
    </div>;
  }
  if (category === "Disk Scheduling") return <div className="lab-fields">{field("diskQueue", "Request queue", "Comma-separated cylinder numbers.")}{field("diskHead", "Initial head", "Current cylinder.", "number")}{field("diskSize", "Disk cylinders", "Valid cylinders are 0 through size − 1.", "number")}<label className="lab-field">Direction<select value={inputs.direction} onChange={(event) => setInputs((current) => ({ ...current, direction: event.target.value }))}><option value="up">Toward higher cylinders</option><option value="down">Toward lower cylinders</option></select><small>Used by SCAN, C-SCAN, LOOK, and C-LOOK.</small></label></div>;
  if (category === "Page Replacement") return <div className="lab-fields">{area("pages", "Reference string", "Comma-separated page numbers.")}{field("frames", "Frame count", "Between 1 and 32 frames.", "number")}</div>;
  if (category === "Memory Management") return <div className="lab-fields">{field("blocks", "Free block sizes", "Comma-separated sizes in memory units.")}{field("processSizes", "Process sizes", "Comma-separated allocation requests.")}</div>;
  if (category === "Deadlock") return <div className="lab-fields">{area("allocation", "Allocation matrix", "One process per row; comma or space separated.", 5)}{algorithm === "banker" ? area("maximum", "Maximum-claim matrix", "Same dimensions as allocation.", 5) : area("currentRequest", "Current outstanding request matrix", "Same dimensions as allocation; requests the processes still need right now.", 5)}{field("available", "Available resources", "Comma-separated vector matching each matrix column.")}</div>;
  if (category === "File Management") return <div className="lab-fields">{field("diskBlocks", "Total disk blocks", "Between 1 and 1,000.", "number")}{field("fileSizes", "File sizes", "Comma-separated data block counts.")}</div>;
  return null;
}

function GanttVisualization({ events, total }) {
  const segments = events.reduce((output, event) => {
    const previous = output.at(-1);
    if (previous && previous.pid === event.pid && previous.end === event.start) previous.end = event.end;
    else output.push({ ...event });
    return output;
  }, []);
  return <div className="gantt-visual" aria-label={`Gantt chart showing ${events.length} of ${total} time units`}>
    {segments.map((segment, index) => <div key={`${segment.start}-${index}`} className={`gantt-visual-segment ${segment.pid ? "" : "idle"}`} style={{ flexGrow: segment.end - segment.start }} title={`${segment.pid || "Idle"}: ${segment.start}–${segment.end}`}><strong>{segment.pid || "Idle"}</strong><small>{segment.start}–{segment.end}</small></div>)}
    <div className="gantt-axis"><span>{segments[0]?.start ?? 0}</span><span>{segments.at(-1)?.end ?? 0}</span></div>
  </div>;
}

function CPUProcessStateVisualization({ events, stepCount, result, algorithm }) {
  const visibleEvents = events.slice(0, stepCount);
  const currentTick = visibleEvents.at(-1)?.end ?? 0;
  const lastEvent = visibleEvents.at(-1);
  const executed = visibleEvents.reduce((counts, event) => {
    if (event.pid) counts[event.pid] = (counts[event.pid] || 0) + 1;
    return counts;
  }, {});
  const processes = result.metrics.map((process) => {
    const remaining = process.burst - (executed[process.id] || 0);
    const state = remaining === 0 ? "TERMINATED"
      : process.arrival > currentTick ? "NEW"
        : lastEvent?.pid === process.id ? "RUNNING" : "READY";
    return { ...process, remaining, state };
  });
  const running = processes.find((process) => process.state === "RUNNING");
  const ready = processes.filter((process) => process.state === "READY");
  return <div className="cpu-state-visual">
    <div className={`cpu-running-card ${running ? "active" : ""}`}>
      <span>CPU</span><strong>{running?.id || "IDLE"}</strong>
      <small>{running ? `${running.remaining} ticks remaining` : "No process running at this step"}</small>
      <b>TICK {currentTick}</b>
    </div>
    <div className="cpu-state-lanes">
      <div className="cpu-state-lane"><span>READY QUEUE <b>{ready.length}</b></span><div>{ready.length ? ready.map((process) => <i key={process.id}>{process.id}</i>) : <small>Empty</small>}</div></div>
      <div className="cpu-process-state-list">{processes.map((process) => <div className={`cpu-process-state ${process.state.toLowerCase()}`} key={process.id}>
        <strong>{process.id}</strong><span>{process.state}</span><small>{process.remaining} / {process.burst} ticks left</small>
      </div>)}</div>
      <small className="cpu-state-source">Process states derived from the visible {algorithm.replace("_", " ").toUpperCase()} execution steps.</small>
    </div>
  </div>;
}

function DiskVisualization({ result, stepCount }) {
  const events = result.events.slice(0, stepCount);
  const sequence = [result.sequence[0], ...events.map((event) => event.to)];
  return <div className="disk-visual">
    <div className="disk-sequence" aria-label="Disk head sequence">{sequence.map((cylinder, index) => <span key={`${index}-${cylinder}`} className="disk-node"><b>{cylinder}</b><small>{index === 0 ? "START" : events[index - 1]?.kind === "wrap" ? "WRAP" : events[index - 1]?.kind === "edge" ? "EDGE" : "REQUEST"}</small></span>)}</div>
    <div className="disk-movements">{events.map((event, index) => <span key={`${event.from}-${event.to}-${index}`} className={event.kind === "wrap" ? "wrap" : ""}>{event.from} → {event.to}<small>{event.kind === "wrap" ? "jump" : `${event.distance} cyl`}</small></span>)}</div>
  </div>;
}

function PageVisualization({ events, frameCount, algorithm }) {
  const current = events.at(-1);
  return <div className="page-visual">
    <div className="page-frames">{Array.from({ length: frameCount }, (_, index) => <div className={`page-frame ${current?.frameIndex === index ? current.hit ? "hit" : "fault" : ""}`} key={index}><small>FRAME {index + 1}{algorithm === "second_chance" && current ? ` · R${Number(current.referenced[index])}` : ""}</small><strong>{current?.frames[index] ?? "—"}</strong></div>)}</div>
    <div className="page-history">{events.map((event) => <span key={event.index} className={event.hit ? "hit" : "fault"} title={event.explanation}>{event.page}<small>{event.hit ? "HIT" : "FAULT"}</small></span>)}</div>
  </div>;
}

function MemoryVisualization({ blocks, total }) {
  return <div className="memory-visual" aria-label="Memory blocks">{blocks.map((block) => <div key={block.id} className={`memory-visual-block ${block.free ? "free" : ""}`} style={{ flexGrow: block.size }} title={`${block.id}: ${block.free} free of ${block.size}`}><strong>{block.id}</strong><small>{block.free} free / {block.size}</small>{block.allocations.map((allocation) => <i key={allocation.id} style={{ flexGrow: allocation.size }} title={`${allocation.id} · ${allocation.size}`}><small>{allocation.id} · {allocation.size}</small></i>)}</div>)}<span className="visual-total">{total} units</span></div>;
}

function ResourceVisualization({ result, complete }) {
  const current = result.events.at(-1);
  const resources = current?.after || (result.events[0]?.before ?? result.availableAfter);
  return <div className={`banker-status ${complete ? result.safe ? "safe" : "unsafe" : ""}`}><strong>{complete ? result.method === "detection" ? result.safe ? "NO DEADLOCK DETECTED" : "DEADLOCK DETECTED" : result.safe ? "SAFE STATE" : "UNSAFE STATE" : result.method === "detection" ? "DETECTION IN PROGRESS" : "SAFETY CHECK IN PROGRESS"}</strong><span>{complete ? result.safe ? result.sequence.join(" → ") || "No processes hold resources" : `Blocked: ${result.blocked.join(", ")}` : current ? `${result.sequence.slice(0, result.events.length).join(" → ")} · checking remaining processes` : "Advance steps to test which process can finish next."}</span><div className="resource-pills">{resources.map((value, index) => <span key={index}>R{index + 1}<b>{value}</b></span>)}</div></div>;
}

function FileVisualization({ result }) {
  return <div className="file-block-map" aria-label="Disk block allocation">{result.blocks.map((block, index) => <span className={block ? `file-block ${block.kind}` : "file-block"} key={index} title={block ? `${block.file} ${block.kind}${block.next !== undefined ? ` · next ${block.next ?? "END"}` : ""}${block.pointsTo ? ` · points to ${block.pointsTo.join(", ")}` : ""}` : `Block ${index} free`}>{block ? block.kind === "index" ? `${block.file}*` : block.file : index}</span>)}</div>;
}

function ResultMetrics({ category, result }) {
  let metrics = [];
  if (category === "CPU Scheduling") metrics = [
    ["AVG WAIT", formatNumber(result.averages.waiting)],
    ["AVG TURNAROUND", formatNumber(result.averages.turnaround)],
    ["AVG RESPONSE", formatNumber(result.averages.response)],
    ["THROUGHPUT", formatNumber(result.averages.throughput)],
  ];
  if (category === "Disk Scheduling") metrics = [["TOTAL SEEK", result.totalSeek], ["REQUESTS SERVICED", result.serviced], ["HEAD MOVES", result.events.length]];
  if (category === "Page Replacement") metrics = [["PAGE FAULTS", result.faults], ["PAGE HITS", result.hits], ["HIT RATIO", `${formatNumber(result.hitRatio * 100)}%`]];
  if (category === "Memory Management") metrics = [["ALLOCATED", `${result.allocated} units`], ["FREE", `${result.free} units`], ["UTILIZATION", `${formatNumber(result.utilization * 100)}%`], ["ALLOCATIONS", `${result.allocatedCount} / ${result.events.length}`]];
  if (category === "Deadlock") metrics = [["STATUS", result.method === "detection" ? result.safe ? "No deadlock" : "Deadlock detected" : result.safe ? "Safe" : "Unsafe"], [result.method === "detection" ? "FINISH ORDER" : "SAFE SEQUENCE", result.sequence.length ? result.sequence.join(" → ") : "None"], [result.method === "detection" ? "DEADLOCKED" : "BLOCKED", result.blocked.length ? result.blocked.join(", ") : "None"]];
  if (category === "File Management") metrics = [["BLOCKS USED", `${result.used} / ${result.used + result.free}`], ["BLOCKS FREE", result.free], ["FILES ALLOCATED", `${result.filesAllocated} / ${result.events.length}`]];
  return <div className="lab-result-metrics">{metrics.map(([label, value]) => <div key={label}><small>{label}</small><strong>{value}</strong></div>)}</div>;
}

function ResultTable({ category, result, stepCount }) {
  if (category === "CPU Scheduling") return <div className="lab-table-wrap"><table><thead><tr><th>PID</th><th>ARRIVAL</th><th>BURST</th><th>COMPLETE</th><th>TURNAROUND</th><th>WAIT</th><th>RESPONSE</th></tr></thead><tbody>{result.metrics.map((row) => <tr key={row.id}><td>{row.id}</td><td>{row.arrival}</td><td>{row.burst}</td><td>{row.completion}</td><td>{row.turnaround}</td><td>{row.waiting}</td><td>{row.response}</td></tr>)}</tbody></table></div>;
  if (category === "Deadlock") return <div className="lab-table-wrap"><table><thead><tr><th>PROCESS</th><th>{result.method === "detection" ? "CURRENT REQUEST" : "NEED"}</th><th>AVAILABLE BEFORE</th><th>AVAILABLE AFTER</th></tr></thead><tbody>{result.events.slice(0, stepCount).map((row) => <tr key={row.process}><td>{row.process}</td><td>{row.need.join(", ")}</td><td>{row.before.join(", ")}</td><td>{row.after.join(", ")}</td></tr>)}</tbody></table></div>;
  if (category === "Memory Management") return <div className="lab-table-wrap"><table><thead><tr><th>PROCESS</th><th>SIZE</th><th>BLOCK</th><th>STATUS</th></tr></thead><tbody>{result.events.slice(0, stepCount).map((row) => <tr key={row.id}><td>{row.id}</td><td>{row.size}</td><td>{row.block || "—"}</td><td>{row.block ? "Allocated" : "No fit"}</td></tr>)}</tbody></table></div>;
  if (category === "File Management") return <div className="lab-table-wrap"><table><thead><tr><th>FILE</th><th>DATA BLOCKS</th><th>ALLOCATION</th><th>INDEX BLOCK</th></tr></thead><tbody>{result.events.slice(0, stepCount).map((row) => <tr key={row.file}><td>{row.file}</td><td>{row.allocated} / {row.requested}</td><td>{row.blocks.join(", ") || "—"}</td><td>{row.indexBlock ?? "—"}</td></tr>)}</tbody></table></div>;
  if (category === "Disk Scheduling") return <div className="lab-table-wrap"><table><thead><tr><th>MOVE</th><th>FROM</th><th>TO</th><th>DISTANCE</th><th>TYPE</th></tr></thead><tbody>{result.events.slice(0, stepCount).map((row, index) => <tr key={`${index}-${row.to}`}><td>{index + 1}</td><td>{row.from}</td><td>{row.to}</td><td>{row.distance}</td><td>{row.kind}</td></tr>)}</tbody></table></div>;
  return null;
}

function ComparisonTable({ category, algorithm, inputs, result }) {
  const [comparison, setComparison] = useState(null);
  const options = algorithmOptions[category] || [];
  if (options.length < 2) return null;
  function compare() {
    const rows = options.map(([key, label]) => {
      try {
        const candidate = calculate(category, key, inputs);
        if (category === "CPU Scheduling") return { algorithm: label, primary: formatNumber(candidate.averages.waiting), secondary: formatNumber(candidate.averages.turnaround), tertiary: formatNumber(candidate.averages.response) };
        if (category === "Disk Scheduling") return { algorithm: label, primary: candidate.totalSeek, secondary: candidate.sequence.join(" → "), tertiary: candidate.serviced };
        if (category === "Page Replacement") return { algorithm: label, primary: candidate.faults, secondary: candidate.hits, tertiary: `${formatNumber(candidate.hitRatio * 100)}%` };
        if (category === "Memory Management") return { algorithm: label, primary: candidate.allocatedCount, secondary: candidate.free, tertiary: `${formatNumber(candidate.utilization * 100)}%` };
        if (category === "File Management") return { algorithm: label, primary: candidate.filesAllocated, secondary: candidate.used, tertiary: candidate.free };
        return { algorithm: label, primary: candidate.method === "detection" ? candidate.safe ? "No deadlock" : "Detected" : candidate.safe ? "Safe" : "Unsafe", secondary: candidate.sequence.join(" → ") || "None", tertiary: candidate.blocked.join(", ") || "None" };
      } catch (error) {
        return { algorithm: label, primary: "Invalid", secondary: error.message, tertiary: "—" };
      }
    });
    setComparison(rows);
  }
  const labels = category === "CPU Scheduling" ? ["Avg waiting", "Avg turnaround", "Avg response"] :
    category === "Disk Scheduling" ? ["Total seek", "Head sequence", "Requests"] :
      category === "Page Replacement" ? ["Faults", "Hits", "Hit ratio"] :
        category === "Memory Management" ? ["Allocated", "Free units", "Utilization"] :
          category === "File Management" ? ["Files allocated", "Blocks used", "Blocks free"] : ["Result", "Finish order", "Blocked / deadlocked"];
  return <section className="lab-panel comparison-panel"><div className="lab-panel-heading"><div><span className="eyebrow">COMPARE</span><h3>Compare every policy on this input</h3></div><button type="button" className="lab-secondary" onClick={compare}>Compare algorithms</button></div>
    {comparison && <div className="lab-table-wrap"><table><thead><tr><th>ALGORITHM</th>{labels.map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>{comparison.map((row) => <tr className={row.algorithm === getAlgorithmName(category, algorithm) ? "comparison-current" : ""} key={row.algorithm}><td>{row.algorithm}</td><td>{row.primary}</td><td>{row.secondary}</td><td>{row.tertiary}</td></tr>)}</tbody></table></div>}
  </section>;
}

function PracticePanel({ category, onReview, onComplete }) {
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState(null);
  const [score, setScore] = useState(0);
  const [finalScore, setFinalScore] = useState(null);
  const [questionResults, setQuestionResults] = useState([]);
  const [finalReview, setFinalReview] = useState([]);
  const questions = quizBank[category] || legacyQuizFallback["OS Concepts"];
  const question = questions[questionIndex];
  const lastQuestionAnswered = questionIndex === questions.length - 1 && answer !== null;
  function nextQuestion() {
    const result = {
      question: question.question,
      selected: answer,
      correct: question.answer,
      options: question.options,
      explanation: question.explanation,
    };
    const updatedResults = [...questionResults, result];
    setQuestionResults(updatedResults);
    if (answer === question.answer) setScore((value) => value + 1);
    if (lastQuestionAnswered) {
      const completedScore = score + (answer === question.answer ? 1 : 0);
      setFinalScore(completedScore);
      setFinalReview(updatedResults);
      onComplete?.(completedScore, questions.length);
      return;
    }
    setQuestionIndex((index) => index + 1);
    setAnswer(null);
  }
  function retryQuiz() {
    setQuestionIndex(0);
    setAnswer(null);
    setScore(0);
    setFinalScore(null);
    setQuestionResults([]);
    setFinalReview([]);
  }
  const lesson = topicTheory[category];
  const missedQuestions = finalReview.filter((result) => result.selected !== result.correct);
  const scorePercent = finalScore === null ? 0 : Math.round((finalScore / questions.length) * 100);
  const scoreLevel = scorePercent >= 90 ? "Excellent understanding" : scorePercent >= 75 ? "Strong progress" : scorePercent >= 50 ? "Building understanding" : "Review and try again";
  const answeredCount = questionIndex + (answer === null ? 0 : 1);
  return <section className="lab-panel practice-panel">
    <div className="lab-panel-heading"><div><span className="eyebrow">20-QUESTION TOPIC QUIZ · {category.toUpperCase()}</span><h3>{finalScore === null ? "Check your understanding" : "Quiz complete"}</h3></div><span>{finalScore === null ? `Question ${questionIndex + 1} of ${questions.length} · Score ${score + (answer === question.answer ? 1 : 0)} / ${questions.length}` : `Final score ${finalScore} / ${questions.length}`}</span></div>
    <details className="quiz-concept-review">
      <summary>Review the core concept before or during the quiz</summary>
      <h4>In plain language</h4>
      <p>{lesson.simple}</p>
      <h4>A useful analogy</h4>
      <p>{lesson.analogy}</p>
      <h4>In a real operating system</h4>
      <p>{lesson.realWorld}</p>
      <p>{lesson.overview}</p>
      <ul>{lesson.rules.slice(0, 3).map((rule) => <li key={rule}>{rule}</li>)}</ul>
      <button type="button" className="lab-secondary" onClick={() => onReview("theory")}>Open the full lesson</button>
    </details>
    {finalScore !== null ? <>
      <div className="quiz-final-score" role="status"><span>YOUR QUIZ RESULT</span><strong>{finalScore} / {questions.length}</strong><span className="quiz-score-percent">{scorePercent}% correct</span><div className="quiz-score-meter" role="progressbar" aria-label="Quiz score" aria-valuemin={0} aria-valuemax={100} aria-valuenow={scorePercent}><span style={{ width: `${scorePercent}%` }} /></div><span className="quiz-score-level">{scoreLevel}</span><p>{finalScore} correct · {questions.length - finalScore} incorrect</p><p>{finalScore === questions.length ? "Excellent work—you demonstrated a strong understanding of this topic." : finalScore >= questions.length * 0.7 ? "Good progress. Review the missed concepts below to strengthen your understanding." : "Use the answer review and visualizer to revisit the key ideas, then try again."}</p><button type="button" className="lab-primary" onClick={retryQuiz}>Retry quiz</button></div>
      {missedQuestions.length > 0 && <section className="quiz-answer-review" aria-label="Review incorrect answers">
        <h4>Review the questions to learn from</h4>
        {missedQuestions.map((result, index) => <article key={`${result.question}-${index}`}>
          <strong>{result.question}</strong>
          <span className="quiz-your-answer">Your answer: {result.options[result.selected]}</span>
          <span className="quiz-correct-answer">Correct answer: {result.options[result.correct]}</span>
          <p>{result.explanation}</p>
        </article>)}
      </section>}
      <section className="quiz-completion-recap">
        <h4>Key ideas to remember</h4>
        <ul>{lesson.recap.map((point) => <li key={point}>{point}</li>)}</ul>
        <details className="topic-self-check">
          <summary>Try a final self-check: {lesson.selfCheck}</summary>
          <p>{lesson.selfCheckAnswer}</p>
        </details>
      </section>
      <div className="quiz-review-actions"><button type="button" className="lab-secondary" onClick={() => onReview("visualize")}>Review visualization</button><button type="button" className="lab-secondary" onClick={() => onReview("theory")}>Re-read concept lesson</button></div>
    </> : <>
      <div className="quiz-progress" aria-label={`Quiz progress: question ${questionIndex + 1} of ${questions.length}`}>
        <span>Question {questionIndex + 1} of {questions.length}</span>
        <strong>{score + (answer === question.answer ? 1 : 0)} correct so far</strong>
        <div className="quiz-progress-track" role="progressbar" aria-label="Questions answered" aria-valuemin={0} aria-valuemax={questions.length} aria-valuenow={answeredCount}><span style={{ width: `${(answeredCount / questions.length) * 100}%` }} /></div>
      </div>
      <div className="quiz-question-card"><span>QUESTION {questionIndex + 1}</span><p>{question.question}</p></div>
      <div className="practice-options">{question.options.map((option, index) => <button type="button" key={option} disabled={answer !== null} className={answer === index ? index === question.answer ? "correct" : "incorrect" : answer !== null && index === question.answer ? "correct" : ""} onClick={() => setAnswer(index)}>{option}</button>)}</div>
      {answer !== null && <div className={`practice-explanation ${answer === question.answer ? "correct" : "incorrect"}`}>
        <strong>{answer === question.answer ? "Correct — here’s why" : "Not quite — review the correct answer"}</strong>
        {answer !== question.answer && <span className="quiz-your-answer">Your answer: {question.options[answer]}</span>}
        <span className="quiz-correct-answer">Correct answer: {question.options[question.answer]}</span>
        <p>{question.explanation}</p>
        <div className="quiz-feedback-actions"><button type="button" className="quiz-review-link" onClick={() => onReview("visualize")}>Review visualization</button><button type="button" onClick={nextQuestion}>{lastQuestionAnswered ? "Finish quiz" : "Next question →"}</button></div>
      </div>}
    </>}
  </section>;
}

function TheoryView({ category, algorithm, onOpenModule, onOpenTopic }) {
  const guide = descriptions[category];
  const lesson = topicTheory[category];
  if (!lesson) throw new Error(`Missing theory lesson for ${category}.`);
  const inDepthSections = deepTheory[category] || [];
  const integrationSection = category === "System Calls" ? "System Calls"
    : category === "Hierarchical File Organization" ? "File System" : null;
  return <div className="theory-topic-layout">
    <article className="lab-panel topic-lesson-panel">
      <header className="topic-article-header">
        <span className="eyebrow">EXECOS STUDY GUIDE · OPERATING SYSTEMS</span>
        <h2>{category}</h2>
        <p className="topic-overview">{lesson.overview}</p>
        <p className="topic-originality-note">An original, example-led explanation designed to accompany the interactive lab.</p>
      </header>
      <nav className="topic-table-of-contents" aria-label={`${category} lesson contents`}>
        <strong>In this lesson</strong>
        <div>
          <a href="#topic-simple">The idea in plain language</a>
          <a href="#topic-analogy">Everyday analogy</a>
          <a href="#topic-real-world">In an operating system</a>
          <a href="#topic-objectives">Learning goals</a>
          {inDepthSections.length > 0 && <a href="#topic-in-depth">How it works</a>}
          <a href="#topic-vocabulary">Key vocabulary</a>
          <a href="#topic-rules">Rules and formulas</a>
          <a href="#topic-example">Worked example</a>
          <a href="#topic-reasoning">Apply the idea</a>
          <a href="#topic-misconceptions">Common mistakes</a>
          <a href="#topic-connections">Related concepts</a>
          {category === "OS Concepts" && <a href="#topic-whole-os">Complete OS study roadmap</a>}
          <a href="#topic-references">Trusted books and documentation</a>
          <a href="#topic-recap">Recap and self-check</a>
        </div>
      </nav>
      <section className="topic-article-section topic-intuition" id="topic-simple">
        <h3>The idea in plain language</h3>
        <p>{lesson.simple}</p>
      </section>
      <section className="topic-article-section topic-analogy" id="topic-analogy">
        <h3>A useful analogy</h3>
        <p>{lesson.analogy}</p>
      </section>
      <section className="topic-article-section topic-real-world" id="topic-real-world">
        <h3>Where this appears in an operating system</h3>
        <p>{lesson.realWorld}</p>
      </section>
      <section className="topic-article-section" id="topic-objectives">
        <h3>What you should understand</h3>
        <ul>{lesson.objectives.map((objective) => <li key={objective}>{objective}</li>)}</ul>
      </section>
      {inDepthSections.length > 0 && <section className="topic-article-section topic-in-depth" id="topic-in-depth">
        <h3>How it works</h3>
        {inDepthSections.map(([heading, body]) => <section className="theory-detail" key={heading}><h4>{heading}</h4><p>{body}</p></section>)}
      </section>}
      <section className="topic-article-section" id="topic-vocabulary">
        <h3>Key vocabulary</h3>
        <dl className="topic-glossary">{topicGlossary[category].map(([term, definition]) => <div key={term}><dt>{term}</dt><dd>{definition}</dd></div>)}</dl>
      </section>
      <section className="topic-article-section topic-core-rules" id="topic-rules">
        <h3>Rules and formulas</h3>
        <ul>{lesson.rules.map((rule) => <li key={rule}>{rule}</li>)}</ul>
      </section>
      <section className="topic-article-section topic-worked-example" id="topic-example">
        <h3>Worked example</h3><p>{lesson.example}</p>
      </section>
      <section className="topic-article-section" id="topic-reasoning">
        <h3>Apply the idea</h3>
        <ol>{lesson.steps.map((step) => <li key={step}>{step}</li>)}</ol>
      </section>
      <section className="topic-article-section" id="topic-misconceptions">
        <h3>Common mistakes</h3>
        <ul>{lesson.pitfalls.map((pitfall) => <li key={pitfall}>{pitfall}</li>)}</ul>
      </section>
      <section className="topic-article-section" id="topic-connections">
        <h3>How this connects to other OS topics</h3>
        <ul>{lesson.connections.map((connection) => <li key={connection}>{connection}</li>)}</ul>
      </section>
      {category === "OS Concepts" && <section className="topic-article-section os-roadmap-section" id="topic-whole-os">
        <span className="eyebrow">COMPLETE OPERATING-SYSTEM STUDY GUIDE</span>
        <h3>Explore the whole operating system</h3>
        <p>Use this roadmap as a map of the subject. Start with architecture and processes, then follow how the OS schedules work, protects memory, handles I/O, stores data, and responds to failures. Each summary is written for this guide; the linked resources provide deeper explanations and different perspectives.</p>
        <div className="os-roadmap-grid">{osStudyRoadmap.map(([title, explanation, relatedTopics], index) => <article className="os-roadmap-card" key={title}>
          <span className="os-roadmap-number">{String(index + 1).padStart(2, "0")}</span>
          <div><h4>{title}</h4><p>{explanation}</p><div className="os-roadmap-links">{relatedTopics.map((topic) => <button type="button" className="os-topic-link" key={topic} onClick={() => onOpenTopic(topic)}>Explore {topic} ↗</button>)}</div></div>
        </article>)}</div>
      </section>}
      <section className="topic-article-section topic-recap" id="topic-recap">
        <h3>Quick recap</h3>
        <ul>{lesson.recap.map((point) => <li key={point}>{point}</li>)}</ul>
        <details className="topic-self-check">
          <summary>Check your understanding: {lesson.selfCheck}</summary>
          <p>{lesson.selfCheckAnswer}</p>
        </details>
      </section>
      <aside className="topic-further-reading">
        <div id="topic-references"><strong>Continue learning with trusted references</strong><span>ExecOS summarizes concepts in its own words. These independent textbooks, course materials, and official documentation are for deeper reading; details can differ across operating systems and versions.</span></div>
        <div className="os-reference-grid">{osReferenceSources.filter((source) => source.topics.includes(category)).map((source) => <article className="os-reference-card" key={source.url}>
          <span>{source.organization}</span>
          <strong>{source.label}</strong>
          <p>{source.description}</p>
          <a href={source.url} target="_blank" rel="noopener noreferrer">{source.label} ↗</a>
        </article>)}
          <article className="os-reference-card">
            <span>Further reading</span>
            <strong>{osFurtherReading.label}</strong>
            <p>A broad tutorial index for definitions, diagrams, and additional OS topic coverage.</p>
            <a href={osFurtherReading.url} target="_blank" rel="noopener noreferrer">{osFurtherReading.label} ↗</a>
          </article>
        </div>
      </aside>
    </article>
    {guide && <aside className="lab-panel theory-facts">
      <span className="eyebrow">SELECTED ALGORITHM</span><h3>{getAlgorithmName(category, algorithm)}</h3>
      <p>{guide.purpose}</p>
      <span className="eyebrow">WORKED POLICY EXAMPLE</span><p>{guide.example}</p>
      <span className="eyebrow">DECISION OUTLINE</span><pre>{guide.pseudocode}</pre>
      <span className="eyebrow">COMPLEXITY</span><dl><dt>Time</dt><dd>{getComplexity(category, algorithm).time}</dd><dt>Space</dt><dd>{getComplexity(category, algorithm).space}</dd></dl>
      <span className="eyebrow">ADVANTAGE</span><p>{guide.advantages}</p>
      <span className="eyebrow">TRADEOFF</span><p>{guide.disadvantages}</p>
      <span className="eyebrow">SCOPE</span><p>This is an educational model. It does not change the host operating system.</p>
    </aside>}
    {category === "OS Concepts" && <div className="concept-grid">{conceptCards.map(([title, summary, detail, section]) => <article className="concept-card" key={title}><span className="eyebrow">OS CONCEPT</span><h3>{title}</h3><strong>{summary}</strong><p>{detail}</p><button type="button" className="lab-secondary" onClick={() => onOpenModule(section)}>Open {section} module ↗</button></article>)}</div>}
    {integrationSection && <div className="integration-note"><span className="eyebrow">CONNECT THEORY TO EXECOS</span><h3>{category === "System Calls" ? "Inspect a supported system call in the Engine." : "Explore path and file state in the virtual filesystem."}</h3><p>The authenticated ExecOS Engine offers a live, traceable workbench for this topic. Its operations affect only the simulated Engine state.</p><button type="button" className="lab-primary" onClick={() => onOpenModule(integrationSection)}>Open {integrationSection} workbench</button></div>}
  </div>;
}

const conceptVisuals = [
  { title: "Process lifecycle", section: "Processes", steps: [
    ["NEW", "The OS admits a process and creates its process control block."],
    ["READY", "The process is eligible to run and waits in the scheduler's ready queue."],
    ["RUNNING", "The dispatcher gives the process a CPU time slice."],
    ["WAITING", "An I/O operation or event blocks the process until it can continue."],
    ["TERMINATED", "The process exits and the OS reclaims its resources."],
  ] },
  { title: "Virtual memory", section: "Storage", steps: [
    ["VIRTUAL ADDRESS", "A running process generates an address in its private virtual address space."],
    ["PAGE TABLE", "The memory-management unit consults the process mapping for the virtual page."],
    ["PHYSICAL FRAME", "A resident mapping identifies the physical frame that holds the page."],
    ["PAGE FAULT", "If the page is absent, the OS resolves the fault and may replace a frame."],
  ] },
  { title: "Paging & segmentation", section: "Storage", steps: [
    ["LOGICAL ADDRESS", "A process issues a logical address that the memory manager must validate and translate."],
    ["PAGE OR SEGMENT", "Paging splits the address into page and offset; segmentation identifies a logical region and offset."],
    ["TABLE LOOKUP", "A page table supplies a frame, or a segment descriptor supplies base and limit."],
    ["CHECK & TRANSLATE", "Preserve the page offset or check the segment bound before producing a physical address."],
  ] },
  { title: "Synchronization & IPC", section: "IPC", steps: [
    ["SENDER", "A process prepares data to communicate to another process."],
    ["CHOOSE IPC", "Select message passing or shared memory; shared memory needs synchronization for concurrent access."],
    ["CHANNEL / SHARED REGION", "The OS can mediate a message queue, or map a shared region into both processes."],
    ["RECEIVER", "The receiving process reads the message or shared data after the required coordination."],
  ] },
  { title: "Process synchronization", section: "IPC", steps: [
    ["LOCK AVAILABLE", "The mutex starts unlocked. P1 and P2 are ready to compete for the critical section."],
    ["P1 ACQUIRES", "P1 atomically acquires the mutex; ownership prevents P2 from entering."],
    ["P1 CRITICAL SECTION", "P1 updates shared state while holding exclusive access."],
    ["P2 BLOCKS", "P2 attempts to acquire the held mutex and waits rather than racing P1."],
    ["P1 RELEASES", "P1 leaves the critical section and releases the mutex so the waiter can proceed."],
    ["P2 ENTERS & RELEASES", "P2 acquires the available mutex, enters safely, and releases it when done."],
  ] },
  { title: "System-call boundary", section: "System Calls", steps: [
    ["USER PROGRAM", "Application code asks a library wrapper for an OS service."],
    ["VALIDATE", "The syscall boundary checks the operation and caller-supplied arguments."],
    ["KERNEL SERVICE", "The privileged OS performs an allowed operation or returns an error."],
    ["RESULT", "A result or error code returns to user mode; the trace can record the event."],
  ] },
  { title: "Files & devices", section: "File System", steps: [
    ["APPLICATION REQUEST", "A process asks to read, write, or create a named resource."],
    ["OS ABSTRACTION", "The filesystem or device layer resolves names and checks access."],
    ["DEVICE QUEUE", "A driver or simulated device orders and services work."],
    ["COMPLETION", "The OS reports the result and wakes any waiting process."],
  ] },
  { title: "Directory structures", section: "File System", steps: [
    ["ROOT", "Path resolution begins at the root directory or the process's current directory."],
    ["DIRECTORY ENTRY", "Each path component is looked up in its parent directory."],
    ["SUBDIRECTORY", "Intermediate components lead to a child directory or another namespace."],
    ["FILE METADATA", "The final name resolves to file metadata and its allocated storage blocks."],
  ] },
  { title: "Execution trace", section: "Execution Trace", steps: [
    ["OPERATION", "A scheduler, process, memory, or filesystem action begins."],
    ["EVENT", "The Engine records the operation and its relevant identifiers."],
    ["STATE CHANGE", "The process or subsystem state is updated by the Engine."],
    ["INSPECTION", "A trace view filters the recorded event to explain what changed."],
  ] },
];

const directoryTree = {
  "/": { directories: ["home", "etc", "var"], files: ["README.md"] },
  "/home": { directories: ["student"], files: ["welcome.txt"] },
  "/home/student": { directories: ["projects"], files: ["notes.txt"] },
  "/home/student/projects": { directories: ["os-lab"], files: ["ideas.md"] },
  "/home/student/projects/os-lab": { directories: [], files: ["scheduler.js", "memory-map.json"] },
  "/etc": { directories: [], files: ["execos.conf", "kernel.conf"] },
  "/var": { directories: ["log"], files: [] },
  "/var/log": { directories: [], files: ["engine.log", "events.log"] },
};

const memoryTechniques = [
  { id: "contiguous", title: "Contiguous allocation", section: "Memory", detail: "One adjacent region per process.", strengths: "Simple address calculation", tradeoff: "External fragmentation", visual: ["PROCESS", "CONTIGUOUS BLOCK", "FREE REGION"], explanation: "The process occupies one continuous physical region. A fitting request needs a sufficiently large free block." },
  { id: "paging", title: "Paging", section: "Storage", detail: "Fixed-size pages map to frames.", strengths: "No external fragmentation", tradeoff: "Page-table overhead", visual: ["VIRTUAL PAGE", "PAGE TABLE", "PHYSICAL FRAME"], explanation: "A page table can map virtual pages to any available physical frames, so a process need not be contiguous in RAM." },
  { id: "segmentation", title: "Segmentation", section: "Storage", detail: "Variable-size logical regions.", strengths: "Matches logical program units", tradeoff: "External fragmentation", visual: ["SEGMENT + OFFSET", "BASE / LIMIT CHECK", "PHYSICAL ADDRESS"], explanation: "A segment table gives each logical region a base and bound; the OS checks the offset before translation." },
  { id: "virtual", title: "Virtual memory", section: "Storage", detail: "Demand-load pages into RAM.", strengths: "Isolation and larger address spaces", tradeoff: "Page-fault latency", visual: ["VIRTUAL ADDRESS", "RESIDENT? · PAGE TABLE", "FRAME OR PAGE FAULT"], explanation: "The process sees a virtual address space; a missing page is brought in on demand and may require replacement." },
];

function MemoryTechniqueLab({ onOpenModule }) {
  const [selected, setSelected] = useState(memoryTechniques[0]);
  const [lab, setLab] = useState("overview");
  const [fixedPartitionInput, setFixedPartitionInput] = useState("100, 200, 300, 400");
  const [fixedRequestInput, setFixedRequestInput] = useState("80, 150, 250, 500");
  const [fixedSizes, setFixedSizes] = useState([100, 200, 300, 400]);
  const [fixedRequests, setFixedRequests] = useState([80, 150, 250, 500]);
  const [fixedError, setFixedError] = useState("");
  const [fixedPartitions, setFixedPartitions] = useState([100, 200, 300, 400].map((size) => ({ size, process: null })));
  const [fixedIndex, setFixedIndex] = useState(0);
  const [fixedMessage, setFixedMessage] = useState("Click Next to place a process into the first available partition that can hold it.");
  const [variableBlocks, setVariableBlocks] = useState([{ size: 1000, process: null }]);
  const [variableIndex, setVariableIndex] = useState(0);
  const [variableMessage, setVariableMessage] = useState("Allocate, release, and compact regions to observe external fragmentation.");
  const [variableCapacityInput, setVariableCapacityInput] = useState("1000");
  const [variableRequestInput, setVariableRequestInput] = useState("220, 350, 180, 300");
  const [variableCapacity, setVariableCapacity] = useState(1000);
  const [variableRequests, setVariableRequests] = useState([220, 350, 180, 300]);
  const [variableError, setVariableError] = useState("");
  const configureFixed = () => {
    try {
      const sizes = parseIntegerList(fixedPartitionInput, "Partition sizes", { min: 1, maxItems: 20 });
      const requests = parseIntegerList(fixedRequestInput, "Process sizes", { min: 1, maxItems: 100 });
      if (sizes.reduce((sum, size) => sum + size, 0) > 1000000) throw new Error("Total partition size cannot exceed 1,000,000 units.");
      setFixedSizes(sizes);
      setFixedRequests(requests);
      setFixedPartitions(sizes.map((size) => ({ size, process: null })));
      setFixedIndex(0);
      setFixedMessage("Workload applied. Allocate each process to the first available partition that can hold it.");
      setFixedError("");
    } catch (error) {
      setFixedError(error.message);
    }
  };
  const configureVariable = () => {
    try {
      const capacity = Number(variableCapacityInput);
      if (!Number.isSafeInteger(capacity) || capacity < 1 || capacity > 1000000) {
        throw new Error("Memory capacity must be a whole number between 1 and 1,000,000 units.");
      }
      const requests = parseIntegerList(variableRequestInput, "Process sizes", { min: 1, maxItems: 100 });
      setVariableCapacity(capacity);
      setVariableRequests(requests);
      setVariableBlocks([{ size: capacity, process: null }]);
      setVariableIndex(0);
      setVariableMessage("Workload applied. Allocate, release, and compact regions to observe external fragmentation.");
      setVariableError("");
    } catch (error) {
      setVariableError(error.message);
    }
  };
  const allocateFixed = () => {
    const size = fixedRequests[fixedIndex];
    if (size === undefined) return;
    const target = fixedPartitions.findIndex((partition) => !partition.process && partition.size >= size);
    if (target >= 0) {
      const partition = fixedPartitions[target];
      setFixedPartitions((blocks) => blocks.map((block, index) => index === target ? { ...block, process: { id: `P${fixedIndex + 1}`, size } } : block));
      setFixedMessage(`P${fixedIndex + 1} (${size}) occupies the ${partition.size}-unit partition; ${partition.size - size} units are internal fragmentation.`);
    } else {
      setFixedMessage(`P${fixedIndex + 1} (${size}) cannot fit in any remaining fixed partition. Free and internally wasted space cannot be combined into one partition.`);
    }
    setFixedIndex((index) => index + 1);
  };
  const allocateVariable = () => {
    const size = variableRequests[variableIndex];
    if (size === undefined) return;
    const target = variableBlocks.findIndex((block) => !block.process && block.size >= size);
    if (target >= 0) {
      const block = variableBlocks[target];
      const next = variableBlocks.slice();
      next.splice(target, 1, { size, process: { id: `P${variableIndex + 1}`, size } }, ...(block.size > size ? [{ size: block.size - size, process: null }] : []));
      setVariableBlocks(next);
      setVariableMessage(`P${variableIndex + 1} is placed in a ${block.size}-unit free region, leaving ${block.size - size} free units adjacent to it.`);
    } else {
      const free = variableBlocks.filter((block) => !block.process);
      const freeTotal = free.reduce((sum, block) => sum + block.size, 0);
      const largest = Math.max(0, ...free.map((block) => block.size));
      setVariableMessage(`P${variableIndex + 1} (${size}) cannot fit: ${freeTotal} units are free in total, but the largest contiguous hole is ${largest}.`);
    }
    setVariableIndex((index) => index + 1);
  };
  const releaseVariable = (index) => {
    const next = variableBlocks.map((block, position) => position === index ? { size: block.size, process: null } : { ...block });
    for (let position = 0; position < next.length - 1;) {
      if (!next[position].process && !next[position + 1].process) {
        next.splice(position, 2, { size: next[position].size + next[position + 1].size, process: null });
      } else position += 1;
    }
    setVariableBlocks(next);
    setVariableMessage("The process was released. Adjacent free regions were coalesced; separated holes remain fragmented.");
  };
  const compactVariable = () => {
    const allocated = variableBlocks.filter((block) => block.process);
    const occupied = allocated.reduce((sum, block) => sum + block.size, 0);
    setVariableBlocks([...allocated, ...(occupied < variableCapacity ? [{ size: variableCapacity - occupied, process: null }] : [])]);
    setVariableMessage("Compaction moved allocated regions together and combined all free space into one contiguous hole.");
  };
  const renderBlocks = (blocks, fixed = false) => <div className="memory-visual" aria-label={fixed ? "Fixed memory partitions" : "Variable memory partitions"}>{blocks.map((block, index) => <div className={`memory-visual-block ${block.process ? "" : "free"}`} style={{ flexGrow: block.size }} key={`${index}-${block.size}`} title={`${block.process ? `${block.process.id} ${block.process.size} units` : "Free"} · region ${block.size}`}><strong>{block.process ? block.process.id : "FREE"}</strong><small>{block.process ? `${block.process.size} used / ${block.size} total` : `${block.size} units free`}</small>{fixed && block.process && <i style={{ flexGrow: Math.max(0, block.size - block.process.size) }}><small>{block.size - block.process.size} internal waste</small></i>}{!fixed && block.process && <button type="button" className="lab-secondary" onClick={() => releaseVariable(index)}>Release {block.process.id}</button>}</div>)}</div>;
  return <div className="concept-lab memory-technique-lab">
    <section className="lab-panel">
    <div className="lab-panel-heading"><div><span className="eyebrow">MEMORY MANAGEMENT OVERVIEW</span><h3>Compare the address-space techniques</h3></div><span>CONCEPT MAP</span></div>
    <div className="translation-tabs" role="group" aria-label="Memory management lab">{[["overview", "Concept overview"], ["mft", "MFT fixed partitions"], ["mvt", "MVT variable partitions"]].map(([key, label]) => <button type="button" className={lab === key ? "selected" : ""} aria-pressed={lab === key} key={key} onClick={() => setLab(key)}>{label}</button>)}</div>
    {lab === "overview" && <>
    <div className="memory-technique-picker" role="group" aria-label="Choose memory technique">{memoryTechniques.map((technique) => <button type="button" className={selected.id === technique.id ? "selected" : ""} aria-pressed={selected.id === technique.id} key={technique.id} onClick={() => setSelected(technique)}>{technique.title}</button>)}</div>
    <div className="memory-technique-flow">{selected.visual.map((item, index) => <div className={`memory-technique-node ${index === 1 ? "focus" : ""}`} key={item}><small>{String(index + 1).padStart(2, "0")}</small><strong>{item}</strong></div>)}</div>
    <p className="memory-technique-detail">{selected.detail} {selected.explanation}</p>
    <div className="memory-technique-facts"><span><small>STRENGTH</small><strong>{selected.strengths}</strong></span><span><small>TRADEOFF</small><strong>{selected.tradeoff}</strong></span></div>
    <button type="button" className="lab-secondary" onClick={() => onOpenModule(selected.section)}>Open {selected.section} simulation ↗</button>
    </>}
    {lab === "mft" && <div className="memory-technique-simulation">
      <div className="translation-controls"><label>Fixed partition sizes<input value={fixedPartitionInput} onChange={(event) => setFixedPartitionInput(event.target.value)} /><small>Positive whole numbers, comma separated</small></label><label>Process sizes<input value={fixedRequestInput} onChange={(event) => setFixedRequestInput(event.target.value)} /><small>Each process needs one whole partition</small></label><button type="button" className="lab-secondary" onClick={configureFixed}>Apply workload</button></div>
      {fixedError && <p className="lab-validation" role="alert">{fixedError}</p>}
      <div className="how-it-works"><span className="eyebrow">MULTIPROGRAMMING WITH A FIXED NUMBER OF TASKS / PARTITIONS</span><p>Partitions are created with fixed sizes. Each process takes one whole partition, so unused space inside it is internal fragmentation. Current requests: {fixedRequests.join(", ")} units.</p><span className="eyebrow">ALLOCATION DECISION</span><p>{fixedMessage}</p></div>{renderBlocks(fixedPartitions, true)}<div className="step-controls"><button type="button" className="lab-primary" onClick={allocateFixed} disabled={fixedError !== "" || fixedIndex >= fixedRequests.length}>Allocate P{fixedIndex + 1} · {fixedRequests[fixedIndex] ?? "complete"}</button><button type="button" className="lab-secondary" onClick={() => { setFixedPartitions(fixedSizes.map((size) => ({ size, process: null }))); setFixedIndex(0); setFixedMessage("Fixed-partition run reset."); }}>Reset run</button><span className="step-counter">{fixedIndex} / {fixedRequests.length} requests processed</span></div><p className="lab-note">MFT can reject a process even if total unused space is large: each request must fit one free partition.</p></div>}
    {lab === "mvt" && <div className="memory-technique-simulation">
      <div className="translation-controls"><label>Total memory capacity<input type="number" min="1" max="1000000" value={variableCapacityInput} onChange={(event) => setVariableCapacityInput(event.target.value)} /></label><label>Process sizes<input value={variableRequestInput} onChange={(event) => setVariableRequestInput(event.target.value)} /><small>Positive whole numbers, comma separated</small></label><button type="button" className="lab-secondary" onClick={configureVariable}>Apply workload</button></div>
      {variableError && <p className="lab-validation" role="alert">{variableError}</p>}
      <div className="how-it-works"><span className="eyebrow">MULTIPROGRAMMING WITH A VARIABLE NUMBER OF TASKS / PARTITIONS</span><p>Each process gets a region sized to its request. Release processes to create external holes, then compare total free memory with the largest contiguous hole. Capacity: {variableCapacity} units; requests: {variableRequests.join(", ")} units.</p><span className="eyebrow">ALLOCATION DECISION</span><p>{variableMessage}</p></div>{renderBlocks(variableBlocks)}<div className="step-controls"><button type="button" className="lab-primary" onClick={allocateVariable} disabled={variableError !== "" || variableIndex >= variableRequests.length}>Allocate P{variableIndex + 1} · {variableRequests[variableIndex] ?? "complete"}</button><button type="button" className="lab-secondary" onClick={compactVariable}>Compact free space</button><button type="button" className="lab-secondary" onClick={() => { setVariableBlocks([{ size: variableCapacity, process: null }]); setVariableIndex(0); setVariableMessage("Variable-partition run reset."); }}>Reset run</button><span className="step-counter">{variableIndex} / {variableRequests.length} requests processed</span></div></div>}
    </section>
  </div>;
}

function DirectoryTreeLab() {
  const [path, setPath] = useState("/");
  const [view, setView] = useState("hierarchical");
  const [singleFiles, setSingleFiles] = useState(["readme.txt", "grades.csv", "kernel.conf"]);
  const [fileName, setFileName] = useState("");
  const [fileError, setFileError] = useState("");
  const current = directoryTree[path];
  const ancestors = path === "/" ? ["/"] : ["/", ...path.slice(1).split("/").map((_, index, parts) => `/${parts.slice(0, index + 1).join("/")}`)];
  const addSingleLevelFile = (event) => {
    event.preventDefault();
    const name = fileName.trim();
    if (!name || name.includes("/") || name === "." || name === "..") {
      setFileError("Enter a file name without a path separator.");
      return;
    }
    if (singleFiles.some((file) => file.toLowerCase() === name.toLowerCase())) {
      setFileError("That name already exists in the single-level directory.");
      return;
    }
    setSingleFiles((files) => [...files, name]);
    setFileName("");
    setFileError("");
  };
  return <section className="lab-panel directory-lab">
    <div className="lab-panel-heading"><div><span className="eyebrow">INTERACTIVE DIRECTORY STRUCTURES</span><h3>{view === "hierarchical" ? "Resolve a path by traversing names" : "Single-level directory"}</h3></div><span>SIMULATED · HOST FILES UNTOUCHED</span></div>
    <div className="translation-tabs" role="group" aria-label="Directory structure">{[["hierarchical", "Hierarchical"], ["single", "Single-level"]].map(([key, label]) => <button type="button" className={view === key ? "selected" : ""} aria-pressed={view === key} key={key} onClick={() => setView(key)}>{label}</button>)}</div>
    {view === "single" ? <><div className="how-it-works"><span className="eyebrow">FLAT NAMESPACE</span><p>Every file lives in one directory, so names must be unique and there are no subdirectory paths. Add or remove entries to explore the namespace.</p></div><form className="syscall-form" onSubmit={addSingleLevelFile}><label>New file name<input value={fileName} onChange={(event) => { setFileName(event.target.value); setFileError(""); }} maxLength={80} /></label><button type="submit" className="lab-primary">Add file</button></form>{fileError && <p className="lab-validation" role="alert">{fileError}</p>}<div className="directory-entries">{singleFiles.map((file) => <div className="directory-entry directory-file" key={file}><span>▤</span><strong>{file}</strong><small>Root-level file <button type="button" className="lab-secondary" onClick={() => setSingleFiles((files) => files.filter((entry) => entry !== file))}>Remove</button></small></div>)}{!singleFiles.length && <p className="answer-placeholder">The directory is empty.</p>}</div></> : <>
    <div className="directory-breadcrumb">{ancestors.map((ancestor) => <button type="button" key={ancestor} className={path === ancestor ? "selected" : ""} onClick={() => setPath(ancestor)}>{ancestor === "/" ? "/" : ancestor.split("/").at(-1)}</button>)}</div>
    <div className="directory-current"><span className="eyebrow">CURRENT DIRECTORY</span><strong>{path}</strong></div>
    <div className="directory-entries">{current.directories.map((directory) => <button type="button" className="directory-entry directory-folder" key={directory} onClick={() => setPath(`${path === "/" ? "" : path}/${directory}`)}><span>▰</span><strong>{directory}/</strong><small>Open directory →</small></button>)}{current.files.map((file) => <div className="directory-entry directory-file" key={file}><span>▤</span><strong>{file}</strong><small>File entry · leaf node</small></div>)}{!current.directories.length && !current.files.length && <p className="answer-placeholder">This directory is empty.</p>}</div>
    <div className="how-it-works"><span className="eyebrow">PATH RESOLUTION</span><p>{path === "/" ? "Start at the root. Choose a child directory and follow the breadcrumb to inspect each path component." : `Each component of ${path} was looked up in its parent directory. Continue into a child or use the breadcrumb to go back.`}</p></div>
    </>}
  </section>;
}

function SynchronizationLab() {
  const [scenario, setScenario] = useState("producer");
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const scenarios = {
    producer: {
      title: "Producer–Consumer · bounded buffer",
      states: [
        { buffer: [], producer: "READY", consumer: "READY", explanation: "The buffer has three slots. Empty counts available slots; full counts items. A mutex protects buffer updates." },
        { buffer: ["A"], producer: "PRODUCED A", consumer: "READY", explanation: "The producer waits for an empty slot, locks the buffer, adds item A, unlocks, then signals that one slot is full." },
        { buffer: ["A"], producer: "READY", consumer: "CONSUMING A", explanation: "The consumer waits for a full slot, locks the same buffer, removes A, unlocks, then signals an empty slot." },
        { buffer: [], producer: "READY", consumer: "CONSUMED A", explanation: "Item A has been consumed. The buffer is empty again; a consumer would block until a producer supplies another item." },
        { buffer: ["B", "C", "D"], producer: "BLOCKED · FULL", consumer: "READY", explanation: "All three slots are full. The producer waits on empty instead of overwriting unread items; consuming one item wakes it." },
        { buffer: ["C", "D", "E"], producer: "PRODUCED E", consumer: "CONSUMED B", explanation: "After the consumer removes B, an empty slot becomes available. The producer can safely append E." },
      ],
    },
    readers: {
      title: "Readers–Writers · shared data",
      states: [
        { readers: [], writer: "READY", data: "Version 1", explanation: "No reader or writer currently holds the resource lock." },
        { readers: ["R1"], writer: "WAITING", data: "Version 1", explanation: "R1 acquires the reader lock. Readers may share access while no writer is modifying the data." },
        { readers: ["R1", "R2"], writer: "WAITING", data: "Version 1", explanation: "R2 joins the read set. Both readers can observe the same stable version concurrently." },
        { readers: ["R1", "R2"], writer: "BLOCKED", data: "Version 1", explanation: "W1 requests exclusive access but must wait until every active reader leaves; writes cannot overlap reads." },
        { readers: ["R2"], writer: "BLOCKED", data: "Version 1", explanation: "R1 finishes and decrements the reader count. W1 still waits because R2 holds a read lock." },
        { readers: [], writer: "WRITING", data: "Version 1 → 2", explanation: "The final reader exits and wakes W1. The writer now has exclusive access to update shared data." },
        { readers: [], writer: "DONE", data: "Version 2", explanation: "W1 releases the write lock after updating the value. Waiting readers and writers may now compete for access." },
      ],
    },
    dining: {
      title: "Dining Philosophers · deadlock and ordering",
      states: [
        { philosophers: ["THINKING", "THINKING", "THINKING", "THINKING", "THINKING"], explanation: "Each philosopher needs both neighboring forks to eat. Forks are exclusive resources shared by neighbors." },
        { philosophers: ["HOLDING LEFT", "THINKING", "THINKING", "THINKING", "THINKING"], explanation: "P0 picks up its left fork. It still needs its right fork before it can eat." },
        { philosophers: ["HOLDING LEFT", "HOLDING LEFT", "THINKING", "THINKING", "THINKING"], explanation: "P1 takes its left fork, which is P0's right fork. P0 now waits while holding one resource." },
        { philosophers: ["HOLDING LEFT", "HOLDING LEFT", "HOLDING LEFT", "HOLDING LEFT", "HOLDING LEFT"], explanation: "If all five pick up their left fork together, each waits for a right fork held by a neighbor: circular wait and deadlock." },
        { philosophers: ["RELEASES FORK", "WAITING", "WAITING", "WAITING", "WAITING"], explanation: "A recovery action releases one held fork so the cycle can break. Recovery avoids the stuck state but discards work." },
        { philosophers: ["EATING", "WAITING", "THINKING", "THINKING", "THINKING"], explanation: "A prevention rule imposes a global fork order: acquire the lower-numbered fork first. This breaks circular wait and allows progress." },
      ],
    },
    mutex: {
      title: "Mutex · critical-section walkthrough",
      states: [
        { owner: "None", p1: "READY", p2: "READY", waiting: "None", explanation: "The mutex is initially unlocked, so either process may acquire it." },
        { owner: "P1", p1: "ACQUIRED", p2: "READY", waiting: "None", explanation: "P1 performs an atomic wait(mutex) and becomes the lock owner." },
        { owner: "P1", p1: "CRITICAL", p2: "READY", waiting: "None", explanation: "P1 enters the critical section while holding the mutex." },
        { owner: "P1", p1: "CRITICAL", p2: "BLOCKED", waiting: "P2", explanation: "P2 attempts wait(mutex); because P1 owns the lock, P2 blocks outside the critical section." },
        { owner: "P2", p1: "READY", p2: "ACQUIRED", waiting: "None", explanation: "P1 leaves and signals the mutex; the waiting P2 can acquire it." },
        { owner: "P2", p1: "READY", p2: "CRITICAL", waiting: "None", explanation: "P2 now enters the protected region; the two processes never overlap inside it." },
        { owner: "None", p1: "DONE", p2: "DONE", waiting: "None", explanation: "P2 exits and releases the mutex. The critical section is available again." },
      ],
    },
  };
  const states = scenarios[scenario].states;
  const state = states[step];
  useEffect(() => {
    if (!playing) return undefined;
    if (step >= states.length - 1) {
      setPlaying(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setStep((value) => value + 1), 800);
    return () => window.clearTimeout(timer);
  }, [playing, step, states.length]);
  const chooseScenario = (value) => { setScenario(value); setStep(0); setPlaying(false); };
  const start = () => { if (step >= states.length - 1) setStep(0); setPlaying(true); };
  return <section className="lab-panel sync-lab">
    <div className="lab-panel-heading"><div><span className="eyebrow">INTERACTIVE SYNCHRONIZATION LAB</span><h3>{scenarios[scenario].title}</h3></div><span>STEP {step + 1} / {states.length}</span></div>
    <div className="translation-tabs" role="group" aria-label="Synchronization scenario">{[["producer", "Producer–Consumer"], ["readers", "Readers–Writers"], ["dining", "Dining Philosophers"], ["mutex", "Mutex"]].map(([key, label]) => <button type="button" className={scenario === key ? "selected" : ""} aria-pressed={scenario === key} key={key} onClick={() => chooseScenario(key)}>{label}</button>)}</div>
    {scenario === "producer" && <div className="sync-process-row"><article className="sync-process"><span>PRODUCER</span><strong>{state.producer}</strong><small>wait(empty) · signal(full)</small></article><div className="sync-critical"><span>BOUNDED BUFFER · 3 SLOTS</span><div className="sync-buffer">{Array.from({ length: 3 }, (_, index) => <span className="translation-cell" key={index}>{state.buffer[index] || "EMPTY"}</span>)}</div><small>{state.buffer.length} full · {3 - state.buffer.length} empty</small></div><article className="sync-process"><span>CONSUMER</span><strong>{state.consumer}</strong><small>wait(full) · signal(empty)</small></article></div>}
    {scenario === "readers" && <div className="sync-process-row"><article className="sync-process"><span>ACTIVE READERS</span><strong>{state.readers.length ? state.readers.join(", ") : "None"}</strong><small>Shared read lock</small></article><div className="sync-critical"><span>SHARED DATA</span><strong>{state.data}</strong><small>Writer: {state.writer}</small></div></div>}
    {scenario === "dining" && <div className="sync-process-row philosopher-row">{state.philosophers.map((status, index) => <article className={`sync-process ${status === "EATING" ? "critical" : status.includes("WAIT") ? "blocked" : ""}`} key={index}><span>PHILOSOPHER</span><strong>P{index}</strong><small>{status}</small></article>)}</div>}
    {scenario === "mutex" && <div className="sync-process-row">
      {[["P1", state.p1], ["P2", state.p2]].map(([pid, status]) => <article className={`sync-process ${status === "CRITICAL" ? "critical" : status === "BLOCKED" ? "blocked" : ""}`} key={pid}><span>PROCESS</span><strong>{pid}</strong><small>{status}</small></article>)}
      <div className={`sync-mutex ${state.owner !== "None" ? "locked" : ""}`}><span>MUTEX</span><strong>{state.owner === "None" ? "UNLOCKED" : `OWNED BY ${state.owner}`}</strong><small>wait / signal</small></div>
    </div>}
    {scenario === "mutex" && <div className="sync-critical"><span>CRITICAL SECTION · SHARED COUNTER</span><strong>{state.p1 === "CRITICAL" ? "P1 updating" : state.p2 === "CRITICAL" ? "P2 updating" : "No process inside"}</strong><small>Waiting process: {state.waiting}</small></div>}
    <div className="how-it-works"><span className="eyebrow">SYNCHRONIZATION EVENT</span><p>{state.explanation}</p></div>
    <div className="step-controls"><button type="button" className="lab-primary" disabled={playing} onClick={start}>{step === states.length - 1 ? "▶ Replay" : "▶ Start"}</button><button type="button" className="lab-secondary" disabled={!playing} onClick={() => setPlaying(false)}>Ⅱ Pause</button><button type="button" className="lab-secondary" disabled={playing || step === 0} onClick={() => setStep((value) => Math.max(0, value - 1))}>← Previous</button><button type="button" className="lab-secondary" disabled={playing || step === states.length - 1} onClick={() => setStep((value) => Math.min(value + 1, states.length - 1))}>⏭ Next event</button><button type="button" className="lab-secondary" onClick={() => { setPlaying(false); setStep(0); }}>↻ Reset</button></div>
  </section>;
}

function AddressTranslationLab() {
  const [mode, setMode] = useState("paging");
  const [address, setAddress] = useState("3456");
  const [segment, setSegment] = useState("1");
  const [pageSizeInput, setPageSizeInput] = useState("1024");
  const [pageTableInput, setPageTableInput] = useState("2, 5, 1, 4");
  const [segments, setSegments] = useState([
    { name: "Code", base: "4000", limit: "600" },
    { name: "Data", base: "8000", limit: "900" },
    { name: "Stack", base: "12000", limit: "512" },
  ]);
  const [references, setReferences] = useState("0, 1, 0, 2, 3, 0, 1");
  const [frameCount, setFrameCount] = useState("3");
  const [tlbCapacity, setTlbCapacity] = useState("2");
  const [tlbStep, setTlbStep] = useState(0);
  const [tlbPlaying, setTlbPlaying] = useState(false);
  const tlbResult = useMemo(() => {
    try {
      const pages = parseIntegerList(references, "TLB page references", { maxItems: 100 });
      return { value: simulateTlb(pages, Number(frameCount), Number(tlbCapacity)), error: "" };
    } catch (error) {
      return { value: null, error: error.message };
    }
  }, [frameCount, references, tlbCapacity]);
  const tlbEvents = tlbResult.value?.events || [];
  const activeTlbEvent = tlbEvents[Math.max(0, tlbStep - 1)];
  const pageTable = useMemo(() => {
    try {
      return { frames: parseIntegerList(pageTableInput, "Page table", { maxItems: 256 }), error: "" };
    } catch (error) {
      return { frames: [], error: error.message };
    }
  }, [pageTableInput]);
  useEffect(() => {
    if (!tlbPlaying) return undefined;
    if (tlbStep >= tlbEvents.length) {
      setTlbPlaying(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setTlbStep((count) => count + 1), 700);
    return () => window.clearTimeout(timer);
  }, [tlbEvents.length, tlbPlaying, tlbStep]);
  const value = Number(address);
  const valid = Number.isSafeInteger(value) && value >= 0;
  const pageSize = Number(pageSizeInput);
  let translation;
  if (!valid) {
    translation = { error: "Enter a non-negative whole-number address." };
  } else if (mode === "paging") {
    try {
      if (pageTable.error) throw new Error(pageTable.error);
      translation = translatePagedAddress(value, pageSize, pageTable.frames);
    } catch (error) {
      translation = { error: error.message };
    }
  } else if (mode === "segmentation") {
    const selected = segments[Number(segment)];
    try {
      translation = translateSegmentedAddress(value, {
        ...selected,
        base: String(selected?.base ?? "").trim() ? Number(selected.base) : NaN,
        limit: String(selected?.limit ?? "").trim() ? Number(selected.limit) : NaN,
      });
    } catch (error) {
      translation = { error: error.message };
    }
  }
  return <section className="lab-panel address-lab">
    <div className="lab-panel-heading"><div><span className="eyebrow">ADDRESS TRANSLATION</span><h3>Paging, segmentation & TLB</h3></div><span>INPUT-DRIVEN DEMO</span></div>
    <div className="translation-tabs" role="group" aria-label="Address translation mode"><button type="button" className={mode === "paging" ? "selected" : ""} aria-pressed={mode === "paging"} onClick={() => setMode("paging")}>Paging</button><button type="button" className={mode === "segmentation" ? "selected" : ""} aria-pressed={mode === "segmentation"} onClick={() => setMode("segmentation")}>Segmentation</button><button type="button" className={mode === "tlb" ? "selected" : ""} aria-pressed={mode === "tlb"} onClick={() => setMode("tlb")}>TLB & page faults</button></div>
    {mode === "tlb" ? <>
      <div className="translation-controls"><label>Page-reference string<input value={references} onChange={(event) => { setReferences(event.target.value); setTlbStep(0); setTlbPlaying(false); }} /><small>Non-negative page numbers, comma separated</small></label><label>Physical frames<input type="number" min="1" max="32" value={frameCount} onChange={(event) => { setFrameCount(event.target.value); setTlbStep(0); setTlbPlaying(false); }} /></label><label>TLB entries<input type="number" min="1" max="16" value={tlbCapacity} onChange={(event) => { setTlbCapacity(event.target.value); setTlbStep(0); setTlbPlaying(false); }} /></label></div>
      {tlbResult.error ? <p className="translation-error" role="alert">{tlbResult.error}</p> : <>
        <div className="how-it-works"><span className="eyebrow">PAGE TABLE + TLB WALK · {tlbStep} / {tlbEvents.length}</span><p>{activeTlbEvent?.explanation || "Advance one reference to check the TLB, consult the page table, and resolve a page fault if needed."}</p></div>
        <div className="translation-map"><span>PHYSICAL FRAMES · FIFO DEMAND PAGING</span>{Array.from({ length: Number(frameCount) }, (_, index) => <div className={`translation-cell ${activeTlbEvent?.frameIndex === index ? "active" : ""}`} key={index}><small>FRAME {index}</small><b>{activeTlbEvent?.frames[index] ?? "EMPTY"}</b></div>)}</div>
        <div className="translation-map"><span>TLB · MOST RECENT FIRST</span>{Array.from({ length: Number(tlbCapacity) }, (_, index) => <div className="translation-cell" key={index}><small>ENTRY {index + 1}</small><b>{activeTlbEvent?.tlb[index] ? `PAGE ${activeTlbEvent.tlb[index].page} → FRAME ${activeTlbEvent.tlb[index].frame}` : "EMPTY"}</b></div>)}</div>
        {activeTlbEvent && <div className="translation-result"><span>REFERENCE {activeTlbEvent.index + 1} · PAGE {activeTlbEvent.page} · {activeTlbEvent.tlbHit ? "TLB HIT" : "TLB MISS"} · {activeTlbEvent.pageFault ? "PAGE FAULT" : "PAGE RESIDENT"}</span><strong>FRAME {activeTlbEvent.frameIndex} · {activeTlbEvent.faults} cumulative faults · {activeTlbEvent.tlbHits} TLB hits</strong></div>}
        <div className="step-controls"><button type="button" className="lab-primary" disabled={tlbPlaying || !tlbEvents.length} onClick={() => { if (tlbStep >= tlbEvents.length) setTlbStep(0); setTlbPlaying(true); }}>{tlbStep >= tlbEvents.length ? "↻ Replay" : "▶ Start"}</button><button type="button" className="lab-secondary" disabled={!tlbPlaying} onClick={() => setTlbPlaying(false)}>Ⅱ Pause</button><button type="button" className="lab-secondary" disabled={tlbPlaying || tlbStep === 0} onClick={() => setTlbStep((count) => Math.max(0, count - 1))}>← Previous</button><button type="button" className="lab-secondary" disabled={tlbPlaying || tlbStep >= tlbEvents.length} onClick={() => setTlbStep((count) => count + 1)}>⏭ Next</button><button type="button" className="lab-secondary" onClick={() => { setTlbPlaying(false); setTlbStep(0); }}>↻ Reset</button></div>
      </>}
    </> : <>
    <div className="translation-controls"><label>{mode === "paging" ? "Virtual address" : "Segment offset"}<input type="number" min="0" value={address} onChange={(event) => setAddress(event.target.value)} /></label>{mode === "paging" ? <><label>Page size<input type="number" min="1" max="1000000" value={pageSizeInput} onChange={(event) => setPageSizeInput(event.target.value)} /></label><label>Page table · frame per page<input value={pageTableInput} onChange={(event) => setPageTableInput(event.target.value)} /><small>Non-negative frame numbers, comma separated</small></label></> : <><label>Segment<select value={segment} onChange={(event) => setSegment(event.target.value)}>{segments.map((item, index) => <option value={index} key={item.name}>{item.name}</option>)}</select></label><label>Segment base<input type="number" min="0" value={segments[Number(segment)]?.base ?? ""} onChange={(event) => setSegments((current) => current.map((item, index) => index === Number(segment) ? { ...item, base: event.target.value } : item))} /></label><label>Segment limit<input type="number" min="1" value={segments[Number(segment)]?.limit ?? ""} onChange={(event) => setSegments((current) => current.map((item, index) => index === Number(segment) ? { ...item, limit: event.target.value } : item))} /></label></>}</div>
    {mode === "paging" ? <div className="translation-map"><span>Virtual pages · configured page table</span>{pageTable.frames.map((frame, page) => <div className={`translation-cell ${translation.page === page && !translation.error ? "active" : ""}`} key={page}><small>PAGE {page}</small><b>→ FRAME {frame}</b></div>)}</div> : <div className="translation-map"><span>Segment table</span>{segments.map(({ name, base, limit }, index) => <div className={`translation-cell ${segment === String(index) ? "active" : ""}`} key={name}><small>{name.toUpperCase()} · BASE {base}</small><b>LIMIT {limit}</b></div>)}</div>}
    {translation.error ? <p className="translation-error" role="status">{translation.error}</p> : <div className="translation-result"><span>{mode === "paging" ? `PAGE ${translation.page} × ${translation.pageSize} + OFFSET ${translation.offset}` : `${translation.segment} BASE ${translation.base} + OFFSET ${translation.offset}`}</span><strong>PHYSICAL ADDRESS · {translation.physical}</strong></div>}
    </>}
  </section>;
}

function FlowVisualization({ title, steps, step, onStepChange }) {
  const current = steps[step];
  return <section className="lab-panel concept-visual-panel">
    <div className="lab-panel-heading"><div><span className="eyebrow">STEP-THROUGH VISUALIZATION</span><h3>{title}</h3></div><span>{step + 1} / {steps.length}</span></div>
    <div className="concept-flow">{steps.map(([label], index) => <div className={`concept-flow-step ${index === step ? "active" : index < step ? "visited" : ""}`} key={label}><span>{String(index + 1).padStart(2, "0")}</span><strong>{label}</strong></div>)}</div>
    <div className="how-it-works"><span className="eyebrow">WHAT HAPPENS AT THIS STEP</span><p>{current[1]}</p></div>
    <div className="step-controls"><button type="button" className="lab-secondary" onClick={() => onStepChange(Math.max(0, step - 1))} disabled={step === 0}>← Previous</button><button type="button" className="lab-primary" onClick={() => onStepChange((step + 1) % steps.length)}>{step === steps.length - 1 ? "↻ Replay" : "Next step →"}</button></div>
  </section>;
}

function VisualizationGuide({ category }) {
  const guide = visualizationGuides[category];
  if (!guide) throw new Error(`Missing visualization guide for ${category}.`);
  return <aside className="lab-panel visualization-guide">
    <div><span className="eyebrow">HOW TO READ THIS VISUALIZATION</span><p>{guide.summary}</p></div>
    <ul>{guide.focus.map((item) => <li key={item}>{item}</li>)}</ul>
    <small>{guide.scope}</small>
  </aside>;
}

function ConceptDiagram({ title, step, steps, onStepChange }) {
  const node = (label, detail, stepIndex, key = label) => (
    <div className={`concept-diagram-node ${stepIndex === step ? "active" : stepIndex < step ? "visited" : ""}`} key={key}>
      <strong>{label}</strong>
      <span>{detail}</span>
    </div>
  );
  const flow = (nodes) => <div className="concept-diagram-flow">{nodes.map(([label, detail, stepIndex], index) => (
    <Fragment key={label}>
      {node(label, detail, stepIndex)}
      {index < nodes.length - 1 && <span className="concept-diagram-arrow" aria-hidden="true">→</span>}
    </Fragment>
  ))}</div>;
  const label = `${title} concept diagram`;
  let diagram;

  if (title === "Process lifecycle") {
    diagram = <>
      {flow([["NEW", "admitted", 0], ["READY", "waiting for CPU", 1], ["RUNNING", "using the CPU", 2], ["TERMINATED", "resources released", 4]])}
      <div className="concept-diagram-branch-label">A running process may block for an event</div>
      {flow([["RUNNING", "I/O request", 2], ["WAITING", "event in progress", 3], ["READY", "event completed", 1]])}
    </>;
  } else if (title === "Virtual memory") {
    diagram = <>
      {flow([["PROCESS", "virtual address", 0], ["MMU", "translate address", 1], ["PAGE TABLE", "find page mapping", 1], ["FRAME", "physical memory", 2]])}
      <div className="concept-diagram-branch-label">If the page is not resident</div>
      {flow([["PAGE TABLE", "no resident mapping", 1], ["PAGE FAULT", "OS loads page", 3], ["FRAME", "mapping is updated", 3]])}
    </>;
  } else if (title === "Paging & segmentation") {
    diagram = <>
      <div className="concept-diagram-lane"><b>Paging</b>{flow([["ADDRESS", "page + offset", 0], ["PAGE TABLE", "page → frame", 2], ["PHYSICAL", "frame + offset", 3]])}</div>
      <div className="concept-diagram-lane"><b>Segmentation</b>{flow([["ADDRESS", "segment + offset", 1], ["DESCRIPTOR", "base + limit", 2], ["PHYSICAL", "base + offset", 3]])}</div>
    </>;
  } else if (title === "Synchronization & IPC") {
    diagram = <>
      {flow([["P1 · SENDER", "prepare data", 0], ["IPC METHOD", "message or shared memory", 1], ["P2 · RECEIVER", "read data", 3]])}
      <div className="concept-diagram-lane"><b>Message passing</b>{flow([["P1", "send(message)", 0], ["KERNEL QUEUE", "buffer / deliver", 2], ["P2", "receive(message)", 3]])}</div>
      <div className="concept-diagram-lane"><b>Shared memory</b>{flow([["P1", "write shared region", 0], ["MUTEX / SEMAPHORE", "coordinate access", 1], ["P2", "read shared region", 3]])}</div>
    </>;
  } else if (title === "Process synchronization") {
    diagram = <>
      {flow([["P1 + P2", "compete for lock", 0], ["MUTEX", "one owner at a time", 1], ["CRITICAL SECTION", "protected shared update", 2]])}
      <div className="concept-diagram-branch-label">The second process waits until the lock is released</div>
      {flow([["P2", "blocked while P1 owns lock", 3], ["MUTEX", "P1 releases ownership", 4], ["P2", "acquires lock and proceeds", 5]])}
    </>;
  } else if (title === "System-call boundary") {
    diagram = flow([["USER MODE", "application request", 0], ["TRAP / SYSCALL", "controlled entry", 1], ["KERNEL MODE", "validate and perform service", 2], ["RETURN", "result or error", 3]]);
  } else if (title === "Files & devices") {
    diagram = flow([["PROCESS", "read or write request", 0], ["OS LAYER", "resolve and check access", 1], ["DEVICE QUEUE", "driver schedules I/O", 2], ["COMPLETION", "wake waiting process", 3]]);
  } else if (title === "Directory structures") {
    diagram = <div className="concept-directory-tree" role="list" aria-label="Example directory hierarchy">
      {node("/", "root directory", 0)}
      <span aria-hidden="true">↓</span>
      {node("home/", "directory entry", 1)}
      <span aria-hidden="true">↓</span>
      {node("student/", "subdirectory", 2)}
      <span aria-hidden="true">↓</span>
      {node("notes.txt", "resolved file", 3)}
    </div>;
  } else {
    diagram = flow([["OPERATION", "request begins", 0], ["EVENT", "Engine records action", 1], ["STATE CHANGE", "subsystem is updated", 2], ["TRACE", "inspect the recorded result", 3]]);
  }

  const current = steps[step];
  return <section className="concept-model-panel" role="group" aria-label={label}>
    <div className="concept-model-heading"><div><span className="eyebrow">INTERACTIVE CONCEPT MODEL</span><strong>{title}</strong></div><span>Step {step + 1} of {steps.length}</span></div>
    <div className="concept-model-canvas">{diagram}</div>
    <div className="how-it-works"><span className="eyebrow">{current[0]}</span><p>{current[1]}</p></div>
    <div className="step-controls">
      <button type="button" className="lab-secondary" onClick={() => onStepChange(Math.max(0, step - 1))} disabled={step === 0}>← Previous</button>
      <button type="button" className="lab-primary" onClick={() => onStepChange((step + 1) % steps.length)}>{step === steps.length - 1 ? "↻ Replay" : "Next step →"}</button>
    </div>
  </section>;
}

const systemCallExamples = {
  sys_open: { path: "/ExecOS/system/kernel.conf" },
  sys_read: { fd: 3 },
  sys_write: { fd: 3, content: "ExecOS learning lab" },
  sys_close: { fd: 3 },
  sys_create_process: { name: "lab-worker", burst_time: 3, priority: 5, memory_mb: 32 },
  sys_terminate_process: { pid: "P104" },
  sys_allocate_memory: { pid: "P101", size_mb: 64 },
  sys_release_memory: { pid: "P101", size_mb: 64 },
};

function SystemCallLab({ engineState, onRunSystemCall, onOpenModule }) {
  const [view, setView] = useState("engine");
  const [name, setName] = useState("sys_open");
  const [argumentsText, setArgumentsText] = useState(JSON.stringify(systemCallExamples.sys_open, null, 2));
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [lifecycleStep, setLifecycleStep] = useState(0);
  const lifecycle = [
    { operation: "fork()", parent: "RUNNING", child: "CREATED", explanation: "fork creates a child process with a separate process identity and inherited execution context. The parent receives the child ID; the child receives a zero return value." },
    { operation: "exec()", parent: "RUNNING", child: "NEW PROGRAM", explanation: "The child calls exec to replace its process image with a new program. The process identity remains; its code, data, stack, and arguments are replaced." },
    { operation: "wait()", parent: "BLOCKED IN WAIT", child: "RUNNING", explanation: "The parent waits for the child to finish. It blocks or reaps an already-terminated child, depending on timing." },
    { operation: "exit()", parent: "AWAKENED / REAPS", child: "TERMINATED", explanation: "The child exits with a status. The kernel records the status and wakes the waiting parent, which collects it with wait." },
  ];
  const steps = [
    ["USER REQUEST", "Choose a supported system call and prepare its arguments in the user-facing request."],
    ["VALIDATE", "ExecOS checks the call name, JSON arguments, process IDs, paths, and resource limits."],
    ["ENGINE SERVICE", "The authenticated Kernel Engine performs the selected simulated OS service."],
    ["RESULT & TRACE", "The result is returned to the UI and the Engine records supported actions in its execution history."],
  ];
  async function invoke() {
    setError("");
    setResult(null);
    let args;
    try {
      args = JSON.parse(argumentsText);
      if (!args || Array.isArray(args) || typeof args !== "object") throw new Error("Arguments must be a JSON object.");
    } catch (caught) {
      setError(`Arguments must be a valid JSON object: ${caught.message}`);
      setStep(1);
      return;
    }
    setBusy(true);
    try {
      const response = await onRunSystemCall(name, args);
      setResult(response);
      setStep(3);
    } catch (caught) {
      setError(caught.message);
      setStep(1);
    } finally {
      setBusy(false);
    }
  }
  return <div className="concept-lab">
    <FlowVisualization title="System-call request path" steps={steps} step={step} onStepChange={setStep} />
    <section className="lab-panel syscall-lab">
      <div className="lab-panel-heading"><div><span className="eyebrow">{view === "engine" ? "LIVE EXECOS KERNEL ENGINE" : "CONCEPTUAL PROCESS MODEL"}</span><h3>{view === "engine" ? "Invoke a supported system call" : "Model process creation and exit"}</h3></div><span>{view === "engine" ? engineState ? `ENGINE TICK ${engineState.engine.clock_tick}` : "ENGINE UNAVAILABLE" : "SIMULATION ONLY"}</span></div>
      <div className="translation-tabs" role="group" aria-label="System call lab mode"><button type="button" className={view === "engine" ? "selected" : ""} aria-pressed={view === "engine"} onClick={() => setView("engine")}>Supported Engine calls</button><button type="button" className={view === "lifecycle" ? "selected" : ""} aria-pressed={view === "lifecycle"} onClick={() => setView("lifecycle")}>fork · exec · wait · exit</button></div>
      {view === "engine" && <>
      <div className="syscall-form">
        <label>System call<select value={name} disabled={busy} onChange={(event) => { const nextName = event.target.value; setName(nextName); setArgumentsText(JSON.stringify(systemCallExamples[nextName], null, 2)); setResult(null); setError(""); setStep(0); }}>{Object.keys(systemCallExamples).map((call) => <option key={call} value={call}>{call}</option>)}</select></label>
        <label>Arguments JSON<textarea rows={5} spellCheck="false" value={argumentsText} disabled={busy} onChange={(event) => { setArgumentsText(event.target.value); setResult(null); setError(""); setStep(0); }} /></label>
        <div className="step-controls"><button type="button" className="lab-primary" onClick={invoke} disabled={busy || !engineState}>{busy ? "Invoking…" : "Invoke in simulated Engine"}</button><button type="button" className="lab-secondary" onClick={() => onOpenModule("System Calls")}>Open full syscall workbench ↗</button><span className="step-counter">Simulation only · does not call host OS APIs</span></div>
      </div>
      {error && <p className="lab-validation" role="alert">{error}</p>}
      {result && <div className="syscall-result" role="status"><div><span className="eyebrow">ENGINE RESULT</span><strong>{result.status || "Call completed"}</strong></div><pre>{JSON.stringify(result, null, 2)}</pre></div>}
      </>}
      {view === "lifecycle" && <div className="syscall-lifecycle"><div className="lab-panel-heading"><div><span className="eyebrow">CONCEPTUAL PROCESS LIFECYCLE</span><h3>{lifecycle[lifecycleStep].operation}</h3></div><span>STEP {lifecycleStep + 1} / {lifecycle.length}</span></div><div className="sync-process-row"><article className="sync-process"><span>PARENT</span><strong>P1</strong><small>{lifecycle[lifecycleStep].parent}</small></article><div className="sync-mutex"><span>SYSTEM CALL</span><strong>{lifecycle[lifecycleStep].operation}</strong><small>user mode → kernel mode → return</small></div><article className="sync-process"><span>CHILD</span><strong>P2</strong><small>{lifecycle[lifecycleStep].child}</small></article></div><div className="how-it-works"><span className="eyebrow">PROCESS CONTROL</span><p>{lifecycle[lifecycleStep].explanation}</p></div><div className="step-controls"><button type="button" className="lab-secondary" disabled={lifecycleStep === 0} onClick={() => setLifecycleStep((index) => index - 1)}>← Previous</button><button type="button" className="lab-primary" onClick={() => setLifecycleStep((index) => (index + 1) % lifecycle.length)}>{lifecycleStep === lifecycle.length - 1 ? "↻ Replay" : "Next lifecycle event →"}</button><span className="step-counter">Concept only · fork/exec/wait/exit are not supported Engine calls</span></div></div>}
    </section>
  </div>;
}

function ConceptLab({ category, onOpenModule, engineState, onRunSystemCall }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [step, setStep] = useState(0);
  const systemCallSteps = [
    ["USER PROGRAM", "The application invokes a library wrapper to request an OS service."],
    ["SYSCALL INSTRUCTION", "A controlled trap changes execution to the kernel entry point."],
    ["KERNEL VALIDATION", "The kernel checks the operation, arguments, and access rights."],
    ["SERVICE & RETURN", "The OS performs the service and returns a value or error to user mode."],
  ];
  const visual = category === "System Calls"
    ? { title: "System-call request path", section: "System Calls", steps: systemCallSteps }
    : conceptVisuals[selectedIndex];
  useEffect(() => {
    setSelectedIndex(0);
    setStep(0);
  }, [category]);
  if (category === "Process Synchronization") return <div className="concept-lab"><SynchronizationLab /></div>;
  if (category === "Memory Management Techniques") return <div className="concept-lab"><MemoryTechniqueLab onOpenModule={onOpenModule} /></div>;
  if (category === "Paging & Segmentation") return <div className="concept-lab"><AddressTranslationLab /></div>;
  if (category === "Hierarchical File Organization") return <div className="concept-lab"><DirectoryTreeLab /></div>;
  if (category === "System Calls") return <SystemCallLab engineState={engineState} onRunSystemCall={onRunSystemCall} onOpenModule={onOpenModule} />;
  return <div className="concept-lab">
    {category === "OS Concepts" && <div className="concept-topic-picker" role="group" aria-label="Choose an OS concept">{conceptVisuals.map((item, index) => <button type="button" className={selectedIndex === index ? "selected" : ""} aria-pressed={selectedIndex === index} key={item.title} onClick={() => { setSelectedIndex(index); setStep(0); }}>{item.title}</button>)}</div>}
    {category === "OS Concepts"
      ? <ConceptDiagram title={visual.title} step={step} steps={visual.steps} onStepChange={setStep} />
      : <FlowVisualization title={visual.title} steps={visual.steps} step={step} onStepChange={setStep} />}
    <section className="lab-panel concept-context"><div><span className="eyebrow">EXECOS WORKBENCH</span><p>{category === "System Calls" ? "The live Engine exposes a limited authenticated system-call interface; invoking it changes only simulated Engine state and is recorded in the trace." : `Connect this concept to the real, isolated ExecOS ${visual.section} Engine module and inspect its state and trace.`}</p></div><button type="button" className="lab-secondary" onClick={() => onOpenModule(visual.section)}>Open {visual.section} module ↗</button></section>
  </div>;
}

export default function AlgorithmStudio({ category, onCategoryChange, onOpenModule, engineState, onRunEngineScheduler, onRunSystemCall, onProgress, onQuizComplete }) {
  const [stage, setStage] = useState("visualize");
  const [visitedStages, setVisitedStages] = useState(["visualize"]);
  const [algorithm, setAlgorithm] = useState(algorithmOptions[category]?.[0]?.[0] || "");
  const [inputs, setInputs] = useState(initialInputs);
  const [stepCount, setStepCount] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [runError, setRunError] = useState("");
  const [engineMessage, setEngineMessage] = useState("");
  const [engineBusy, setEngineBusy] = useState(false);
  const [algorithmInfoTab, setAlgorithmInfoTab] = useState("description");
  const options = algorithmOptions[category] || [];
  const result = useMemo(() => {
    if (!options.length) return { value: null, error: "" };
    try {
      return { value: calculate(category, algorithm, inputs), error: "" };
    } catch (error) {
      return { value: null, error: error.message };
    }
  }, [algorithm, category, inputs, options.length]);
  const simulation = result.value;
  const events = simulation?.events || [];
  const complete = Boolean(simulation) && stepCount >= events.length;
  const activeStep = events[Math.max(0, stepCount - 1)] || null;
  const stageDetails = {
    visualize: ["01", "Explore the simulation", "Set an example workload and follow each decision as it happens."],
    theory: ["02", "Understand the concept", "Connect the visualization to the OS rules and real-world behavior."],
    quiz: ["03", "Check your understanding", "Practice, see explanations, and review your result."],
  };
  function goToStage(nextStage) {
    setVisitedStages((current) => current.includes(nextStage) ? current : [...current, nextStage]);
    setStage(nextStage);
  }
  const openLearningTopic = (topic) => {
    onCategoryChange(topic);
    goToStage("visualize");
  };

  useEffect(() => {
    setAlgorithm(algorithmOptions[category]?.[0]?.[0] || "");
    setStepCount(0);
    setPlaying(false);
    setRunError("");
    setStage("visualize");
    setVisitedStages(["visualize"]);
    setAlgorithmInfoTab("description");
  }, [category]);
  useEffect(() => {
    if (stage === "visualize") onProgress?.(category, { visualization_visited: true });
    if (stage === "theory") onProgress?.(category, { lesson_visited: true });
  }, [category, onProgress, stage]);
  useEffect(() => {
    setStepCount(0);
    setPlaying(false);
    setRunError("");
    setEngineMessage("");
  }, [algorithm, inputs]);
  useEffect(() => {
    if (!playing || !simulation) return undefined;
    if (stepCount >= events.length) {
      setPlaying(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setStepCount((count) => Math.min(count + 1, events.length)), 650);
    return () => window.clearTimeout(timer);
  }, [events.length, playing, simulation, stepCount]);

  function step() {
    if (!simulation) {
      setRunError(result.error || "Correct the inputs before running this simulation.");
      return;
    }
    setRunError("");
    setPlaying(false);
    setStepCount((count) => Math.min(count + 1, events.length));
  }

  function start() {
    if (!simulation) {
      setRunError(result.error || "Correct the inputs before running this simulation.");
      return;
    }
    if (!events.length) return;
    setRunError("");
    if (complete) setStepCount(0);
    setPlaying(true);
  }

  async function runOnEngine() {
    if (!onRunEngineScheduler || engineBusy) return;
    setEngineBusy(true);
    setEngineMessage("");
    try {
      const response = await onRunEngineScheduler(algorithm, Number(inputs.quantum));
      setEngineMessage(`${response.algorithm.toUpperCase()} ran on the shared Engine workload. Its result is recorded in the Execution Trace.`);
    } catch (error) {
      setRunError(error.message);
    } finally {
      setEngineBusy(false);
    }
  }

  const moduleLink = category === "CPU Scheduling" ? "CPU" : category === "Memory Management" ? "Memory" :
    category === "Page Replacement" ? "Storage" : category === "Deadlock" ? "Deadlocks" :
      category === "File Management" ? "File System" : null;

  return <div className="view-content engine-view algorithm-studio">
    <section className={`studio-header module-visualizer-hero ${category === "CPU Scheduling" ? "cpu-visualizer-hero" : ""}`}><div><span className="eyebrow">EXECOS · OPERATING SYSTEM LEARNING LAB</span><h2>{category === "CPU Scheduling" ? "CPU Scheduling Visualizer" : `${category} Learning Lab`}</h2><p>{category === "CPU Scheduling" ? "Run a workload, follow each scheduling decision, then learn the concept and take its 20-question quiz." : `Explore ${category.toLowerCase()} with an interactive lab, a clear concept guide, and a 20-question quiz.`}</p></div><span className="studio-engine-state"><i className={`status-dot ${engineState ? "online" : "offline"}`} />{engineState ? "Engine connected" : "Engine unavailable"}</span></section>
    <div className="category-picker" role="group" aria-label="Choose a learning module">{categories.map((item) => <button type="button" key={item} className={category === item ? "selected" : ""} aria-pressed={category === item} onClick={() => onCategoryChange(item)}>{item}</button>)}</div>
    <section className="studio-module-heading"><div className="studio-module-copy"><span className="eyebrow">LEARNING MODULE {String(categories.indexOf(category) + 1).padStart(2, "0")} <i /> {String(categories.length).padStart(2, "0")}</span><h2>{category}</h2><p>{descriptions[category]?.purpose || (category === "OS Concepts" ? "Explore the ideas that connect processes, memory, files, and devices." : "Use the existing ExecOS Engine module for real, traceable operations.")}</p></div><nav className="learning-path" aria-label="Learning steps">{Object.entries(stageDetails).map(([id, [number, label, hint]]) => <button type="button" key={id} className={`${stage === id ? "active" : ""} ${visitedStages.includes(id) ? "visited" : ""}`} aria-current={stage === id ? "step" : undefined} aria-pressed={stage === id} onClick={() => goToStage(id)}><span className="learning-step-number">{visitedStages.includes(id) && stage !== id ? "✓" : number}</span><span className="learning-step-copy"><strong>{label}</strong><small>{hint}</small></span></button>)}</nav></section>
    {stage === "visualize" && <VisualizationGuide category={category} />}
    {stage === "theory" ? <><TheoryView category={category} algorithm={algorithm} onOpenModule={onOpenModule} onOpenTopic={openLearningTopic} /><div className="learning-step-actions"><button type="button" className="lab-secondary" onClick={() => goToStage("visualize")}>← Back to visualization</button><button type="button" className="lab-primary" onClick={() => goToStage("quiz")}>Take the 20-question quiz →</button></div></> :
      stage === "quiz" ? <PracticePanel key={category} category={category} onReview={goToStage} onComplete={(score, total) => onQuizComplete?.(category, score, total)} /> :
      !options.length ? ["System Calls", "OS Concepts", "Process Synchronization", "Memory Management Techniques", "Paging & Segmentation", "Hierarchical File Organization"].includes(category) ? <ConceptLab category={category} onOpenModule={onOpenModule} engineState={engineState} onRunSystemCall={onRunSystemCall} /> : <TheoryView category={category} algorithm={algorithm} onOpenModule={onOpenModule} /> :
        <div className={`studio-columns ${category === "CPU Scheduling" ? "cpu-scheduling-layout" : ""}`}>
          <div className="studio-main-column">
            <section className="lab-panel simulator-panel">
              {category === "CPU Scheduling" && <div className="cpu-policy-intro">
                <span className="eyebrow">SELECTED SCHEDULER</span>
                <h3>{getAlgorithmName(category, algorithm)}</h3>
                <p>{cpuPolicyGuide[algorithm]?.description}</p>
                <strong>How it works</strong>
                <ul>{cpuPolicyGuide[algorithm]?.how.map((step, index) => <li key={index}>{step}</li>)}</ul>
              </div>}
              <div className="lab-panel-heading"><div><span className="eyebrow">CONFIGURE YOUR RUN</span><h3>Set inputs & choose a policy</h3></div><span className="input-badge">Validated inputs</span></div>
              <div className="algorithm-select-row"><label>Algorithm<select value={algorithm} onChange={(event) => setAlgorithm(event.target.value)}>{options.map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label><div className="algorithm-complexity"><small>TIME</small><b>{getComplexity(category, algorithm).time}</b><small>SPACE</small><b>{getComplexity(category, algorithm).space}</b></div></div>
              <SimulatorInputs category={category} algorithm={algorithm} inputs={inputs} setInputs={setInputs} />
              {result.error && <p className="lab-validation" role="alert">{result.error}</p>}
              {category === "CPU Scheduling" && <p className="lab-note">Use priority 1–10 for Priority scheduling (1 is highest). The other policies accept rows with or without the final priority value. Non-preemptive Priority is an educational lab policy; it is not exposed by the shared Engine API.</p>}
              {category === "Disk Scheduling" && <p className="lab-note">SCAN and C-SCAN include boundary travel; the wrap jump is shown and counted as head movement. LOOK and C-LOOK turn at the last request.</p>}
              <div className="step-controls"><button type="button" className="lab-primary" onClick={start} disabled={playing || !simulation || !events.length}>{playing ? "Running…" : complete && events.length ? "↻ Replay" : category === "CPU Scheduling" ? "▶ Simulate" : "▶ Start"}</button><button type="button" className="lab-secondary" onClick={() => setPlaying(false)} disabled={!playing}>Ⅱ Pause</button><button type="button" className="lab-secondary" onClick={step} disabled={!simulation || complete || !events.length}>⏭ Next step</button><button type="button" className="lab-secondary" onClick={() => { setPlaying(false); setStepCount(0); setRunError(""); if (category === "CPU Scheduling") setInputs((current) => ({ ...current, processes: initialInputs.processes, quantum: initialInputs.quantum })); }}>↻ Reset</button><span className="step-counter">{simulation ? `${stepCount} / ${events.length} steps` : "Fix inputs to continue"}</span></div>
            </section>
          </div>
          <aside className="studio-side-column">
            {category !== "CPU Scheduling" && simulation && <section className="lab-panel visualization-panel"><div className="lab-panel-heading"><div><span className="eyebrow">SIMULATION RESULTS · LIVE VISUALIZATION</span><h3>{getAlgorithmName(category, algorithm)}</h3></div>{complete && <span className="complete-badge">SIMULATION COMPLETE</span>}</div>
              {category === "Disk Scheduling" && <DiskVisualization result={simulation} stepCount={stepCount} />}
              {category === "Page Replacement" && <PageVisualization events={events.slice(0, stepCount)} frameCount={Number(inputs.frames)} algorithm={algorithm} />}
              {category === "Memory Management" && <MemoryVisualization blocks={(events[Math.max(0, stepCount - 1)]?.blocks || inputs.blocks.split(/[\s,]+/).filter(Boolean).map((size, index) => ({ id: `B${index + 1}`, size: Number(size), free: Number(size), allocations: [] })))} total={simulation.allocated + simulation.free} />}
              {category === "Deadlock" && <ResourceVisualization result={{ ...simulation, events: simulation.events.slice(0, stepCount) }} complete={complete} />}
              {category === "File Management" && <FileVisualization result={stepCount ? { ...simulation, blocks: events[stepCount - 1]?.disk || simulation.blocks } : { ...simulation, blocks: Array(Number(inputs.diskBlocks)).fill(null) }} />}
              <div className="how-it-works"><span className="eyebrow">HOW IT WORKS · STEP {stepCount || 0}</span><p>{activeStep?.explanation || (complete ? "Every input has been processed. Review the final metrics and result table below." : "Press Simulate to play automatically or Next step to advance one decision at a time.")}</p></div>
              {complete && <ResultMetrics category={category} result={simulation} />}
              {complete && <ResultTable category={category} result={simulation} stepCount={stepCount} />}
            </section>}
            {category !== "CPU Scheduling" && simulation && <ComparisonTable category={category} algorithm={algorithm} inputs={inputs} result={simulation} />}
            {category === "CPU Scheduling" && simulation && <section className="lab-panel visualization-panel cpu-results-panel"><div className="lab-panel-heading"><div><span className="eyebrow">SIMULATION RESULTS</span><h3>{getAlgorithmName(category, algorithm)}</h3></div>{complete && <span className="complete-badge">SIMULATION COMPLETE</span>}</div>
              <CPUProcessStateVisualization events={events} stepCount={stepCount} result={simulation} algorithm={algorithm} />
              <GanttVisualization events={events.slice(0, stepCount)} total={events.length} />
              <div className="how-it-works"><span className="eyebrow">HOW IT WORKS · STEP {stepCount || 0}</span><p>{activeStep?.explanation || (complete ? "Every input has been processed. Review the final metrics and result table below." : "Press Start to play automatically or Next step to advance one decision at a time.")}</p></div>
              {complete && <ResultMetrics category={category} result={simulation} />}
              {complete && <ResultTable category={category} result={simulation} stepCount={stepCount} />}
              {complete && <ComparisonTable category={category} algorithm={algorithm} inputs={inputs} result={simulation} />}
            </section>}
            {category === "CPU Scheduling" && <section className="lab-panel algorithm-guide cpu-policy-guide">
              <span className="eyebrow">ALGORITHM INFORMATION · {algorithm.replace("_", " ").toUpperCase()}</span>
              <h3>{getAlgorithmName(category, algorithm)}</h3>
              <div className="cpu-guide-tabs" role="tablist" aria-label="CPU policy information">
                {[["description", "Description"], ["formula", "Formula"], ["advantages", "Advantages"], ["disadvantages", "Disadvantages"], ["comparison", "Comparison"]].map(([id, label]) =>
                  <button key={id} id={`cpu-guide-tab-${id}`} type="button" role="tab" aria-selected={algorithmInfoTab === id} aria-controls="cpu-guide-content" className={algorithmInfoTab === id ? "active" : ""} onClick={() => setAlgorithmInfoTab(id)}>{label}</button>)}
              </div>
              <div id="cpu-guide-content" role="tabpanel" aria-labelledby={`cpu-guide-tab-${algorithmInfoTab}`} className="cpu-guide-content">
                {algorithmInfoTab === "formula" ? <pre>{cpuPolicyGuide[algorithm]?.formula}</pre> :
                  algorithmInfoTab === "advantages" ? <p>{cpuPolicyGuide[algorithm]?.advantages}</p> :
                    algorithmInfoTab === "disadvantages" ? <p>{cpuPolicyGuide[algorithm]?.disadvantages}</p> :
                      algorithmInfoTab === "comparison" ? <p>Compare this policy against the same process workload in the simulation-results panel. Each row is calculated by running that scheduler on an independent copy of these inputs.</p> :
                        <p>{cpuPolicyGuide[algorithm]?.description}</p>}
              </div>
            </section>}
            {category !== "CPU Scheduling" && <section className="lab-panel algorithm-guide"><span className="eyebrow">ALGORITHM NOTES</span><h3>{getAlgorithmName(category, algorithm)}</h3><p>{descriptions[category]?.purpose}</p><div className="guide-fact"><small>TIME COMPLEXITY</small><strong>{getComplexity(category, algorithm).time}</strong></div><div className="guide-fact"><small>SPACE COMPLEXITY</small><strong>{getComplexity(category, algorithm).space}</strong></div><div className="guide-fact"><small>ADVANTAGE</small><p>{descriptions[category]?.advantages}</p></div><button type="button" className="lab-secondary" onClick={() => goToStage("theory")}>Read full explanation ↗</button></section>}
            {category === "CPU Scheduling" && <section className="lab-panel"><div className="lab-panel-heading"><div><span className="eyebrow">SHARED EXECOS ENGINE</span><h3>Run its current workload</h3></div></div><p className="lab-side-copy">The local lab above uses your custom input. This button runs the selected supported policy on the existing shared Engine process table.</p><button type="button" className="lab-secondary" onClick={runOnEngine} disabled={engineBusy || !engineState || algorithm === "priority_np"}>{engineBusy ? "Running Engine…" : "Run on live Engine"}</button>{engineMessage && <p className="lab-success" role="status">{engineMessage}</p>}</section>}
            {moduleLink && <section className="lab-panel engine-module-link"><span className="eyebrow">EXECOS WORKBENCH</span><p>Need the full Engine view, controls, and execution trace?</p><button type="button" className="lab-secondary" onClick={() => onOpenModule(moduleLink)}>Open {moduleLink} module ↗</button></section>}
          </aside>
        </div>}
    {stage === "visualize" && <div className="learning-step-actions"><div><strong>Next: understand the idea</strong><span>Connect what you observed to the OS rules and a worked explanation.</span></div><button type="button" className="lab-primary" onClick={() => goToStage("theory")}>Continue to concept lesson →</button></div>}
    {runError && <div className="lab-validation" role="alert">{runError}</div>}
  </div>;
}
