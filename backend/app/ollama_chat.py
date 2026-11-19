"""Optional local Ollama chat integration for OS tutoring."""

from __future__ import annotations

import json
import os
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen


class OllamaError(RuntimeError):
    """An explicit Ollama configuration, availability, or response error."""


def _configuration() -> tuple[str, str]:
    base_url = os.environ.get("EXECOS_OLLAMA_URL", "http://127.0.0.1:11434").rstrip("/")
    model = os.environ.get("EXECOS_OLLAMA_MODEL", "qwen2.5:1.5b").strip()
    parsed = urlparse(base_url)
    if parsed.scheme != "http" or parsed.hostname not in {"127.0.0.1", "localhost", "::1"}:
        raise OllamaError(
            "Ollama must use a local HTTP endpoint (localhost, 127.0.0.1, or ::1)."
        )
    if not model:
        raise OllamaError("Set EXECOS_OLLAMA_MODEL to an installed Ollama model.")
    return base_url, model


def _request_json(url: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    request = Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"} if data is not None else {},
        method="POST" if data is not None else "GET",
    )
    try:
        with urlopen(request, timeout=120 if data is not None else 2) as response:
            result = json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        raise OllamaError(f"Ollama returned HTTP {error.code}.") from error
    except (URLError, TimeoutError, OSError) as error:
        raise OllamaError(
            "Ollama is not reachable on this computer. Start Ollama and try again."
        ) from error
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise OllamaError("Ollama returned an unreadable response.") from error
    if not isinstance(result, dict):
        raise OllamaError("Ollama returned an invalid response.")
    return result


def ollama_status() -> dict[str, Any]:
    try:
        base_url, model = _configuration()
    except OllamaError as error:
        return {"available": False, "model": None, "message": str(error)}
    try:
        result = _request_json(f"{base_url}/api/tags")
    except OllamaError as error:
        return {"available": False, "model": model, "message": str(error)}
    models = result.get("models", [])
    installed = any(
        isinstance(entry, dict) and entry.get("name") == model
        for entry in models
    )
    return {
        "available": installed,
        "model": model,
        "message": "Local model ready." if installed else (
            f"Ollama is running, but model '{model}' is not installed. "
            f"Pull it locally or set EXECOS_OLLAMA_MODEL to an installed model."
        ),
    }


def answer_with_ollama(
    question: str,
    history: list[dict[str, str]],
    kernel_state: dict[str, Any] | None = None,
) -> dict[str, Any]:
    status = ollama_status()
    if not status["available"]:
        raise OllamaError(status["message"])
    base_url, model = _configuration()
    messages = [{
        "role": "system",
        "content": (
            "You are ExecOS AI, a conversational tutor and general assistant with broad "
            "knowledge across operating systems, computer science, programming, "
            "mathematics, science, technology, and everyday topics. Answer the user's "
            "actual question rather than refusing just because it is outside operating "
            "systems or unrelated to ExecOS. For operating-system questions, teach the "
            "concept in depth and connect it to a concrete example. For other questions, "
            "answer normally at the level of detail requested. If part of a request "
            "cannot be answered confidently, explain the uncertainty and still provide "
            "the useful, well-supported part. "
            "For operating-system topics, help with "
            "processes and threads, CPU scheduling, synchronization, deadlocks, memory "
            "management, virtual memory, paging, segmentation, file systems, I/O, disks, "
            "system calls, interrupts, protection, and distributed-system fundamentals. "
            "Answer the user's question directly, then explain the underlying mechanism "
            "step by step; use accurate terminology, a small worked example, and "
            "tradeoffs when useful. Handle follow-ups using the conversation history. "
            "For factual questions, separate well-established facts from uncertainty. "
            "Do not invent a causal mechanism or fill gaps with plausible-sounding detail; "
            "say what is uncertain and answer only what you can support. Keep the answer "
            "focused unless the user asks for depth. "
            "Follow the user's requested language and level. Format readable "
            "answers with short headings, lists, and fenced code blocks when helpful; "
            "write formulas in plain text or code formatting rather than raw LaTeX. "
            "Distinguish established OS concepts from facts about the ExecOS software "
            "simulator and the user's real host. The latest system-state message, when "
            "present, is the only "
            "source for live ExecOS claims; use its exact facts and say when information "
            "is absent. Do not invent metrics, process actions, features, or trace "
            "events. The listed scheduler algorithms are the exact policies implemented "
            "by this Engine; an unlisted policy such as priority aging is not implemented. "
            "Round Robin is listed and is implemented. If asked about formulas or code, "
            "show a concise, correct example and state assumptions for calculations. "
            "Never claim to browse the web, execute commands, or change system state. "
            "When the answer is longer than one response, finish a coherent section "
            "and invite the user to ask for the next part."
        ),
    }]
    if kernel_state is not None:
        messages.append({
            "role": "system",
            "content": (
                "Fresh read-only ExecOS Kernel Engine snapshot at this request; "
                "it is simulated application state, not the host operating system. "
                "Use these observed facts only for user questions about current ExecOS:\n"
                + json.dumps(kernel_state, ensure_ascii=True, separators=(",", ":"))
            ),
        })
    messages.extend(history)
    messages.append({"role": "user", "content": question})
    result = _request_json(
        f"{base_url}/api/chat",
        {
            "model": model,
            "stream": False,
            "messages": messages,
            "options": {
                "temperature": 0.1,
                "num_ctx": 8192,
                "num_predict": 2048,
            },
        },
    )
    message = result.get("message")
    content = message.get("content") if isinstance(message, dict) else None
    if not isinstance(content, str) or not content.strip():
        raise OllamaError("Ollama returned an empty answer.")
    return {
        "answer": content.strip(),
        "source": "local-ollama",
        "model": model,
        "domain": "os_tutor",
        "function": "chat",
        "read_only": True,
        "evidence": ["Generated locally by the configured Ollama model; no Engine action was taken."],
    }
