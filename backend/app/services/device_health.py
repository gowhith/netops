from __future__ import annotations

from app.core.config import settings
from app.models.device import DeviceStatus


def compute_health_score(
    cpu: float | None,
    memory: float | None,
    latency: float | None,
    packet_loss: float | None,
) -> float:
    """Composite 0–100 score. Lower component values = higher score."""
    components: list[float] = []
    if cpu is not None:
        components.append(max(0.0, 100.0 - cpu))
    if memory is not None:
        components.append(max(0.0, 100.0 - memory))
    if latency is not None:
        # 0ms -> 100, 500ms+ -> 0
        components.append(max(0.0, 100.0 - min(latency, 500.0) / 5.0))
    if packet_loss is not None:
        components.append(max(0.0, 100.0 - packet_loss * 10.0))

    if not components:
        return 0.0
    return round(sum(components) / len(components), 2)


def classify_status(
    cpu: float | None,
    memory: float | None,
    latency: float | None,
    packet_loss: float | None,
) -> DeviceStatus:
    if (
        (cpu is not None and cpu >= settings.rule_cpu_critical)
        or (memory is not None and memory >= settings.rule_mem_critical)
        or (packet_loss is not None and packet_loss >= settings.rule_packet_loss_critical)
    ):
        return DeviceStatus.CRITICAL

    if latency is not None and latency >= settings.rule_latency_critical_ms:
        return DeviceStatus.DEGRADED

    if (
        (cpu is not None and cpu >= settings.rule_cpu_warning)
        or (memory is not None and memory >= settings.rule_mem_warning)
        or (packet_loss is not None and packet_loss >= settings.rule_packet_loss_warning)
        or (latency is not None and latency >= settings.rule_latency_warning_ms)
    ):
        return DeviceStatus.WARNING

    return DeviceStatus.HEALTHY
