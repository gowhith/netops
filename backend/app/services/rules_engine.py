"""Threshold-based detection — produces alert payloads from a telemetry event."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

from app.core.config import settings
from app.models.alert import AlertSeverity


@dataclass(frozen=True)
class AlertCandidate:
    rule: str
    severity: AlertSeverity
    message: str
    metric_value: float
    threshold: float


def evaluate(event: dict) -> list[AlertCandidate]:
    """Return zero or more alert candidates produced by the rules."""
    out: list[AlertCandidate] = []

    cpu = _f(event.get("cpu_percent"))
    mem = _f(event.get("memory_percent"))
    lat = _f(event.get("latency_ms"))
    loss = _f(event.get("packet_loss_percent"))

    if cpu is not None:
        if cpu >= settings.rule_cpu_critical:
            out.append(_cand("cpu_critical", AlertSeverity.CRITICAL,
                             f"CPU {cpu:.1f}% above critical", cpu, settings.rule_cpu_critical))
        elif cpu >= settings.rule_cpu_warning:
            out.append(_cand("cpu_warning", AlertSeverity.WARNING,
                             f"CPU {cpu:.1f}% above warning", cpu, settings.rule_cpu_warning))

    if mem is not None:
        if mem >= settings.rule_mem_critical:
            out.append(_cand("memory_critical", AlertSeverity.CRITICAL,
                             f"Memory {mem:.1f}% above critical", mem, settings.rule_mem_critical))
        elif mem >= settings.rule_mem_warning:
            out.append(_cand("memory_warning", AlertSeverity.WARNING,
                             f"Memory {mem:.1f}% above warning", mem, settings.rule_mem_warning))

    if lat is not None:
        if lat >= settings.rule_latency_critical_ms:
            out.append(_cand("latency_degraded", AlertSeverity.CRITICAL,
                             f"Latency {lat:.0f}ms degraded", lat, settings.rule_latency_critical_ms))
        elif lat >= settings.rule_latency_warning_ms:
            out.append(_cand("latency_warning", AlertSeverity.WARNING,
                             f"Latency {lat:.0f}ms high", lat, settings.rule_latency_warning_ms))

    if loss is not None:
        if loss >= settings.rule_packet_loss_critical:
            out.append(_cand("packet_loss_critical", AlertSeverity.CRITICAL,
                             f"Packet loss {loss:.1f}% critical", loss, settings.rule_packet_loss_critical))
        elif loss >= settings.rule_packet_loss_warning:
            out.append(_cand("packet_loss_warning", AlertSeverity.WARNING,
                             f"Packet loss {loss:.1f}% elevated", loss, settings.rule_packet_loss_warning))

    return out


def severity_rank(candidates: Iterable[AlertCandidate]) -> AlertSeverity | None:
    order = {AlertSeverity.INFO: 0, AlertSeverity.WARNING: 1, AlertSeverity.CRITICAL: 2}
    best: AlertSeverity | None = None
    for c in candidates:
        if best is None or order[c.severity] > order[best]:
            best = c.severity
    return best


def _f(v) -> float | None:
    if v is None or v == "":
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _cand(rule: str, sev: AlertSeverity, msg: str, value: float, threshold: float) -> AlertCandidate:
    return AlertCandidate(rule=rule, severity=sev, message=msg, metric_value=value, threshold=threshold)
