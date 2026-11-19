"""User-approved, Engine-owned recovery operations for ExecAI."""

from __future__ import annotations

import copy
import secrets
from threading import RLock
from typing import Any

from app.analysis import diagnose_execos
from app.kernel_engine import ExecOSKernelEngine, KernelEngineError


class RecoveryManager:
    def __init__(self, engine: ExecOSKernelEngine) -> None:
        self._engine = engine
        self._lock = RLock()
        self._plans: dict[str, dict[str, Any]] = {}

    @property
    def engine(self) -> ExecOSKernelEngine:
        return self._engine

    def create_plan(self) -> dict[str, Any]:
        data = self._engine.analysis_bundle()
        snapshot = data["snapshot"]
        optimizer = data["optimizer"]
        diagnosis = diagnose_execos(snapshot, data["trace"], optimizer)
        current_policy = (
            snapshot["scheduler"]["last_result"]["algorithm"]
            if snapshot["scheduler"]["last_result"]
            else "round_robin"
        )
        recommended_policy = optimizer.get("recommended_algorithm") if optimizer else None
        ready = snapshot["scheduler"]["ready_queue"]
        actionable = bool(
            ready
            and recommended_policy
            and recommended_policy != current_policy
        )
        plan_id = secrets.token_urlsafe(18)
        plan = {
            "plan_id": plan_id,
            "status": "awaiting_approval" if actionable else "no_safe_action",
            "action": {
                "type": "run_scheduler",
                "algorithm": recommended_policy,
                "quantum": optimizer.get("recommended_quantum", 4) if optimizer else None,
            } if actionable else None,
            "summary": (
                f"Run {recommended_policy.upper()} on the current READY workload."
                if actionable
                else "No alternate scheduler policy is currently justified by measured workload data."
            ),
            "reason": (
                optimizer.get("recommendation_reason")
                if actionable and optimizer
                else "The Engine has no READY workload or the measured optimizer found no safer alternate policy."
            ),
            "evidence": diagnosis["evidence"],
            "diagnosis": {
                "system_health": diagnosis["system_health"],
                "severity": diagnosis["severity"],
                "primary_issue": diagnosis["primary_issue"],
                "findings": diagnosis["findings"],
            },
            "source": "execos-recovery-manager",
            "read_only_until_approved": True,
        }
        with self._lock:
            self._plans[plan_id] = {
                "snapshot": copy.deepcopy(snapshot),
                "plan": plan,
            }
            if len(self._plans) > 50:
                oldest_id = next(iter(self._plans))
                del self._plans[oldest_id]
        return plan

    def execute(self, plan_id: str, approved: bool) -> dict[str, Any]:
        if not approved:
            raise KernelEngineError("Explicit user approval is required for recovery")
        with self._lock:
            stored = self._plans.pop(plan_id, None)
        if stored is None:
            raise KernelEngineError("Recovery plan is unknown, expired, or already used")
        if stored["plan"]["status"] != "awaiting_approval":
            raise KernelEngineError("Recovery plan has no executable action")

        action = stored["plan"]["action"]
        result = self._engine.run_scheduler_if_state_unchanged(
            action["algorithm"],
            quantum=action["quantum"] or 4,
            expected_state=stored["snapshot"],
        )
        verified_state = result["engine_state"]
        expected_ready = [
            process["pid"]
            for process in verified_state["processes"]["states"]["READY"]
        ]
        queue_matches = verified_state["scheduler"]["ready_queue"] == expected_ready
        running = verified_state["processes"]["states"]["RUNNING"]
        owner_matches = (
            len(running) <= 1
            and (
                verified_state["scheduler"]["current_pid"]
                == (running[0]["pid"] if running else None)
            )
        )
        return {
            "plan": stored["plan"],
            "result": result,
            "verification": {
                "verified": queue_matches and owner_matches,
                "ready_queue_matches_process_table": queue_matches,
                "running_owner_matches_process_table": owner_matches,
                "engine_tick": verified_state["engine"]["clock_tick"],
            },
            "source": "execos-recovery-manager",
        }
