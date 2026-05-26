"""Hybrid telemetry generator.

- One "device" mirrors this host via psutil (CPU/mem real numbers).
- N synthetic routers/switches/APs emit randomized telemetry.
- A failure-injection rotation periodically forces warning/critical/offline
  scenarios so the rules engine + automation can be visibly exercised.

Run:

    python -m simulator.device_simulator
"""

from __future__ import annotations

import asyncio
import logging
import random
from datetime import datetime, timezone
from typing import Any

import httpx
import psutil

from app.core.config import settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("simulator")

DEVICE_TYPES = ["router", "switch", "ap", "edge"]
LOCATIONS = ["San Jose DC-1", "Dallas DC-2", "NYC POP-1", "London POP-2", "Singapore DC-1"]
VENDORS = ["Cisco", "Juniper", "Arista", "Aruba"]

# Failure scenarios cycled through synthetic devices.
SCENARIOS = ["normal", "normal", "normal", "warning", "critical", "offline"]


def _normal() -> dict[str, float]:
    return {
        "cpu_percent": random.uniform(15, 60),
        "memory_percent": random.uniform(30, 70),
        "latency_ms": random.uniform(15, 80),
        "packet_loss_percent": random.uniform(0, 1),
        "bandwidth_mbps": random.uniform(200, 900),
    }


def _warning() -> dict[str, float]:
    return {
        "cpu_percent": random.uniform(75, 89),
        "memory_percent": random.uniform(80, 90),
        "latency_ms": random.uniform(120, 195),
        "packet_loss_percent": random.uniform(2, 4.5),
        "bandwidth_mbps": random.uniform(100, 500),
    }


def _critical() -> dict[str, float]:
    return {
        "cpu_percent": random.uniform(91, 99),
        "memory_percent": random.uniform(92, 99),
        "latency_ms": random.uniform(220, 480),
        "packet_loss_percent": random.uniform(6, 15),
        "bandwidth_mbps": random.uniform(20, 200),
    }


SCENARIO_FN = {"normal": _normal, "warning": _warning, "critical": _critical}


def _real_host_metrics() -> dict[str, Any]:
    return {
        "cpu_percent": psutil.cpu_percent(interval=None),
        "memory_percent": psutil.virtual_memory().percent,
        "latency_ms": random.uniform(5, 30),
        "packet_loss_percent": 0.0,
        "bandwidth_mbps": random.uniform(50, 800),
    }


def _build_event(device: dict[str, Any], scenario: str) -> dict[str, Any] | None:
    if scenario == "offline":
        # Send nothing — simulates a missing heartbeat. Sweeper will react.
        return None

    metrics = (
        _real_host_metrics()
        if device.get("is_local")
        else SCENARIO_FN.get(scenario, _normal)()
    )
    return {
        "device_id": device["device_id"],
        "device_type": device["device_type"],
        "name": device["name"],
        "location": device["location"],
        "vendor": device["vendor"],
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "interface_status": "up",
        **metrics,
    }


def _build_fleet(count: int) -> list[dict[str, Any]]:
    fleet: list[dict[str, Any]] = [
        {
            "device_id": "host-local-01",
            "name": "Local Host (psutil)",
            "device_type": "server",
            "location": LOCATIONS[0],
            "vendor": "self",
            "is_local": True,
            "scenario_idx": 0,
        }
    ]
    for i in range(1, count + 1):
        dtype = DEVICE_TYPES[i % len(DEVICE_TYPES)]
        fleet.append(
            {
                "device_id": f"{dtype}-{i:03d}",
                "name": f"{dtype.title()} {i:03d}",
                "device_type": dtype,
                "location": random.choice(LOCATIONS),
                "vendor": random.choice(VENDORS),
                "is_local": False,
                "scenario_idx": random.randrange(len(SCENARIOS)),
            }
        )
    return fleet


async def _post(client: httpx.AsyncClient, event: dict[str, Any]) -> None:
    try:
        r = await client.post("/api/telemetry", json=event, timeout=5.0)
        if r.status_code >= 300:
            logger.warning("ingest %s -> %s %s", event["device_id"], r.status_code, r.text[:200])
    except Exception as e:
        logger.warning("ingest failed for %s: %s", event["device_id"], e)


async def run() -> None:
    fleet = _build_fleet(settings.sim_device_count)
    logger.info(
        "simulator running: %d devices @ %ss interval -> %s",
        len(fleet),
        settings.sim_interval_seconds,
        settings.sim_api_url,
    )

    async with httpx.AsyncClient(base_url=settings.sim_api_url) as client:
        tick = 0
        while True:
            tasks: list[Any] = []
            for device in fleet:
                # Each device cycles through SCENARIOS so the dashboard shows
                # the full alert/incident lifecycle.
                idx = (device["scenario_idx"] + tick // 4) % len(SCENARIOS)
                scenario = SCENARIOS[idx]
                event = _build_event(device, scenario)
                if event is not None:
                    tasks.append(_post(client, event))
            if tasks:
                await asyncio.gather(*tasks, return_exceptions=True)

            tick += 1
            await asyncio.sleep(settings.sim_interval_seconds)


if __name__ == "__main__":
    try:
        asyncio.run(run())
    except KeyboardInterrupt:
        pass
