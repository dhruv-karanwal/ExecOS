import unittest
from copy import deepcopy

from app.analysis import diagnose_execos
from app.intelligence import (
    answer_engine_question,
    answer_general_question,
    answer_question,
    build_engine_insights,
    build_insights,
)
from app.kernel_engine import ExecOSKernelEngine


class IntelligenceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.system = {
            "cpu_percent": 31.5,
            "cpu_count_logical": 8,
            "memory": {
                "used_bytes": 6 * 1024**3,
                "total_bytes": 16 * 1024**3,
                "percent": 37.5,
            },
        }
        self.processes = [
            {
                "pid": 42,
                "name": "editor",
                "memory_bytes": 512 * 1024**2,
                "cpu_percent": 1.2,
            },
            {
                "pid": 84,
                "name": "browser",
                "memory_bytes": 1024 * 1024**2,
                "cpu_percent": 5.5,
            },
        ]

    def test_process_analysis_uses_current_host_process_data(self) -> None:
        result = answer_question(
            "Which process is using the most memory?",
            "analyze",
            self.system,
            self.processes,
        )

        self.assertEqual(result["source"], "host-os")
        self.assertIn("browser (host PID 84)", result["answer"])
        self.assertIn("1.0 GB", result["answer"])
        self.assertIn("host OS process data", result["evidence"][-1])
        self.assertTrue(result["read_only"])

    def test_process_cpu_question_does_not_substitute_aggregate_cpu(self) -> None:
        result = answer_question(
            "Which process is using the most CPU?",
            "analyze",
            self.system,
            [
                {**process, "cpu_percent": None}
                for process in self.processes
            ],
        )

        self.assertEqual(result["source"], "host-os")
        self.assertIn("Per-process CPU utilization is not collected", result["answer"])
        self.assertIn("31.5%", result["answer"])

    def test_guest_scheduler_question_never_invents_a_result(self) -> None:
        result = answer_question(
            "Why was P102 selected?",
            "explain",
            self.system,
            self.processes,
        )

        self.assertEqual(result["source"], "guest-kernel")
        self.assertIn("no guest telemetry is connected", result["answer"])
        self.assertIn("won't infer", result["answer"])

    def test_teach_mode_is_marked_as_concept_not_live_state(self) -> None:
        result = answer_question(
            "Explain external memory fragmentation",
            "teach",
            self.system,
            self.processes,
        )

        self.assertEqual(result["source"], "educational-reference")
        self.assertIn("External fragmentation occurs", result["answer"])
        self.assertIn("not a measurement", result["evidence"][0])

    def test_unrecognized_os_topic_is_not_misrepresented_as_scheduling_advice(self) -> None:
        result = answer_question(
            "Compare exokernels and microkernels",
            "teach",
            self.system,
            self.processes,
        )

        self.assertIn("don't have a verified reference", result["answer"])
        self.assertIn("OS Tutor", result["answer"])
        self.assertNotIn("Schedulers select runnable work", result["answer"])

    def test_insights_use_host_measurements_and_mark_guest_gaps(self) -> None:
        insights = build_insights(self.system, self.processes)
        by_id = {insight["id"]: insight for insight in insights}

        self.assertIn("31.5%", by_id["host-cpu"]["summary"])
        self.assertIn("browser (host PID 84)", by_id["host-process"]["summary"])
        self.assertFalse(by_id["guest-scheduler"]["available"])
        self.assertFalse(by_id["guest-memory"]["available"])
        self.assertFalse(by_id["guest-resource"]["available"])
        self.assertIn("fragmentation", by_id["guest-memory"]["summary"])

    def test_engine_explanations_use_scheduler_and_process_trace_evidence(self) -> None:
        engine = ExecOSKernelEngine()
        engine.run_scheduler("fcfs")
        state = engine.overview()
        result = answer_engine_question("Why was P102 selected?", "explain", state)
        insights = build_engine_insights(state)

        self.assertEqual(result["source"], "execos-kernel-engine")
        self.assertIn("FCFS", result["answer"])
        self.assertIn("earliest arrival time", result["answer"])
        self.assertEqual(result["evidence"][0], "Dispatch interval: tick 8–14.")
        self.assertTrue(all(item["available"] for item in insights))

    def test_general_and_debug_domains_use_their_declared_sources(self) -> None:
        general = answer_general_question("Explain a database transaction")
        self.assertEqual(general["domain"], "general")
        self.assertEqual(general["source"], "curated-technical-reference")
        self.assertIn("transaction", general["answer"])

        engine = ExecOSKernelEngine()
        context = engine.analysis_snapshot()
        debug = answer_engine_question(
            "Inspect recent trace",
            "analyze",
            context["snapshot"],
            context["trace"],
            "debug",
        )
        self.assertEqual(debug["source"], "execos-kernel-engine-trace")
        self.assertIn("PROCESS_READY", " ".join(debug["evidence"]))

    def test_explains_manual_running_process_from_current_dispatch_trace(self) -> None:
        engine = ExecOSKernelEngine()
        engine.run_scheduler("fcfs")
        process = engine.create_process("manual-runner", burst_time=2, memory_mb=16)
        engine.process_action(process["pid"], "start")
        context = engine.analysis_snapshot()

        result = answer_engine_question(
            f"Why is {process['pid']} running?",
            "explain",
            context["snapshot"],
            context["trace"],
        )

        self.assertIn("manual dispatch", result["answer"])
        self.assertIn(process["pid"], result["answer"])
        self.assertIn("manual dispatch", " ".join(result["evidence"]))

    def test_diagnosis_detects_ready_queue_and_running_owner_inconsistency(self) -> None:
        engine = ExecOSKernelEngine()
        snapshot = deepcopy(engine.overview())
        snapshot["scheduler"]["ready_queue"] = ["P999"]
        result = diagnose_execos(snapshot, engine.trace_state())

        finding = next(
            item for item in result["findings"]
            if item["issue"] == "Process-state / ready-queue synchronization inconsistency"
        )
        self.assertEqual(finding["severity"], "CRITICAL")
        self.assertEqual(set(finding["affected_processes"]), {"P101", "P102", "P103", "P999"})
        self.assertEqual(result["system_health"], "CRITICAL")

    def test_engine_explains_actual_io_wait_and_fragmentation(self) -> None:
        engine = ExecOSKernelEngine()
        engine.process_action("P102", "terminate")
        engine.request_device("P101", "Disk", "read")
        state = engine.overview()
        wait = answer_engine_question("Why is P101 waiting?", "explain", state)
        memory = answer_engine_question(
            "Explain current external fragmentation",
            "analyze",
            state,
        )

        self.assertIn("Disk: read", wait["answer"])
        self.assertIn("5.2%", memory["answer"])

    def test_engine_memory_resource_requests_match_physical_allocations(self) -> None:
        engine = ExecOSKernelEngine()
        engine.request_resource("P101", "Memory", 64)
        allocated = engine.resource_state()

        self.assertEqual(engine.memory_state()["used_mb"], 640)
        self.assertEqual(allocated["allocation"]["P101"]["Memory"], 192)
        engine.release_resource("P101", "Memory", 64)
        self.assertEqual(engine.memory_state()["used_mb"], 576)

    def test_virtual_filesystem_rejects_lookalike_root_and_traversal(self) -> None:
        engine = ExecOSKernelEngine()

        with self.assertRaises(ValueError):
            engine.filesystem_action("create_file", "/ExecOS2/notes.txt", "no")
        with self.assertRaises(ValueError):
            engine.filesystem_action("create_file", "/ExecOS/../notes.txt", "no")

    def test_execai_diagnosis_exposes_actual_io_queue_causal_evidence(self) -> None:
        engine = ExecOSKernelEngine()
        engine.request_device("P101", "Disk", "read")
        engine.request_device("P102", "Network", "receive")
        data = engine.analysis_snapshot()

        result = diagnose_execos(data["snapshot"], data["trace"])
        congestion = next(
            finding
            for finding in result["findings"]
            if finding["issue"] == "I/O queue congestion"
        )

        self.assertEqual(set(congestion["affected_processes"]), {"P101", "P102"})
        self.assertTrue(any("2" in evidence for evidence in congestion["evidence"]))
        self.assertEqual(result["source"], "execos-kernel-engine-snapshot")
        self.assertEqual(result["health_coverage"], "4/5 measured dimensions")
        self.assertIn("Insufficient historical evidence", result["predictions"][0]["risk"])
        self.assertTrue(
            any("I/O congestion may delay" in prediction["risk"] for prediction in result["predictions"])
        )

    def test_execai_health_score_uses_scheduler_measurements(self) -> None:
        engine = ExecOSKernelEngine()
        engine.run_scheduler("fcfs")
        data = engine.analysis_snapshot()

        result = diagnose_execos(data["snapshot"], data["trace"])

        self.assertIsInstance(result["health_score"], int)
        self.assertEqual(result["health_coverage"], "4/5 measured dimensions")
        self.assertIsNone(result["metrics"]["cpu_utilization_percent"])
        self.assertEqual(result["last_scheduler_run"]["current_workload"], False)
        self.assertEqual(
            result["last_scheduler_run"]["metrics"]["cpu_utilization_percent"],
            100.0,
        )
        self.assertEqual(result["metrics"]["ready_queue_length"], 0)

    def test_execai_does_not_attribute_old_scheduler_metrics_to_new_processes(self) -> None:
        engine = ExecOSKernelEngine()
        engine.run_scheduler("fcfs")
        engine.create_process("new-workload", burst_time=5, memory_mb=32)

        result = diagnose_execos(
            engine.overview(),
            engine.trace_state(limit=1000),
        )

        self.assertIsNone(result["metrics"]["cpu_utilization_percent"])
        self.assertEqual(result["health_dimensions"]["cpu"], None)
        self.assertIn("historical", result["last_scheduler_run"]["note"])
        self.assertFalse(
            any(finding["issue"] == "CPU saturation" for finding in result["findings"])
        )

    def test_prediction_uses_retained_scheduler_waiting_trend(self) -> None:
        engine = ExecOSKernelEngine()
        for process in engine.list_processes():
            engine.process_action(process["pid"], "terminate")
        for name, burst in (("first", 3), ("second", 1), ("third", 3)):
            engine.create_process(name, burst_time=burst, memory_mb=16)
        engine.run_scheduler("sjf")
        for name, burst in (("next-first", 3), ("next-second", 1), ("next-third", 3)):
            engine.create_process(name, burst_time=burst, memory_mb=16)
        engine.run_scheduler("fcfs")

        result = diagnose_execos(
            engine.overview(),
            engine.trace_state(limit=1000),
        )

        self.assertEqual(result["predictions"][0]["risk"], "Increasing waiting time")
        self.assertIn("identical burst/priority profile", result["predictions"][0]["method"])


if __name__ == "__main__":
    unittest.main()
