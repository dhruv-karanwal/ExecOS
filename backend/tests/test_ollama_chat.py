import os
import unittest
from unittest.mock import patch

from app.ollama_chat import OllamaError, answer_with_ollama, ollama_status


class OllamaChatTests(unittest.TestCase):
    def test_status_reports_installed_configured_local_model(self) -> None:
        with (
            patch.dict(os.environ, {
                "EXECOS_OLLAMA_URL": "http://localhost:11434",
                "EXECOS_OLLAMA_MODEL": "test-model",
            }),
            patch(
                "app.ollama_chat._request_json",
                return_value={"models": [{"name": "test-model"}]},
            ),
        ):
            result = ollama_status()
        self.assertTrue(result["available"])
        self.assertEqual(result["model"], "test-model")

    def test_refuses_non_local_ollama_endpoint(self) -> None:
        with patch.dict(os.environ, {
            "EXECOS_OLLAMA_URL": "http://example.com:11434",
            "EXECOS_OLLAMA_MODEL": "test-model",
        }):
            result = ollama_status()
        self.assertFalse(result["available"])
        self.assertIn("local HTTP endpoint", result["message"])

    def test_chat_uses_configured_model_and_returns_actual_local_answer(self) -> None:
        with (
            patch.dict(os.environ, {
                "EXECOS_OLLAMA_URL": "http://127.0.0.1:11434",
                "EXECOS_OLLAMA_MODEL": "test-model",
            }),
            patch(
                "app.ollama_chat._request_json",
                side_effect=[
                    {"models": [{"name": "test-model"}]},
                    {"message": {"content": "A page table maps virtual pages to frames."}},
                ],
            ) as mocked_request,
        ):
            result = answer_with_ollama(
                "What does a page table do?",
                [{"role": "user", "content": "Explain virtual memory"}],
            )
        self.assertEqual(result["answer"], "A page table maps virtual pages to frames.")
        self.assertEqual(result["source"], "local-ollama")
        payload = mocked_request.call_args.args[1]
        self.assertEqual(payload["model"], "test-model")
        self.assertEqual(payload["messages"][-1], {
            "role": "user",
            "content": "What does a page table do?",
        })
        self.assertIn("Never claim to browse the web", payload["messages"][0]["content"])
        self.assertIn("priority aging is not implemented", payload["messages"][0]["content"])
        self.assertIn("Answer the user's actual question", payload["messages"][0]["content"])
        self.assertIn("outside operating systems", payload["messages"][0]["content"])
        self.assertIn("Do not invent a causal mechanism", payload["messages"][0]["content"])
        self.assertEqual(payload["options"]["temperature"], 0.1)
        self.assertEqual(payload["options"]["num_ctx"], 8192)
        self.assertIn("deadlocks", payload["messages"][0]["content"])
        self.assertIn("virtual memory", payload["messages"][0]["content"])
        self.assertEqual(payload["options"]["num_predict"], 2048)

    def test_chat_includes_live_engine_context_as_read_only_system_data(self) -> None:
        context = {
            "source": "execos-kernel-engine",
            "scheduler": {"clock_tick": 17, "ready_queue": ["P101"]},
        }
        with (
            patch.dict(os.environ, {
                "EXECOS_OLLAMA_URL": "http://127.0.0.1:11434",
                "EXECOS_OLLAMA_MODEL": "test-model",
            }),
            patch(
                "app.ollama_chat._request_json",
                side_effect=[
                    {"models": [{"name": "test-model"}]},
                    {"message": {"content": "P101 is ready."}},
                ],
            ) as mocked_request,
        ):
            answer_with_ollama("What is ready?", [], context)
        messages = mocked_request.call_args.args[1]["messages"]
        self.assertEqual(messages[1]["role"], "system")
        self.assertIn("Fresh read-only ExecOS Kernel Engine snapshot", messages[1]["content"])
        self.assertIn('"clock_tick":17', messages[1]["content"])

    def test_chat_does_not_use_fallback_when_model_is_unavailable(self) -> None:
        with (
            patch.dict(os.environ, {
                "EXECOS_OLLAMA_URL": "http://127.0.0.1:11434",
                "EXECOS_OLLAMA_MODEL": "missing-model",
            }),
            patch("app.ollama_chat._request_json", return_value={"models": []}),
        ):
            with self.assertRaisesRegex(OllamaError, "not installed"):
                answer_with_ollama("Explain paging", [])


if __name__ == "__main__":
    unittest.main()
