# ExecOS · Contiguous Memory · Kernel Engine backend methods
# Copied verbatim from (the app still runs from these originals):
#   backend/app/kernel_engine.py lines 867-906
#   backend/app/kernel_engine.py lines 908-909
#   backend/app/kernel_engine.py lines 911-936
#   backend/app/kernel_engine.py lines 938-956
#   backend/app/kernel_engine.py lines 978-997
#   backend/app/kernel_engine.py lines 999-1023
#   backend/app/kernel_engine.py lines 1025-1037
#   backend/app/kernel_engine.py lines 1039-1058

# Excerpt of methods from class ExecOSKernelEngine; imports and the rest of the class stay in kernel_engine.py.

class ExecOSKernelEngine:  # excerpt
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
