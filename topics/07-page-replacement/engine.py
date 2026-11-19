# ExecOS · Page Replacement · Kernel Engine backend methods
# Copied verbatim from (the app still runs from these originals):
#   backend/app/kernel_engine.py lines 1060-1083
#   backend/app/kernel_engine.py lines 1085-1166
#   backend/app/kernel_engine.py lines 958-976

# Excerpt of methods from class ExecOSKernelEngine; imports and the rest of the class stay in kernel_engine.py.

class ExecOSKernelEngine:  # excerpt
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
