"""Team-facing contract models and adapters for Blackbox integration.

Witsmith keeps `deny` internally because the wit YAML and demo language use it.
This module is the boundary that exposes the shared team vocabulary (`block`).
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from witsmith.models import Action, CheckResult

ContractDecisionValue = Literal["allow", "ask", "block"]
ContractAmendmentStatus = Literal["suggested", "applied", "rejected"]
ClaimConfidence = Literal["low", "medium", "high"]
ClaimKind = Literal["observed", "agent_reported", "inferred"]


class ContractCheckInput(BaseModel):
    command: str
    cwd: str
    sessionId: str | None = None


class ContractDecision(BaseModel):
    decision: ContractDecisionValue
    reason: str | None = None
    ruleId: str | None = None

    @field_validator("decision", mode="before")
    @classmethod
    def _accept_internal_deny(cls, value: Any) -> ContractDecisionValue:
        if value == "allow":
            return "allow"
        if value == "ask":
            return "ask"
        return "block"


class ContractEvent(BaseModel):
    id: str
    sessionId: str
    command: str | None = None
    decision: ContractDecisionValue
    ruleId: str | None = None
    reason: str | None = None
    createdAt: str

    @field_validator("decision", mode="before")
    @classmethod
    def _accept_internal_deny(cls, value: Any) -> ContractDecisionValue:
        if value == "allow":
            return "allow"
        if value == "ask":
            return "ask"
        return "block"


class CommandLog(BaseModel):
    model_config = ConfigDict(extra="allow")

    command: str = ""
    output: str = ""
    exitCode: int | None = None
    createdAt: str = ""
    contractDecision: ContractDecision | None = None


class ContractAmendment(BaseModel):
    id: str
    sessionId: str
    filePath: str
    diff: str
    reason: str
    evidence: list[str] = Field(default_factory=list)
    status: ContractAmendmentStatus = "suggested"
    createdAt: str


class EvidenceBundle(BaseModel):
    """Permissive shape: accepts both the team contract and Witsmith's action log."""

    model_config = ConfigDict(extra="allow")

    sessionId: str = ""
    task: str = ""
    repoPath: str = ""
    branch: str = ""
    baseCommit: str = ""
    endCommit: str = ""
    startedAt: str = ""
    finishedAt: str = ""
    status: str = ""
    changedFiles: list[str] = Field(default_factory=list)
    diff: str = ""
    commands: list[CommandLog] = Field(default_factory=list)
    actions: list[dict[str, Any]] = Field(default_factory=list)
    agentTrace: str = ""
    contractEvents: list[ContractEvent] = Field(default_factory=list)


class Claim(BaseModel):
    id: str
    kind: ClaimKind
    text: str
    confidence: ClaimConfidence
    evidence: list[str] = Field(default_factory=list)


class MemoryCard(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str = ""
    sessionId: str = ""
    content: str = ""
    evidence: list[str] = Field(default_factory=list)
    sourceFiles: list[str] = Field(default_factory=list)
    retrieveWhen: list[str] = Field(default_factory=list)
    staleIfChanged: list[str] = Field(default_factory=list)
    isStale: bool = False
    createdAt: str = ""


def contract_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def public_decision(decision: str | None) -> ContractDecisionValue:
    if decision == "allow":
        return "allow"
    if decision == "ask":
        return "ask"
    return "block"


def internal_decision(decision: str | None) -> str:
    if decision == "block":
        return "deny"
    if decision in {"allow", "ask", "deny"}:
        return decision
    return "ask"


def to_contract_decision(result: CheckResult, action: Action | None = None) -> ContractDecision:
    _ = action  # reserved for future source-aware rule labels
    return ContractDecision(
        decision=public_decision(result.decision),
        reason=result.reason,
        ruleId=result.matched_rule,
    )


def to_contract_event(log_line: dict[str, Any]) -> ContractEvent:
    session_id = (
        log_line.get("sessionId")
        or log_line.get("session_id")
        or log_line.get("session")
        or ""
    )
    return ContractEvent(
        id=str(log_line.get("id") or log_line.get("action_id") or contract_id("contract_event")),
        sessionId=str(session_id),
        command=log_line.get("command"),
        decision=public_decision(str(log_line.get("decision") or "")),
        ruleId=log_line.get("ruleId") or log_line.get("matched_rule"),
        reason=log_line.get("reason"),
        createdAt=str(log_line.get("createdAt") or log_line.get("ts") or utc_now_iso()),
    )


def to_contract_amendment(
    *,
    file_path: Path | str,
    diff: str,
    reason: str,
    evidence: list[str] | None = None,
    session_id: str | None = None,
    status: ContractAmendmentStatus = "suggested",
    amendment_id: str | None = None,
    created_at: str | None = None,
) -> ContractAmendment:
    return ContractAmendment(
        id=amendment_id or contract_id("amendment"),
        sessionId=session_id or "",
        filePath=str(file_path),
        diff=diff,
        reason=reason,
        evidence=evidence or [],
        status=status,
        createdAt=created_at or utc_now_iso(),
    )


def parse_evidence_bundle(data: dict[str, Any]) -> EvidenceBundle:
    """Load either the agreed team shape or the current Witsmith session example."""
    payload = dict(data)
    if "evidenceBundle" in payload and isinstance(payload["evidenceBundle"], dict):
        payload = dict(payload["evidenceBundle"])

    if "sessionId" not in payload:
        payload["sessionId"] = payload.get("id") or payload.get("session_id") or ""
    if "commands" not in payload and "actions" in payload:
        payload["commands"] = [
            _command_from_action(action) for action in payload.get("actions") or []
        ]
    if "actions" not in payload:
        payload["actions"] = payload.get("commands") or []
    if "contractEvents" not in payload:
        payload["contractEvents"] = []

    return EvidenceBundle.model_validate(payload)


def _command_from_action(action: dict[str, Any]) -> dict[str, Any]:
    output = "\n".join(
        part
        for part in [str(action.get("stdout") or ""), str(action.get("stderr") or "")]
        if part
    )
    decision = ContractDecision(
        decision=public_decision(action.get("decision")),
        reason=action.get("reason"),
        ruleId=action.get("matched_rule") or action.get("ruleId"),
    )
    return {
        "command": str(action.get("command") or ""),
        "output": output,
        "exitCode": action.get("exitCode", action.get("exit_code")),
        "createdAt": str(action.get("createdAt") or action.get("ts") or ""),
        "contractDecision": decision.model_dump(mode="json"),
    }
