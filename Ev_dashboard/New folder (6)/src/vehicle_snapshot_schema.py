from __future__ import annotations

import json
import uuid
from datetime import UTC, datetime
from typing import Any


UNIFIED_HEADERS = [
    "scraped_at",
    "source",
    "vehicle_id",
    "Vehcile_no",
    "vehicle model/model",
    "lat",
    "long",
    "Dist._today",
    "odometer",
    "time today",
    "average speed(calculated from distance and time)",
    "current status of vehicle",
    "battery%",
    "state of health",
    "energy consumed",
    "last stop",
]

NUMERIC_HEADERS = {
    "lat",
    "long",
    "Dist._today",
    "odometer",
    "time today",
    "average speed(calculated from distance and time)",
    "battery%",
    "state of health",
    "energy consumed",
}


def output_headers() -> list[str]:
    return list(UNIFIED_HEADERS)


def now_iso() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat()


def new_log_id() -> str:
    return str(uuid.uuid4())


def epoch_to_iso(value: Any) -> str:
    number = as_float(value)
    if not isinstance(number, float) or number == 0:
        return ""
    if number > 1_000_000_000_000:
        number = number / 1000
    return datetime.fromtimestamp(number, UTC).replace(microsecond=0).isoformat()


def as_float(value: Any) -> float | str:
    if value in (None, ""):
        return ""
    try:
        return float(value)
    except (TypeError, ValueError):
        return ""


def as_non_negative_float(value: Any) -> float | str:
    number = as_float(value)
    if isinstance(number, float) and number >= 0:
        return number
    return ""


def first_non_negative_float(*values: Any) -> float | str:
    for value in values:
        number = as_non_negative_float(value)
        if number != "":
            return number
    return ""


def as_bool(value: Any) -> bool | str:
    if value in (None, ""):
        return ""
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    text = str(value).strip().lower()
    if text in {"true", "yes", "y", "1", "on", "charging", "active"}:
        return True
    if text in {"false", "no", "n", "0", "off", "none", "null"}:
        return False
    return ""


def compact_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, default=str, separators=(",", ":"))


def first_value(*values: Any) -> Any:
    for value in values:
        if value not in (None, ""):
            return value
    return ""


def final_vehicle_record(source: str, **values: Any) -> dict[str, Any]:
    record = {header: "" for header in UNIFIED_HEADERS}
    record["scraped_at"] = values.get("scraped_at") or now_iso()
    record["source"] = source
    for key, value in values.items():
        if key in record and value not in (None, ""):
            record[key] = value
    return fill_required_fields(record)


def fill_required_fields(record: dict[str, Any]) -> dict[str, Any]:
    for header in UNIFIED_HEADERS:
        if record.get(header) not in (None, ""):
            continue
        if header in NUMERIC_HEADERS:
            record[header] = ""
            continue
        record[header] = "N/A"
    return record


def blank_success_record(source_system: str) -> dict[str, Any]:
    return final_vehicle_record(source_system)


def failure_record(source_system: str, error_message: str, raw_payload: Any = None) -> dict[str, Any]:
    return final_vehicle_record(
        source_system,
        vehicle_id=f"ERROR-{new_log_id()}",
        **{
            "current status of vehicle": f"scrape_failed: {error_message}",
            "last stop": compact_json(raw_payload or {"error": error_message}),
        },
    )
