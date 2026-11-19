"""ExecOS Kernel Engine API and read-only host telemetry API."""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any, Literal

from fastapi import Depends, FastAPI, Header, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.auth import AccountError, AccountManager
from app.host import HostSystemMonitor
from app.analysis import diagnose_execos
from app.intelligence import (
    AnalysisMode,
    IntelligenceDomain,
    answer_engine_question,
    build_engine_insights,
)
from app.kernel_engine import ExecOSKernelEngine, KernelEngineError
from app.ollama_chat import OllamaError, answer_with_ollama, ollama_status
from app.recovery import RecoveryManager


class Credentials(BaseModel):
    username: str | None = Field(default=None, min_length=3, max_length=32)
    email: str | None = Field(default=None, max_length=254)
    full_name: str | None = Field(default=None, max_length=100)
    password: str


class HostSystemCallRequest(BaseModel):
    name: Literal[
        "get_cpu_info",
        "get_memory_info",
        "get_process_list",
        "get_uptime",
        "get_system_info",
        "get_disk_info",
    ]


class IntelligenceQuery(BaseModel):
    question: str = Field(min_length=1, max_length=500)
    function: AnalysisMode = "explain"
    domain: IntelligenceDomain = "os_expert"


class OllamaChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class OllamaChatRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    history: list[OllamaChatMessage] = Field(default_factory=list, max_length=12)


class RecoveryApprovalRequest(BaseModel):
    plan_id: str = Field(min_length=1, max_length=100)
    approved: bool


class LearningProgressRecord(BaseModel):
    visualization_visited: bool = False
    lesson_visited: bool = False
    quiz_attempts: int = Field(default=0, ge=0, le=100_000)
    quiz_best_score: int = Field(default=0, ge=0, le=20)
    challenge_attempts: int = Field(default=0, ge=0, le=100_000)
    challenge_best_score: int = Field(default=0, ge=0, le=100)
    challenge_completed: bool = False


class LearningProgressUpdate(BaseModel):
    topic: str = Field(min_length=1, max_length=64)
    progress: LearningProgressRecord


learning_topics = {
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
}


class WhatIfRequest(BaseModel):
    algorithm: Literal["fcfs", "sjf", "srtf", "priority", "round_robin"] = "round_robin"
    quantum: int = Field(default=4, ge=1, le=10_000)
    process_pid: str | None = None
    priority: int | None = Field(default=None, ge=1, le=10)
    burst_time: int | None = Field(default=None, ge=1, le=10_000)
    arrival_time: int | None = Field(default=None, ge=0, le=10_000)
    allocation_policy: Literal["first_fit", "best_fit", "worst_fit"] | None = None
    allocation_pid: str | None = None
    memory_size_mb: int | None = Field(default=None, ge=1, le=4096)


class ProcessCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    burst_time: int = Field(default=4, ge=1, le=100_000)
    priority: int = Field(default=5, ge=1, le=10)
    memory_mb: int = Field(default=64, ge=1, le=4096)
    arrival_time: int | None = Field(default=None, ge=0)
    parent_pid: str | None = None


class ProcessActionRequest(BaseModel):
    action: Literal["start", "pause", "resume", "terminate", "priority"]
    priority: int | None = Field(default=None, ge=1, le=10)


class SchedulerRunRequest(BaseModel):
    algorithm: Literal["fcfs", "sjf", "srtf", "priority", "round_robin"] = "round_robin"
    quantum: int = Field(default=4, ge=1, le=10_000)


class MemoryRequest(BaseModel):
    pid: str
    size_mb: int | None = Field(default=None, ge=1, le=4096)
    policy: Literal["first_fit", "best_fit", "worst_fit"] = "first_fit"


class PageAccessRequest(BaseModel):
    pid: str
    page: int = Field(ge=0)
    policy: Literal["fifo", "lru"] = "fifo"


class FilesystemRequest(BaseModel):
    action: Literal[
        "create_file", "create_directory", "read", "write", "delete", "rename"
    ]
    path: str
    content: str = Field(default="", max_length=100_000)
    to_path: str | None = None


class DeviceRequest(BaseModel):
    pid: str
    device: str
    operation: str = Field(min_length=1, max_length=80)


class IOCompletionRequest(BaseModel):
    request_id: int = Field(ge=1)


class IPCSendRequest(BaseModel):
    sender_pid: str
    receiver_pid: str
    message: str = Field(min_length=1, max_length=500)


class IPCReceiveRequest(BaseModel):
    receiver_pid: str


class InterruptRequest(BaseModel):
    interrupt_type: Literal["Timer", "Keyboard", "Disk", "I/O"]
    pid: str | None = None
    details: dict[str, Any] = Field(default_factory=dict)


class ResourceRequest(BaseModel):
    pid: str
    resource: Literal["CPU", "Memory", "Disk"]
    amount: int = Field(ge=1)


class SystemCallRequest(BaseModel):
    name: Literal[
        "sys_create_process",
        "sys_terminate_process",
        "sys_open",
        "sys_read",
        "sys_write",
        "sys_close",
        "sys_allocate_memory",
        "sys_release_memory",
    ]
    arguments: dict[str, Any] = Field(default_factory=dict)


class TerminalRequest(BaseModel):
    command: str = Field(min_length=1, max_length=500)


app = FastAPI(
    title="ExecOS Workbench API",
    description=(
        "Stateful ExecOS software kernel engine and read-only telemetry for "
        "the host operating system."
    ),
    version="0.3.0",
)
cors_origins = [
    origin.strip()
    for origin in os.environ.get(
        "EXECOS_CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)
host_monitor = HostSystemMonitor(
    memory_sample_interval_seconds=float(
        os.environ.get("EXECOS_MEMORY_SAMPLE_INTERVAL_SECONDS", "5")
    ),
)
account_manager = AccountManager()
kernel_engine = ExecOSKernelEngine()
recovery_manager: RecoveryManager | None = None


def get_recovery_manager() -> RecoveryManager:
    global recovery_manager
    if recovery_manager is None or recovery_manager.engine is not kernel_engine:
        recovery_manager = RecoveryManager(kernel_engine)
    return recovery_manager


def kernel_operation(operation: Any) -> Any:
    try:
        return operation()
    except KernelEngineError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error


def require_authenticated_user(
    authorization: str | None = Header(default=None),
) -> dict[str, str]:
    user = account_manager.authenticate(authorization)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sign in required",
        )
    return user


@app.post("/api/auth/register", status_code=status.HTTP_201_CREATED)
def register(credentials: Credentials) -> dict[str, Any]:
    try:
        user = account_manager.register(
            credentials.username,
            credentials.password,
            credentials.email,
            credentials.full_name,
        )
        token, _ = account_manager.login(
            credentials.email or credentials.username or "",
            credentials.password,
        )
    except AccountError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        ) from error
    return {"token": token, "user": user}


@app.post("/api/auth/login")
def login(credentials: Credentials) -> dict[str, Any]:
    try:
        token, user = account_manager.login(
            credentials.email or credentials.username or "",
            credentials.password,
        )
    except AccountError as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(error),
        ) from error
    return {"token": token, "user": user}


@app.get("/api/auth/me")
def current_user(
    user: dict[str, str] = Depends(require_authenticated_user),
) -> dict[str, str]:
    return user


@app.post("/api/auth/logout")
def logout(authorization: str | None = Header(default=None)) -> dict[str, bool]:
    account_manager.logout(authorization)
    return {"ok": True}


@app.get("/api/learning/progress")
def get_learning_progress(
    user: dict[str, str] = Depends(require_authenticated_user),
) -> dict[str, Any]:
    return {"progress": account_manager.get_learning_progress(user["username"])}


@app.put("/api/learning/progress")
def update_learning_progress(
    request: LearningProgressUpdate,
    user: dict[str, str] = Depends(require_authenticated_user),
) -> dict[str, Any]:
    if request.topic not in learning_topics:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Unknown learning topic",
        )
    progress = account_manager.update_learning_progress(
        user["username"],
        request.topic,
        request.progress.model_dump(),
    )
    return {"progress": progress}


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {
        "application": app.title,
        "status": "ok",
        "kernel_engine": "running",
        "host_monitor": "read-only",
        "qemu_guest": "optional",
    }


@app.get(
    "/api/kernel/status",
    dependencies=[Depends(require_authenticated_user)],
)
def kernel_connection_status() -> dict[str, str | bool]:
    return {
        "connected": True,
        "connection_scope": "software-engine",
        "engine": "ExecOS Kernel Engine",
        "status": "RUNNING",
        "engine_running": True,
        "qemu_required": False,
        "qemu_connected": False,
        "qemu_guest": "optional, not connected",
    }


@app.get(
    "/api/kernel/state",
    dependencies=[Depends(require_authenticated_user)],
)
def get_kernel_state() -> dict[str, Any]:
    return kernel_engine.overview()


@app.get(
    "/api/kernel/processes",
    dependencies=[Depends(require_authenticated_user)],
)
def get_kernel_processes() -> list[dict[str, Any]]:
    return kernel_engine.list_processes()


@app.post(
    "/api/kernel/processes",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_authenticated_user)],
)
def create_kernel_process(request: ProcessCreateRequest) -> dict[str, Any]:
    return kernel_operation(lambda: kernel_engine.create_process(**request.model_dump()))


@app.post(
    "/api/kernel/processes/{pid}/action",
    dependencies=[Depends(require_authenticated_user)],
)
def kernel_process_action(pid: str, request: ProcessActionRequest) -> dict[str, Any]:
    return kernel_operation(
        lambda: kernel_engine.process_action(pid, request.action, request.priority)
    )


@app.get(
    "/api/kernel/scheduler",
    dependencies=[Depends(require_authenticated_user)],
)
def get_kernel_scheduler() -> dict[str, Any]:
    return kernel_engine.scheduler_state()


@app.post(
    "/api/kernel/scheduler/run",
    dependencies=[Depends(require_authenticated_user)],
)
def run_kernel_scheduler(request: SchedulerRunRequest) -> dict[str, Any]:
    return kernel_operation(lambda: kernel_engine.run_scheduler(**request.model_dump()))


@app.get(
    "/api/kernel/memory",
    dependencies=[Depends(require_authenticated_user)],
)
def get_kernel_memory() -> dict[str, Any]:
    return kernel_engine.memory_state()


@app.post(
    "/api/kernel/memory/allocate",
    dependencies=[Depends(require_authenticated_user)],
)
def allocate_kernel_memory(request: MemoryRequest) -> dict[str, Any]:
    if request.size_mb is None:
        raise HTTPException(status_code=422, detail="size_mb is required")
    return kernel_operation(
        lambda: kernel_engine.allocate_memory(
            request.pid, request.size_mb, request.policy
        )
    )


@app.post(
    "/api/kernel/memory/release",
    dependencies=[Depends(require_authenticated_user)],
)
def release_kernel_memory(request: MemoryRequest) -> dict[str, Any]:
    return kernel_operation(
        lambda: kernel_engine.release_memory(request.pid, request.size_mb)
    )


@app.get(
    "/api/kernel/virtual-memory",
    dependencies=[Depends(require_authenticated_user)],
)
def get_virtual_memory() -> dict[str, Any]:
    return kernel_engine.virtual_memory_state()


@app.post(
    "/api/kernel/virtual-memory/access",
    dependencies=[Depends(require_authenticated_user)],
)
def access_virtual_page(request: PageAccessRequest) -> dict[str, Any]:
    return kernel_operation(
        lambda: kernel_engine.access_page(
            request.pid, request.page, request.policy
        )
    )


@app.get(
    "/api/kernel/filesystem",
    dependencies=[Depends(require_authenticated_user)],
)
def get_virtual_filesystem() -> dict[str, Any]:
    return kernel_engine.filesystem_state()


@app.post(
    "/api/kernel/filesystem",
    dependencies=[Depends(require_authenticated_user)],
)
def modify_virtual_filesystem(request: FilesystemRequest) -> dict[str, Any]:
    return kernel_operation(lambda: kernel_engine.filesystem_action(**request.model_dump()))


@app.get(
    "/api/kernel/devices",
    dependencies=[Depends(require_authenticated_user)],
)
def get_kernel_devices() -> dict[str, Any]:
    return kernel_engine.device_state()


@app.post(
    "/api/kernel/devices/request",
    dependencies=[Depends(require_authenticated_user)],
)
def request_kernel_device(request: DeviceRequest) -> dict[str, Any]:
    return kernel_operation(
        lambda: kernel_engine.request_device(
            request.pid, request.device, request.operation
        )
    )


@app.post(
    "/api/kernel/devices/release",
    dependencies=[Depends(require_authenticated_user)],
)
def release_kernel_device(request: DeviceRequest) -> dict[str, Any]:
    return kernel_operation(
        lambda: kernel_engine.release_device(request.device, request.pid)
    )


@app.get(
    "/api/kernel/io",
    dependencies=[Depends(require_authenticated_user)],
)
def get_kernel_io() -> dict[str, Any]:
    return kernel_engine.io_state()


@app.post(
    "/api/kernel/io/complete",
    dependencies=[Depends(require_authenticated_user)],
)
def complete_kernel_io(request: IOCompletionRequest) -> dict[str, Any]:
    return kernel_operation(lambda: kernel_engine.complete_io(request.request_id))


@app.get(
    "/api/kernel/ipc",
    dependencies=[Depends(require_authenticated_user)],
)
def get_kernel_ipc() -> dict[str, Any]:
    return kernel_engine.ipc_state()


@app.post(
    "/api/kernel/ipc/send",
    dependencies=[Depends(require_authenticated_user)],
)
def send_kernel_message(request: IPCSendRequest) -> dict[str, Any]:
    return kernel_operation(
        lambda: kernel_engine.send_message(
            request.sender_pid, request.receiver_pid, request.message
        )
    )


@app.post(
    "/api/kernel/ipc/receive",
    dependencies=[Depends(require_authenticated_user)],
)
def receive_kernel_message(request: IPCReceiveRequest) -> dict[str, Any]:
    return kernel_operation(lambda: kernel_engine.receive_message(request.receiver_pid))


@app.get(
    "/api/kernel/resources",
    dependencies=[Depends(require_authenticated_user)],
)
def get_kernel_resources() -> dict[str, Any]:
    return kernel_engine.resource_state()


@app.post(
    "/api/kernel/resources/request",
    dependencies=[Depends(require_authenticated_user)],
)
def request_kernel_resource(request: ResourceRequest) -> dict[str, Any]:
    return kernel_operation(
        lambda: kernel_engine.request_resource(
            request.pid, request.resource, request.amount
        )
    )


@app.post(
    "/api/kernel/resources/release",
    dependencies=[Depends(require_authenticated_user)],
)
def release_kernel_resource(request: ResourceRequest) -> dict[str, Any]:
    return kernel_operation(
        lambda: kernel_engine.release_resource(
            request.pid, request.resource, request.amount
        )
    )


@app.post(
    "/api/kernel/deadlocks/check",
    dependencies=[Depends(require_authenticated_user)],
)
def check_kernel_deadlocks() -> dict[str, Any]:
    return kernel_engine.bankers_check()


@app.get(
    "/api/kernel/interrupts",
    dependencies=[Depends(require_authenticated_user)],
)
def get_kernel_interrupts() -> dict[str, Any]:
    return kernel_engine.interrupt_state()


@app.post(
    "/api/kernel/interrupts/trigger",
    dependencies=[Depends(require_authenticated_user)],
)
def trigger_kernel_interrupt(request: InterruptRequest) -> dict[str, Any]:
    return kernel_operation(
        lambda: kernel_engine.trigger_interrupt(
            request.interrupt_type, request.pid, request.details
        )
    )


@app.get(
    "/api/kernel/syscalls",
    dependencies=[Depends(require_authenticated_user)],
)
def get_kernel_syscalls() -> list[dict[str, Any]]:
    return kernel_engine.syscall_history()


@app.post(
    "/api/kernel/syscalls",
    dependencies=[Depends(require_authenticated_user)],
)
def invoke_kernel_syscall(request: SystemCallRequest) -> dict[str, Any]:
    return kernel_engine.syscall(request.name, request.arguments)


@app.post(
    "/api/kernel/terminal",
    dependencies=[Depends(require_authenticated_user)],
)
def execute_kernel_terminal_command(request: TerminalRequest) -> dict[str, Any]:
    return kernel_operation(lambda: kernel_engine.terminal(request.command))


@app.get(
    "/api/kernel/trace",
    dependencies=[Depends(require_authenticated_user)],
)
def get_kernel_trace(
    pid: str | None = None,
    module: str | None = None,
    event: str | None = None,
    limit: int = Query(default=250, ge=1, le=1000),
) -> dict[str, Any]:
    return kernel_engine.trace_state(pid, module, event, limit)


@app.get("/api/v1/health")
def v1_health() -> dict[str, str]:
    return {
        "application": app.title,
        "version": app.version,
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get(
    "/api/host/system",
    dependencies=[Depends(require_authenticated_user)],
)
def get_host_system_info() -> dict[str, Any]:
    return host_monitor.system_info()


@app.get(
    "/api/host/memory",
    dependencies=[Depends(require_authenticated_user)],
)
def get_host_memory_info() -> dict[str, Any]:
    return host_monitor.memory_info()


@app.get(
    "/api/host/processes",
    dependencies=[Depends(require_authenticated_user)],
)
def get_host_processes(
    limit: int = Query(default=100, ge=1, le=1000),
    sort_by: Literal["memory", "name", "pid"] = "memory",
) -> list[dict[str, Any]]:
    return host_monitor.process_list(limit=limit, sort_by=sort_by)


@app.get(
    "/api/host/io",
    dependencies=[Depends(require_authenticated_user)],
)
def get_host_io() -> dict[str, Any]:
    return host_monitor.io_info()


@app.post(
    "/api/host/syscalls",
    dependencies=[Depends(require_authenticated_user)],
)
def invoke_host_read_only_query(request: HostSystemCallRequest) -> dict[str, Any]:
    try:
        return host_monitor.syscall(request.name)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@app.get(
    "/api/v1/memory/summary",
    dependencies=[Depends(require_authenticated_user)],
)
def get_host_memory_summary() -> dict[str, Any]:
    return host_monitor.memory_summary()


@app.get(
    "/api/v1/memory/history",
    dependencies=[Depends(require_authenticated_user)],
)
def get_host_memory_history() -> dict[str, Any]:
    return host_monitor.memory_history()


@app.get(
    "/api/v1/processes",
    dependencies=[Depends(require_authenticated_user)],
)
def get_host_memory_processes(
    sort_by: Literal["memory", "name", "pid"] = "memory",
    limit: int = Query(default=20, ge=1, le=1000),
) -> list[dict[str, Any]]:
    return host_monitor.process_list(limit=limit, sort_by=sort_by)


@app.get(
    "/api/intelligence/insights",
    dependencies=[Depends(require_authenticated_user)],
)
def get_intelligence_insights() -> dict[str, Any]:
    state = kernel_engine.overview()
    return {
        "insights": build_engine_insights(state),
        "source": "execos-kernel-engine",
        "read_only": True,
        "timestamp": HostSystemMonitor._timestamp(),
    }


@app.post(
    "/api/intelligence/query",
    dependencies=[Depends(require_authenticated_user)],
)
def query_intelligence(request: IntelligenceQuery) -> dict[str, Any]:
    try:
        context = kernel_engine.analysis_snapshot()
        return answer_engine_question(
            request.question,
            request.function,
            context["snapshot"],
            context["trace"],
            request.domain,
        )
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@app.get(
    "/api/intelligence/chat/status",
    dependencies=[Depends(require_authenticated_user)],
)
def get_ollama_status() -> dict[str, Any]:
    return ollama_status()


@app.post(
    "/api/intelligence/chat",
    dependencies=[Depends(require_authenticated_user)],
)
def query_ollama_chat(request: OllamaChatRequest) -> dict[str, Any]:
    try:
        history = [message.model_dump() for message in request.history]
        snapshot = kernel_engine.overview()
        process_states = snapshot["processes"]["states"]
        process_summary = [
            {
                "pid": process["pid"],
                "name": process["name"],
                "state": process["state"],
                "arrival_time": process["arrival_time"],
                "burst_time": process["burst_time"],
                "remaining_time": process["remaining_time"],
                "priority": process["priority"],
                "waiting_time": process["waiting_time"],
                "response_time": process["response_time"],
                "turnaround_time": process["turnaround_time"],
                "wait_reason": process["wait_reason"],
            }
            for processes in process_states.values()
            for process in processes
        ]
        last_schedule = snapshot["scheduler"]["last_result"]
        kernel_context = {
            "source": snapshot["source"],
            "engine": snapshot["engine"],
            "scheduler": {
                key: snapshot["scheduler"][key]
                for key in (
                    "clock_tick",
                    "current_pid",
                    "ready_queue",
                    "supported_algorithms",
                    "default_algorithm",
                    "default_quantum",
                )
            },
            "last_schedule": {
                key: last_schedule.get(key)
                for key in (
                    "algorithm",
                    "quantum",
                    "start_tick",
                    "end_tick",
                    "metrics",
                    "completed_pids",
                    "remaining_pids",
                )
            } if last_schedule else None,
            "processes": process_summary[:40],
            "processes_truncated": len(process_summary) > 40,
            "memory": {
                key: snapshot["memory"].get(key)
                for key in (
                    "total_mb",
                    "used_mb",
                    "free_mb",
                    "utilization_percent",
                    "external_fragmentation_percent",
                )
            },
            "virtual_memory": {
                "page_faults": snapshot["virtual_memory"]["page_faults"],
            },
            "io": {
                "queue_depth": snapshot["io"]["queue_depth"],
                "requests": [
                    {
                        "pid": request["pid"],
                        "device": request["device"],
                        "status": request["status"],
                    }
                    for request in snapshot["io"]["requests"][:20]
                ],
            },
            "resources": {
                name: {
                    key: values.get(key)
                    for key in ("total", "available", "allocated", "requested", "waiting")
                }
                for name, values in snapshot["resources"]["resources"].items()
            },
            "deadlock_check": snapshot["deadlock_check"],
            "recent_events": [
                {
                    key: event.get(key)
                    for key in ("tick", "event", "pid", "module", "details")
                    if key in event
                }
                for event in snapshot["recent_events"][-8:]
            ],
        }
        return answer_with_ollama(request.question, history, kernel_context)
    except OllamaError as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)) from error


@app.get(
    "/api/intelligence/diagnose",
    dependencies=[Depends(require_authenticated_user)],
)
def diagnose_kernel_engine() -> dict[str, Any]:
    data = kernel_engine.analysis_bundle()
    optimizer = data["optimizer"]
    result = diagnose_execos(data["snapshot"], data["trace"], optimizer)
    result.update({
        "kernel_state": data["snapshot"],
        "trace_events": len(data["trace"].get("events", [])),
        "processes": [
            {
                "pid": process["pid"],
                "name": process["name"],
                "priority": process["priority"],
                "burst_time": process["burst_time"],
                "state": process["state"],
                "memory_allocation_mb": process["memory_allocation_mb"],
            }
            for state_processes in data["snapshot"]["processes"]["states"].values()
            for process in state_processes
        ],
        "optimizer": optimizer,
        "timestamp": HostSystemMonitor._timestamp(),
    })
    return result


@app.post(
    "/api/intelligence/recovery/plan",
    dependencies=[Depends(require_authenticated_user)],
)
def create_recovery_plan() -> dict[str, Any]:
    return kernel_operation(get_recovery_manager().create_plan)


@app.post(
    "/api/intelligence/recovery/execute",
    dependencies=[Depends(require_authenticated_user)],
)
def execute_recovery_plan(request: RecoveryApprovalRequest) -> dict[str, Any]:
    manager = get_recovery_manager()
    return kernel_operation(lambda: manager.execute(request.plan_id, request.approved))


@app.get(
    "/api/intelligence/optimizer",
    dependencies=[Depends(require_authenticated_user)],
)
def optimize_kernel_scheduler() -> dict[str, Any]:
    return kernel_operation(kernel_engine.compare_schedulers)


@app.post(
    "/api/intelligence/what-if",
    dependencies=[Depends(require_authenticated_user)],
)
def run_what_if(request: WhatIfRequest) -> dict[str, Any]:
    return kernel_operation(lambda: kernel_engine.simulate_what_if(
        algorithm=request.algorithm,
        quantum=request.quantum,
        process_pid=request.process_pid,
        priority=request.priority,
        burst_time=request.burst_time,
        arrival_time=request.arrival_time,
        allocation_policy=request.allocation_policy,
        allocation_pid=request.allocation_pid,
        memory_size_mb=request.memory_size_mb,
    ))
