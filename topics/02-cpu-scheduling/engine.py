# ExecOS · CPU Scheduling · Kernel Engine backend methods
# Copied verbatim from (the app still runs from these originals):
#   backend/app/kernel_engine.py lines 862-865
#   backend/app/kernel_engine.py lines 467-476
#   backend/app/kernel_engine.py lines 478-499
#   backend/app/kernel_engine.py lines 501-536
#   backend/app/kernel_engine.py lines 538-823
#   backend/app/kernel_engine.py lines 825-836
#   backend/app/kernel_engine.py lines 838-860
#   backend/app/kernel_engine.py lines 1835-1859
#   backend/app/kernel_engine.py lines 1951-2010
#   backend/app/kernel_engine.py lines 2012-2180

# Excerpt of methods from class ExecOSKernelEngine; imports and the rest of the class stay in kernel_engine.py.

class ExecOSKernelEngine:  # excerpt
    def _admit_arrivals(self) -> None:
        for process in self._processes.values():
            if process.state == ProcessState.NEW and process.arrival_time <= self._clock_tick:
                self._admit_process(process, "arrival")

    def _save_context(self, process: Process) -> None:
        process.registers["R0"] = process.remaining_time
        process.registers["R1"] = process.priority
        process.registers["R2"] = self._clock_tick
        process.stack_pointer = max(0, process.stack_pointer - 16)
        self._record("CONTEXT_SAVED", process.pid, "scheduler", {
            "program_counter": process.program_counter,
            "stack_pointer": process.stack_pointer,
            "registers": copy.deepcopy(process.registers),
        })

    def _restore_context(
        self,
        process: Process,
        policy: SchedulingPolicy | None = None,
    ) -> None:
        if process.state == ProcessState.READY:
            process.stack_pointer += 16
        process.state = ProcessState.RUNNING
        if process.start_time is None:
            process.start_time = self._clock_tick
            process.response_time = self._clock_tick - process.arrival_time
        self._current_pid = process.pid
        self._record("CONTEXT_RESTORED", process.pid, "scheduler", {
            "program_counter": process.program_counter,
            "stack_pointer": process.stack_pointer,
            "registers": copy.deepcopy(process.registers),
        })
        self._record("PROCESS_RUNNING", process.pid, "scheduler", {
            "policy": policy or (
                self._last_schedule["algorithm"] if self._last_schedule else "manual"
            ),
        })

    def _select_process(
        self,
        policy: SchedulingPolicy,
        ready_queue: list[Process] | None = None,
    ) -> Process | None:
        candidates = list(ready_queue if ready_queue is not None else self._runnable_processes())
        if not candidates:
            return None
        if policy == "fcfs":
            key = lambda process: (process.arrival_time, process.created_sequence)
        elif policy == "sjf":
            key = lambda process: (process.burst_time, process.arrival_time, process.created_sequence)
        elif policy == "srtf":
            key = lambda process: (process.remaining_time, process.arrival_time, process.created_sequence)
        elif policy == "priority":
            key = lambda process: (process.priority, process.arrival_time, process.created_sequence)
        elif policy == "round_robin":
            candidates.sort(key=lambda process: (
                process.arrival_time,
                process.created_sequence,
            ))
            if self._rr_last_pid:
                previous_index = next(
                    (
                        index
                        for index, item in enumerate(candidates)
                        if item.pid == self._rr_last_pid
                    ),
                    None,
                )
                if previous_index is not None:
                    return candidates[(previous_index + 1) % len(candidates)]
            return candidates[0]
        else:
            key = lambda process: (process.arrival_time, process.created_sequence)
        return min(candidates, key=key)

    def run_scheduler(
        self,
        algorithm: SchedulingPolicy = "round_robin",
        quantum: int = 4,
        max_ticks: int = 100_000,
    ) -> dict[str, Any]:
        if algorithm not in {"fcfs", "sjf", "srtf", "priority", "round_robin"}:
            raise KernelEngineError("Unsupported scheduling policy")
        if algorithm == "round_robin" and not 1 <= quantum <= 10_000:
            raise KernelEngineError("Round Robin quantum must be between 1 and 10000")
        if not 1 <= max_ticks <= 100_000:
            raise KernelEngineError("max_ticks must be between 1 and 100000")
        with self._lock:
            self._admit_arrivals()
            if self._current_pid:
                current = self._processes[self._current_pid]
                if current.state == ProcessState.RUNNING:
                    self._save_context(current)
                    current.state = ProcessState.READY
                    self._record("PROCESS_READY", current.pid, "scheduler", {
                        "reason": "scheduler run started"
                    })
                self._current_pid = None
            eligible = self._runnable_processes()
            pending_arrivals = any(
                process.state == ProcessState.NEW
                for process in self._processes.values()
            )
            self._log_scheduler_state(algorithm, selected_process=None)
            if not eligible and not pending_arrivals:
                raise KernelEngineError(
                    "No READY processes are available; the ready queue is empty"
                )

            self._record("SCHEDULER_STARTED", None, "scheduler", {
                "algorithm": algorithm,
                "quantum": quantum if algorithm == "round_robin" else None,
                "ready_queue": self._ready_queue(),
            })
            timeline: list[dict[str, Any]] = []
            completed_this_run: list[Process] = []
            context_switches = 0
            idle_ticks = 0
            previous_pid: str | None = None
            initial_tick = self._clock_tick
            workload_profile = sorted(
                [
                    {
                        "remaining_time": process.remaining_time,
                        "priority": process.priority,
                    }
                    for process in eligible
                ],
                key=lambda item: (item["remaining_time"], item["priority"]),
            )

            while self._clock_tick - initial_tick < max_ticks:
                self._admit_arrivals()
                runnable_queue = self._runnable_processes()
                ready_before_selection = [item.pid for item in runnable_queue]
                process = self._select_process(algorithm, runnable_queue)
                if process is None:
                    pending = [
                        item for item in self._processes.values()
                        if item.state == ProcessState.NEW
                    ]
                    if not pending:
                        break
                    self._clock_tick += 1
                    idle_ticks += 1
                    self._record("CPU_IDLE_TICK", None, "scheduler", {
                        "reason": "waiting for process arrival"
                    })
                    continue
                self._log_scheduler_state(algorithm, selected_process=process.pid)

                selection_criteria = {
                    "fcfs": ("earliest arrival time", process.arrival_time),
                    "sjf": ("shortest original CPU burst", process.burst_time),
                    "srtf": ("shortest remaining CPU time", process.remaining_time),
                    "priority": ("highest priority (lowest number)", process.priority),
                    "round_robin": (
                        "next process in the circular ready queue",
                        f"after {self._rr_last_pid}" if self._rr_last_pid else "queue head",
                    ),
                }
                self._record("PROCESS_SELECTED", process.pid, "scheduler", {
                    "algorithm": algorithm,
                    "criterion": selection_criteria[algorithm][0],
                    "value": selection_criteria[algorithm][1],
                    "ready_queue": ready_before_selection,
                })
                if previous_pid is not None and previous_pid != process.pid:
                    context_switches += 1
                    self._record("TIMER_INTERRUPT", previous_pid, "interrupt", {
                        "tick": self._clock_tick,
                        "reason": "scheduler dispatch",
                    })
                    self._record("CONTEXT_SWITCH", process.pid, "scheduler", {
                        "from_pid": previous_pid,
                        "to_pid": process.pid,
                        "algorithm": algorithm,
                    })
                    self._record("PROCESS_READY", previous_pid, "scheduler", {
                        "reason": "preempted by scheduler"
                    })
                if process.state != ProcessState.RUNNING:
                    self._restore_context(process, algorithm)

                run_ticks = (
                    min(quantum, process.remaining_time)
                    if algorithm == "round_robin"
                    else 1
                )
                if algorithm in {"fcfs", "sjf", "priority"}:
                    run_ticks = process.remaining_time
                if algorithm == "srtf":
                    run_ticks = 1
                run_start = self._clock_tick
                ready_at_start = self._ready_queue()
                for _ in range(run_ticks):
                    if process.state != ProcessState.RUNNING:
                        break
                    self._clock_tick += 1
                    process.remaining_time -= 1
                    process.program_counter += 1
                    process.total_cpu_time += 1
                    process.registers["R0"] = process.remaining_time
                    process.registers["R3"] = process.program_counter
                    for candidate in self._processes.values():
                        if (
                            candidate.pid != process.pid
                            and candidate.state == ProcessState.READY
                        ):
                            candidate.waiting_time += 1
                    self._admit_arrivals()
                    if algorithm == "srtf":
                        challenger = self._select_process(algorithm)
                        if challenger and challenger.pid != process.pid:
                            break

                elapsed = self._clock_tick - run_start
                if elapsed:
                    timeline.append({
                        "pid": process.pid,
                        "name": process.name,
                        "start": run_start,
                        "end": self._clock_tick,
                        "duration": elapsed,
                        "state": "COMPLETED" if process.remaining_time == 0 else "PREEMPTED",
                        "algorithm": algorithm,
                        "selection_criterion": selection_criteria[algorithm][0],
                        "selection_value": selection_criteria[algorithm][1],
                        "ready_queue": ready_before_selection,
                    })
                    self._record("CPU_BURST_EXECUTED", process.pid, "scheduler", {
                        "start": run_start,
                        "end": self._clock_tick,
                        "duration": elapsed,
                        "remaining_time": process.remaining_time,
                        "ready_queue": ready_at_start,
                    })
                previous_pid = process.pid
                if algorithm == "round_robin":
                    self._rr_last_pid = process.pid

                if process.remaining_time == 0:
                    process.state = ProcessState.TERMINATED
                    process.completion_time = self._clock_tick
                    process.turnaround_time = (
                        process.completion_time - process.arrival_time
                    )
                    process.wait_reason = None
                    self._current_pid = None
                    self._release_memory(process.pid)
                    self._release_virtual_memory(process.pid)
                    self._release_non_memory_resources(process.pid)
                    self._allocation[process.pid] = {"CPU": 0, "Memory": 0, "Disk": 0}
                    self._grant_pending_resource_requests("Memory")
                    completed_this_run.append(process)
                    self._record("PROCESS_COMPLETED", process.pid, "scheduler", {
                        "completion_time": process.completion_time,
                        "turnaround_time": process.turnaround_time,
                    })
                    previous_pid = process.pid
                elif process.state == ProcessState.RUNNING:
                    self._save_context(process)
                    process.state = ProcessState.READY
                    self._current_pid = None
                    self._record("PROCESS_PREEMPTED", process.pid, "scheduler", {
                        "remaining_time": process.remaining_time,
                        "policy": algorithm,
                        "tick": self._clock_tick,
                    })
                    self._record("PROCESS_READY", process.pid, "scheduler", {
                        "reason": (
                            "time quantum expired"
                            if algorithm == "round_robin"
                            else "preempted by shorter remaining time"
                            if algorithm == "srtf"
                            else "scheduler yielded"
                        )
                    })
                    if algorithm == "round_robin":
                        self._record("TIMER_INTERRUPT", process.pid, "interrupt", {
                            "tick": self._clock_tick,
                            "reason": "round-robin quantum expired",
                        })
                        self._record("TIME_QUANTUM_EXPIRED", process.pid, "scheduler", {
                            "quantum": quantum
                        })

                if not any(
                    item.state in {ProcessState.READY, ProcessState.NEW}
                    for item in self._processes.values()
                ):
                    break

            unfinished = [
                process.pid
                for process in self._processes.values()
                if process.state in {ProcessState.READY, ProcessState.NEW}
            ]
            if unfinished and self._clock_tick - initial_tick >= max_ticks:
                raise KernelEngineError("Scheduler tick budget exhausted")

            completed = completed_this_run
            count = len(completed)
            average_waiting = (
                sum(process.waiting_time for process in completed) / count if count else 0.0
            )
            average_turnaround = (
                sum(
                    process.completion_time - process.arrival_time
                    for process in completed
                    if process.completion_time is not None
                ) / count if count else 0.0
            )
            average_response = (
                sum(process.response_time or 0 for process in completed) / count
                if count else 0.0
            )
            elapsed_total = self._clock_tick - initial_tick
            busy_ticks = sum(item["duration"] for item in timeline)
            metrics = {
                "average_waiting_time": round(average_waiting, 2),
                "average_turnaround_time": round(average_turnaround, 2),
                "average_response_time": round(average_response, 2),
                "completion_time": self._clock_tick,
                "cpu_utilization_percent": (
                    round(100 * busy_ticks / elapsed_total, 2) if elapsed_total else 0.0
                ),
                "throughput_per_tick": round(count / elapsed_total, 4) if elapsed_total else 0.0,
                "context_switches": context_switches,
                "idle_ticks": idle_ticks,
                "io_queue_length": self.io_state()["queue_depth"],
            }
            result = {
                "algorithm": algorithm,
                "quantum": quantum if algorithm == "round_robin" else None,
                "start_tick": initial_tick,
                "end_tick": self._clock_tick,
                "timeline": timeline,
                "metrics": metrics,
                "completed_pids": [item.pid for item in completed],
                "remaining_pids": unfinished,
            }
            self._schedule_history.append({
                "algorithm": algorithm,
                "quantum": quantum if algorithm == "round_robin" else None,
                "start_tick": initial_tick,
                "end_tick": self._clock_tick,
                "process_count": count,
                "workload_profile": workload_profile,
                "metrics": copy.deepcopy(metrics),
            })
            self._schedule_history = self._schedule_history[-20:]
            self._last_schedule = copy.deepcopy(result)
            self._record("SCHEDULER_COMPLETED", None, "scheduler", {
                "algorithm": algorithm,
                "metrics": metrics,
                "timeline_segments": len(timeline),
            })
            response = copy.deepcopy(result)
            response["engine_state"] = self.overview()
            return response

    def run_scheduler_if_state_unchanged(
        self,
        algorithm: SchedulingPolicy,
        quantum: int,
        expected_state: dict[str, Any],
    ) -> dict[str, Any]:
        with self._lock:
            if self.overview() != expected_state:
                raise KernelEngineError(
                    "Kernel state changed after planning; create a fresh recovery plan"
                )
            return self.run_scheduler(algorithm, quantum)

    def _log_scheduler_state(
        self,
        policy: SchedulingPolicy,
        selected_process: str | None,
    ) -> None:
        ready_queue = self._ready_queue()
        processes = (
            self._processes.values()
            if selected_process is None
            else [self._require_process(selected_process)]
        )
        for process in processes:
            logger.debug(
                "scheduler_state pid=%s state=%s remaining_burst_time=%s "
                "ready_queue=%s selected_policy=%s selected_process=%s engine_tick=%s",
                process.pid,
                process.state.value,
                process.remaining_time,
                ready_queue,
                policy,
                selected_process,
                self._clock_tick,
            )

    def scheduler_state(self) -> dict[str, Any]:
        with self._lock:
            running = [
                process.pid
                for process in self._processes.values()
                if process.state == ProcessState.RUNNING
            ]
            return {
                "clock_tick": self._clock_tick,
                "current_pid": self._current_pid,
                "running": running,
                "ready_queue": self._ready_queue(),
                "last_result": copy.deepcopy(self._last_schedule),
                "history": copy.deepcopy(self._schedule_history),
                "supported_algorithms": [
                    "fcfs",
                    "sjf",
                    "srtf",
                    "priority",
                    "round_robin",
                ],
                "default_algorithm": "round_robin",
                "default_quantum": 4,
                "source": "execos-kernel-engine",
            }

    def compare_schedulers(self) -> dict[str, Any]:
        with self._lock:
            base = self._analysis_clone()
            workload_size = self._prepare_analysis_workload(base)
            if not workload_size:
                raise KernelEngineError("No runnable processes are available to compare")
            if sum(
                process.remaining_time
                for process in base._processes.values()
                if process.state == ProcessState.READY
            ) > 10_000:
                raise KernelEngineError(
                    "Scheduler comparison is limited to 10000 total CPU ticks"
                )
            outcomes = []
            for policy in ("fcfs", "sjf", "srtf", "priority", "round_robin"):
                candidate = base._analysis_clone()
                result = candidate.run_scheduler(policy, quantum=4, max_ticks=10_000)
                metrics = result["metrics"]
                outcomes.append({
                    "algorithm": policy,
                    "quantum": 4 if policy == "round_robin" else None,
                    "metrics": metrics,
                    "timeline": result["timeline"],
                })
            recommendation = min(
                outcomes,
                key=lambda item: (
                    item["metrics"]["average_response_time"],
                    item["metrics"]["average_waiting_time"],
                    item["metrics"]["context_switches"],
                    item["algorithm"],
                ),
            )
            recommendation_metrics = recommendation["metrics"]
            return {
                "workload_size": workload_size,
                "baseline_policy": (
                    self._last_schedule["algorithm"]
                    if self._last_schedule
                    else "round_robin"
                ),
                "candidates": outcomes,
                "recommended_algorithm": recommendation["algorithm"],
                "recommended_quantum": recommendation["quantum"],
                "recommendation_reason": (
                    f"{recommendation['algorithm'].upper()} was selected with "
                    f"{recommendation_metrics['average_response_time']:.2f} "
                    f"average response ticks, "
                    f"{recommendation_metrics['average_waiting_time']:.2f} "
                    f"average waiting ticks, and "
                    f"{recommendation_metrics['context_switches']} context "
                    "switches. Ranking prioritizes average response time, "
                    "then average waiting time, then context switches. "
                    "Every metric came from an independent scheduler run on "
                    "an identical normalized copy of the current runnable workload."
                ),
                "source": "execos-kernel-engine-copy",
                "read_only": True,
            }

    def simulate_what_if(
        self,
        algorithm: SchedulingPolicy = "round_robin",
        quantum: int = 4,
        process_pid: str | None = None,
        priority: int | None = None,
        burst_time: int | None = None,
        arrival_time: int | None = None,
        allocation_policy: AllocationPolicy | None = None,
        allocation_pid: str | None = None,
        memory_size_mb: int | None = None,
    ) -> dict[str, Any]:
        if algorithm not in {"fcfs", "sjf", "srtf", "priority", "round_robin"}:
            raise KernelEngineError("Unsupported scheduling policy")
        if algorithm == "round_robin" and not 1 <= quantum <= 10_000:
            raise KernelEngineError("Round Robin quantum must be between 1 and 10000")
        if allocation_policy is not None and allocation_policy not in {
            "first_fit", "best_fit", "worst_fit"
        }:
            raise KernelEngineError("Unsupported memory allocation policy")
        with self._lock:
            original = self._analysis_clone()
            runnable = self._prepare_analysis_workload(original)
            if not runnable:
                raise KernelEngineError("No runnable processes are available to simulate")
            workload_ticks = sum(
                process.remaining_time
                for process in original._processes.values()
                if process.state == ProcessState.READY
            )
            if workload_ticks > 10_000:
                raise KernelEngineError(
                    "What-if simulation is limited to 10000 total CPU ticks"
                )
            if priority is not None or burst_time is not None or arrival_time is not None:
                if process_pid is None:
                    raise KernelEngineError(
                        "Select a process before changing its workload attributes"
                    )
                process = original._require_process(process_pid)
                if process.state != ProcessState.READY:
                    raise KernelEngineError("Selected process is not in the runnable workload")
                if priority is not None:
                    if not 1 <= priority <= 10:
                        raise KernelEngineError("Priority must be between 1 and 10")
                    process.priority = priority
                if burst_time is not None:
                    if not 1 <= burst_time <= 10_000:
                        raise KernelEngineError("Burst must be between 1 and 10000 ticks")
                    process.burst_time = burst_time
                    process.remaining_time = burst_time
                if arrival_time is not None:
                    if not 0 <= arrival_time <= 10_000:
                        raise KernelEngineError("Arrival tick must be between 0 and 10000")
                    process.arrival_time = arrival_time
                    process.state = (
                        ProcessState.READY
                        if arrival_time <= original._clock_tick
                        else ProcessState.NEW
                    )
            if allocation_policy is not None:
                if allocation_pid is None or memory_size_mb is None:
                    raise KernelEngineError(
                        "Select a process and memory amount to compare allocation strategies"
                    )
                if not 1 <= memory_size_mb <= self.MEMORY_TOTAL_MB:
                    raise KernelEngineError("Memory amount is outside the Engine arena size")
                original.allocate_memory(allocation_pid, memory_size_mb, allocation_policy)
            simulated_memory_state = original.memory_state()

            baseline_policy: SchedulingPolicy = (
                self._last_schedule["algorithm"]
                if self._last_schedule
                else "round_robin"
            )
            baseline_quantum = (
                self._last_schedule.get("quantum") or 4
                if self._last_schedule
                else 4
            )
            current = self._analysis_clone()
            self._prepare_analysis_workload(current)
            current_memory_state = current.memory_state()
            current_result = current.run_scheduler(
                baseline_policy,
                quantum=baseline_quantum,
                max_ticks=10_000,
            )
            simulated_result = original.run_scheduler(
                algorithm,
                quantum=quantum,
                max_ticks=10_000,
            )
            current_metrics = current_result["metrics"]
            simulated_metrics = simulated_result["metrics"]
            metric_keys = (
                "average_waiting_time",
                "average_turnaround_time",
                "average_response_time",
                "cpu_utilization_percent",
                "context_switches",
                "throughput_per_tick",
            )
            delta = {
                key: round(simulated_metrics[key] - current_metrics[key], 4)
                for key in metric_keys
            }
            explanatory_metrics = (
                ("average_waiting_time", "average waiting time"),
                ("average_turnaround_time", "average turnaround time"),
                ("average_response_time", "average response time"),
                ("context_switches", "context switches"),
                ("cpu_utilization_percent", "CPU utilization"),
                ("throughput_per_tick", "throughput"),
            )
            explanations = [
                (
                    f"{label} "
                    f"{'decreased' if delta[key] < 0 else 'increased'} "
                    f"by {abs(delta[key]):.4f}"
                )
                for key, label in explanatory_metrics
                if delta[key] != 0
            ]
            explanation = (
                "On the normalized current workload"
                + (
                    " with the requested process/memory overrides"
                    if priority is not None
                    or burst_time is not None
                    or arrival_time is not None
                    or allocation_policy is not None
                    else ""
                )
                + (", " + "; ".join(explanations) + "."
                   if explanations
                   else ", the measured scheduler metrics are unchanged.")
            )
            return {
                "current": {
                    "algorithm": baseline_policy,
                    "quantum": baseline_quantum if baseline_policy == "round_robin" else None,
                    "metrics": current_metrics,
                    "timeline": current_result["timeline"],
                },
                "simulated": {
                    "algorithm": algorithm,
                    "quantum": quantum if algorithm == "round_robin" else None,
                    "metrics": simulated_metrics,
                    "timeline": simulated_result["timeline"],
                },
                "memory": {
                    "current": current_memory_state,
                    "simulated": simulated_memory_state,
                } if allocation_policy is not None else None,
                "delta": delta,
                "explanation": explanation,
                "changes": {
                    "process_pid": process_pid if priority is not None or burst_time is not None or arrival_time is not None else None,
                    "priority": priority,
                    "burst_time": burst_time,
                    "arrival_time": arrival_time,
                    "allocation_pid": allocation_pid if allocation_policy else None,
                    "memory_size_mb": memory_size_mb if allocation_policy else None,
                    "allocation_policy": allocation_policy,
                },
                "source": "execos-kernel-engine-copy",
                "read_only": True,
            }
