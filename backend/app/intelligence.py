"""Evidence-based explanations over host telemetry and the Kernel Engine."""

from __future__ import annotations

import re
from typing import Any, Literal

AnalysisMode = Literal["explain", "analyze", "recommend", "teach"]
IntelligenceDomain = Literal["os_expert", "general", "debug", "learning"]

GENERAL_REFERENCE: tuple[tuple[tuple[str, ...], str, str], ...] = (
    (
        ("dbms", "database management", "database transaction", "transactions", "sql"),
        "A DBMS is software that defines, stores, queries, and protects structured data. "
        "It manages transactions, indexes, concurrency, and recovery so applications do "
        "not have to implement those mechanisms themselves.",
        "A database transaction is expected to preserve the configured consistency rules "
        "while the DBMS coordinates concurrent reads and writes.",
    ),
    (
        ("computer network", "networking", "tcp", "udp", "dns", "http"),
        "A computer network moves data between independent devices using agreed "
        "protocols. The network stack separates concerns: IP routes packets, transport "
        "protocols such as TCP or UDP provide end-to-end delivery semantics, and "
        "application protocols such as HTTP define message meaning.",
        "A request can cross several protocol layers; a failure at one layer is not "
        "automatically evidence of a failure at another.",
    ),
    (
        ("data structure", "algorithm", "big o", "complexity", "binary search", "sorting"),
        "Data structures organize information to make particular operations efficient. "
        "Algorithms define the steps used to process that information; Big-O notation "
        "describes how resource use scales as input size grows.",
        "Choose a structure and algorithm based on the operations and input scale that "
        "matter, then measure the implementation.",
    ),
    (
        ("oop", "object oriented", "polymorphism", "inheritance", "encapsulation"),
        "Object-oriented programming organizes behavior around objects that combine "
        "state with operations. Encapsulation hides implementation details, inheritance "
        "reuses or specializes behavior, and polymorphism lets callers use a common "
        "interface for different implementations.",
        "Prefer clear interfaces and composition when inheritance would create tightly "
        "coupled types.",
    ),
    (
        ("computer architecture", "cache", "pipeline", "instruction set", "cpu architecture"),
        "Computer architecture describes how a computer's instruction set, processor, "
        "memory hierarchy, and I/O are organized. Caches exploit locality to reduce "
        "average access latency, while pipelines overlap instruction stages to improve "
        "throughput.",
        "Performance depends on the workload and the full memory/processor hierarchy, "
        "not only on clock frequency.",
    ),
    (
        ("machine learning", " ai", "ai/ml", "artificial intelligence", "neural network", "model training"),
        "Machine learning fits a model to examples so it can make predictions or "
        "classifications on new inputs. Training estimates model parameters; evaluation "
        "on held-out data checks whether the model generalizes beyond its training set.",
        "A model's output is a prediction, not a measurement or proof; validate it "
        "against appropriate data and report uncertainty.",
    ),
    (
        ("programming", "python", "javascript", "typescript", "compiler", "debugging"),
        "Programming expresses instructions and data transformations in a language "
        "that tools can execute or translate. A reliable debugging workflow reproduces "
        "a failure, narrows it with observations, tests a minimal correction, and "
        "verifies the affected behavior.",
        "A code change should be checked with focused tests and the project's normal "
        "build or type-check.",
    ),
)


def answer_general_question(question: str) -> dict[str, Any]:
    lowered = question.casefold()
    match = next(
        (
            (answer, evidence)
            for terms, answer, evidence in GENERAL_REFERENCE
            if any(term in lowered for term in terms)
        ),
        None,
    )
    if match is None:
        answer = (
            "I don't have a verified reference for that specific topic in this "
            "ExecOS installation. Try a question about DBMS, computer networks, "
            "data structures and algorithms, OOP, computer architecture, "
            "programming, or AI/ML."
        )
        evidence = "General technical reference mode; no live Engine metrics were used."
    else:
        answer, evidence = match
    return {
        "question": question.strip(),
        "function": "teach",
        "answer": answer,
        "evidence": [evidence],
        "source": "curated-technical-reference",
        "read_only": True,
        "domain": "general",
    }

GUEST_STATE_TERMS = re.compile(
    r"\b(scheduler|scheduled|waiting|wait state|context switch|fragmentation|"
    r"interrupt|syscall|guest|execos kernel|disk io|i/o request)\b|\bp\d{1,8}\b",
    re.IGNORECASE,
)


def build_insights(
    system: dict[str, Any],
    processes: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Summarize measured host state and explicitly unavailable guest state."""
    cpu_percent = system["cpu_percent"]
    memory_percent = system["memory"]["percent"]
    top_memory_process = max(
        processes,
        key=lambda process: process["memory_bytes"] or 0,
        default=None,
    )

    if cpu_percent >= 80:
        cpu_title = "Elevated host CPU sample"
        cpu_summary = (
            f"The latest host CPU sample is {cpu_percent:.1f}%. "
            "This is a point-in-time reading, not a guest scheduler measurement."
        )
    elif cpu_percent < 5:
        cpu_title = "Light host CPU sample"
        cpu_summary = (
            f"The latest host CPU sample is {cpu_percent:.1f}%. "
            "A low sample alone does not identify why the host is idle."
        )
    else:
        cpu_title = "Host CPU sample"
        cpu_summary = (
            f"The latest host CPU sample is {cpu_percent:.1f}%, measured by the host OS."
        )

    if memory_percent >= 85:
        memory_title = "Host memory usage is high"
        memory_summary = (
            f"The host OS reports {memory_percent:.1f}% memory use. "
            "This does not measure ExecOS guest memory or fragmentation."
        )
    else:
        memory_title = "Host memory snapshot"
        memory_summary = (
            f"The host OS reports {memory_percent:.1f}% memory use. "
            "Guest allocator and fragmentation metrics are not connected."
        )

    if top_memory_process is None:
        process_summary = "No host processes were returned by the current read-only query."
    else:
        process_summary = (
            f"{top_memory_process['name']} (host PID {top_memory_process['pid']}) "
            f"has the largest resident-memory reading in the returned host process list: "
            f"{_format_bytes(top_memory_process.get('memory_bytes'))}."
        )

    return [
        {
            "id": "host-cpu",
            "title": cpu_title,
            "category": "Host CPU",
            "summary": cpu_summary,
            "evidence": f"Host CPU utilization: {cpu_percent:.1f}%.",
            "source": "host-os",
            "available": True,
        },
        {
            "id": "host-memory",
            "title": memory_title,
            "category": "Host memory",
            "summary": memory_summary,
            "evidence": (
                f"{system['memory']['used_bytes']} of {system['memory']['total_bytes']} "
                f"bytes used ({memory_percent:.1f}%)."
            ),
            "source": "host-os",
            "available": True,
        },
        {
            "id": "host-process",
            "title": "Largest host process by resident memory",
            "category": "Host process",
            "summary": process_summary,
            "evidence": (
                "Sorted from the current read-only host process snapshot; "
                "this is not an ExecOS guest process."
            ),
            "source": "host-os",
            "available": top_memory_process is not None,
        },
        {
            "id": "guest-scheduler",
            "title": "Guest scheduler analysis unavailable",
            "category": "ExecOS kernel",
            "summary": (
                "No guest process table or scheduler result is connected. "
                "Scheduling policy comparisons and wait reasons cannot be inferred."
            ),
            "evidence": "QEMU guest telemetry transport: not connected.",
            "source": "guest-kernel",
            "available": False,
        },
        {
            "id": "guest-memory",
            "title": "Guest fragmentation unavailable",
            "category": "ExecOS kernel",
            "summary": (
                "Guest allocator free-block data is not connected to the workbench. "
                "External fragmentation cannot be calculated from host memory."
            ),
            "evidence": "ExecOS guest allocator telemetry: not connected.",
            "source": "guest-kernel",
            "available": False,
        },
        {
            "id": "guest-resource",
            "title": "Guest wait-state analysis unavailable",
            "category": "ExecOS resources",
            "summary": (
                "No guest wait queue or I/O completion events are connected. "
                "The number and reasons for waiting guest processes are unknown."
            ),
            "evidence": "Guest process-state and event telemetry: not connected.",
            "source": "guest-kernel",
            "available": False,
        },
    ]


def answer_question(
    question: str,
    mode: AnalysisMode,
    system: dict[str, Any],
    processes: list[dict[str, Any]],
) -> dict[str, Any]:
    """Answer against a current host snapshot without controlling the OS."""
    normalized = question.strip()
    lowered = normalized.casefold()
    if not normalized:
        raise ValueError("Enter a question to analyze.")

    if mode == "teach":
        answer, evidence = _teach(lowered)
        source = "educational-reference"
    elif GUEST_STATE_TERMS.search(normalized):
        answer = (
            "I can't verify that from the current ExecOS data. The QEMU guest "
            "exposes a serial shell, but no guest telemetry is connected to this "
            "workbench. I won't infer a process state, scheduler choice, context "
            "switch, or fragmentation value."
        )
        evidence = [
            "Guest process/scheduler/memory telemetry: unavailable.",
            "Host measurements describe the OS running this API, not the QEMU guest.",
        ]
        source = "guest-kernel"
    else:
        answer, evidence = _answer_host_question(lowered, mode, system, processes)
        source = "host-os"

    return {
        "question": normalized,
        "function": mode,
        "answer": answer,
        "evidence": evidence,
        "source": source,
        "read_only": True,
    }


def _answer_host_question(
    question: str,
    mode: AnalysisMode,
    system: dict[str, Any],
    processes: list[dict[str, Any]],
) -> tuple[str, list[str]]:
    if "process" in question and "cpu" in question:
        measured_processes = [
            process
            for process in processes
            if isinstance(process.get("cpu_percent"), (int, float))
        ]
        if not measured_processes:
            return (
                "Per-process CPU utilization is not collected in the responsive "
                "host snapshot, so I can't rank host processes by CPU. The host "
                f"aggregate sample is {system['cpu_percent']:.1f}%; no guest CPU "
                "information is connected.",
                [
                    "Host process CPU readings: unavailable.",
                    f"Host aggregate CPU sample: {system['cpu_percent']:.1f}%.",
                ],
            )
        process = max(measured_processes, key=lambda item: item["cpu_percent"])
        return (
            f"{process['name']} (host PID {process['pid']}) has the highest "
            f"reported CPU sample at {process['cpu_percent']:.1f}% in the returned "
            "host process list.",
            [
                f"Host PID {process['pid']}: {process['name']}.",
                f"Reported process CPU sample: {process['cpu_percent']:.1f}%.",
            ],
        )

    if "process" in question and ("memory" in question or "ram" in question):
        process = max(
            processes,
            key=lambda item: item.get("memory_bytes") or 0,
            default=None,
        )
        if process is None:
            return (
                "The host process query returned no entries, so I can't identify a "
                "largest process from this snapshot.",
                ["Host process snapshot: empty."],
            )
        evidence = [
            f"Host PID {process['pid']}: {process['name']}.",
            f"Resident memory: {_format_bytes(process.get('memory_bytes'))}.",
            "This is host OS process data, not an ExecOS guest process.",
        ]
        if mode == "recommend":
            answer = (
                f"{process['name']} has the largest resident-memory reading in the "
                "returned host process list. Review the host process table for "
                "context; ExecOS makes no changes to host processes."
            )
        else:
            answer = (
                f"{process['name']} (host PID {process['pid']}) is using the most "
                f"resident memory in the returned host process list: "
                f"{_format_bytes(process.get('memory_bytes'))}."
            )
        return answer, evidence

    if "cpu" in question or "processor" in question:
        percent = system["cpu_percent"]
        evidence = [
            f"Latest host CPU utilization sample: {percent:.1f}%.",
            f"Logical processors reported by host OS: {system['cpu_count_logical']}.",
            "One sample cannot establish the cause of a high or low reading.",
        ]
        if mode == "recommend":
            answer = (
                f"The host CPU sample is {percent:.1f}%. Compare several readings "
                "and inspect host processes if you need to identify a workload; "
                "this workbench does not change scheduling policy."
            )
        else:
            answer = (
                f"The host OS reports {percent:.1f}% CPU utilization across "
                f"{system['cpu_count_logical']} logical processors. This is host "
                "telemetry, not ExecOS guest CPU utilization."
            )
        return answer, evidence

    if "memory" in question or "ram" in question:
        memory = system["memory"]
        evidence = [
            f"Host memory used: {_format_bytes(memory['used_bytes'])}.",
            f"Host memory total: {_format_bytes(memory['total_bytes'])}.",
            f"Host memory utilization: {memory['percent']:.1f}%.",
            "Host memory readings do not reveal guest allocator fragmentation.",
        ]
        answer = (
            f"The host OS reports {_format_bytes(memory['used_bytes'])} used of "
            f"{_format_bytes(memory['total_bytes'])} ({memory['percent']:.1f}%). "
            "This does not describe memory allocated inside the ExecOS guest."
        )
        return answer, evidence

    return (
        "I can explain the current host CPU, memory, or host process snapshot. "
        "Questions about ExecOS guest processes, scheduling, interrupts, or "
        "fragmentation require a guest telemetry connection.",
        [
            "Available source: read-only host operating-system telemetry.",
            "Guest telemetry transport: not connected.",
        ],
    )


def _teach(question: str) -> tuple[str, list[str]]:
    if "deadlock" in question:
        answer = (
            "A deadlock is a state in which a set of processes cannot make progress "
            "because each is waiting for a resource held by another. The classic "
            "conditions are mutual exclusion, hold-and-wait, no preemption, and "
            "circular wait. A resource manager can use a safety check to avoid "
            "granting requests that leave no safe completion order."
        )
        topic = "Operating-systems concept; current Engine resource safety is shown separately."
    elif "system call" in question or "syscall" in question:
        answer = (
            "A system call is a controlled interface through which a program asks "
            "the kernel to perform a privileged operation, such as creating a "
            "process or accessing a file. The kernel validates the request and "
            "returns a result rather than letting the program directly manipulate "
            "protected OS state."
        )
        topic = "Operating-systems concept; this explanation does not invoke a system call."
    elif "pcb" in question or "process control block" in question:
        answer = (
            "A Process Control Block (PCB) is the kernel's record for a process. "
            "It commonly stores identity, state, scheduling information, saved "
            "CPU context, memory ownership, and accounting metrics."
        )
        topic = "Operating-systems concept; the ExecOS process table exposes Engine PCB fields."
    elif "process" in question and "thread" in question:
        answer = (
            "A process is an executing program with its own protected address "
            "space and OS resources. A thread is an execution path within a "
            "process; threads share much of that process's memory and resources "
            "while keeping their own CPU context and stack."
        )
        topic = "General operating-systems concept; no host or Engine thread state is inferred."
    elif "paging" in question or "page fault" in question:
        answer = (
            "Paging divides virtual memory into fixed-size pages and physical "
            "memory into frames. A page table maps pages to frames; a page fault "
            "occurs when an access needs a page that is not currently resident "
            "or cannot be resolved with the current mapping."
        )
        topic = "Operating-systems concept; live ExecOS page-fault counts appear in Engine telemetry."
    elif "round robin" in question or "rr" in question:
        answer = (
            "Round Robin gives each READY process up to a configured time quantum. "
            "A process with remaining burst returns to READY when its quantum "
            "expires; a completed process becomes TERMINATED. The quantum trades "
            "interactive response against context-switch frequency."
        )
        topic = "Scheduling concept; actual policy decisions are made by the Engine scheduler."
    elif "fragment" in question or "memory" in question:
        answer = (
            "External fragmentation occurs when total free memory is sufficient "
            "but split across non-contiguous blocks, preventing a contiguous "
            "allocation. A memory manager must measure its free-block layout to "
            "calculate fragmentation; host RAM totals alone are not enough."
        )
        topic = "Memory-management concept; not a measurement of current guest state."
    elif "context" in question or "interrupt" in question or "preempt" in question:
        answer = (
            "A timer interrupt can transfer control to the kernel. If the active "
            "thread's time slice has expired, the scheduler may save its context "
            "and dispatch another runnable thread. The actual choice depends on "
            "the kernel's policy and runnable queue."
        )
        topic = "Operating-systems concept; no current guest event was inspected."
    elif "wait" in question or "block" in question or "io" in question:
        answer = (
            "A blocked process is waiting for an event such as I/O completion. "
            "The OS moves it back to a runnable state when the relevant event is "
            "signaled. A specific wait reason must come from that OS's process "
            "state and event records."
        )
        topic = "Operating-systems concept; no current guest wait state was inspected."
    else:
        answer = (
            "I don't have a verified reference for that specific OS topic in this "
            "curated lesson set. Use the OS Tutor for an open-ended explanation, "
            "or ask about process lifecycle, scheduling, memory, paging, "
            "synchronization, deadlocks, filesystems, interrupts, or system calls."
        )
        topic = "Curated educational reference; no live Engine state was used."
    return answer, [topic]


def _format_bytes(value: int | None) -> str:
    if value is None:
        return "unavailable"
    amount = float(value)
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if amount < 1024 or unit == "TB":
            return f"{amount:.1f} {unit}" if unit != "B" else f"{int(amount)} B"
        amount /= 1024
    return f"{amount:.1f} TB"


def build_engine_insights(state: dict[str, Any]) -> list[dict[str, Any]]:
    """Build console insights exclusively from the kernel-engine snapshot."""
    processes = state["processes"]["states"]
    ready = len(processes["READY"])
    running = len(processes["RUNNING"])
    waiting = processes["WAITING"]
    memory = state["memory"]
    scheduler = state["scheduler"]
    deadlock = state["deadlock_check"]
    top_process = max(
        [
            process
            for group in state["processes"]["states"].values()
            for process in group
            if process["state"] != "TERMINATED"
        ],
        key=lambda process: process["memory_allocation_mb"],
        default=None,
    )
    insights = [
        {
            "id": "scheduler-state",
            "title": "Scheduler ready queue",
            "category": "Scheduler",
            "summary": (
                f"{ready} process(es) ready; {running} running. "
                f"Current policy: {scheduler['last_result']['algorithm'] if scheduler['last_result'] else 'round_robin'}."
            ),
            "evidence": f"Ready queue: {', '.join(scheduler['ready_queue']) or 'empty'}.",
            "source": "execos-kernel-engine",
            "available": True,
        },
        {
            "id": "process-waits",
            "title": "Process wait states",
            "category": "Process manager",
            "summary": (
                f"{len(waiting)} process(es) currently waiting."
                if waiting
                else "No processes are currently waiting."
            ),
            "evidence": (
                "; ".join(
                    f"{process['pid']}: {process['wait_reason'] or 'reason not recorded'}"
                    for process in waiting
                )
                if waiting
                else "Observed directly from the current process table."
            ),
            "source": "execos-kernel-engine",
            "available": True,
        },
        {
            "id": "memory-state",
            "title": "Kernel memory layout",
            "category": "Memory manager",
            "summary": (
                f"{memory['used_mb']} MB used of {memory['total_mb']} MB; "
                f"external fragmentation is {memory['external_fragmentation_percent']:.1f}%."
            ),
            "evidence": (
                f"{sum(block['pid'] is None for block in memory['blocks'])} free block(s); "
                f"largest free block is {max((block['size_mb'] for block in memory['blocks'] if block['pid'] is None), default=0)} MB."
            ),
            "source": "execos-kernel-engine",
            "available": True,
        },
        {
            "id": "io-queue",
            "title": "I/O request queue",
            "category": "I/O manager",
            "summary": f"{state['io']['queue_depth']} active or queued I/O request(s).",
            "evidence": (
                "; ".join(
                    f"{item['pid']} {item['operation']} on {item['device']} ({item['status']})"
                    for item in state["io"]["requests"]
                    if item["status"] in {"ACTIVE", "QUEUED"}
                )
                or "No pending I/O requests."
            ),
            "source": "execos-kernel-engine",
            "available": True,
        },
        {
            "id": "deadlock-state",
            "title": "Resource safety",
            "category": "Resource manager",
            "summary": deadlock["status"],
            "evidence": (
                f"Safe sequence: {' → '.join(deadlock['safe_sequence']) or 'none'}."
                if deadlock["safe"]
                else f"Blocked processes: {', '.join(deadlock['blocked_pids'])}."
            ),
            "source": "execos-kernel-engine",
            "available": True,
        },
    ]
    if top_process:
        insights.insert(1, {
            "id": "largest-process",
            "title": "Largest engine memory allocation",
            "category": "Process manager",
            "summary": (
                f"{top_process['name']} ({top_process['pid']}) owns "
                f"{top_process['memory_allocation_mb']} MB in the engine."
            ),
            "evidence": "Read from the process table and contiguous memory map.",
            "source": "execos-kernel-engine",
            "available": True,
        })
    return insights


def answer_engine_question(
    question: str,
    mode: AnalysisMode,
    state: dict[str, Any],
    trace: dict[str, Any] | None = None,
    domain: IntelligenceDomain = "os_expert",
) -> dict[str, Any]:
    """Explain state transitions using current engine records and trace events."""
    normalized = question.strip()
    if not normalized:
        raise ValueError("Enter a question to analyze.")
    if domain == "general":
        return answer_general_question(normalized)
    if domain == "learning":
        answer, evidence = _teach(normalized.casefold())
        process_groups = state["processes"]["states"]
        example_process = next(
            (
                process
                for group in process_groups.values()
                for process in group
            ),
            None,
        )
        if "deadlock" in normalized.casefold():
            example = (
                f"The current Engine Banker's check reports "
                f"{state['deadlock_check']['status']}."
            )
        elif "round robin" in normalized.casefold() or "scheduler" in normalized.casefold():
            example = (
                f"At Engine tick {state['engine']['clock_tick']}, policy is "
                f"{(state['scheduler']['last_result'] or {}).get('algorithm', 'not run')}; "
                f"the READY queue is {', '.join(state['scheduler']['ready_queue']) or 'empty'}."
            )
        elif example_process:
            example = (
                f"ExecOS currently records {example_process['pid']} as "
                f"{example_process['state']}, with {example_process['remaining_time']} "
                f"CPU ticks remaining and {example_process['memory_allocation_mb']} MB "
                "allocated."
            )
        else:
            example = (
                f"ExecOS is at Engine tick {state['engine']['clock_tick']} with "
                f"{state['processes']['total']} process records."
            )
        answer = f"{answer}\n\nExecOS example: {example}"
        evidence.append(
            f"Live Engine example from tick {state['engine']['clock_tick']}; it is not a host OS measurement."
        )
        return {
            "question": normalized,
            "function": "teach",
            "answer": answer,
            "evidence": evidence,
            "source": "educational-reference",
            "read_only": True,
            "domain": domain,
        }
    lowered = normalized.casefold()
    processes = state["processes"]["states"]
    all_processes = [
        process for collection in processes.values() for process in collection
    ]
    pid_match = re.search(r"\bp\d{1,8}\b", lowered, re.IGNORECASE)
    process = None
    if pid_match:
        process = next(
            (
                item for item in all_processes
                if item["pid"].casefold() == pid_match.group(0).casefold()
            ),
            None,
        )

    if mode == "teach":
        answer, evidence = _teach(lowered)
        source = "educational-reference"
    elif process and ("wait" in lowered or process["state"] == "WAITING"):
        if process["state"] == "WAITING":
            answer = (
                f"{process['pid']} ({process['name']}) is WAITING because "
                f"{process['wait_reason'] or 'the engine recorded a blocking operation'}."
            )
            evidence = [
                f"Current process state: {process['state']}.",
                f"Recorded wait reason: {process['wait_reason']}.",
            ]
        else:
            answer = (
                f"{process['pid']} ({process['name']}) is currently "
                f"{process['state']}, not waiting."
                + (
                    f" Its last recorded wait reason was {process['wait_reason']}."
                    if process["wait_reason"]
                    else " The process table has no current wait reason for it."
                )
            )
            evidence = [
                f"Current process state: {process['state']}.",
                f"Remaining CPU burst: {process['remaining_time']} ticks.",
            ]
        source = "execos-kernel-engine"
    elif process and ("select" in lowered or "run" in lowered or "before" in lowered or "running" in lowered):
        selected_event = next(
            (
                event for event in reversed((trace or {}).get("events", []))
                if event.get("event") in {"PROCESS_SELECTED", "PROCESS_DISPATCHED"}
                and event.get("pid") == process["pid"]
            ),
            None,
        )
        selected = None
        if selected_event:
            details = selected_event.get("details", {})
            selected = {
                "algorithm": details.get("algorithm", details.get("policy", "unknown")),
                "selection_criterion": details.get(
                    "criterion",
                    "manual dispatch" if selected_event["event"] == "PROCESS_DISPATCHED" else "scheduler policy",
                ),
                "selection_value": details.get("value", "not recorded"),
                "start": selected_event.get("tick"),
                "end": selected_event.get("tick"),
                "ready_queue": details.get("ready_queue", []),
            }
        if selected is None:
            selected = next(
                (
                    item for item in reversed(state["scheduler"]["last_result"]["timeline"])
                    if item["pid"] == process["pid"]
                ),
                None,
            ) if state["scheduler"]["last_result"] else None
        if selected:
            answer = (
                f"{process['pid']} ({process['name']}) was selected by "
                f"{selected['algorithm'].upper()} because it matched the recorded "
                f"criterion: {selected['selection_criterion']} "
                f"(value: {selected['selection_value']})."
            )
            evidence = [
                f"Dispatch interval: tick {selected['start']}–{selected['end']}.",
                f"Ready queue at dispatch: {', '.join(selected['ready_queue']) or 'empty'}.",
                f"Recorded selection reason: {selected['selection_criterion']} "
                f"(value: {selected['selection_value']}).",
                f"Process priority: {process['priority']}; remaining burst now "
                f"{process['remaining_time']} ticks.",
            ]
        else:
            answer = (
                f"{process['pid']} is {process['state']}. No scheduler dispatch "
                "record exists for this process yet."
            )
            evidence = [
                f"Current process state: {process['state']}.",
                "Scheduler dispatch history: unavailable for this process.",
            ]
        source = "execos-kernel-engine"
    elif not process and ("selected" in lowered or "most recent process" in lowered):
        selected_event = next(
            (
                event for event in reversed((trace or {}).get("events", []))
                if event.get("event") in {"PROCESS_SELECTED", "PROCESS_DISPATCHED"}
                and event.get("pid")
            ),
            None,
        )
        selected_process = next(
            (
                item for item in all_processes
                if selected_event and item["pid"] == selected_event["pid"]
            ),
            None,
        )
        if selected_event and selected_process:
            details = selected_event.get("details", {})
            policy = details.get("algorithm", details.get("policy", "unknown"))
            criterion = details.get(
                "criterion",
                "manual dispatch" if selected_event["event"] == "PROCESS_DISPATCHED" else "scheduler policy",
            )
            value = details.get("value", "not recorded")
            answer = (
                f"{selected_process['pid']} ({selected_process['name']}) was most "
                f"recently selected under {policy.upper()} because of {criterion} "
                f"(value: {value})."
            )
            evidence = [
                f"Trace event: {selected_event['event']} at tick {selected_event['tick']}.",
                f"Ready queue at selection: {', '.join(details.get('ready_queue', [])) or 'not recorded'}.",
                f"Current process state: {selected_process['state']}; priority {selected_process['priority']}; "
                f"remaining burst {selected_process['remaining_time']} ticks.",
            ]
        else:
            answer = "No process-selection or dispatch event is present in the retained Engine trace."
            evidence = ["Retained process selection trace: empty."]
        source = "execos-kernel-engine-trace"
    elif domain == "debug":
        events = trace.get("events", []) if trace else []
        recent = events[-12:]
        if recent:
            answer = (
                f"Debug context collected at Engine tick {state['engine']['clock_tick']}: "
                f"{len(recent)} of {len(events)} retained trace events are shown below. "
                "These are recorded Engine events, not inferred host activity."
            )
            evidence = [
                f"tick {event.get('tick')} · {event.get('event')} · "
                f"{event.get('pid') or 'kernel'} · {event.get('module')}"
                for event in recent
            ]
        else:
            answer = "The current Engine snapshot has no retained execution-trace events to inspect."
            evidence = [
                f"Engine tick: {state['engine']['clock_tick']}.",
                "Execution trace: empty.",
            ]
        source = "execos-kernel-engine-trace"
    elif "wait" in lowered:
        waiting = processes["WAITING"]
        if waiting:
            answer = "Current engine wait states: " + "; ".join(
                f"{item['pid']} ({item['name']}) waits for "
                f"{item['wait_reason'] or 'an event without a recorded reason'}"
                for item in waiting
            ) + "."
            evidence = [
                f"{item['pid']} state={item['state']}; reason={item['wait_reason']}."
                for item in waiting
            ]
        else:
            answer = "No ExecOS engine processes are currently in the WAITING state."
            evidence = ["Current process table has no WAITING entries."]
        source = "execos-kernel-engine"
    elif "process" in lowered and ("memory" in lowered or "ram" in lowered):
        allocated = [
            item for item in all_processes if item["state"] != "TERMINATED"
        ]
        largest = max(allocated, key=lambda item: item["memory_allocation_mb"], default=None)
        if largest:
            answer = (
                f"{largest['name']} ({largest['pid']}) currently owns the largest "
                f"engine memory allocation: {largest['memory_allocation_mb']} MB."
            )
            evidence = [
                f"PCB allocation: {largest['memory_allocation_mb']} MB.",
                "Compared with other non-terminated process records in the Engine.",
            ]
        else:
            answer = "No active engine process has a memory allocation."
            evidence = ["No non-terminated process records were found."]
        source = "execos-kernel-engine"
    elif "context" in lowered or "interrupt" in lowered:
        switches = [
            event for event in state["recent_events"]
            if event["event"] in {"CONTEXT_SWITCH", "CONTEXT_SAVED", "CONTEXT_RESTORED"}
        ]
        if switches:
            event = switches[-1]
            details = event["details"]
            answer = (
                f"The latest context event is {event['event']} for {event['pid']} "
                f"at engine tick {event['tick']}. The transition was recorded by "
                f"the {event['module']} module."
            )
            evidence = [f"Trace payload: {details}."]
        else:
            answer = "No context-switch record is present in the current engine trace."
            evidence = ["Current engine context-switch trace: empty."]
        source = "execos-kernel-engine"
    elif "fragment" in lowered or "free block" in lowered:
        memory = state["memory"]
        answer = (
            f"The engine reports {memory['external_fragmentation_percent']:.1f}% "
            f"external fragmentation across {sum(block['pid'] is None for block in memory['blocks'])} "
            f"free block(s). It calculates this as free memory outside the largest "
            f"contiguous free block divided by total free memory."
        )
        evidence = [
            f"Total/free: {memory['total_mb']}/{memory['free_mb']} MB.",
            f"Largest free block: {max((block['size_mb'] for block in memory['blocks'] if block['pid'] is None), default=0)} MB.",
        ]
        source = "execos-kernel-engine"
    elif (
        "gantt" in lowered
        or "schedul" in lowered
        or "average waiting" in lowered
    ):
        result = state["scheduler"]["last_result"]
        if result:
            metrics = result["metrics"]
            answer = (
                f"{result['algorithm'].upper()} completed {len(result['timeline'])} "
                f"recorded CPU segment(s). Average waiting time is "
                f"{metrics['average_waiting_time']} ticks, average turnaround is "
                f"{metrics['average_turnaround_time']} ticks, CPU utilization is "
                f"{metrics['cpu_utilization_percent']}%, with "
                f"{metrics['context_switches']} context switches."
            )
            evidence = [
                "Segments: "
                + " → ".join(
                    f"{item['pid']}[{item['start']},{item['end']})"
                    for item in result["timeline"]
                ),
                f"Metrics from scheduler result: {metrics}.",
            ]
        else:
            answer = "The scheduler has not run yet, so no Gantt chart or execution metrics exist."
            evidence = ["Scheduler run history: empty."]
        source = "execos-kernel-engine"
    elif "cpu" in lowered or "utilization" in lowered:
        result = state["scheduler"]["last_result"]
        if result:
            metrics = result["metrics"]
            answer = (
                f"The last {result['algorithm'].upper()} run measured "
                f"{metrics['cpu_utilization_percent']}% CPU utilization over "
                f"{result['end_tick'] - result['start_tick']} ticks, with "
                f"{metrics['idle_ticks']} idle ticks and "
                f"{metrics['context_switches']} context switches."
            )
            evidence = [
                f"Scheduler metrics: {metrics}.",
                "This is Engine scheduler time, not host CPU utilization.",
            ]
        else:
            answer = (
                "The scheduler has not run, so the Engine has no measured CPU "
                "utilization result yet."
            )
            evidence = ["Scheduler result: unavailable until a workload runs."]
        source = "execos-kernel-engine"
    elif "deadlock" in lowered or "safe state" in lowered or "unsafe state" in lowered:
        result = state["deadlock_check"]
        answer = (
            f"The current Banker's safety check reports {result['status']}."
            + (
                f" A safe completion order is {' → '.join(result['safe_sequence'])}."
                if result["safe"]
                else f" Processes without a satisfiable remaining claim: {', '.join(result['blocked_pids'])}."
            )
        )
        evidence = [
            f"Available resources: {state['resources']['resources']}.",
            f"Need matrix: {state['resources']['need']}.",
        ]
        source = "execos-kernel-engine"
    elif "memory" in lowered or "page fault" in lowered:
        vm = state["virtual_memory"]
        memory = state["memory"]
        answer = (
            f"The engine currently has {memory['used_mb']} MB allocated with "
            f"{memory['free_mb']} MB free. Virtual memory has recorded "
            f"{vm['page_faults']} page fault(s) and {vm['page_hits']} hit(s)."
        )
        evidence = [
            f"Page hit ratio: {vm['hit_ratio_percent']}%.",
            f"Physical memory utilization: {memory['utilization_percent']}%.",
        ]
        source = "execos-kernel-engine"
    elif "io" in lowered or "device" in lowered:
        requests = [
            item for item in state["io"]["requests"]
            if item["status"] in {"ACTIVE", "QUEUED"}
        ]
        answer = (
            f"The engine has {len(requests)} pending I/O request(s)."
            if requests
            else "The engine I/O queue is empty."
        )
        evidence = [
            f"{item['pid']} {item['operation']} on {item['device']}: {item['status']}."
            for item in requests
        ] or ["Current I/O queue contains no active or queued requests."]
        source = "execos-kernel-engine"
    else:
        answer = (
            f"ExecOS Kernel Engine is {state['engine']['status']} at tick "
            f"{state['engine']['clock_tick']}. It currently manages "
            f"{state['processes']['total']} process records; ask about a process "
            "state, scheduler result, memory layout, I/O, or deadlock check."
        )
        evidence = [
            f"Ready queue: {', '.join(state['scheduler']['ready_queue']) or 'empty'}.",
            f"Recent trace events: {len(state['recent_events'])}.",
        ]
        source = "execos-kernel-engine"

    if mode == "recommend":
        answer = (
            "Recommendation (no action taken): "
            + answer
            + " Review the evidence above before choosing an OS operation."
        )
    return {
        "question": normalized,
        "function": mode,
        "answer": answer,
        "evidence": evidence,
        "source": source,
        "read_only": True,
        "domain": domain,
    }
