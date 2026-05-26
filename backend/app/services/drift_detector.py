from __future__ import annotations

from typing import Any


def diff_configs(baseline: dict, current: dict) -> dict[str, dict[str, Any]]:
    """Shallow + nested diff.

    Returns a dict keyed by field path with entries:
        {"baseline": <value>, "current": <value>}
    Missing keys are reported with `None` on the absent side.
    """
    differences: dict[str, dict[str, Any]] = {}
    _walk(baseline or {}, current or {}, "", differences)
    return differences


def _walk(a: Any, b: Any, path: str, out: dict[str, dict[str, Any]]) -> None:
    if isinstance(a, dict) and isinstance(b, dict):
        for key in set(a) | set(b):
            sub_path = f"{path}.{key}" if path else key
            _walk(a.get(key), b.get(key), sub_path, out)
        return
    if a != b:
        out[path or "<root>"] = {"baseline": a, "current": b}
