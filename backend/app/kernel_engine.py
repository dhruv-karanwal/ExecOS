"""Stateful, deterministic software kernel engine for the ExecOS workbench."""

from __future__ import annotations

import copy
import logging
import shlex
import time
from collections import deque
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from enum import Enum
from threading import RLock
from typing import Any, Literal

SchedulingPolicy = Literal["fcfs", "sjf", "srtf", "priority", "round_robin"]
AllocationPolicy = Literal["first_fit", "best_fit", "worst_fit"]
ReplacementPolicy = Literal["fifo", "lru"]
logger = logging.getLogger(__name__)


class ProcessState(str, Enum):
    NEW = "NEW"
    READY = "READY"
    RUNNING = "RUNNING"
    WAITING = "WAITING"
    TERMINATED = "TERMINATED"


class KernelEngineError(ValueError):
    """An invalid or impossible kernel-engine operation."""


@dataclass
class Process:
    pid: str
    name: str
    state: ProcessState
    priority: int
    arrival_time: int
    burst_time: int
    remaining_time: int
    program_counter: int
    registers: dict[str, int]
    memory_allocation_mb: int
    parent_pid: str | None
    created_sequence: int
    start_time: int | None = None
    completion_time: int | None = None
    turnaround_time: int | None = None
    waiting_time: int = 0
    response_time: int | None = None
    wait_reason: str | None = None
    stack_pointer: int = 4096
    total_cpu_time: int = 0


@dataclass
class IORequest:
    request_id: int
    pid: str
    device: str
    operation: str
    status: str
    created_at_tick: int


class ExecOSKernelEngine:
    """Single-process software kernel with locked, observable OS module state."""

    MEMORY_TOTAL_MB = 4096
    VIRTUAL_FRAME_COUNT = 4

    def __init__(self) -> None:
        self._lock = RLock()
        self._clock_tick = 0
        self._sequence = 0
        self._next_pid = 101
        self._next_request_id = 1
        self._processes: dict[str, Process] = {}
        self._memory_blocks: list[dict[str, Any]] = [
            {"start_mb": 0, "size_mb": self.MEMORY_TOTAL_MB, "pid": None}
        ]
        self._frame_table: list[dict[str, Any]] = [
            {"frame": index, "page": None, "pid": None, "last_used": 0}
            for index in range(self.VIRTUAL_FRAME_COUNT)
        ]
        self._page_tables: dict[str, dict[str, dict[str, Any]]] = {}
        self._page_faults = 0
        self._page_hits = 0
        self._page_access_sequence = 0
        self._page_fifo: deque[int] = deque()
        self._last_schedule: dict[str, Any] | None = None
        self._schedule_history: list[dict[str, Any]] = []
        self._current_pid: str | None = None
        self._rr_last_pid: str | None = None
        self._trace: list[dict[str, Any]] = []
        self._max_trace_events = 1000
        self._io_requests: list[IORequest] = []
        self._devices: dict[str, dict[str, Any]] = {
            "Keyboard": {
                "type": "Input",
                "status": "READY",
                "owner_pid": None,
                "interrupt": "IRQ 1",
            },
            "Disk": {
                "type": "Storage",
                "status": "READY",
                "owner_pid": None,
                "interrupt": "IRQ 14",
            },
            "Network": {
                "type": "I/O",
                "status": "READY",
                "owner_pid": None,
                "interrupt": "IRQ 11",
            },
            "Printer": {
                "type": "Output",
                "status": "READY",
                "owner_pid": None,
                "interrupt": "IRQ 7",
            },
        }
        self._messages: list[dict[str, Any]] = []
        self._interrupts: list[dict[str, Any]] = []
        self._syscall_history: list[dict[str, Any]] = []
        self._file_descriptors: dict[int, str] = {}
        self._next_file_descriptor = 3
        self._resources: dict[str, dict[str, int]] = {
            "CPU": {"total": 1, "available": 1},
            "Memory": {"total": self.MEMORY_TOTAL_MB, "available": self.MEMORY_TOTAL_MB},
            "Disk": {"total": 100, "available": 100},
        }
        self._allocation: dict[str, dict[str, int]] = {}
        self._maximum: dict[str, dict[str, int]] = {}
        self._pending_resource_requests: dict[str, tuple[str, int]] = {}
        self._filesystem: dict[str, dict[str, Any]] = {}
        self._boot_engine()

    def _boot_engine(self) -> None:
        self._record("KERNEL_ENGINE_READY", None, "kernel", {
            "memory_mb": self.MEMORY_TOTAL_MB,
            "scheduler": "round_robin",
            "time_quantum": 4,
        })
        self._mkdir("/ExecOS")
        for path in ("/ExecOS/bin", "/ExecOS/system", "/ExecOS/users", "/ExecOS/logs"):
            self._mkdir(path)
        for path, content in (
            ("/ExecOS/bin/scheduler.exe", "ExecOS scheduler service\n"),
            ("/ExecOS/bin/terminal.exe", "ExecOS kernel shell service\n"),
            ("/ExecOS/system/kernel.conf", "scheduler=round_robin\nquantum=4\n"),
            ("/ExecOS/system/processes.db", "Managed by the ExecOS Kernel Engine.\n"),
            ("/ExecOS/users/vedanti/notes.txt", "ExecOS workbench notes\n"),
            ("/ExecOS/users/vedanti/project.txt", "Kernel Engine state is authoritative.\n"),
            ("/ExecOS/logs/kernel.log", "Kernel Engine boot complete.\n"),
            ("/ExecOS/logs/events.log", "Execution events are recorded in the trace.\n"),
        ):
            if path.endswith("/vedanti/notes.txt") or path.endswith("/vedanti/project.txt"):
                self._mkdir("/ExecOS/users/vedanti")
            self._filesystem[path] = {
                "type": "file",
                "content": content,
                "owner": "system",
                "created_at_tick": self._clock_tick,
            }
        self._record("FILESYSTEM_MOUNTED", None, "filesystem", {
            "root": "/ExecOS",
            "entries": len(self._filesystem),
        })
        self._create_process(
            "init",
            burst_time=8,
            priority=3,
            memory_mb=128,
            arrival_time=0,
            parent_pid=None,
            trace_kind="KERNEL_SERVICE_STARTED",
        )
        self._create_process(
            "scheduler",
            burst_time=6,
            priority=2,
            memory_mb=192,
            arrival_time=0,
            parent_pid="P101",
            trace_kind="KERNEL_SERVICE_STARTED",
        )
        self._create_process(
            "event-worker",
            burst_time=10,
            priority=4,
            memory_mb=256,
            arrival_time=0,
            parent_pid="P101",
            trace_kind="KERNEL_SERVICE_STARTED",
        )
        self._record("BOOT_COMPLETE", None, "kernel", {
            "ready_queue": self._ready_queue(),
            "process_count": len(self._processes),
        })

    def _now(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    def _record(
        self,
        event: str,
        pid: str | None,
        module: str,
        details: dict[str, Any] | str,
    ) -> dict[str, Any]:
        self._sequence += 1
        item = {
            "sequence": self._sequence,
            "timestamp": self._now(),
            "tick": self._clock_tick,
            "event": event,
            "pid": pid,
            "module": module,
            "details": details if isinstance(details, str) else copy.deepcopy(details),
        }
        self._trace.append(item)
        if len(self._trace) > self._max_trace_events:
            del self._trace[: len(self._trace) - self._max_trace_events]
        return item

    def _require_process(self, pid: str) -> Process:
        process = self._processes.get(pid)
        if process is None:
            raise KernelEngineError(f"Unknown process {pid}")
        return process

    def _ready_queue(self) -> list[str]:
        return [process.pid for process in self._runnable_processes()]

    def _runnable_processes(self) -> list[Process]:
        return [
            process
            for process in sorted(
                self._processes.values(),
                key=lambda item: (item.arrival_time, item.created_sequence),
            )
            if process.state == ProcessState.READY
        ]

    def _process_snapshot(self, process: Process) -> dict[str, Any]:
        snapshot = asdict(process)
        if process.completion_time is not None:
            snapshot["turnaround_time"] = process.completion_time - process.arrival_time
        return snapshot

    def _create_process(
        self,
        name: str,
        burst_time: int,
        priority: int = 5,
        memory_mb: int = 64,
        arrival_time: int | None = None,
        parent_pid: str | None = None,
        trace_kind: str = "PROCESS_CREATED",
    ) -> Process:
        if not name.strip():
            raise KernelEngineError("Process name is required")
        if not 1 <= burst_time <= 100_000:
            raise KernelEngineError("CPU burst must be between 1 and 100000 ticks")
        if not 1 <= priority <= 10:
            raise KernelEngineError("Priority must be between 1 and 10 (1 is highest)")
        if not 1 <= memory_mb <= self.MEMORY_TOTAL_MB:
            raise KernelEngineError(
                f"Memory allocation must be between 1 and {self.MEMORY_TOTAL_MB} MB"
            )
        if parent_pid is not None:
            self._require_process(parent_pid)
        pid = f"P{self._next_pid}"
        allocated_mb = self._allocate_memory(pid, memory_mb, "first_fit")
        self._next_pid += 1
        self._sequence += 1
        process = Process(
            pid=pid,
            name=name.strip()[:64],
            state=ProcessState.NEW,
            priority=priority,
            arrival_time=self._clock_tick if arrival_time is None else arrival_time,
            burst_time=burst_time,
            remaining_time=burst_time,
            program_counter=0,
            registers={f"R{index}": 0 for index in range(8)},
            memory_allocation_mb=0,
            parent_pid=parent_pid,
            created_sequence=self._sequence,
        )
        self._processes[pid] = process
        self._allocation[pid] = {"CPU": 0, "Memory": 0, "Disk": 0}
        self._maximum[pid] = {
            "CPU": 1,
            "Memory": min(self.MEMORY_TOTAL_MB, memory_mb + 1024),
            "Disk": 100,
        }
        process.memory_allocation_mb = allocated_mb
        self._allocation[pid]["Memory"] = memory_mb
        self._resources["Memory"]["available"] -= memory_mb
        self._record(trace_kind, pid, "process", {
            "name": process.name,
            "state": ProcessState.NEW,
            "priority": priority,
            "arrival_time": process.arrival_time,
            "burst_time": burst_time,
            "memory_mb": memory_mb,
            "parent_pid": parent_pid,
        })
        self._record("MEMORY_ALLOCATED", pid, "memory", {
            "size_mb": memory_mb,
            "policy": "first_fit",
            "reason": "process admission",
        })
        if process.arrival_time <= self._clock_tick:
            self._admit_process(process, "arrival")
        return process

    def _admit_process(self, process: Process, reason: str) -> None:
        if process.state != ProcessState.NEW:
            raise KernelEngineError(f"Only a NEW process can be admitted: {process.pid}")
        process.state = ProcessState.READY
        self._record("PROCESS_ADMITTED", process.pid, "process", {
            "reason": reason,
            "arrival_time": process.arrival_time,
            "memory_mb": process.memory_allocation_mb,
        })
        self._record("PROCESS_READY", process.pid, "process", {
            "reason": reason,
            "arrival_time": process.arrival_time,
        })

    def create_process(
        self,
        name: str,
        burst_time: int,
        priority: int = 5,
        memory_mb: int = 64,
        arrival_time: int | None = None,
        parent_pid: str | None = None,
    ) -> dict[str, Any]:
        with self._lock:
            process = self._create_process(
                name, burst_time, priority, memory_mb, arrival_time, parent_pid
            )
            response = self._process_snapshot(process)
            response["engine_state"] = self.overview()
            return response

    def process_action(self, pid: str, action: str, priority: int | None = None) -> dict[str, Any]:
        with self._lock:
            process = self._require_process(pid)
            normalized = action.casefold()
            if normalized == "start":
                if process.state == ProcessState.NEW and process.arrival_time <= self._clock_tick:
                    self._admit_process(process, "manual dispatch")
                if process.state != ProcessState.READY:
                    raise KernelEngineError("Only a READY process can be started")
                if self._current_pid and self._current_pid != pid:
                    raise KernelEngineError(
                        f"CPU is occupied by {self._current_pid}; dispatch is unavailable"
                    )
                policy = self._last_schedule["algorithm"] if self._last_schedule else "manual"
                self._restore_context(process, policy)
                self._record("PROCESS_DISPATCHED", pid, "scheduler", {
                    "policy": policy,
                    "tick": self._clock_tick,
                })
            elif normalized == "pause":
                if process.state not in {ProcessState.READY, ProcessState.RUNNING}:
                    raise KernelEngineError("Only READY or RUNNING processes can be paused")
                if process.state == ProcessState.RUNNING:
                    self._save_context(process)
                    self._current_pid = None
                process.state = ProcessState.WAITING
                process.wait_reason = "paused"
                self._record("PROCESS_PAUSED", pid, "process", {"state": process.state})
            elif normalized == "resume":
                if process.wait_reason != "paused":
                    raise KernelEngineError("Only a paused process can be resumed")
                process.state = ProcessState.READY
                process.wait_reason = None
                self._record("PROCESS_RESUMED", pid, "process", {"state": process.state})
            elif normalized == "terminate":
                self._terminate(process, "user request")
            elif normalized == "priority":
                if priority is None or not 1 <= priority <= 10:
                    raise KernelEngineError("Priority must be between 1 and 10")
                previous = process.priority
                process.priority = priority
                self._record("PROCESS_PRIORITY_CHANGED", pid, "process", {
                    "previous": previous,
                    "priority": priority,
                })
            else:
                raise KernelEngineError(f"Unsupported process action: {action}")
            response = self._process_snapshot(process)
            response["engine_state"] = self.overview()
            return response

    def _terminate(self, process: Process, reason: str) -> None:
        if process.state == ProcessState.TERMINATED:
            raise KernelEngineError(f"{process.pid} is already terminated")
        if process.state == ProcessState.RUNNING:
            self._save_context(process)
            self._current_pid = None
        process.state = ProcessState.TERMINATED
        process.completion_time = self._clock_tick
        process.turnaround_time = self._clock_tick - process.arrival_time
        process.wait_reason = None
        self._release_memory(process.pid)
        self._release_virtual_memory(process.pid)
        for request in self._io_requests:
            if request.pid == process.pid and request.status in {"ACTIVE", "QUEUED"}:
                request.status = "CANCELLED"
                device = self._devices[request.device]
                if device["owner_pid"] == process.pid:
                    device.update(status="READY", owner_pid=None)
                    self._activate_next_io_request(request.device)
        self._pending_resource_requests.pop(process.pid, None)
        self._release_non_memory_resources(process.pid)
        self._allocation[process.pid] = {"CPU": 0, "Memory": 0, "Disk": 0}
        self._grant_pending_resource_requests("Memory")
        self._record("PROCESS_TERMINATED", process.pid, "process", {
            "reason": reason,
            "completion_time": self._clock_tick,
            "turnaround_time": process.turnaround_time,
        })

    def _release_non_memory_resources(self, pid: str) -> None:
        for resource_name in ("CPU", "Disk"):
            allocation = self._allocation[pid][resource_name]
            self._resources[resource_name]["available"] = min(
                self._resources[resource_name]["total"],
                self._resources[resource_name]["available"] + allocation,
            )

    def _activate_next_io_request(self, device_name: str) -> None:
        device = self._devices[device_name]
        if device["owner_pid"] is not None:
            return
        next_request = next(
            (
                item for item in self._io_requests
                if item.device == device_name and item.status == "QUEUED"
            ),
            None,
        )
        if next_request:
            next_request.status = "ACTIVE"
            device.update(status="BUSY", owner_pid=next_request.pid)

    def list_processes(self) -> list[dict[str, Any]]:
        with self._lock:
            return [
                self._process_snapshot(process)
                for process in sorted(
                    self._processes.values(),
                    key=lambda item: (item.created_sequence, item.pid),
                )
            ]

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

    def _admit_arrivals(self) -> None:
        for process in self._processes.values():
            if process.state == ProcessState.NEW and process.arrival_time <= self._clock_tick:
                self._admit_process(process, "arrival")

    def _memory_allocate(
        self,
        pid: str,
        size_mb: int,
        policy: AllocationPolicy,
    ) -> int:
        if size_mb <= 0:
            raise KernelEngineError("Allocation size must be positive")
        if policy not in {"first_fit", "best_fit", "worst_fit"}:
            raise KernelEngineError("Unsupported memory allocation policy")
        candidates = [
            (index, block)
            for index, block in enumerate(self._memory_blocks)
            if block["pid"] is None and block["size_mb"] >= size_mb
        ]
        if not candidates:
            raise KernelEngineError(
                f"Cannot allocate {size_mb} MB: no contiguous free block is large enough"
            )
        if policy == "first_fit":
            index, block = candidates[0]
        elif policy == "best_fit":
            index, block = min(candidates, key=lambda pair: pair[1]["size_mb"])
        else:
            index, block = max(candidates, key=lambda pair: pair[1]["size_mb"])
        allocated = {
            "start_mb": block["start_mb"],
            "size_mb": size_mb,
            "pid": pid,
        }
        remainder = block["size_mb"] - size_mb
        replacement = [allocated]
        if remainder:
            replacement.append({
                "start_mb": block["start_mb"] + size_mb,
                "size_mb": remainder,
                "pid": None,
            })
        self._memory_blocks[index:index + 1] = replacement
        return size_mb

    def _allocate_memory(self, pid: str, size_mb: int, policy: AllocationPolicy) -> int:
        return self._memory_allocate(pid, size_mb, policy)

    def allocate_memory(
        self,
        pid: str,
        size_mb: int,
        policy: AllocationPolicy = "first_fit",
    ) -> dict[str, Any]:
        with self._lock:
            process = self._require_process(pid)
            if process.state == ProcessState.TERMINATED:
                raise KernelEngineError("Cannot allocate memory to a terminated process")
            self._memory_allocate(pid, size_mb, policy)
            process.memory_allocation_mb += size_mb
            self._allocation[pid]["Memory"] += size_mb
            self._maximum[pid]["Memory"] = min(
                self.MEMORY_TOTAL_MB,
                max(
                    self._maximum[pid]["Memory"],
                    self._allocation[pid]["Memory"],
                ),
            )
            self._resources["Memory"]["available"] -= size_mb
            self._record("MEMORY_ALLOCATED", pid, "memory", {
                "size_mb": size_mb,
                "policy": policy,
            })
            return self.memory_state()

    def _release_memory(self, pid: str) -> int:
        released = 0
        for block in self._memory_blocks:
            if block["pid"] == pid:
                released += block["size_mb"]
                block["pid"] = None
        if released:
            self._coalesce_memory()
            self._resources["Memory"]["available"] = min(
                self._resources["Memory"]["total"],
                self._resources["Memory"]["available"] + released,
            )
            if pid in self._processes:
                self._processes[pid].memory_allocation_mb = max(
                    0,
                    self._processes[pid].memory_allocation_mb - released,
                )
            self._record("MEMORY_RELEASED", pid, "memory", {"size_mb": released})
        return released

    def _release_virtual_memory(self, pid: str) -> None:
        released_frames = []
        for frame in self._frame_table:
            if frame["pid"] == pid:
                released_frames.append(frame["frame"])
                self._frame_table[frame["frame"]] = {
                    "frame": frame["frame"],
                    "page": None,
                    "pid": None,
                    "last_used": 0,
                }
        self._page_tables.pop(pid, None)
        self._page_fifo = deque(
            frame for frame in self._page_fifo if frame not in released_frames
        )
        if released_frames:
            self._record("VIRTUAL_MEMORY_RELEASED", pid, "virtual-memory", {
                "frames": released_frames,
            })

    def release_memory(self, pid: str, size_mb: int | None = None) -> dict[str, Any]:
        with self._lock:
            process = self._require_process(pid)
            owned = [
                block for block in self._memory_blocks if block["pid"] == pid
            ]
            total_owned = sum(block["size_mb"] for block in owned)
            if not total_owned:
                raise KernelEngineError(f"{pid} has no allocated memory")
            if size_mb is None or size_mb >= total_owned:
                released = self._release_memory(pid)
            else:
                if size_mb <= 0:
                    raise KernelEngineError("Release size must be positive")
                released = self._release_memory_amount(pid, size_mb)
            self._allocation[pid]["Memory"] = max(
                0, self._allocation[pid]["Memory"] - released
            )
            self._grant_pending_resource_requests("Memory")
            return self.memory_state()

    def _release_memory_amount(self, pid: str, size_mb: int) -> int:
        remaining = size_mb
        for block in reversed(self._memory_blocks):
            if block["pid"] != pid or remaining == 0:
                continue
            amount = min(remaining, block["size_mb"])
            if amount == block["size_mb"]:
                block["pid"] = None
            else:
                tail = {
                    "start_mb": block["start_mb"] + block["size_mb"] - amount,
                    "size_mb": amount,
                    "pid": None,
                }
                block["size_mb"] -= amount
                self._memory_blocks.insert(self._memory_blocks.index(block) + 1, tail)
            remaining -= amount
        self._coalesce_memory()
        released = size_mb - remaining
        self._resources["Memory"]["available"] = min(
            self._resources["Memory"]["total"],
            self._resources["Memory"]["available"] + released,
        )
        self._processes[pid].memory_allocation_mb -= released
        return released

    def _coalesce_memory(self) -> None:
        merged: list[dict[str, Any]] = []
        for block in sorted(self._memory_blocks, key=lambda item: item["start_mb"]):
            if (
                merged
                and merged[-1]["pid"] is None
                and block["pid"] is None
                and merged[-1]["start_mb"] + merged[-1]["size_mb"] == block["start_mb"]
            ):
                merged[-1]["size_mb"] += block["size_mb"]
            else:
                merged.append(block)
        self._memory_blocks = merged

    def memory_state(self) -> dict[str, Any]:
        with self._lock:
            used = sum(block["size_mb"] for block in self._memory_blocks if block["pid"])
            free_blocks = [
                block["size_mb"] for block in self._memory_blocks if block["pid"] is None
            ]
            free = sum(free_blocks)
            largest = max(free_blocks, default=0)
            fragmentation = (
                round(100 * (free - largest) / free, 2) if free else 0.0
            )
            return {
                "total_mb": self.MEMORY_TOTAL_MB,
                "used_mb": used,
                "free_mb": free,
                "utilization_percent": round(100 * used / self.MEMORY_TOTAL_MB, 2),
                "external_fragmentation_percent": fragmentation,
                "blocks": copy.deepcopy(self._memory_blocks),
                "source": "execos-kernel-engine",
            }

    def virtual_memory_state(self) -> dict[str, Any]:
        with self._lock:
            entries = []
            for pid, pages in sorted(self._page_tables.items()):
                for page, mapping in sorted(pages.items(), key=lambda pair: int(pair[0])):
                    entries.append({
                        "pid": pid,
                        "page": int(page),
                        "frame": mapping["frame"],
                        "valid": mapping["valid"],
                        "last_used": mapping["last_used"],
                    })
            return {
                "frames": copy.deepcopy(self._frame_table),
                "page_table": entries,
                "page_faults": self._page_faults,
                "page_hits": self._page_hits,
                "accesses": self._page_faults + self._page_hits,
                "hit_ratio_percent": round(
                    100 * self._page_hits / max(1, self._page_faults + self._page_hits),
                    2,
                ),
                "source": "execos-kernel-engine",
            }

    def access_page(
        self,
        pid: str,
        page: int,
        policy: ReplacementPolicy = "fifo",
    ) -> dict[str, Any]:
        with self._lock:
            process = self._require_process(pid)
            if process.state == ProcessState.TERMINATED:
                raise KernelEngineError("Cannot access memory for a terminated process")
            if page < 0:
                raise KernelEngineError("Page number cannot be negative")
            if policy not in {"fifo", "lru"}:
                raise KernelEngineError("Page replacement policy must be fifo or lru")
            self._page_access_sequence += 1
            pages = self._page_tables.setdefault(pid, {})
            key = str(page)
            existing = pages.get(key)
            if existing and existing["valid"]:
                self._page_hits += 1
                frame_index = existing["frame"]
                existing["last_used"] = self._page_access_sequence
                self._frame_table[frame_index]["last_used"] = self._page_access_sequence
                self._record("PAGE_HIT", pid, "virtual-memory", {
                    "page": page,
                    "frame": frame_index,
                })
                fault = False
            else:
                self._page_faults += 1
                free_frame = next(
                    (frame for frame in self._frame_table if frame["page"] is None),
                    None,
                )
                if free_frame is None:
                    if policy == "fifo":
                        frame_index = self._page_fifo.popleft()
                    else:
                        frame_index = min(
                            self._frame_table,
                            key=lambda frame: frame["last_used"],
                        )["frame"]
                    old_frame = self._frame_table[frame_index]
                    old_pid, old_page = old_frame["pid"], old_frame["page"]
                    if old_pid is not None and old_page is not None:
                        self._page_tables[old_pid][str(old_page)]["valid"] = False
                    self._record("PAGE_REPLACED", pid, "virtual-memory", {
                        "evicted_pid": old_pid,
                        "evicted_page": old_page,
                        "frame": frame_index,
                        "policy": policy,
                    })
                else:
                    frame_index = free_frame["frame"]
                    if frame_index not in self._page_fifo:
                        self._page_fifo.append(frame_index)
                pages[key] = {
                    "frame": frame_index,
                    "valid": True,
                    "last_used": self._page_access_sequence,
                }
                self._frame_table[frame_index] = {
                    "frame": frame_index,
                    "page": page,
                    "pid": pid,
                    "last_used": self._page_access_sequence,
                }
                self._record("PAGE_FAULT", pid, "virtual-memory", {
                    "page": page,
                    "frame": frame_index,
                    "policy": policy,
                })
                fault = True
            state = self.virtual_memory_state()
            state["access"] = {
                "pid": pid,
                "page": page,
                "frame": frame_index,
                "fault": fault,
                "policy": policy,
            }
            return state

    def filesystem_state(self) -> dict[str, Any]:
        with self._lock:
            entries = [
                {"path": path, **copy.deepcopy(entry)}
                for path, entry in sorted(self._filesystem.items())
            ]
            return {"root": "/ExecOS", "entries": entries, "source": "execos-kernel-engine"}

    @staticmethod
    def _normalize_path(path: str) -> str:
        parts: list[str] = []
        for part in path.strip().replace("\\", "/").split("/"):
            if part in {"", "."}:
                continue
            if part == "..":
                if parts:
                    parts.pop()
                continue
            parts.append(part)
        return "/" + "/".join(parts)

    @staticmethod
    def _inside_filesystem_root(path: str) -> bool:
        return path == "/ExecOS" or path.startswith("/ExecOS/")

    def filesystem_action(
        self,
        action: str,
        path: str,
        content: str = "",
        to_path: str | None = None,
    ) -> dict[str, Any]:
        with self._lock:
            path = self._normalize_path(path)
            normalized_action = action.casefold()
            if not self._inside_filesystem_root(path):
                raise KernelEngineError("Virtual filesystem paths must be inside /ExecOS")
            if normalized_action in {"mkdir", "create_directory"}:
                if path == "/ExecOS" and path in self._filesystem:
                    raise KernelEngineError("The virtual filesystem root already exists")
                self._mkdir(path)
                self._record("DIRECTORY_CREATED", None, "filesystem", {"path": path})
            elif normalized_action in {"create", "create_file"}:
                if path in self._filesystem:
                    raise KernelEngineError(f"Path already exists: {path}")
                if self._filesystem.get(path.rpartition("/")[0], {}).get("type") != "directory":
                    raise KernelEngineError("Parent directory does not exist")
                self._filesystem[path] = {
                    "type": "file",
                    "content": content,
                    "owner": "user",
                    "created_at_tick": self._clock_tick,
                }
                self._record("FILE_CREATED", None, "filesystem", {"path": path})
            elif normalized_action == "read":
                entry = self._filesystem.get(path)
                if entry is None or entry["type"] != "file":
                    raise KernelEngineError("File does not exist")
                self._record("FILE_READ", None, "filesystem", {"path": path})
                return {"path": path, "content": entry["content"], "type": "file"}
            elif normalized_action == "write":
                entry = self._filesystem.get(path)
                if entry is None or entry["type"] != "file":
                    raise KernelEngineError("File does not exist")
                entry["content"] = content
                self._record("FILE_WRITTEN", None, "filesystem", {
                    "path": path,
                    "bytes": len(content.encode("utf-8")),
                })
            elif normalized_action == "delete":
                if path == "/ExecOS":
                    raise KernelEngineError("The virtual filesystem root cannot be deleted")
                entry = self._filesystem.get(path)
                if entry is None:
                    raise KernelEngineError("Path does not exist")
                if entry["type"] == "directory" and any(
                    candidate != path and candidate.startswith(path + "/")
                    for candidate in self._filesystem
                ):
                    raise KernelEngineError("Directory must be empty before deletion")
                del self._filesystem[path]
                self._record(
                    "DIRECTORY_DELETED" if entry["type"] == "directory" else "FILE_DELETED",
                    None,
                    "filesystem",
                    {"path": path},
                )
            elif normalized_action == "rename":
                if not to_path:
                    raise KernelEngineError("A destination path is required")
                if path == "/ExecOS":
                    raise KernelEngineError("The virtual filesystem root cannot be renamed")
                destination = self._normalize_path(to_path)
                if not self._inside_filesystem_root(destination):
                    raise KernelEngineError("Destination must be inside /ExecOS")
                if destination.startswith(path + "/"):
                    raise KernelEngineError("A directory cannot be moved inside itself")
                if destination in self._filesystem:
                    raise KernelEngineError(f"Destination already exists: {destination}")
                if path not in self._filesystem:
                    raise KernelEngineError("Path does not exist")
                if self._filesystem.get(destination.rpartition("/")[0], {}).get("type") != "directory":
                    raise KernelEngineError("Destination parent directory does not exist")
                moved_paths = [
                    candidate for candidate in self._filesystem
                    if candidate == path or candidate.startswith(path + "/")
                ]
                for old_path in moved_paths:
                    new_path = destination + old_path[len(path):]
                    if new_path in self._filesystem and new_path not in moved_paths:
                        raise KernelEngineError(f"Destination already exists: {new_path}")
                moved_entries = {
                    destination + old_path[len(path):]: self._filesystem[old_path]
                    for old_path in moved_paths
                }
                for old_path in moved_paths:
                    del self._filesystem[old_path]
                self._filesystem.update(moved_entries)
                self._record("PATH_RENAMED", None, "filesystem", {
                    "from": path,
                    "to": destination,
                    "entries_moved": len(moved_entries),
                })
            else:
                raise KernelEngineError(f"Unsupported filesystem action: {action}")
            return self.filesystem_state()

    def _mkdir(self, path: str) -> None:
        path = self._normalize_path(path)
        if path in self._filesystem:
            if self._filesystem[path]["type"] == "directory":
                return
            raise KernelEngineError(f"A file already exists at {path}")
        parent = path.rpartition("/")[0] or "/"
        if path != "/ExecOS" and parent != path and parent not in self._filesystem:
            raise KernelEngineError(f"Parent directory does not exist: {parent}")
        self._filesystem[path] = {
            "type": "directory",
            "content": "",
            "owner": "system",
            "created_at_tick": self._clock_tick,
        }

    def device_state(self) -> dict[str, Any]:
        with self._lock:
            devices = []
            for name, device in self._devices.items():
                queued = [
                    asdict(request)
                    for request in self._io_requests
                    if request.device == name and request.status == "QUEUED"
                ]
                devices.append({
                    "name": name,
                    **copy.deepcopy(device),
                    "queue": queued,
                })
            return {"devices": devices, "source": "execos-kernel-engine"}

    def request_device(self, pid: str, device_name: str, operation: str) -> dict[str, Any]:
        with self._lock:
            process = self._require_process(pid)
            if process.state not in {ProcessState.READY, ProcessState.RUNNING}:
                raise KernelEngineError(
                    "Only READY or RUNNING processes can request devices"
                )
            if process.state == ProcessState.RUNNING:
                self._save_context(process)
                process.state = ProcessState.READY
                self._current_pid = None
            device = self._devices.get(device_name)
            if device is None:
                raise KernelEngineError(f"Unknown device: {device_name}")
            request = IORequest(
                request_id=self._next_request_id,
                pid=pid,
                device=device_name,
                operation=operation.strip()[:80] or "I/O",
                status="QUEUED",
                created_at_tick=self._clock_tick,
            )
            self._next_request_id += 1
            self._io_requests.append(request)
            process.state = ProcessState.WAITING
            process.wait_reason = f"{device_name}: {request.operation}"
            if device["owner_pid"] is None:
                device.update(status="BUSY", owner_pid=pid)
                request.status = "ACTIVE"
            self._record("IO_REQUEST_QUEUED", pid, "io", {
                "request_id": request.request_id,
                "device": device_name,
                "operation": request.operation,
                "status": request.status,
            })
            self._record("PROCESS_WAITING", pid, "process", {
                "reason": process.wait_reason,
            })
            return self.io_state()

    def complete_io(self, request_id: int) -> dict[str, Any]:
        with self._lock:
            request = next(
                (
                    item for item in self._io_requests
                    if item.request_id == request_id
                ),
                None,
            )
            if request is None or request.status != "ACTIVE":
                raise KernelEngineError("I/O request is not active")
            request.status = "COMPLETED"
            device = self._devices[request.device]
            device.update(status="READY", owner_pid=None)
            process = self._require_process(request.pid)
            if process.state == ProcessState.WAITING and process.wait_reason != "paused":
                process.state = ProcessState.READY
                process.wait_reason = None
                self._record("PROCESS_READY", process.pid, "io", {
                    "reason": "I/O completion interrupt",
                    "request_id": request_id,
                })
            self._activate_next_io_request(request.device)
            self._record("IO_COMPLETED", request.pid, "io", {
                "request_id": request_id,
                "device": request.device,
            })
            self.trigger_interrupt("I/O", pid=request.pid, details={
                "request_id": request_id,
                "device": request.device,
            })
            return self.io_state()

    def release_device(self, device_name: str, pid: str) -> dict[str, Any]:
        with self._lock:
            device = self._devices.get(device_name)
            if device is None or device["owner_pid"] != pid:
                raise KernelEngineError("The process does not own this device")
            active = next(
                (
                    request for request in self._io_requests
                    if request.pid == pid
                    and request.device == device_name
                    and request.status == "ACTIVE"
                ),
                None,
            )
            if active:
                active.status = "COMPLETED"
            device.update(status="READY", owner_pid=None)
            process = self._require_process(pid)
            if process.state == ProcessState.WAITING and process.wait_reason != "paused":
                process.state = ProcessState.READY
                process.wait_reason = None
            self._activate_next_io_request(device_name)
            self._record("DEVICE_RELEASED", pid, "device", {"device": device_name})
            return self.device_state()

    def io_state(self) -> dict[str, Any]:
        with self._lock:
            return {
                "requests": [asdict(request) for request in self._io_requests],
                "queue_depth": sum(
                    request.status in {"ACTIVE", "QUEUED"}
                    for request in self._io_requests
                ),
                "source": "execos-kernel-engine",
            }

    def send_message(self, sender_pid: str, receiver_pid: str, message: str) -> dict[str, Any]:
        with self._lock:
            sender = self._require_process(sender_pid)
            receiver = self._require_process(receiver_pid)
            if (
                sender.state == ProcessState.TERMINATED
                or receiver.state == ProcessState.TERMINATED
            ):
                raise KernelEngineError("Messages require active sender and receiver processes")
            if sender_pid == receiver_pid:
                raise KernelEngineError("Sender and receiver must be different processes")
            if not message.strip():
                raise KernelEngineError("Message cannot be empty")
            item = {
                "id": self._next_request_id,
                "sender_pid": sender_pid,
                "receiver_pid": receiver_pid,
                "message": message[:500],
                "status": "QUEUED",
                "created_at_tick": self._clock_tick,
            }
            self._next_request_id += 1
            self._messages.append(item)
            self._record("MESSAGE_SENT", sender_pid, "ipc", {
                "receiver_pid": receiver_pid,
                "message_id": item["id"],
            })
            return self.ipc_state()

    def receive_message(self, receiver_pid: str) -> dict[str, Any]:
        with self._lock:
            self._require_process(receiver_pid)
            message = next(
                (
                    item for item in self._messages
                    if item["receiver_pid"] == receiver_pid
                    and item["status"] == "QUEUED"
                ),
                None,
            )
            if message is None:
                raise KernelEngineError("No queued messages for this process")
            message["status"] = "RECEIVED"
            self._record("MESSAGE_RECEIVED", receiver_pid, "ipc", {
                "sender_pid": message["sender_pid"],
                "message_id": message["id"],
            })
            return {"message": copy.deepcopy(message), **self.ipc_state()}

    def ipc_state(self) -> dict[str, Any]:
        with self._lock:
            return {"messages": copy.deepcopy(self._messages), "source": "execos-kernel-engine"}

    def trigger_interrupt(
        self,
        interrupt_type: str,
        pid: str | None = None,
        details: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        with self._lock:
            allowed = {"Timer", "Keyboard", "Disk", "I/O"}
            if interrupt_type not in allowed:
                raise KernelEngineError(f"Interrupt must be one of {sorted(allowed)}")
            if pid:
                self._require_process(pid)
            self._clock_tick += 1
            item = {
                "id": self._next_request_id,
                "type": interrupt_type,
                "pid": pid,
                "tick": self._clock_tick,
                "status": "HANDLED",
                "details": details or {},
                "timestamp": self._now(),
            }
            self._next_request_id += 1
            self._interrupts.append(item)
            self._record(f"{interrupt_type.upper()}_INTERRUPT", pid, "interrupt", item)
            self._record("INTERRUPT_HANDLED", pid, "interrupt", {
                "type": interrupt_type,
                "handler": f"{interrupt_type.casefold()}_handler",
            })
            return copy.deepcopy(item)

    def interrupt_state(self) -> dict[str, Any]:
        with self._lock:
            return {
                "interrupts": copy.deepcopy(self._interrupts[-100:]),
                "total_handled": len(self._interrupts),
                "source": "execos-kernel-engine",
            }

    def request_resource(
        self,
        pid: str,
        resource_name: str,
        amount: int,
    ) -> dict[str, Any]:
        with self._lock:
            self._require_process(pid)
            if self._processes[pid].state not in {
                ProcessState.READY,
                ProcessState.RUNNING,
            }:
                raise KernelEngineError(
                    "Only READY or RUNNING processes can request resources"
                )
            resource = self._resources.get(resource_name)
            if resource is None:
                raise KernelEngineError(f"Unknown resource: {resource_name}")
            if amount <= 0:
                raise KernelEngineError("Resource amount must be positive")
            allocated = self._allocation[pid][resource_name]
            maximum = self._maximum[pid][resource_name]
            if allocated + amount > maximum:
                raise KernelEngineError(
                    f"Request exceeds {pid}'s declared maximum claim of {maximum}"
                )
            allocation_error = None
            if resource_name == "Memory" and resource["available"] >= amount:
                try:
                    self.allocate_memory(pid, amount, "first_fit")
                except KernelEngineError as error:
                    allocation_error = str(error)
                else:
                    self._record("RESOURCE_ALLOCATED", pid, "resources", {
                        "resource": resource_name,
                        "amount": amount,
                    })
                    return self.resource_state()
            if resource["available"] < amount or allocation_error:
                self._processes[pid].state = ProcessState.WAITING
                self._processes[pid].wait_reason = (
                    f"resource {resource_name}: requested {amount}, "
                    f"available {resource['available']}"
                    + (f"; {allocation_error}" if allocation_error else "")
                )
                self._record("RESOURCE_REQUEST_BLOCKED", pid, "resources", {
                    "resource": resource_name,
                    "amount": amount,
                    "available": resource["available"],
                    "allocation_error": allocation_error,
                })
                self._pending_resource_requests[pid] = (resource_name, amount)
                return self.resource_state()
            resource["available"] -= amount
            self._allocation[pid][resource_name] += amount
            self._record("RESOURCE_ALLOCATED", pid, "resources", {
                "resource": resource_name,
                "amount": amount,
            })
            return self.resource_state()

    def release_resource(self, pid: str, resource_name: str, amount: int) -> dict[str, Any]:
        with self._lock:
            self._require_process(pid)
            if resource_name not in self._resources or amount <= 0:
                raise KernelEngineError("Unknown resource or invalid release amount")
            allocated = self._allocation[pid][resource_name]
            if amount > allocated:
                raise KernelEngineError(
                    f"{pid} only holds {allocated} units of {resource_name}"
                )
            if resource_name == "Memory":
                return self.release_memory(pid, amount)
            self._allocation[pid][resource_name] -= amount
            self._resources[resource_name]["available"] += amount
            self._record("RESOURCE_RELEASED", pid, "resources", {
                "resource": resource_name,
                "amount": amount,
            })
            self._grant_pending_resource_requests(resource_name)
            return self.resource_state()

    def _grant_pending_resource_requests(self, resource_name: str) -> None:
        resource = self._resources[resource_name]
        for waiting_pid, (requested_resource, requested_amount) in list(
            self._pending_resource_requests.items()
        ):
            if (
                requested_resource != resource_name
                or resource["available"] < requested_amount
            ):
                continue
            if resource_name == "Memory":
                try:
                    self.allocate_memory(waiting_pid, requested_amount, "first_fit")
                except KernelEngineError:
                    continue
            else:
                resource["available"] -= requested_amount
                self._allocation[waiting_pid][resource_name] += requested_amount
            waiting_process = self._processes[waiting_pid]
            waiting_process.state = ProcessState.READY
            waiting_process.wait_reason = None
            del self._pending_resource_requests[waiting_pid]
            self._record("RESOURCE_ALLOCATED", waiting_pid, "resources", {
                "resource": resource_name,
                "amount": requested_amount,
                "reason": "released resource granted",
            })
            self._record("PROCESS_READY", waiting_pid, "resources", {
                "reason": "resource request granted"
            })

    def resource_state(self) -> dict[str, Any]:
        with self._lock:
            allocation = {
                pid: dict(values)
                for pid, values in self._allocation.items()
                if self._processes[pid].state != ProcessState.TERMINATED
            }
            maximum = {
                pid: dict(values)
                for pid, values in self._maximum.items()
                if self._processes[pid].state != ProcessState.TERMINATED
            }
            need = {
                pid: {
                    resource: max(0, maximum[pid][resource] - allocation[pid][resource])
                    for resource in self._resources
                }
                for pid in allocation
            }
            return {
                "resources": {
                    name: {
                        **values,
                        "allocated": values["total"] - values["available"],
                        "requested": sum(
                            1 for process in self._processes.values()
                            if process.state == ProcessState.WAITING
                            and process.wait_reason
                            and f"resource {name}" in process.wait_reason
                        ),
                        "waiting": [
                            process.pid for process in self._processes.values()
                            if process.state == ProcessState.WAITING
                            and process.wait_reason
                            and f"resource {name}" in process.wait_reason
                        ],
                    }
                    for name, values in self._resources.items()
                },
                "allocation": allocation,
                "maximum": maximum,
                "need": need,
                "source": "execos-kernel-engine",
            }

    def bankers_check(self) -> dict[str, Any]:
        with self._lock:
            state = self.resource_state()
            available = {
                name: values["available"] for name, values in self._resources.items()
            }
            unfinished = set(state["allocation"])
            safe_sequence: list[str] = []
            while unfinished:
                runnable = next(
                    (
                        pid for pid in sorted(unfinished)
                        if all(
                            state["need"][pid][resource] <= available[resource]
                            for resource in available
                        )
                    ),
                    None,
                )
                if runnable is None:
                    break
                for resource in available:
                    available[resource] += state["allocation"][runnable][resource]
                unfinished.remove(runnable)
                safe_sequence.append(runnable)
            safe = not unfinished
            result = {
                "safe": safe,
                "status": "SAFE STATE" if safe else "UNSAFE STATE",
                "safe_sequence": safe_sequence,
                "blocked_pids": sorted(unfinished),
                "available_after": available,
            }
            self._record("BANKERS_SAFETY_CHECK", None, "deadlocks", result)
            return result

    def syscall(self, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        with self._lock:
            started = time.perf_counter()
            self._record("SYSCALL_ENTER", arguments.get("pid"), "syscall", {
                "name": name,
                "arguments": copy.deepcopy(arguments),
            })
            try:
                if name == "sys_create_process":
                    result = self.create_process(
                        str(arguments.get("name", "process")),
                        int(arguments.get("burst_time", 4)),
                        int(arguments.get("priority", 5)),
                        int(arguments.get("memory_mb", 64)),
                        parent_pid=arguments.get("parent_pid"),
                    )
                elif name == "sys_terminate_process":
                    result = self.process_action(str(arguments["pid"]), "terminate")
                elif name == "sys_open":
                    path = self._normalize_path(str(arguments["path"]))
                    entry = self._filesystem.get(path)
                    if entry is None or entry["type"] != "file":
                        raise KernelEngineError("File does not exist")
                    descriptor = self._next_file_descriptor
                    self._next_file_descriptor += 1
                    self._file_descriptors[descriptor] = path
                    result = {"fd": descriptor, "path": path}
                elif name in {"sys_read", "sys_write"}:
                    descriptor = int(arguments["fd"])
                    path = self._file_descriptors.get(descriptor)
                    if path is None:
                        raise KernelEngineError(f"Invalid file descriptor: {descriptor}")
                    action = "read" if name == "sys_read" else "write"
                    result = self.filesystem_action(
                        action,
                        path,
                        str(arguments.get("content", "")),
                    )
                elif name == "sys_close":
                    descriptor = int(arguments["fd"])
                    path = self._file_descriptors.pop(descriptor, None)
                    if path is None:
                        raise KernelEngineError(f"Invalid file descriptor: {descriptor}")
                    result = {"fd": descriptor, "closed": True}
                elif name == "sys_allocate_memory":
                    policies: dict[str, AllocationPolicy] = {
                        policy: policy
                        for policy in ("first_fit", "best_fit", "worst_fit")
                    }
                    policy = policies.get(str(arguments.get("policy", "first_fit")))
                    if policy is None:
                        raise KernelEngineError("Unsupported memory allocation policy")
                    result = self.allocate_memory(
                        str(arguments["pid"]),
                        int(arguments["size_mb"]),
                        policy,
                    )
                elif name == "sys_release_memory":
                    result = self.release_memory(
                        str(arguments["pid"]),
                        int(arguments["size_mb"]) if "size_mb" in arguments else None,
                    )
                else:
                    raise KernelEngineError(f"Unsupported system call: {name}")
                status = "SUCCESS"
                error = None
            except (KernelEngineError, KeyError, TypeError, ValueError) as exception:
                result = None
                status = "ERROR"
                error = str(exception)
            duration_ms = round((time.perf_counter() - started) * 1000, 3)
            call = {
                "name": name,
                "arguments": copy.deepcopy(arguments),
                "status": status,
                "duration_ms": duration_ms,
                "result": copy.deepcopy(result),
                "error": error,
                "tick": self._clock_tick,
            }
            self._syscall_history.append(call)
            self._syscall_history = self._syscall_history[-100:]
            self._record("SYSCALL_EXIT", arguments.get("pid"), "syscall", {
                "name": name,
                "status": status,
                "duration_ms": duration_ms,
                "error": error,
            })
            return copy.deepcopy(call)

    def trace_state(
        self,
        pid: str | None = None,
        module: str | None = None,
        event: str | None = None,
        limit: int = 250,
    ) -> dict[str, Any]:
        with self._lock:
            if not 1 <= limit <= 1000:
                raise KernelEngineError("Trace limit must be between 1 and 1000")
            events = self._trace
            if pid:
                events = [item for item in events if item["pid"] == pid]
            if module:
                events = [item for item in events if item["module"] == module]
            if event:
                events = [item for item in events if item["event"] == event]
            return {
                "events": copy.deepcopy(events[-limit:]),
                "total_events": len(self._trace),
                "source": "execos-kernel-engine",
            }

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

    def overview(self) -> dict[str, Any]:
        with self._lock:
            processes = list(self._processes.values())
            by_state = {
                state: [self._process_snapshot(item) for item in processes if item.state == state]
                for state in ("NEW", "READY", "RUNNING", "WAITING", "TERMINATED")
            }
            return {
                "engine": {
                    "name": "ExecOS Kernel Engine",
                    "status": "RUNNING",
                    "uptime_ticks": self._clock_tick,
                    "clock_tick": self._clock_tick,
                    "qemu_required": False,
                },
                "processes": {
                    "total": len(processes),
                    "running": by_state["RUNNING"],
                    "ready": by_state["READY"],
                    "waiting": by_state["WAITING"],
                    "terminated": by_state["TERMINATED"],
                    "states": by_state,
                },
                "scheduler": self.scheduler_state(),
                "memory": self.memory_state(),
                "io": self.io_state(),
                "interrupts": self.interrupt_state(),
                "resources": self.resource_state(),
                "devices": self.device_state(),
                "recent_events": copy.deepcopy(self._trace[-12:]),
                "filesystem": self.filesystem_state(),
                "virtual_memory": self.virtual_memory_state(),
                "ipc": self.ipc_state(),
                "deadlock_check": self.bankers_check_snapshot(),
                "syscalls": copy.deepcopy(self._syscall_history[-20:]),
                "schedule_history": copy.deepcopy(self._schedule_history),
                "source": "execos-kernel-engine",
            }

    def analysis_snapshot(self) -> dict[str, Any]:
        with self._lock:
            return {
                "snapshot": self.overview(),
                "trace": self.trace_state(limit=self._max_trace_events),
            }

    def analysis_bundle(self) -> dict[str, Any]:
        with self._lock:
            data = self.analysis_snapshot()
            try:
                data["optimizer"] = self.compare_schedulers()
            except KernelEngineError:
                data["optimizer"] = None
            return data

    def _analysis_clone(self) -> ExecOSKernelEngine:
        clone = ExecOSKernelEngine()
        for name, value in self.__dict__.items():
            if name != "_lock":
                setattr(clone, name, copy.deepcopy(value))
        clone._lock = RLock()
        return clone

    @staticmethod
    def _prepare_analysis_workload(clone: ExecOSKernelEngine) -> int:
        clone._current_pid = None
        clone._rr_last_pid = None
        clone._last_schedule = None
        clone._schedule_history = []
        runnable = 0
        for process in clone._processes.values():
            if process.state in {
                ProcessState.READY,
                ProcessState.RUNNING,
                ProcessState.NEW,
            }:
                process.burst_time = process.remaining_time
                process.state = ProcessState.READY
                process.arrival_time = 0
                process.remaining_time = process.burst_time
                process.waiting_time = 0
                process.response_time = None
                process.start_time = None
                process.completion_time = None
                process.total_cpu_time = 0
                process.program_counter = 0
                runnable += 1
        clone._clock_tick = 0
        return runnable

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

    def bankers_check_snapshot(self) -> dict[str, Any]:
        state = self.resource_state()
        available = {
            name: values["available"] for name, values in self._resources.items()
        }
        unfinished = set(state["allocation"])
        sequence: list[str] = []
        while unfinished:
            pid = next(
                (
                    candidate for candidate in sorted(unfinished)
                    if all(
                        state["need"][candidate][resource] <= available[resource]
                        for resource in available
                    )
                ),
                None,
            )
            if pid is None:
                break
            for resource in available:
                available[resource] += state["allocation"][pid][resource]
            sequence.append(pid)
            unfinished.remove(pid)
        return {
            "safe": not unfinished,
            "status": "SAFE STATE" if not unfinished else "UNSAFE STATE",
            "safe_sequence": sequence,
            "blocked_pids": sorted(unfinished),
        }

    def syscall_history(self) -> list[dict[str, Any]]:
        with self._lock:
            return copy.deepcopy(self._syscall_history)

    def terminal(self, command: str) -> dict[str, Any]:
        with self._lock:
            try:
                parts = shlex.split(command.strip())
            except ValueError as error:
                raise KernelEngineError(f"Invalid command quoting: {error}") from error
            if not parts:
                return {"command": command, "status": "OK", "output": ""}
            name, *arguments = parts
            if name in {"help", "?"}:
                output = (
                    "help | ps | memory | ls [path] | cat <path> | "
                    "mkdir <path> | touch <path> | write <path> <text> | "
                    "rm <path> | schedule <fcfs|sjf|srtf|priority|round_robin> [quantum] | "
                    "trace [count]"
                )
            elif name == "ps":
                output = "\n".join(
                    f"{item['pid']:<6} {item['state']:<10} {item['name']:<20} "
                    f"remaining={item['remaining_time']}"
                    for item in self.list_processes()
                )
            elif name == "memory":
                memory = self.memory_state()
                output = (
                    f"{memory['used_mb']} MB used / {memory['total_mb']} MB; "
                    f"{memory['free_mb']} MB free; "
                    f"fragmentation {memory['external_fragmentation_percent']}%"
                )
            elif name == "ls":
                path = self._normalize_path(arguments[0] if arguments else "/ExecOS")
                directory = self._filesystem.get(path)
                if directory is None or directory["type"] != "directory":
                    raise KernelEngineError("Directory does not exist")
                prefix = path.rstrip("/") + "/"
                output = "\n".join(sorted(
                    candidate[len(prefix):]
                    for candidate in self._filesystem
                    if candidate.startswith(prefix) and "/" not in candidate[len(prefix):]
                ))
            elif name == "cat":
                if len(arguments) != 1:
                    raise KernelEngineError("Usage: cat <path>")
                output = self.filesystem_action("read", arguments[0])["content"]
            elif name == "mkdir":
                if len(arguments) != 1:
                    raise KernelEngineError("Usage: mkdir <path>")
                self.filesystem_action("create_directory", arguments[0])
                output = f"Directory created: {arguments[0]}"
            elif name == "touch":
                if len(arguments) != 1:
                    raise KernelEngineError("Usage: touch <path>")
                self.filesystem_action("create_file", arguments[0])
                output = f"File created: {arguments[0]}"
            elif name == "write":
                if len(arguments) < 2:
                    raise KernelEngineError("Usage: write <path> <text>")
                self.filesystem_action("write", arguments[0], " ".join(arguments[1:]))
                output = f"Wrote {arguments[0]}"
            elif name == "rm":
                if len(arguments) != 1:
                    raise KernelEngineError("Usage: rm <path>")
                self.filesystem_action("delete", arguments[0])
                output = f"Removed {arguments[0]}"
            elif name == "schedule":
                if not arguments:
                    raise KernelEngineError("Usage: schedule <policy> [quantum]")
                quantum = int(arguments[1]) if len(arguments) > 1 else 4
                policies: dict[str, SchedulingPolicy] = {
                    policy: policy
                    for policy in ("fcfs", "sjf", "srtf", "priority", "round_robin")
                }
                algorithm = policies.get(arguments[0])
                if algorithm is None:
                    raise KernelEngineError(f"Unsupported scheduling policy: {arguments[0]}")
                result = self.run_scheduler(algorithm, quantum)
                output = (
                    f"{result['algorithm'].upper()} completed at tick {result['end_tick']}; "
                    f"segments={len(result['timeline'])}; metrics={result['metrics']}"
                )
            elif name == "trace":
                count = int(arguments[0]) if arguments else 20
                events = self.trace_state(limit=count)["events"]
                output = "\n".join(
                    f"{item['tick']:>5} {item['event']:<26} "
                    f"{item['pid'] or '-':<6} {item['module']}"
                    for item in events
                )
            else:
                raise KernelEngineError(f"Unknown command: {name}. Type 'help'.")
            self._record("TERMINAL_COMMAND", None, "terminal", {
                "command": command,
                "status": "SUCCESS",
            })
            return {"command": command, "status": "OK", "output": output}
