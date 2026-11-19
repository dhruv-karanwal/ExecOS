from types import SimpleNamespace
import unittest
from unittest.mock import patch

import psutil

from app.host import HostSystemMonitor


def virtual_memory(
    total: int = 1000,
    used: int = 400,
    available: int = 600,
    free: int = 200,
    percent: float = 40.0,
) -> SimpleNamespace:
    return SimpleNamespace(
        total=total,
        used=used,
        available=available,
        free=free,
        percent=percent,
    )


class HostMemoryMonitorTests(unittest.TestCase):
    @patch("app.host.psutil.swap_memory")
    @patch("app.host.psutil.virtual_memory")
    def test_summary_preserves_real_byte_values_and_scope(
        self,
        mock_virtual_memory,
        mock_swap_memory,
    ) -> None:
        mock_virtual_memory.return_value = virtual_memory()
        mock_swap_memory.return_value = SimpleNamespace(
            total=500,
            used=125,
            free=375,
            percent=25.0,
        )
        monitor = HostSystemMonitor()

        summary = monitor.memory_summary()

        self.assertEqual(summary["source"], "host-os")
        self.assertEqual(summary["scope"], "host-operating-system")
        self.assertTrue(summary["read_only"])
        self.assertEqual(summary["memory"]["total_bytes"], 1000)
        self.assertEqual(summary["memory"]["used_bytes"], 400)
        self.assertEqual(summary["memory"]["available_bytes"], 600)
        self.assertEqual(summary["swap"]["available_bytes"], 375)
        self.assertTrue(summary["swap"]["supported"])
        self.assertTrue(summary["timestamp"].endswith("+00:00"))

    @patch("app.host.psutil.swap_memory", side_effect=NotImplementedError)
    @patch("app.host.psutil.virtual_memory")
    def test_unsupported_swap_is_explicitly_unavailable(
        self,
        mock_virtual_memory,
        _mock_swap_memory,
    ) -> None:
        mock_virtual_memory.return_value = virtual_memory()

        swap = HostSystemMonitor().memory_summary()["swap"]

        self.assertFalse(swap["supported"])
        self.assertIsNone(swap["total_bytes"])
        self.assertIsNone(swap["percent"])

    @patch("app.host.psutil.virtual_memory")
    @patch("app.host.psutil.process_iter")
    def test_process_listing_sorts_limits_and_skips_permission_errors(
        self,
        mock_process_iter,
        mock_virtual_memory,
    ) -> None:
        class FakeProcess:
            def __init__(self, pid, name, resident_bytes):
                self.info = {
                    "pid": pid,
                    "name": name,
                    "status": "running",
                    "memory_info": SimpleNamespace(rss=resident_bytes),
                }

        class DeniedProcess:
            @property
            def info(self):
                raise psutil.AccessDenied(pid=99)

        mock_process_iter.return_value = [
            FakeProcess(2, "small", 100),
            DeniedProcess(),
            FakeProcess(1, "large", 500),
        ]
        mock_virtual_memory.return_value = virtual_memory(total=1000)

        result = HostSystemMonitor.process_list(limit=1)

        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["pid"], 1)
        self.assertEqual(result[0]["memory_bytes"], 500)
        self.assertEqual(result[0]["memory_percent"], 50.0)
        self.assertEqual(result[0]["source"], "host-os")
        self.assertIsNone(result[0]["cpu_percent"])
        self.assertIsNone(result[0]["open_file_count"])
        self.assertEqual(
            [item["name"] for item in HostSystemMonitor.process_list(sort_by="name")],
            ["large", "small"],
        )

    def test_process_limit_and_sort_options_are_validated(self) -> None:
        with self.assertRaises(ValueError):
            HostSystemMonitor.process_list(limit=0)
        with self.assertRaises(ValueError):
            HostSystemMonitor.process_list(sort_by="command")

    @patch("app.host.time.monotonic", side_effect=[1.0, 1.0, 7.0, 13.0])
    @patch("app.host.psutil.swap_memory")
    @patch("app.host.psutil.virtual_memory")
    def test_history_is_ordered_and_bounded(
        self,
        mock_virtual_memory,
        mock_swap_memory,
        _mock_monotonic,
    ) -> None:
        mock_virtual_memory.side_effect = [
            virtual_memory(used=100, percent=10.0),
            virtual_memory(used=200, percent=20.0),
            virtual_memory(used=300, percent=30.0),
            virtual_memory(used=400, percent=40.0),
        ]
        mock_swap_memory.return_value = SimpleNamespace(
            total=0, used=0, free=0, percent=0.0
        )
        monitor = HostSystemMonitor(memory_sample_interval_seconds=5, memory_history_limit=2)

        history = []
        for _ in range(4):
            history = monitor.memory_history()["samples"]

        self.assertEqual([sample["percent"] for sample in history], [30.0, 40.0])
        self.assertLessEqual(history[0]["timestamp"], history[1]["timestamp"])
        self.assertEqual(monitor.memory_history_limit, 2)


if __name__ == "__main__":
    unittest.main()
