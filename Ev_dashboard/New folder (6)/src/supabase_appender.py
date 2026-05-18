from __future__ import annotations

import os
import math
import json
from typing import Any

import requests


class SupabaseVehicleAppender:
    def __init__(
        self,
        url: str,
        service_role_key: str,
        vehicle_table: str = "vehicles",
        snapshot_table: str = "vehicle_snapshots",
    ) -> None:
        self.url = url.rstrip("/")
        self.service_role_key = service_role_key
        self.vehicle_table = vehicle_table
        self.snapshot_table = snapshot_table

    def append(self, records: list[dict[str, Any]]) -> None:
        valid_records = [record for record in records if _vehicle_number(record)]
        if not valid_records:
            return

        latest_by_vehicle: dict[str, dict[str, Any]] = {}
        for record in valid_records:
            latest_by_vehicle[_vehicle_number(record)] = self._vehicle_payload(record)

        self._post(
            f"/rest/v1/{self.vehicle_table}?on_conflict=id",
            list(latest_by_vehicle.values()),
            prefer="resolution=merge-duplicates,return=minimal",
        )
        self._post(
            f"/rest/v1/{self.snapshot_table}",
            [self._snapshot_payload(record) for record in valid_records],
            prefer="return=minimal",
        )

    def _post(self, path: str, payload: list[dict[str, Any]], prefer: str) -> None:
        if not payload:
            return
        payload = _normalize_bulk_keys(payload)
        safe_payload = _sanitize_json(payload)
        # Supabase/PostgREST rejects NaN/Infinity in JSON; Python's default JSON encoder
        # will emit them unless we both sanitize and disallow them at dump-time.
        body = json.dumps(safe_payload, allow_nan=False, separators=(",", ":")).encode("utf-8")
        response = requests.post(
            f"{self.url}{path}",
            data=body,
            timeout=45,
            headers={
                "apikey": self.service_role_key,
                "Authorization": f"Bearer {self.service_role_key}",
                "Content-Type": "application/json",
                "Prefer": prefer,
            },
        )
        if not response.ok:
            # Help debug PostgREST validation errors without dumping secrets.
            sample = safe_payload[:1] if isinstance(safe_payload, list) else safe_payload
            print(f"[supabase_appender] POST {path} failed: {response.status_code} {response.text}")
            print(f"[supabase_appender] payload_sample={json.dumps(sample, ensure_ascii=True)[:2000]}")
        response.raise_for_status()

    def _vehicle_payload(self, record: dict[str, Any]) -> dict[str, Any]:
        vehicle_number = _vehicle_number(record)
        battery = _number(_first(record, "battery%", "battery_percent", "battery"))
        return _drop_none(
            {
                "id": vehicle_number,
                "model": _text(_first(record, "vehicle model/model", "vehicle_model", "model")),
                "source_system": _text(_first(record, "source", "source_system")),
                "status": _text(_first(record, "current status of vehicle", "status", "movement_status_raw")),
                "battery": round(battery) if battery is not None else None,
                "today_distance": _number(_first(record, "Dist._today", "distance_today_km", "today_distance")),
                "running_time": _text(_first(record, "time today", "running_time", "today_running_minutes")),
                "avg_speed": _text(_first(record, "average speed(calculated from distance and time)", "today_avg_speed_kmph", "avg_speed")),
                "odometer": _text(_first(record, "odometer", "odometer_km")),
                "energy": _text(_first(record, "energy consumed", "energy_today_kwh", "energy")),
                "last_updated": _text(_first(record, "scraped_at", "vehicle_updated_at", "last_updated")),
                "lat": _number(_first(record, "lat", "latitude")),
                "lng": _number(_first(record, "long", "lng", "longitude", "lon")),
                "metadata": record,
            }
        )

    def _snapshot_payload(self, record: dict[str, Any]) -> dict[str, Any]:
        return _drop_none(
            {
                "scraped_at": _text(_first(record, "scraped_at", "vehicle_updated_at", "last_updated")),
                "source": _text(_first(record, "source", "source_system")),
                "vehicle_id": _text(_first(record, "vehicle_id", "id")),
                "vehicle_number": _vehicle_number(record),
                "vehicle_model": _text(_first(record, "vehicle model/model", "vehicle_model", "model")),
                "latitude": _number(_first(record, "lat", "latitude")),
                "longitude": _number(_first(record, "long", "lng", "longitude", "lon")),
                "distance_today_km": _number(_first(record, "Dist._today", "distance_today_km", "today_distance")),
                "odometer_km": _number(_first(record, "odometer", "odometer_km")),
                "today_running_minutes": _number(_first(record, "time today", "today_running_minutes")),
                "today_avg_speed_kmph": _number(_first(record, "average speed(calculated from distance and time)", "today_avg_speed_kmph")),
                "movement_status_raw": _text(_first(record, "current status of vehicle", "movement_status_raw", "status")),
                "battery_percent": _number(_first(record, "battery%", "battery_percent", "battery")),
                "state_of_health": _number(_first(record, "state of health", "state_of_health")),
                "energy_today_kwh": _number(_first(record, "energy consumed", "energy_today_kwh", "energy")),
                "last_stop_location_text": _text(_first(record, "last stop", "last_stop_location_text", "last_stop")),
                "raw_payload": record,
            }
        )


def build_supabase_appender_from_env() -> SupabaseVehicleAppender | None:
    storage = os.getenv("SCRAPER_STORAGE", "").strip().lower()
    wants_supabase = storage == "supabase" or os.getenv("USE_SUPABASE", "").strip().lower() in {"1", "true", "yes"}
    url = os.getenv("SUPABASE_URL", "").strip()
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not wants_supabase:
        return None
    if not url or not key:
        raise RuntimeError("SCRAPER_STORAGE=supabase requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.")
    return SupabaseVehicleAppender(
        url=url,
        service_role_key=key,
        vehicle_table=os.getenv("SUPABASE_VEHICLE_TABLE", "vehicles"),
        snapshot_table=os.getenv("SUPABASE_SNAPSHOT_TABLE", "vehicle_snapshots"),
    )


def _vehicle_number(record: dict[str, Any]) -> str:
    return _text(_first(record, "Vehcile_no", "vehicle_number", "vehicle_no", "vehicle_id", "id")).upper()


def _first(record: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        value = record.get(key)
        if value not in (None, "", "N/A", "Unavailable"):
            return value
    return None


def _text(value: Any) -> str:
    return str(value).strip() if value not in (None, "") else ""


def _number(value: Any) -> float | None:
    if value in (None, ""):
        return None
    try:
        number = float(str(value).replace(",", "").split()[0])
        return number if math.isfinite(number) else None
    except (TypeError, ValueError):
        return None


def _drop_none(payload: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in payload.items() if value is not None}


def _sanitize_json(value: Any) -> Any:
    """Recursively convert Python values into strict JSON-safe values.

    In particular, converts non-finite floats (NaN/Infinity) to None so PostgREST accepts the payload.
    """
    if value is None:
        return None
    if isinstance(value, float):
        return value if math.isfinite(value) else None
    if isinstance(value, (str, int, bool)):
        return value
    if isinstance(value, (list, tuple)):
        return [_sanitize_json(v) for v in value]
    if isinstance(value, dict):
        # Ensure keys are strings and values are sanitized.
        return {str(k): _sanitize_json(v) for k, v in value.items()}
    # Fallback: stringify unknown objects (e.g., datetime, Decimal) to keep JSON encoding strict.
    return str(value)


def _normalize_bulk_keys(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """PostgREST requires all objects in a bulk insert to have identical keys."""
    if not rows:
        return rows
    all_keys: set[str] = set()
    for row in rows:
        all_keys.update(row.keys())
    normalized: list[dict[str, Any]] = []
    for row in rows:
        normalized.append({key: row.get(key, None) for key in all_keys})
    return normalized
