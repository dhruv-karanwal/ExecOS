import os
import tempfile
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from app import main
from app.auth import AccountManager
from app.kernel_engine import ExecOSKernelEngine


class KernelEngineApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        main.account_manager = AccountManager(":memory:")
        cls.bootstrap_client = TestClient(main.app)
        registration = cls.bootstrap_client.post(
            "/api/auth/register",
            json={"username": "hostadmin", "password": "sample-password-123"},
        )
        if registration.status_code != 201:
            raise AssertionError(registration.text)
        cls.token = registration.json()["token"]

    def test_email_signup_and_signin_authenticate_real_account(self) -> None:
        registration = self.bootstrap_client.post(
            "/api/auth/register",
            json={
                "email": "learner@example.com",
                "full_name": "ExecOS Learner",
                "password": "secure-password-123",
            },
        )
        self.assertEqual(registration.status_code, 201, registration.text)
        self.assertEqual(registration.json()["user"]["email"], "learner@example.com")
        self.assertEqual(registration.json()["user"]["full_name"], "ExecOS Learner")

        signed_in = self.bootstrap_client.post(
            "/api/auth/login",
            json={"email": "LEARNER@example.com", "password": "secure-password-123"},
        )
        self.assertEqual(signed_in.status_code, 200, signed_in.text)
        self.assertEqual(signed_in.json()["user"]["username"], registration.json()["user"]["username"])
        user = self.bootstrap_client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {signed_in.json()['token']}"},
        )
        self.assertEqual(user.status_code, 200)
        self.assertEqual(user.json()["full_name"], "ExecOS Learner")

    def test_email_signup_rejects_duplicate_email(self) -> None:
        first = self.bootstrap_client.post(
            "/api/auth/register",
            json={
                "email": "duplicate@example.com",
                "full_name": "First User",
                "password": "secure-password-123",
            },
        )
        duplicate = self.bootstrap_client.post(
            "/api/auth/register",
            json={
                "email": "DUPLICATE@example.com",
                "full_name": "Second User",
                "password": "secure-password-123",
            },
        )
        self.assertEqual(first.status_code, 201)
        self.assertEqual(duplicate.status_code, 400)
        self.assertIn("already registered", duplicate.json()["detail"])

    def test_learning_progress_is_authenticated_validated_and_account_scoped(self) -> None:
        self.assertEqual(
            self.bootstrap_client.get("/api/learning/progress").status_code,
            401,
        )
        saved = self.client.put(
            "/api/learning/progress",
            json={
                "topic": "CPU Scheduling",
                "progress": {
                    "visualization_visited": True,
                    "lesson_visited": True,
                    "quiz_attempts": 2,
                    "quiz_best_score": 17,
                    "challenge_attempts": 3,
                    "challenge_best_score": 100,
                    "challenge_completed": True,
                },
            },
        )
        self.assertEqual(saved.status_code, 200, saved.text)
        self.assertEqual(saved.json()["progress"]["CPU Scheduling"]["quiz_best_score"], 17)
        lower_retry = self.client.put(
            "/api/learning/progress",
            json={
                "topic": "CPU Scheduling",
                "progress": {"quiz_attempts": 1, "quiz_best_score": 4},
            },
        )
        self.assertEqual(lower_retry.status_code, 200, lower_retry.text)
        self.assertEqual(lower_retry.json()["progress"]["CPU Scheduling"]["quiz_attempts"], 2)
        self.assertEqual(lower_retry.json()["progress"]["CPU Scheduling"]["quiz_best_score"], 17)
        loaded = self.client.get("/api/learning/progress")
        self.assertEqual(loaded.status_code, 200)
        self.assertTrue(loaded.json()["progress"]["CPU Scheduling"]["challenge_completed"])

        main.account_manager.register("progressuser", "progress-password-123")
        other_token, _ = main.account_manager.login(
            "progressuser",
            "progress-password-123",
        )
        other = TestClient(
            main.app,
            headers={"Authorization": f"Bearer {other_token}"},
        )
        self.assertEqual(other.get("/api/learning/progress").json()["progress"], {})

        unknown_topic = self.client.put(
            "/api/learning/progress",
            json={"topic": "Unknown OS Topic", "progress": {}},
        )
        excessive_score = self.client.put(
            "/api/learning/progress",
            json={
                "topic": "CPU Scheduling",
                "progress": {"quiz_best_score": 21},
            },
        )
        self.assertEqual(unknown_topic.status_code, 422)
        self.assertEqual(excessive_score.status_code, 422)

    def test_learning_progress_survives_account_manager_restart(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = os.path.join(directory, "accounts.sqlite3")
            manager = AccountManager(path)
            manager.register("progresspersist", "persistent-password-123")
            manager.update_learning_progress(
                "progresspersist",
                "Deadlock",
                {"challenge_attempts": 2, "challenge_best_score": 100, "challenge_completed": True},
            )
            manager.close()

            restarted = AccountManager(path)
            self.assertEqual(
                restarted.get_learning_progress("progresspersist")["Deadlock"],
                {
                    "visualization_visited": False,
                    "lesson_visited": False,
                    "quiz_attempts": 0,
                    "quiz_best_score": 0,
                    "challenge_attempts": 2,
                    "challenge_best_score": 100,
                    "challenge_completed": True,
                },
            )
            restarted.close()

    def test_registered_accounts_persist_across_account_manager_restart(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = os.path.join(directory, "accounts.sqlite3")
            first_manager = AccountManager(path)
            user = first_manager.register(
                None,
                "persistent-password-123",
                "persistent@example.com",
                "Persistent Learner",
            )
            first_manager.close()

            restarted_manager = AccountManager(path)
            token, signed_in_user = restarted_manager.login(
                "persistent@example.com",
                "persistent-password-123",
            )
            self.assertTrue(token)
            self.assertEqual(signed_in_user["username"], user["username"])
            self.assertEqual(signed_in_user["full_name"], "Persistent Learner")
            restarted_manager.close()

    def setUp(self) -> None:
        main.kernel_engine = ExecOSKernelEngine()
        self.client = TestClient(
            main.app,
            headers={"Authorization": f"Bearer {self.token}"},
        )

    def test_kernel_engine_and_host_telemetry_are_separate(self) -> None:
        status = self.client.get("/api/kernel/status")
        engine = self.client.get("/api/kernel/state")
        host = self.client.get("/api/host/system")

        self.assertTrue(status.json()["connected"])
        self.assertEqual(status.json()["status"], "RUNNING")
        self.assertFalse(status.json()["qemu_required"])
        self.assertFalse(status.json()["qemu_connected"])
        self.assertEqual(status.json()["connection_scope"], "software-engine")
        self.assertEqual(engine.json()["source"], "execos-kernel-engine")
        self.assertEqual(engine.json()["processes"]["total"], 3)
        self.assertEqual(host.json()["source"], "host-os")

    def test_kernel_routes_require_an_application_session(self) -> None:
        self.assertEqual(
            self.bootstrap_client.get("/api/kernel/processes").status_code,
            401,
        )
        self.assertEqual(
            self.bootstrap_client.post(
                "/api/intelligence/chat",
                json={"question": "Explain virtual memory"},
            ).status_code,
            401,
        )

    def test_ollama_chat_is_authenticated_and_returns_local_model_source(self) -> None:
        answer = {
            "answer": "Virtual memory maps virtual addresses to physical memory.",
            "source": "local-ollama",
            "model": "test-model",
            "domain": "os_tutor",
            "function": "chat",
            "read_only": True,
            "evidence": ["Generated locally."],
        }
        with patch("app.main.answer_with_ollama", return_value=answer) as mocked_answer:
            response = self.client.post(
                "/api/intelligence/chat",
                json={
                    "question": "Explain virtual memory",
                    "history": [{"role": "user", "content": "Explain paging"}],
                },
            )
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["source"], "local-ollama")
        self.assertEqual(response.json()["model"], "test-model")
        mocked_answer.assert_called_once()
        question, history, kernel_context = mocked_answer.call_args.args
        self.assertEqual(question, "Explain virtual memory")
        self.assertEqual(history, [{"role": "user", "content": "Explain paging"}])
        self.assertEqual(kernel_context["source"], "execos-kernel-engine")
        self.assertEqual(
            kernel_context["scheduler"]["ready_queue"],
            main.kernel_engine.overview()["scheduler"]["ready_queue"],
        )
        self.assertIn("processes", kernel_context)

    def test_ollama_chat_reports_unavailable_model_without_fallback(self) -> None:
        with patch(
            "app.main.answer_with_ollama",
            side_effect=main.OllamaError("Ollama is not reachable on this computer."),
        ):
            response = self.client.post(
                "/api/intelligence/chat",
                json={"question": "Explain virtual memory"},
            )
        self.assertEqual(response.status_code, 503)
        self.assertIn("Ollama is not reachable", response.json()["detail"])

    def test_process_creation_and_scheduler_run_are_engine_backed(self) -> None:
        process = self.client.post(
            "/api/kernel/processes",
            json={"name": "api-worker", "burst_time": 2, "memory_mb": 32},
        )
        schedule = self.client.post(
            "/api/kernel/scheduler/run",
            json={"algorithm": "round_robin", "quantum": 1},
        )

        self.assertEqual(process.status_code, 201)
        self.assertEqual(process.json()["pid"], "P104")
        self.assertEqual(schedule.status_code, 200)
        self.assertEqual(schedule.json()["algorithm"], "round_robin")
        self.assertTrue(schedule.json()["timeline"])
        self.assertEqual(
            schedule.json()["engine_state"]["scheduler"]["last_result"]["algorithm"],
            "round_robin",
        )
        self.assertEqual(
            schedule.json()["engine_state"]["scheduler"]["ready_queue"],
            [
                process["pid"]
                for process in schedule.json()["engine_state"]["processes"]["ready"]
            ],
        )

    def test_system_call_lab_invokes_only_the_simulated_engine(self) -> None:
        opened = self.client.post(
            "/api/kernel/syscalls",
            json={
                "name": "sys_open",
                "arguments": {"path": "/ExecOS/system/kernel.conf"},
            },
        )
        self.assertEqual(opened.status_code, 200, opened.text)
        self.assertEqual(opened.json()["status"], "SUCCESS")
        self.assertEqual(opened.json()["result"]["path"], "/ExecOS/system/kernel.conf")
        trace = self.client.get("/api/kernel/trace?module=syscall&limit=10")
        self.assertEqual(trace.status_code, 200, trace.text)
        self.assertTrue(any(event["event"] == "SYSCALL_ENTER" for event in trace.json()["events"]))

    def test_process_actions_return_an_atomic_engine_snapshot_and_trace(self) -> None:
        created = self.client.post(
            "/api/kernel/processes",
            json={"name": "dispatch-worker", "burst_time": 3, "memory_mb": 16},
        )
        self.assertEqual(created.status_code, 201, created.text)
        pid = created.json()["pid"]
        created_state = created.json()["engine_state"]
        self.assertEqual(created_state["scheduler"]["ready_queue"][-1], pid)
        self.assertEqual(created_state["processes"]["states"]["READY"][-1]["pid"], pid)

        dispatched = self.client.post(
            f"/api/kernel/processes/{pid}/action",
            json={"action": "start"},
        )
        self.assertEqual(dispatched.status_code, 200, dispatched.text)
        dispatched_state = dispatched.json()["engine_state"]
        self.assertEqual(dispatched.json()["state"], "RUNNING")
        self.assertEqual(dispatched_state["scheduler"]["current_pid"], pid)
        self.assertNotIn(pid, dispatched_state["scheduler"]["ready_queue"])
        self.assertEqual(
            next(
                process
                for process in dispatched_state["processes"]["states"]["RUNNING"]
                if process["pid"] == pid
            )["start_time"],
            0,
        )

        trace = self.client.get(f"/api/kernel/trace?pid={pid}")
        self.assertEqual(trace.status_code, 200, trace.text)
        event_names = [event["event"] for event in trace.json()["events"]]
        self.assertIn("PROCESS_ADMITTED", event_names)
        self.assertIn("PROCESS_DISPATCHED", event_names)

    def test_engine_intelligence_uses_live_scheduler_and_wait_data(self) -> None:
        self.client.post(
            "/api/kernel/scheduler/run",
            json={"algorithm": "fcfs", "quantum": 2},
        )
        insights = self.client.get("/api/intelligence/insights")
        answer = self.client.post(
            "/api/intelligence/query",
            json={
                "question": "Explain the current scheduling result",
                "function": "analyze",
            },
        )

        self.assertEqual(insights.json()["source"], "execos-kernel-engine")
        self.assertTrue(all(item["available"] for item in insights.json()["insights"]))
        self.assertEqual(answer.json()["source"], "execos-kernel-engine")
        self.assertIn("FCFS", answer.json()["answer"])
        self.assertTrue(answer.json()["read_only"])

    def test_intelligence_general_and_debug_modes_use_verified_sources(self) -> None:
        general = self.client.post(
            "/api/intelligence/query",
            json={
                "question": "Explain database transactions",
                "function": "teach",
                "domain": "general",
            },
        )
        debug = self.client.post(
            "/api/intelligence/query",
            json={
                "question": "Inspect the latest trace",
                "function": "analyze",
                "domain": "debug",
            },
        )
        self.assertEqual(general.status_code, 200, general.text)
        self.assertEqual(general.json()["source"], "curated-technical-reference")
        self.assertEqual(debug.status_code, 200, debug.text)
        self.assertEqual(debug.json()["source"], "execos-kernel-engine-trace")

    def test_recovery_manager_requires_approval_and_verifies_engine_execution(self) -> None:
        self.client.post(
            "/api/kernel/scheduler/run",
            json={"algorithm": "sjf", "quantum": 2},
        )
        self.client.post(
            "/api/kernel/processes",
            json={"name": "recovery-short", "burst_time": 3, "memory_mb": 16},
        )
        self.client.post(
            "/api/kernel/processes",
            json={"name": "recovery-long", "burst_time": 8, "memory_mb": 16},
        )
        plan_response = self.client.post("/api/intelligence/recovery/plan")
        self.assertEqual(plan_response.status_code, 200, plan_response.text)
        plan = plan_response.json()
        self.assertEqual(plan["status"], "awaiting_approval")
        self.assertTrue(plan["read_only_until_approved"])

        not_approved = self.client.post(
            "/api/intelligence/recovery/execute",
            json={"plan_id": plan["plan_id"], "approved": False},
        )
        self.assertEqual(not_approved.status_code, 400)
        self.assertEqual(
            main.kernel_engine.scheduler_state()["last_result"]["algorithm"],
            "sjf",
        )

        executed = self.client.post(
            "/api/intelligence/recovery/execute",
            json={"plan_id": plan["plan_id"], "approved": True},
        )
        self.assertEqual(executed.status_code, 200, executed.text)
        self.assertEqual(executed.json()["source"], "execos-recovery-manager")
        self.assertTrue(executed.json()["verification"]["verified"])
        self.assertEqual(
            main.kernel_engine.scheduler_state()["last_result"]["algorithm"],
            plan["action"]["algorithm"],
        )

    def test_recovery_manager_rejects_a_stale_plan(self) -> None:
        self.client.post(
            "/api/kernel/scheduler/run",
            json={"algorithm": "sjf", "quantum": 2},
        )
        self.client.post(
            "/api/kernel/processes",
            json={"name": "plan-short", "burst_time": 3, "memory_mb": 16},
        )
        self.client.post(
            "/api/kernel/processes",
            json={"name": "plan-long", "burst_time": 8, "memory_mb": 16},
        )
        plan = self.client.post("/api/intelligence/recovery/plan").json()
        self.client.post(
            "/api/kernel/processes",
            json={"name": "new-after-plan", "burst_time": 1, "memory_mb": 16},
        )

        stale = self.client.post(
            "/api/intelligence/recovery/execute",
            json={"plan_id": plan["plan_id"], "approved": True},
        )
        self.assertEqual(stale.status_code, 400)
        self.assertIn("state changed after planning", stale.json()["detail"])
        self.assertEqual(
            main.kernel_engine.scheduler_state()["last_result"]["algorithm"],
            "sjf",
        )

    def test_execai_diagnosis_optimizer_and_what_if_are_authenticated_and_read_only(self) -> None:
        before = main.kernel_engine.analysis_snapshot()
        diagnosis = self.client.get("/api/intelligence/diagnose")
        comparison = self.client.get("/api/intelligence/optimizer")
        what_if = self.client.post(
            "/api/intelligence/what-if",
            json={"algorithm": "srtf", "quantum": 3},
        )

        self.assertEqual(diagnosis.status_code, 200)
        self.assertEqual(comparison.status_code, 200)
        self.assertEqual(what_if.status_code, 200)
        self.assertEqual(len(comparison.json()["candidates"]), 5)
        self.assertIn("health_score", diagnosis.json())
        self.assertIn("causal_chain", diagnosis.json())
        self.assertTrue(what_if.json()["read_only"])
        self.assertEqual(main.kernel_engine.analysis_snapshot(), before)

        unauthorized = self.bootstrap_client.get("/api/intelligence/diagnose")
        self.assertEqual(unauthorized.status_code, 401)

    def test_engine_operations_validate_invalid_requests(self) -> None:
        response = self.client.post(
            "/api/kernel/processes/P101/action",
            json={"action": "terminate"},
        )
        invalid = self.client.post(
            "/api/kernel/scheduler/run",
            json={"algorithm": "unsupported", "quantum": 4},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(invalid.status_code, 422)

    def test_terminal_is_a_kernel_command_interface_not_a_host_shell(self) -> None:
        response = self.client.post(
            "/api/kernel/terminal",
            json={"command": "ls /ExecOS/bin"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("scheduler.exe", response.json()["output"])
        self.assertIn("terminal.exe", response.json()["output"])

    def test_engine_module_routes_return_live_state_and_apply_operations(self) -> None:
        paths = (
            "/api/kernel/memory",
            "/api/kernel/virtual-memory",
            "/api/kernel/filesystem",
            "/api/kernel/devices",
            "/api/kernel/io",
            "/api/kernel/ipc",
            "/api/kernel/resources",
            "/api/kernel/interrupts",
            "/api/kernel/syscalls",
            "/api/kernel/trace",
        )
        for path in paths:
            with self.subTest(path=path):
                self.assertEqual(self.client.get(path).status_code, 200)

        page = self.client.post(
            "/api/kernel/virtual-memory/access",
            json={"pid": "P101", "page": 2, "policy": "fifo"},
        )
        created = self.client.post(
            "/api/kernel/filesystem",
            json={
                "action": "create_file",
                "path": "/ExecOS/users/vedanti/api-test.txt",
                "content": "from API",
            },
        )
        io = self.client.post(
            "/api/kernel/devices/request",
            json={"pid": "P101", "device": "Disk", "operation": "read"},
        )
        completed = self.client.post(
            "/api/kernel/io/complete",
            json={"request_id": io.json()["requests"][0]["request_id"]},
        )
        message = self.client.post(
            "/api/kernel/ipc/send",
            json={"sender_pid": "P101", "receiver_pid": "P102", "message": "hello"},
        )
        safety = self.client.post("/api/kernel/deadlocks/check")
        interrupt = self.client.post(
            "/api/kernel/interrupts/trigger",
            json={"interrupt_type": "Keyboard", "pid": "P101"},
        )

        self.assertTrue(page.json()["access"]["fault"])
        self.assertEqual(created.status_code, 200)
        self.assertEqual(completed.json()["requests"][0]["status"], "COMPLETED")
        self.assertEqual(message.status_code, 200)
        self.assertTrue(safety.json()["safe"])
        self.assertEqual(interrupt.json()["status"], "HANDLED")

    def test_legacy_in_memory_os_endpoints_are_not_exposed(self) -> None:
        for path in ("/api/state", "/api/processes", "/api/events"):
            with self.subTest(path=path):
                self.assertEqual(self.client.get(path).status_code, 404)
        self.assertEqual(
            self.client.post("/api/schedule", json={"algorithm": "fcfs"}).status_code,
            404,
        )


if __name__ == "__main__":
    unittest.main()
