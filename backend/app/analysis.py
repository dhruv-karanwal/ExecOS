"""Deterministic, evidence-backed analysis of the ExecOS Kernel Engine."""

from __future__ import annotations

from statistics import mean
from typing import Any


def _number(value: Any, default: float = 0.0) -> float:
    return float(value) if isinstance(value, (int, float)) else default


def _find_processes(snapshot: dict[str, Any]) -> list[dict[str, Any]]:
    grouped = snapshot.get("processes", {}).get("states", {})
    if isinstance(grouped, dict):
        return [
            process
            for items in grouped.values()
            for process in items
            if isinstance(process, dict)
        ]
    processes = snapshot.get("processes", [])
    return processes if isinstance(processes, list) else []


def diagnose_execos(
    snapshot: dict[str, Any],
    trace: dict[str, Any],
    optimizer: dict[str, Any] | None = None,
) -> dict[str, Any]:
    processes = _find_processes(snapshot)
    scheduler = snapshot.get("scheduler", {})
    memory = snapshot.get("memory", {})
    io_state = snapshot.get("io", {})
    last_result = scheduler.get("last_result") or {}
    history = scheduler.get("history", [])
    active_runnable = [
        process for process in processes
        if process.get("state") in {"READY", "RUNNING", "NEW"}
    ]
    last_run_processes = set(last_result.get("completed_pids", [])) | set(
        last_result.get("remaining_pids", [])
    )
    current_run_metrics = bool(active_runnable) and all(
        process.get("pid") in last_run_processes for process in active_runnable
    )
    metrics = (last_result.get("metrics") or {}) if current_run_metrics else {}
    if not metrics and history and current_run_metrics:
        metrics = history[-1].get("metrics", {})

    ready = [p for p in processes if p.get("state") == "READY"]
    io_requests = io_state.get("requests", [])
    active_io_pids = {
        str(request.get("pid"))
        for request in io_requests
        if request.get("status") in {"ACTIVE", "QUEUED"}
    }
    waiting_io = [
        p for p in processes
        if p.get("state") in {"WAITING", "BLOCKED"}
        and (
            str(p.get("pid")) in active_io_pids
            or "io" in str(p.get("wait_reason", "")).lower()
        )
    ]
    io_queue_count = int(io_state.get("queue_depth", len(active_io_pids)))
    memory_total = _number(memory.get("total_mb"))
    memory_used = _number(memory.get("used_mb"))
    memory_utilization = (
        memory_used * 100 / memory_total if memory_total > 0 else None
    )
    fragmentation = _number(memory.get("external_fragmentation_percent"))
    virtual_memory = snapshot.get("virtual_memory", {})
    trace_events = trace.get("events", []) if isinstance(trace, dict) else []
    selected_counts: dict[str, int] = {}
    for event in trace_events:
        details = event.get("details", {}) if isinstance(event, dict) else {}
        pid = details.get("pid") or event.get("pid")
        kind = str(event.get("event", event.get("event_type", event.get("type", "")))).lower()
        if pid and kind == "process_selected":
            selected_counts[str(pid)] = selected_counts.get(str(pid), 0) + 1

    findings: list[dict[str, Any]] = []

    def add_finding(
        issue: str,
        severity: str,
        affected: list[str],
        evidence: list[str],
        cause: str,
        recommendation: str,
        chain: list[str],
    ) -> None:
        findings.append({
            "issue": issue,
            "severity": severity,
            "affected_processes": affected,
            "evidence": evidence,
            "root_cause": cause,
            "recommendation": recommendation,
            "causal_chain": chain,
        })

    ready_queue = scheduler.get("ready_queue", [])
    ready_pids = [str(process.get("pid")) for process in ready]
    queue_pids = [str(pid) for pid in ready_queue]
    if set(ready_pids) != set(queue_pids):
        missing_from_queue = sorted(set(ready_pids) - set(queue_pids))
        missing_from_process_table = sorted(set(queue_pids) - set(ready_pids))
        add_finding(
            "Process-state / ready-queue synchronization inconsistency",
            "CRITICAL",
            sorted(set(missing_from_queue + missing_from_process_table)),
            [
                f"READY process-table PIDs: {', '.join(ready_pids) or 'none'}",
                f"Scheduler ready-queue PIDs: {', '.join(queue_pids) or 'none'}",
                f"Missing from scheduler queue: {', '.join(missing_from_queue) or 'none'}",
                f"Not READY but present in queue: {', '.join(missing_from_process_table) or 'none'}",
            ],
            "The scheduler queue does not match the process manager's current READY states.",
            "Reconcile the scheduler queue from the authoritative process table before dispatching work.",
            [
                f"Process manager reports {len(ready_pids)} READY process(es)",
                f"Scheduler reports {len(queue_pids)} queued process(es)",
                "The two Engine views disagree on runnable process identity",
            ],
        )
    running_pids = [str(process.get("pid")) for process in processes if process.get("state") == "RUNNING"]
    current_pid = scheduler.get("current_pid")
    if len(running_pids) > 1 or (
        (current_pid is None and running_pids)
        or (current_pid is not None and running_pids != [str(current_pid)])
    ):
        add_finding(
            "Running-process ownership inconsistency",
            "CRITICAL",
            sorted(set(running_pids + ([str(current_pid)] if current_pid else []))),
            [
                f"Process table RUNNING PIDs: {', '.join(running_pids) or 'none'}",
                f"Scheduler current PID: {current_pid or 'none'}",
            ],
            "The CPU owner recorded by the scheduler does not match the process table's RUNNING state.",
            "Reconcile the current CPU owner and process state before executing another scheduling operation.",
            [
                f"Process table has {len(running_pids)} RUNNING process(es)",
                f"Scheduler current PID is {current_pid or 'unset'}",
                "CPU ownership is not consistent across Engine state",
            ],
        )

    utilization = metrics.get("cpu_utilization_percent")
    measured_io_queue = _number(metrics.get("io_queue_length"))
    if (
        utilization is not None
        and _number(utilization) < 30
        and measured_io_queue > 0
        and waiting_io
    ):
        add_finding(
            "I/O bottleneck",
            "HIGH" if io_queue_count >= 2 or len(waiting_io) >= 2 else "MEDIUM",
            [str(p.get("pid")) for p in waiting_io],
            [
                f"Last scheduler run CPU utilization: {_number(utilization):.1f}%",
                f"Processes waiting for I/O: {len(waiting_io)}",
                f"Queued I/O requests: {io_queue_count}",
            ],
            "The scheduler had little runnable CPU work while processes and requests were waiting on I/O.",
            "Inspect the queued device requests and complete or service I/O through the Kernel Engine.",
            [
                f"CPU utilization measured at {_number(utilization):.1f}%",
                f"{len(waiting_io)} process(es) are waiting for I/O",
                f"{io_queue_count} request(s) are queued",
                "I/O wait is limiting runnable CPU work",
            ],
        )
    elif utilization is not None and _number(utilization) >= 90 and ready:
        average_wait = metrics.get("average_waiting_time")
        add_finding(
            "CPU saturation",
            "HIGH" if len(ready) >= 3 else "MEDIUM",
            [str(p.get("pid")) for p in ready],
            [
                f"Last scheduler run CPU utilization: {_number(utilization):.1f}%",
                f"Current ready queue length: {len(ready)}",
                f"Last-run average waiting time: {_number(average_wait):.2f} ticks",
            ],
            "The measured workload consumed nearly all available CPU ticks; this is contention, not proof of a faulty CPU.",
            "Compare scheduler policies on the same workload and consider shorter bursts or a responsive policy when response time is the goal.",
            [
                f"CPU utilization reached {_number(utilization):.1f}% in the last run",
                f"Average waiting time was {_number(average_wait):.2f} ticks",
                f"{len(ready)} process(es) are currently ready",
                "CPU demand is the limiting measured resource",
            ],
        )

    if memory_utilization is not None and memory_utilization >= 85:
        add_finding(
            "Memory pressure",
            "HIGH" if memory_utilization >= 95 else "MEDIUM",
            [
                str(p.get("pid")) for p in processes
                if p.get("memory_allocation_mb", 0) > 0
            ],
            [
                f"Allocated memory: {memory_used:.1f}/{memory_total:.1f} MB ({memory_utilization:.1f}%)",
                f"Page faults: {virtual_memory.get('page_faults', 0)}",
            ],
            "The Engine's allocated memory is near its configured arena capacity.",
            "Review process allocations and release memory for completed processes before admitting more work.",
            [
                f"Memory utilization is {memory_utilization:.1f}%",
                f"{virtual_memory.get('page_faults', 0)} page faults are recorded",
                "Available memory capacity is constrained",
            ],
        )

    if fragmentation >= 20:
        add_finding(
            "External fragmentation",
            "MEDIUM" if fragmentation < 40 else "HIGH",
            [
                str(p.get("pid")) for p in processes
                if p.get("memory_allocation_mb", 0) > 0
            ],
            [
                f"Measured external fragmentation: {fragmentation:.1f}%",
                f"Free memory: {_number(memory.get('free_mb')):.1f} MB",
            ],
            "Free memory is split across non-contiguous regions, so total free space may overstate the largest allocatable block.",
            "Compare Best Fit and First Fit for the next allocation on a What-If copy; do not compact live memory without an explicit Engine operation.",
            [
                f"External fragmentation is {fragmentation:.1f}%",
                f"{_number(memory.get('free_mb')):.1f} MB is free in total",
                "The free-space layout may prevent a contiguous allocation",
            ],
        )

    if io_queue_count >= 2 or len(waiting_io) >= 2:
        if not any(f["issue"] == "I/O bottleneck" for f in findings):
            add_finding(
                "I/O queue congestion",
                "MEDIUM",
                [str(p.get("pid")) for p in waiting_io],
                [
                    f"Queued I/O requests: {io_queue_count}",
                    f"Processes waiting for I/O: {len(waiting_io)}",
                ],
                "Multiple active requests or I/O-waiting processes indicate queued device demand.",
                "Inspect device queue order and complete requests through the normal I/O path.",
                [
                    f"{io_queue_count} I/O request(s) are queued",
                    f"{len(waiting_io)} process(es) are waiting for I/O",
                    "Device service is queued behind outstanding requests",
                ],
            )

    if ready:
        waiters = [
            p for p in ready
            if _number(p.get("waiting_time")) >= max(10, 2 * _number(p.get("burst_time"), 1))
        ]
        last_policy = last_result.get("algorithm")
        priority = [
            p for p in ready
            if last_policy == "priority"
            and _number(p.get("priority"), 0) > 0
            and _number(p.get("waiting_time")) >= 5
            and selected_counts.get(str(p.get("pid")), 0) == 0
        ]
        starved = {str(p.get("pid")): p for p in waiters + priority}
        if starved:
            affected = list(starved)
            add_finding(
                "Starvation risk",
                "HIGH" if len(affected) else "MEDIUM",
                affected,
                [
                    f"{pid}: waiting {_number(p.get('waiting_time')):.0f} ticks; "
                    f"CPU selections in retained trace: {selected_counts.get(pid, 0)}"
                    for pid, p in starved.items()
                ] + [f"Most recent scheduling policy: {last_policy or 'not recorded'}"],
                "A ready process has accumulated long measured wait relative to its burst, or has not been selected under the recorded Priority policy.",
                "Use aging or compare Round Robin against the current policy on a What-If copy.",
                [
                    "A process remains in the READY state",
                    "Its measured wait is high relative to its burst or retained CPU selections",
                    f"Most recent policy is {last_policy or 'not recorded'}",
                    "Repeated loss of CPU selection creates starvation risk",
                ],
            )

    context_switches = metrics.get("context_switches")
    result = last_result
    total_ticks = _number(
        result.get("end_tick", 0) - result.get("start_tick", 0)
        if result.get("end_tick") is not None and result.get("start_tick") is not None
        else 0
    )
    if context_switches is not None and total_ticks > 0:
        switch_rate = _number(context_switches) / total_ticks
        if switch_rate > 0.5:
            add_finding(
                "Excessive context switching",
                "MEDIUM",
                [str(p.get("pid")) for p in processes if p.get("state") in {"READY", "RUNNING"}],
                [
                    f"Context switches: {context_switches}",
                    f"Elapsed scheduler ticks: {total_ticks:.0f}",
                    f"Measured switches per tick: {switch_rate:.2f}",
                ],
                "The recorded run changed execution context more than once per two CPU ticks.",
                "Test a larger Round Robin quantum or a non-preemptive policy in What-If and compare response time against switch count.",
                [
                    f"{context_switches} context switches over {total_ticks:.0f} ticks",
                    f"Switch rate is {switch_rate:.2f} per tick",
                    "Dispatch overhead risk is elevated for this workload",
                ],
            )

    banker = snapshot.get("deadlock_check", {})
    if banker.get("safe") is False:
        blocked = [
            str(p.get("pid")) for p in processes
            if p.get("state") in {"BLOCKED", "WAITING"}
            and "resource" in str(p.get("wait_reason", "")).lower()
        ]
        add_finding(
            "Deadlock risk",
            "HIGH",
            blocked,
            [
                "Banker's safety check reports an unsafe state",
                f"Safe sequence: {banker.get('safe_sequence', [])}",
            ],
            "The current resource allocation has no safe completion sequence according to the Engine's Banker check.",
            "Avoid granting additional resource requests until the allocation returns to a safe state.",
            [
                "Banker's algorithm reports an unsafe allocation state",
                f"Resource-waiting processes: {len(blocked)}",
                "A safe process completion order is not currently established",
            ],
        )

    if optimizer and optimizer.get("recommended_algorithm") != optimizer.get("baseline_policy"):
        current_candidate = next(
            (
                item for item in optimizer.get("candidates", [])
                if item.get("algorithm") == optimizer.get("baseline_policy")
            ),
            None,
        )
        best_candidate = next(
            (
                item for item in optimizer.get("candidates", [])
                if item.get("algorithm") == optimizer.get("recommended_algorithm")
            ),
            None,
        )
        if current_candidate and best_candidate:
            current_response = _number(current_candidate["metrics"].get("average_response_time"))
            best_response = _number(best_candidate["metrics"].get("average_response_time"))
            if current_response > best_response:
                add_finding(
                    "Scheduling inefficiency",
                    "MEDIUM",
                    [str(p.get("pid")) for p in processes if p.get("state") in {"READY", "RUNNING", "NEW"}],
                    [
                        f"Current policy: {optimizer['baseline_policy']} ({current_response:.2f} average response ticks)",
                        f"Best measured policy: {optimizer['recommended_algorithm']} ({best_response:.2f} average response ticks)",
                    ],
                    "An independent run of another real scheduler algorithm produced a lower average response time on an identical normalized workload copy.",
                    optimizer.get("recommendation_reason", "Review the measured candidate comparison."),
                    [
                        f"Optimizer ran {optimizer['baseline_policy']} and {optimizer['recommended_algorithm']} on the same workload",
                        f"Average response improved from {current_response:.2f} to {best_response:.2f} ticks",
                        "The current policy is less responsive for this measured workload",
                    ],
                )

    severity_rank = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "INFO": 3}
    findings.sort(key=lambda item: severity_rank.get(item["severity"], 3))
    primary = findings[0] if findings else None
    cpu_score = (
        None
        if utilization is None
        else 100
        if not ready
        else max(0, min(100, 100 - max(0, _number(utilization) - 80) * 4))
    )
    categories: dict[str, float | None] = {
        "cpu": cpu_score,
        "memory": (
            max(0, min(100, 100 - (memory_utilization or 0) - fragmentation / 2))
            if memory_utilization is not None
            else None
        ),
        "io": max(0, 100 - 20 * io_queue_count - 15 * len(waiting_io)),
        "processes": max(
            0,
            100 - 25 * sum(f["issue"] == "Starvation risk" for f in findings)
            - 15 * len(ready),
        ),
        "resources": (
            100 if banker.get("safe") is True
            else 25 if banker.get("safe") is False
            else None
        ),
    }
    measured = [score for score in categories.values() if score is not None]
    health_score = round(mean(measured)) if measured else None
    system_health = (
        "UNKNOWN" if health_score is None
        else "CRITICAL" if health_score < 50 or any(f["severity"] in {"CRITICAL", "HIGH"} for f in findings)
        else "DEGRADED" if health_score < 75 or findings
        else "HEALTHY"
    )
    predictions = []
    current_profile = sorted(
        [
            {
                "remaining_time": process.get("remaining_time", process.get("burst_time", 0)),
                "priority": process.get("priority", 0),
            }
            for process in active_runnable
        ],
        key=lambda item: (item["remaining_time"], item["priority"]),
    )
    target_profile = current_profile or (
        history[-1].get("workload_profile", []) if history else []
    )
    comparable_history = [
        run for run in history
        if run.get("workload_profile") == target_profile and target_profile
    ][-5:]
    if len(comparable_history) >= 2:
        waits = [
            _number(run.get("metrics", {}).get("average_waiting_time"))
            for run in comparable_history
        ]
        if len(waits) >= 2 and waits[-1] > waits[0]:
            predictions.append({
                "risk": "Increasing waiting time",
                "confidence": "historical trend",
                "evidence": [
                    f"Comparable workload runs: {len(waits)}",
                    f"Average waiting time changed from {waits[0]:.2f} to {waits[-1]:.2f} ticks",
                ],
                "method": "Observed first-to-last trend for an identical burst/priority profile; not an ML forecast",
            })
        io_counts = [
            _number(run.get("metrics", {}).get("io_queue_length"))
            for run in comparable_history
            if "io_queue_length" in run.get("metrics", {})
        ]
        if len(io_counts) >= 2 and io_counts[-1] > io_counts[0]:
            predictions.append({
                "risk": "I/O congestion",
                "confidence": "historical trend",
                "evidence": [
                    f"Queued I/O increased from {io_counts[0]:.0f} to {io_counts[-1]:.0f}"
                ],
                "method": "Observed comparable scheduler runs; not an ML forecast",
            })
    if not predictions:
        predictions.append({
            "risk": "Insufficient historical evidence",
            "confidence": "unavailable",
            "evidence": [
                f"Retained real scheduler runs: {len(history)}",
                f"Runs matching the active burst/priority profile: {len(comparable_history)}",
                "At least two runs with the same workload profile are required for trend predictions",
            ],
            "method": "No prediction made",
        })
    current_risks = {
        "CPU saturation": "CPU demand may continue saturating the scheduler",
        "Memory pressure": "Memory pressure may constrain upcoming allocations",
        "External fragmentation": "A contiguous allocation may fail despite free memory",
        "I/O queue congestion": "I/O congestion may delay waiting processes",
        "I/O bottleneck": "I/O wait may continue limiting runnable CPU work",
        "Starvation risk": "A ready process may continue to lose CPU selection",
        "Scheduling inefficiency": "The current scheduling policy may continue to underperform",
    }
    predictions.extend(
        {
            "risk": current_risks[finding["issue"]],
            "confidence": "rule-based current-state indicator",
            "evidence": finding["evidence"],
            "method": (
                "Projects risk from current measured Engine state; this is not "
                "a probability estimate or an ML forecast."
            ),
        }
        for finding in findings
        if finding["issue"] in current_risks
    )

    return {
        "system_health": system_health,
        "health_score": health_score,
        "health_dimensions": categories,
        "health_coverage": f"{len(measured)}/5 measured dimensions",
        "health_scoring": (
            "Arithmetic mean of measured dimensions only. CPU penalizes "
            "utilization above 80% only while processes are ready; memory is "
            "100 minus utilization and half the fragmentation percent; I/O "
            "deducts 20 per queued request and 15 per I/O waiter; processes "
            "deduct 25 for starvation risk and 15 per ready process; resources "
            "score 100 when Banker's check is safe and 25 when unsafe. "
            "Unavailable dimensions are excluded, not assumed healthy."
        ),
        "severity": primary["severity"] if primary else "INFO",
        "primary_issue": primary["issue"] if primary else "No threshold-based issue detected",
        "affected_processes": primary["affected_processes"] if primary else [],
        "evidence": primary["evidence"] if primary else [
            "No configured diagnosis threshold was exceeded by the available snapshot"
        ],
        "root_cause": primary["root_cause"] if primary else "No causal issue was identified from available measurements.",
        "recommendation": primary["recommendation"] if primary else "Continue monitoring measured Engine state.",
        "causal_chain": primary["causal_chain"] if primary else [],
        "findings": findings,
        "warnings": [f"{f['severity']}: {f['issue']}" for f in findings],
        "predictions": predictions,
        "metrics": {
            "cpu_utilization_percent": utilization,
            "ready_queue_length": len(ready),
            "average_waiting_time": metrics.get("average_waiting_time"),
            "average_response_time": metrics.get("average_response_time"),
            "context_switches": context_switches,
            "memory_utilization_percent": memory_utilization,
            "external_fragmentation_percent": fragmentation,
            "page_faults": virtual_memory.get("page_faults", 0),
            "io_queue_length": io_queue_count,
            "resource_state_safe": banker.get("safe"),
        },
        "last_scheduler_run": {
            "algorithm": last_result.get("algorithm"),
            "metrics": last_result.get("metrics"),
            "current_workload": current_run_metrics,
            "note": (
                "Last scheduler metrics match the current runnable workload."
                if current_run_metrics
                else "Last scheduler metrics are historical and do not describe the current runnable workload."
            ),
        },
        "source": "execos-kernel-engine-snapshot",
    }
