# ExecOS · OS Concepts · Kernel Engine backend methods
# Copied verbatim from (the app still runs from these originals):
#   backend/app/kernel_engine.py lines 255-321
#   backend/app/kernel_engine.py lines 323-335
#   backend/app/kernel_engine.py lines 337-352
#   backend/app/kernel_engine.py lines 354-403
#   backend/app/kernel_engine.py lines 405-432
#   backend/app/kernel_engine.py lines 1436-1463
#   backend/app/kernel_engine.py lines 1465-1483
#   backend/app/kernel_engine.py lines 1485-1487
#   backend/app/kernel_engine.py lines 1327-1365
#   backend/app/kernel_engine.py lines 1367-1398
#   backend/app/kernel_engine.py lines 1400-1423
#   backend/app/kernel_engine.py lines 1489-1518
#   backend/app/kernel_engine.py lines 1520-1526

# Excerpt of methods from class ExecOSKernelEngine; imports and the rest of the class stay in kernel_engine.py.

class ExecOSKernelEngine:  # excerpt
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
