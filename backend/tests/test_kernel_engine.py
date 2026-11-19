import unittest

from app.kernel_engine import ExecOSKernelEngine, KernelEngineError


class KernelEngineTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = ExecOSKernelEngine()

    def test_boot_has_deterministic_engine_owned_processes_and_files(self) -> None:
        processes = self.engine.list_processes()
        state = self.engine.overview()

        self.assertEqual([item["pid"] for item in processes], ["P101", "P102", "P103"])
        self.assertEqual([item["state"] for item in processes], ["READY"] * 3)
        self.assertEqual(state["engine"]["status"], "RUNNING")
        self.assertEqual(state["filesystem"]["root"], "/ExecOS")
        self.assertGreater(len(state["filesystem"]["entries"]), 8)

    def test_fcfs_has_known_order_and_metrics(self) -> None:
        result = self.engine.run_scheduler("fcfs")

        self.assertEqual([item["pid"] for item in result["timeline"]], ["P101", "P102", "P103"])
        self.assertEqual(result["metrics"]["average_waiting_time"], 7.33)
        self.assertEqual(result["metrics"]["average_turnaround_time"], 15.33)
        self.assertEqual(result["metrics"]["average_response_time"], 7.33)
        self.assertEqual(result["metrics"]["context_switches"], 2)

    def test_round_robin_rotates_the_ready_queue_fairly(self) -> None:
        result = self.engine.run_scheduler("round_robin", quantum=2)

        self.assertEqual(
            [item["pid"] for item in result["timeline"][:6]],
            ["P101", "P102", "P103", "P101", "P102", "P103"],
        )
        self.assertEqual(set(result["completed_pids"]), {"P101", "P102", "P103"})
        self.assertGreater(result["metrics"]["context_switches"], 2)

    def test_sjf_selects_shortest_burst_first(self) -> None:
        result = self.engine.run_scheduler("sjf")

        self.assertEqual([item["pid"] for item in result["timeline"]], ["P102", "P101", "P103"])
        self.assertEqual(result["metrics"]["average_waiting_time"], 6.67)

    def test_srtf_preempts_when_a_shorter_process_arrives(self) -> None:
        for process in self.engine.list_processes():
            self.engine.process_action(process["pid"], "terminate")
        self.engine.create_process("long", burst_time=8, memory_mb=64, arrival_time=0)
        self.engine.create_process("short", burst_time=2, memory_mb=64, arrival_time=2)

        result = self.engine.run_scheduler("srtf")

        self.assertEqual(
            [(item["pid"], item["start"], item["end"]) for item in result["timeline"][:3]],
            [("P104", 0, 1), ("P104", 1, 2), ("P105", 2, 3)],
        )
        self.assertEqual(result["completed_pids"], ["P105", "P104"])

    def test_priority_policy_uses_lowest_number_as_highest_priority(self) -> None:
        result = self.engine.run_scheduler("priority")

        self.assertEqual([item["pid"] for item in result["timeline"]], ["P102", "P101", "P103"])

    def test_round_robin_schedules_new_ready_workload_after_sjf_run(self) -> None:
        self.engine.run_scheduler("sjf")
        first = self.engine.create_process("interactive", burst_time=6, memory_mb=16)
        second = self.engine.create_process("short-task", burst_time=3, memory_mb=16)

        self.assertEqual(first["state"], "READY")
        self.assertEqual(self.engine.scheduler_state()["ready_queue"], [first["pid"], second["pid"]])

        result = self.engine.run_scheduler("round_robin", quantum=4)
        state = result["engine_state"]
        processes = {
            item["pid"]: item
            for group in state["processes"]["states"].values()
            for item in group
        }

        self.assertEqual(
            [(segment["pid"], segment["duration"]) for segment in result["timeline"]],
            [(first["pid"], 4), (second["pid"], 3), (first["pid"], 2)],
        )
        self.assertEqual(result["metrics"]["average_waiting_time"], 3.5)
        self.assertEqual(result["metrics"]["average_turnaround_time"], 8.0)
        self.assertEqual(result["metrics"]["average_response_time"], 2.0)
        self.assertEqual(state["scheduler"]["last_result"]["algorithm"], "round_robin")
        self.assertEqual(state["scheduler"]["ready_queue"], [])
        self.assertEqual(state["scheduler"]["current_pid"], None)
        self.assertEqual(state["scheduler"]["clock_tick"], result["end_tick"])
        self.assertEqual(processes[first["pid"]]["state"], "TERMINATED")
        self.assertEqual(processes[second["pid"]]["state"], "TERMINATED")

    def test_paused_process_is_waiting_and_resume_returns_it_to_ready_queue(self) -> None:
        process = self.engine.create_process("pause-test", burst_time=2, memory_mb=16)

        paused = self.engine.process_action(process["pid"], "pause")
        self.assertEqual(paused["state"], "WAITING")
        self.assertNotIn(process["pid"], self.engine.scheduler_state()["ready_queue"])

        resumed = self.engine.process_action(process["pid"], "resume")
        self.assertEqual(resumed["state"], "READY")
        self.assertIn(process["pid"], self.engine.scheduler_state()["ready_queue"])

    def test_dispatch_updates_the_single_running_process_and_process_metrics(self) -> None:
        dispatched = self.engine.process_action("P101", "start")

        self.assertEqual(dispatched["state"], "RUNNING")
        self.assertEqual(dispatched["start_time"], 0)
        self.assertEqual(dispatched["response_time"], 0)
        self.assertEqual(dispatched["engine_state"]["scheduler"]["current_pid"], "P101")
        self.assertNotIn("P101", dispatched["engine_state"]["scheduler"]["ready_queue"])
        with self.assertRaisesRegex(KernelEngineError, "CPU is occupied by P101"):
            self.engine.process_action("P102", "start")
        paused = self.engine.process_action("P101", "pause")
        self.assertEqual(paused["state"], "WAITING")
        self.assertIsNone(paused["engine_state"]["scheduler"]["current_pid"])

    def test_creation_is_admitted_and_memory_events_are_in_the_process_trace(self) -> None:
        process = self.engine.create_process("trace-worker", burst_time=2, memory_mb=32)
        self.assertEqual(process["state"], "READY")
        self.assertIn(process["pid"], process["engine_state"]["scheduler"]["ready_queue"])

        events = self.engine.trace_state(pid=process["pid"])["events"]
        kinds = [event["event"] for event in events]
        self.assertLess(kinds.index("PROCESS_CREATED"), kinds.index("MEMORY_ALLOCATED"))
        self.assertLess(kinds.index("MEMORY_ALLOCATED"), kinds.index("PROCESS_ADMITTED"))
        self.assertLess(kinds.index("PROCESS_ADMITTED"), kinds.index("PROCESS_READY"))

        terminated = self.engine.process_action(process["pid"], "terminate")
        self.assertEqual(terminated["state"], "TERMINATED")
        self.assertEqual(terminated["turnaround_time"], 0)
        self.assertEqual(terminated["completion_time"], self.engine.scheduler_state()["clock_tick"])
        terminal_events = self.engine.trace_state(pid=process["pid"])["events"]
        kinds = [event["event"] for event in terminal_events]
        self.assertIn("MEMORY_RELEASED", kinds)
        self.assertIn("PROCESS_TERMINATED", kinds)

    def test_future_arrival_starts_new_and_is_admitted_by_the_engine(self) -> None:
        process = self.engine.create_process(
            "future-worker",
            burst_time=1,
            memory_mb=16,
            arrival_time=2,
        )
        self.assertEqual(process["state"], "NEW")
        self.assertNotIn(process["pid"], process["engine_state"]["scheduler"]["ready_queue"])

        self.engine.run_scheduler("fcfs")

        completed = next(
            item for item in self.engine.list_processes() if item["pid"] == process["pid"]
        )
        self.assertEqual(completed["state"], "TERMINATED")
        self.assertEqual(
            completed["turnaround_time"],
            completed["completion_time"] - completed["arrival_time"],
        )
        kinds = [
            event["event"]
            for event in self.engine.trace_state(pid=process["pid"])["events"]
        ]
        self.assertIn("PROCESS_ADMITTED", kinds)

    def test_failed_process_admission_does_not_consume_a_pid_or_leave_partial_state(self) -> None:
        before = self.engine.overview()
        with self.assertRaisesRegex(KernelEngineError, "no contiguous free block"):
            self.engine.create_process("too-large", burst_time=1, memory_mb=4096)

        after = self.engine.overview()
        self.assertEqual(after["processes"], before["processes"])
        self.assertEqual(after["memory"], before["memory"])
        created = self.engine.create_process("next-process", burst_time=1, memory_mb=16)
        self.assertEqual(created["pid"], "P104")

    def test_scheduler_waits_for_future_arrival_and_what_if_is_copy_only(self) -> None:
        for process in self.engine.list_processes():
            self.engine.process_action(process["pid"], "terminate")
        future = self.engine.create_process(
            "future-only",
            burst_time=2,
            memory_mb=16,
            arrival_time=3,
        )
        result = self.engine.run_scheduler("fcfs")
        self.assertEqual(result["timeline"][0]["pid"], future["pid"])
        self.assertEqual(result["timeline"][0]["start"], 3)
        self.assertEqual(result["metrics"]["idle_ticks"], 3)

        engine = ExecOSKernelEngine()
        before = engine.analysis_snapshot()
        what_if = engine.simulate_what_if(
            algorithm="fcfs",
            process_pid="P101",
            arrival_time=4,
        )
        self.assertTrue(what_if["read_only"])
        self.assertEqual(engine.analysis_snapshot(), before)
        self.assertTrue(
            all(
                segment["start"] >= 4
                for segment in what_if["simulated"]["timeline"]
                if segment["pid"] == "P101"
            )
        )

    def test_empty_ready_queue_returns_specific_error(self) -> None:
        for process in self.engine.list_processes():
            self.engine.process_action(process["pid"], "terminate")

        with self.assertRaisesRegex(
            KernelEngineError,
            "No READY processes are available; the ready queue is empty",
        ):
            self.engine.run_scheduler("round_robin", quantum=4)

    def test_scheduler_debug_log_contains_state_and_selection_fields(self) -> None:
        with self.assertLogs("app.kernel_engine", level="DEBUG") as captured:
            self.engine.run_scheduler("round_robin", quantum=4)

        log = "\n".join(captured.output)
        for field in (
            "pid=P101",
            "state=READY",
            "remaining_burst_time=",
            "ready_queue=",
            "selected_policy=round_robin",
            "selected_process=",
            "engine_tick=",
        ):
            self.assertIn(field, log)

    def test_scheduler_optimizer_and_what_if_use_isolated_engine_copies(self) -> None:
        before = self.engine.analysis_snapshot()

        comparison = self.engine.compare_schedulers()
        what_if = self.engine.simulate_what_if(
            algorithm="round_robin",
            quantum=2,
            process_pid="P101",
            burst_time=3,
        )
        memory_what_if = self.engine.simulate_what_if(
            algorithm="fcfs",
            allocation_policy="best_fit",
            allocation_pid="P101",
            memory_size_mb=16,
        )

        self.assertEqual(
            [item["algorithm"] for item in comparison["candidates"]],
            ["fcfs", "sjf", "srtf", "priority", "round_robin"],
        )
        self.assertEqual(comparison["workload_size"], 3)
        self.assertEqual(what_if["simulated"]["algorithm"], "round_robin")
        self.assertEqual(what_if["changes"]["burst_time"], 3)
        self.assertIn("normalized current workload", what_if["explanation"])
        self.assertEqual(memory_what_if["memory"]["simulated"]["used_mb"], 592)
        self.assertEqual(memory_what_if["memory"]["current"]["used_mb"], 576)
        self.assertTrue(comparison["read_only"])
        self.assertTrue(what_if["read_only"])
        self.assertEqual(self.engine.analysis_snapshot(), before)

    def test_scheduler_history_contains_only_measured_runs(self) -> None:
        run = self.engine.run_scheduler("fcfs")
        history = self.engine.scheduler_state()["history"]

        self.assertEqual(len(history), 1)
        self.assertEqual(history[0]["algorithm"], "fcfs")
        self.assertEqual(history[0]["metrics"], run["metrics"])
        self.assertEqual(
            history[0]["workload_profile"],
            [
                {"remaining_time": 6, "priority": 2},
                {"remaining_time": 8, "priority": 3},
                {"remaining_time": 10, "priority": 4},
            ],
        )

    def test_scheduler_metrics_do_not_recount_prior_completions(self) -> None:
        first = self.engine.run_scheduler("fcfs")
        process = self.engine.create_process("later", burst_time=1, memory_mb=16)
        second = self.engine.run_scheduler("fcfs")

        self.assertEqual(first["completed_pids"], ["P101", "P102", "P103"])
        self.assertEqual(second["completed_pids"], [process["pid"]])
        self.assertEqual(second["metrics"]["average_turnaround_time"], 1)

    def test_memory_release_reports_external_fragmentation(self) -> None:
        self.engine.process_action("P102", "terminate")
        memory = self.engine.memory_state()

        self.assertEqual(memory["used_mb"], 384)
        self.assertGreater(memory["external_fragmentation_percent"], 0)
        self.assertEqual(memory["free_mb"], 3712)

    def test_virtual_memory_fifo_and_lru_replacement(self) -> None:
        for page in range(4):
            self.engine.access_page("P101", page, "fifo")
        self.engine.access_page("P101", 0, "fifo")
        fifo = self.engine.access_page("P101", 4, "fifo")

        self.assertEqual(fifo["access"]["frame"], 0)
        self.assertEqual(fifo["page_faults"], 5)
        self.assertEqual(fifo["page_hits"], 1)

        lru_engine = ExecOSKernelEngine()
        for page in range(4):
            lru_engine.access_page("P101", page, "lru")
        lru_engine.access_page("P101", 0, "lru")
        lru = lru_engine.access_page("P101", 4, "lru")
        self.assertEqual(lru["access"]["frame"], 1)

    def test_filesystem_read_write_and_directory_rename(self) -> None:
        self.engine.filesystem_action(
            "create_directory",
            "/ExecOS/users/test",
        )
        self.engine.filesystem_action(
            "create_file",
            "/ExecOS/users/test/readme.txt",
            "before",
        )
        self.engine.filesystem_action(
            "rename",
            "/ExecOS/users/test",
            to_path="/ExecOS/users/renamed",
        )
        self.engine.filesystem_action(
            "write",
            "/ExecOS/users/renamed/readme.txt",
            "after",
        )
        result = self.engine.filesystem_action("read", "/ExecOS/users/renamed/readme.txt")

        self.assertEqual(result["content"], "after")
        self.assertNotIn(
            "/ExecOS/users/test/readme.txt",
            {entry["path"] for entry in self.engine.filesystem_state()["entries"]},
        )

    def test_io_waits_for_active_device_and_only_active_request_completes(self) -> None:
        first = self.engine.request_device("P101", "Disk", "read")
        second = self.engine.request_device("P102", "Disk", "write")
        requests = second["requests"]

        self.assertEqual(requests[0]["status"], "ACTIVE")
        self.assertEqual(requests[1]["status"], "QUEUED")
        with self.assertRaises(KernelEngineError):
            self.engine.complete_io(requests[1]["request_id"])
        completed = self.engine.complete_io(requests[0]["request_id"])

        self.assertEqual(completed["requests"][0]["status"], "COMPLETED")
        self.assertEqual(completed["requests"][1]["status"], "ACTIVE")
        self.assertEqual(first["queue_depth"], 1)

    def test_ipc_interrupt_and_syscall_are_recorded(self) -> None:
        self.engine.send_message("P101", "P102", "ready")
        received = self.engine.receive_message("P102")
        interrupt = self.engine.trigger_interrupt("Keyboard", "P101")
        opened = self.engine.syscall("sys_open", {"path": "/ExecOS/system/kernel.conf"})
        read = self.engine.syscall("sys_read", {"fd": opened["result"]["fd"]})

        self.assertEqual(received["message"]["message"], "ready")
        self.assertEqual(interrupt["status"], "HANDLED")
        self.assertEqual(opened["status"], "SUCCESS")
        self.assertIn("scheduler=round_robin", read["result"]["content"])

    def test_resource_request_is_granted_after_release_and_bankers_is_safe(self) -> None:
        self.engine.request_resource("P101", "CPU", 1)
        blocked = self.engine.request_resource("P102", "CPU", 1)
        self.assertEqual(blocked["resources"]["CPU"]["waiting"], ["P102"])
        granted = self.engine.release_resource("P101", "CPU", 1)

        self.assertEqual(granted["allocation"]["P102"]["CPU"], 1)
        self.assertEqual(self.engine.list_processes()[1]["state"], "READY")
        self.assertTrue(self.engine.bankers_check()["safe"])

    def test_terminal_runs_only_kernel_commands(self) -> None:
        self.assertIn("P101", self.engine.terminal("ps")["output"])
        self.assertIn("scheduler.exe", self.engine.terminal("ls /ExecOS/bin")["output"])
        with self.assertRaises(KernelEngineError):
            self.engine.terminal("python -c print(1)")


if __name__ == "__main__":
    unittest.main()
