# ExecOS · System Calls · Kernel Engine backend methods
# Copied verbatim from (the app still runs from these originals):
#   backend/app/kernel_engine.py lines 1722-1810
#   backend/app/kernel_engine.py lines 2213-2215

# Excerpt of methods from class ExecOSKernelEngine; imports and the rest of the class stay in kernel_engine.py.

class ExecOSKernelEngine:  # excerpt
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

    def syscall_history(self) -> list[dict[str, Any]]:
        with self._lock:
            return copy.deepcopy(self._syscall_history)
