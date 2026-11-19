"""Read-only access to operating-system metrics from the host running ExecOS."""

from __future__ import annotations

import platform
import time
from collections import deque
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from typing import Any

import psutil


class HostSystemMonitor:
    """Expose real host telemetry without permitting host mutations."""

    def __init__(
        self,
        memory_sample_interval_seconds: float = 5.0,
        memory_history_limit: int = 720,
    ) -> None:
        if memory_sample_interval_seconds <= 0:
            raise ValueError("memory sample interval must be positive")
        if memory_history_limit <= 0:
            raise ValueError("memory history limit must be positive")
        self.memory_sample_interval_seconds = memory_sample_interval_seconds
        self.memory_history_limit = memory_history_limit
        self._memory_samples: deque[dict[str, Any]] = deque(maxlen=memory_history_limit)
        self._last_memory_sample_at: float | None = None
        self._memory_lock = Lock()

    @staticmethod
    def _timestamp() -> str:
        return datetime.now(timezone.utc).isoformat()

    def _record_memory_sample(self, sample: dict[str, Any]) -> None:
        now = time.monotonic()
        with self._memory_lock:
            if (
                self._last_memory_sample_at is None
                or now - self._last_memory_sample_at >= self.memory_sample_interval_seconds
            ):
                self._memory_samples.append(sample)
                self._last_memory_sample_at = now

    def memory_summary(self) -> dict[str, Any]:
        memory = psutil.virtual_memory()
        timestamp = self._timestamp()
        try:
            swap = psutil.swap_memory()
            swap_metrics = {
                "supported": True,
                "total_bytes": swap.total,
                "used_bytes": swap.used,
                "available_bytes": swap.free,
                "free_bytes": swap.free,
                "percent": swap.percent,
            }
        except (psutil.Error, OSError, NotImplementedError):
            swap_metrics = {
                "supported": False,
                "total_bytes": None,
                "used_bytes": None,
                "available_bytes": None,
                "free_bytes": None,
                "percent": None,
            }

        summary = {
            "source": "host-os",
            "scope": "host-operating-system",
            "read_only": True,
            "timestamp": timestamp,
            "memory": {
                "total_bytes": memory.total,
                "used_bytes": memory.used,
                "available_bytes": memory.available,
                "free_bytes": memory.free,
                "percent": memory.percent,
            },
            "swap": swap_metrics,
        }
        self._record_memory_sample({
            "timestamp": timestamp,
            "total_bytes": memory.total,
            "used_bytes": memory.used,
            "available_bytes": memory.available,
            "percent": memory.percent,
        })
        return summary

    def memory_history(self) -> dict[str, Any]:
        self.memory_summary()
        with self._memory_lock:
            samples = list(self._memory_samples)
        return {
            "source": "host-os",
            "scope": "host-operating-system",
            "sample_interval_seconds": self.memory_sample_interval_seconds,
            "retention_limit": self.memory_history_limit,
            "samples": samples,
        }

    @staticmethod
    def memory_info() -> dict[str, Any]:
        memory = psutil.virtual_memory()
        swap = psutil.swap_memory()
        return {
            "source": "host-os",
            "read_only": True,
            "memory": {
                "total_bytes": memory.total,
                "used_bytes": memory.used,
                "available_bytes": memory.available,
                "percent": memory.percent,
            },
            "swap": {
                "total_bytes": swap.total,
                "used_bytes": swap.used,
                "free_bytes": swap.free,
                "percent": swap.percent,
            },
            "top_processes": HostSystemMonitor.process_list(limit=10),
        }

    def system_info(self) -> dict[str, Any]:
        memory = psutil.virtual_memory()
        swap = psutil.swap_memory()
        frequency = psutil.cpu_freq()
        disk_root = Path.home().anchor or "/"
        disk = psutil.disk_usage(disk_root)
        return {
            "source": "host-os",
            "read_only": True,
            "platform": platform.platform(),
            "system": platform.system(),
            "release": platform.release(),
            "architecture": platform.machine(),
            "processor": platform.processor(),
            "cpu_count_logical": psutil.cpu_count(logical=True),
            "cpu_count_physical": psutil.cpu_count(logical=False),
            "cpu_frequency_mhz": {
                "current": frequency.current,
                "maximum": frequency.max,
            } if frequency else None,
            "cpu_percent": psutil.cpu_percent(interval=0.1),
            "cpu_percent_per_core": psutil.cpu_percent(interval=None, percpu=True),
            "memory": {
                "total_bytes": memory.total,
                "available_bytes": memory.available,
                "used_bytes": memory.used,
                "percent": memory.percent,
            },
            "swap": {
                "total_bytes": swap.total,
                "used_bytes": swap.used,
                "percent": swap.percent,
            },
            "disk": {
                "root": disk_root,
                "total_bytes": disk.total,
                "used_bytes": disk.used,
                "free_bytes": disk.free,
                "percent": disk.percent,
            },
            "uptime_seconds": max(0, int(time.time() - psutil.boot_time())),
        }

    @staticmethod
    def process_list(
        limit: int = 100,
        sort_by: str = "memory",
    ) -> list[dict[str, Any]]:
        if not 1 <= limit <= 1000:
            raise ValueError("process limit must be between 1 and 1000")
        if sort_by not in {"memory", "name", "pid"}:
            raise ValueError("sort_by must be memory, name, or pid")

        timestamp = HostSystemMonitor._timestamp()
        total_memory_bytes = psutil.virtual_memory().total
        processes: list[dict[str, Any]] = []
        for process in psutil.process_iter(
            ["pid", "name", "status", "memory_info"],
            ad_value=None,
        ):
            try:
                info = process.info
                pid = info["pid"]
                if pid is None:
                    continue
                memory_info = info["memory_info"]
                memory_bytes = memory_info.rss if memory_info else None
                memory_percent = (
                    memory_bytes * 100 / total_memory_bytes
                    if memory_bytes is not None and total_memory_bytes > 0
                    else None
                )
                processes.append({
                    "pid": pid,
                    "name": info["name"] or "Unknown",
                    "status": info["status"] or "unknown",
                    "memory_bytes": memory_bytes,
                    "memory_mb": memory_bytes / (1024 ** 2) if memory_bytes is not None else None,
                    "memory_percent": memory_percent,
                    "user": None,
                    "parent_pid": None,
                    "cpu_percent": None,
                    "thread_count": None,
                    "priority": None,
                    "cpu_time_seconds": None,
                    "open_file_count": None,
                    "runtime_seconds": None,
                    "timestamp": timestamp,
                    "source": "host-os",
                })
            except (psutil.Error, OSError, KeyError, TypeError):
                continue

        if sort_by == "name":
            processes.sort(key=lambda process: (
                process["name"].casefold(),
                process["pid"],
            ))
        elif sort_by == "pid":
            processes.sort(key=lambda process: process["pid"])
        else:
            processes.sort(key=lambda process: (
                -(
                    process["memory_bytes"]
                    if process["memory_bytes"] is not None
                    else -1
                ),
                process["pid"],
            ))
        return processes[:limit]

    @staticmethod
    def io_info() -> dict[str, Any]:
        disk = psutil.disk_io_counters()
        network = psutil.net_io_counters()
        return {
            "source": "host-os",
            "read_only": True,
            "timestamp": HostSystemMonitor._timestamp(),
            "disk": {
                "supported": disk is not None,
                "read_bytes": disk.read_bytes if disk else None,
                "write_bytes": disk.write_bytes if disk else None,
                "read_count": disk.read_count if disk else None,
                "write_count": disk.write_count if disk else None,
            },
            "network": {
                "supported": network is not None,
                "bytes_sent": network.bytes_sent if network else None,
                "bytes_received": network.bytes_recv if network else None,
                "packets_sent": network.packets_sent if network else None,
                "packets_received": network.packets_recv if network else None,
            },
        }

    def syscall(self, name: str) -> dict[str, Any]:
        calls = {
            "get_cpu_info": self._cpu_info,
            "get_memory_info": self._memory_info,
            "get_process_list": self.process_list,
            "get_uptime": self._uptime,
            "get_system_info": self.system_info,
            "get_disk_info": self._disk_info,
        }
        try:
            result = calls[name]()
        except KeyError as error:
            raise ValueError(f"Unsupported read-only host query: {name}") from error
        return {"call": name, "execution": "host-os-read-only", "result": result}

    def _cpu_info(self) -> dict[str, Any]:
        frequency = psutil.cpu_freq()
        return {
            "processor": platform.processor(),
            "logical_cores": psutil.cpu_count(logical=True),
            "physical_cores": psutil.cpu_count(logical=False),
            "frequency_mhz": {
                "current": frequency.current,
                "maximum": frequency.max,
            } if frequency else None,
            "percent": psutil.cpu_percent(interval=0.1),
            "percent_per_core": psutil.cpu_percent(interval=None, percpu=True),
        }

    @staticmethod
    def _memory_info() -> dict[str, Any]:
        memory = psutil.virtual_memory()
        swap = psutil.swap_memory()
        return {
            "total_bytes": memory.total,
            "available_bytes": memory.available,
            "used_bytes": memory.used,
            "percent": memory.percent,
            "swap_total_bytes": swap.total,
            "swap_used_bytes": swap.used,
        }

    @staticmethod
    def _uptime() -> dict[str, int]:
        return {"uptime_seconds": max(0, int(time.time() - psutil.boot_time()))}

    @staticmethod
    def _disk_info() -> dict[str, Any]:
        root = Path.home().anchor or "/"
        disk = psutil.disk_usage(root)
        return {
            "root": root,
            "total_bytes": disk.total,
            "used_bytes": disk.used,
            "free_bytes": disk.free,
            "percent": disk.percent,
        }
