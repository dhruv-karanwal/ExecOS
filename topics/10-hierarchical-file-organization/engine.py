# ExecOS · Hierarchical File Organization · Kernel Engine backend methods
# Copied verbatim from (the app still runs from these originals):
#   backend/app/kernel_engine.py lines 1168-1174
#   backend/app/kernel_engine.py lines 1176-1176
#   backend/app/kernel_engine.py lines 1189-1189
#   backend/app/kernel_engine.py lines 1193-1293
#   backend/app/kernel_engine.py lines 1295-1309

# Excerpt of methods from class ExecOSKernelEngine; imports and the rest of the class stay in kernel_engine.py.

class ExecOSKernelEngine:  # excerpt
    def filesystem_state(self) -> dict[str, Any]:
        with self._lock:
            entries = [
                {"path": path, **copy.deepcopy(entry)}
                for path, entry in sorted(self._filesystem.items())
            ]
            return {"root": "/ExecOS", "entries": entries, "source": "execos-kernel-engine"}

    @staticmethod

    @staticmethod

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
