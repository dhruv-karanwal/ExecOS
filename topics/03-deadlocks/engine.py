# ExecOS · Deadlocks · Kernel Engine backend methods
# Copied verbatim from (the app still runs from these originals):
#   backend/app/kernel_engine.py lines 1528-1587
#   backend/app/kernel_engine.py lines 1589-1608
#   backend/app/kernel_engine.py lines 1610-1639
#   backend/app/kernel_engine.py lines 1641-1684
#   backend/app/kernel_engine.py lines 1686-1720
#   backend/app/kernel_engine.py lines 2182-2211

# Excerpt of methods from class ExecOSKernelEngine; imports and the rest of the class stay in kernel_engine.py.

class ExecOSKernelEngine:  # excerpt
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
