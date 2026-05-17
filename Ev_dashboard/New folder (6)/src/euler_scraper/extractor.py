from __future__ import annotations

import json
import os
import re
from urllib.parse import parse_qs, urlparse
from collections.abc import Iterable
from typing import Any

from bs4 import BeautifulSoup

from src.vehicle_snapshot_schema import (
    as_bool,
    as_float,
    as_non_negative_float,
    blank_success_record,
    compact_json,
    epoch_to_iso,
    final_vehicle_record,
    first_non_negative_float,
    first_value,
    now_iso,
    output_headers,
)

VEHICLE_HINT_KEYS = {
    "asset",
    "battery",
    "car",
    "chassis",
    "driver",
    "fleet",
    "imei",
    "latitude",
    "location",
    "longitude",
    "make",
    "model",
    "plate",
    "registration",
    "regno",
    "soc",
    "status",
    "vehicle",
    "vin",
}

IDENTITY_KEYS = {
    "assetid",
    "carid",
    "chassisno",
    "deviceid",
    "id",
    "imei",
    "registration",
    "registrationno",
    "regno",
    "vehicleid",
    "vehicleno",
    "vin",
}

HEADER_ALIASES = {
    "asset": "vehicle_id",
    "asset id": "vehicle_id",
    "battery": "battery",
    "battery %": "battery",
    "car": "vehicle_name",
    "driver": "driver",
    "fleet": "fleet",
    "imei": "imei",
    "lat": "latitude",
    "latitude": "latitude",
    "lng": "longitude",
    "lon": "longitude",
    "longitude": "longitude",
    "location": "location",
    "make": "make",
    "model": "model",
    "plate": "registration_number",
    "registration": "registration_number",
    "registration no": "registration_number",
    "reg no": "registration_number",
    "soc": "battery",
    "status": "status",
    "vehicle": "vehicle_name",
    "vehicle id": "vehicle_id",
    "vehicle no": "registration_number",
    "vin": "vin",
}


def flatten_key(key: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", key.lower())


def normalize_label(label: str) -> str:
    return re.sub(r"\s+", " ", label.strip().lower())


def pick_first(data: dict[str, Any], candidates: Iterable[str]) -> Any:
    normalized = {flatten_key(k): v for k, v in data.items()}
    for candidate in candidates:
        value = normalized.get(flatten_key(candidate))
        if value not in (None, ""):
            return value
    return ""


def nested_get(data: dict[str, Any], path: str, default: Any = "") -> Any:
    value: Any = data
    for part in path.split("."):
        if not isinstance(value, dict):
            return default
        value = value.get(part, default)
    return value if value not in (None, "") else default


def normalize_vehicle_record(raw: dict[str, Any], source: str) -> dict[str, Any]:
    scraped_at = now_iso()
    record = {
        "scraped_at": scraped_at,
        "source": source,
        "vehicle_id": pick_first(raw, ["vehicle_id", "vehicleId", "id", "assetId", "carId"]),
        "imei": pick_first(raw, ["imei", "deviceImei", "deviceId"]),
        "registration_number": pick_first(
            raw,
            ["registration_number", "registrationNo", "regNo", "vehicleNo", "plate", "r_num", "v_reg_num"],
        ),
        "chassis_number": pick_first(raw, ["chassis_number", "chassisNo", "chassis", "vin"]),
        "vehicle_name": pick_first(raw, ["vehicle_name", "vehicleName", "vehicle", "car", "name"]),
        "vehicle_model": pick_first(raw, ["vehicle_model", "vehicleModel", "model", "v_model"]),
        "vehicle_category": pick_first(raw, ["vehicle_category", "v_cat"]),
        "driver": pick_first(raw, ["driver", "driverName"]),
        "status": pick_first(raw, ["status", "vehicleStatus", "state"]),
        "latitude": pick_first(raw, ["latitude", "lat"]),
        "longitude": pick_first(raw, ["longitude", "lng", "lon"]),
        "location_text": location_text_from(
            raw,
            "__location_address",
            "location_text",
            "location.address",
            "location.formatted_address",
            "location.location_address",
            "address",
            "last_location",
            "lastLocation",
            "Last Location",
        ),
        "last_stop_location_text": trip_end_location_text(raw),
        "heading": pick_first(raw, ["heading"]),
        "battery_soc": pick_first(raw, ["battery_soc", "battery", "batteryPercent", "battery_percentage", "soc"]),
        "battery_state": pick_first(raw, ["battery_state", "batteryState"]),
        "connectivity_state": pick_first(raw, ["connectivity_state", "connectivityState", "network"]),
        "lock_state": pick_first(raw, ["lock_state", "lockState"]),
        "vehicle_state": pick_first(raw, ["vehicle_state", "vehicleState"]),
        "vehicle_mode": pick_first(raw, ["vehicle_mode", "vehicleMode"]),
        "location_last_updated": pick_first(raw, ["location_last_updated"]),
        "vehicle_last_updated": pick_first(raw, ["vehicle_last_updated"]),
        "wake_up_time": pick_first(raw, ["wake_up_time"]),
        "total_distance_travelled": pick_first(raw, ["total_distance_travelled"]),
        "average_distance_per_day": pick_first(raw, ["average_distance_per_day"]),
        "total_energy_dissipated": pick_first(raw, ["total_energy_dissipated"]),
        "average_energy_dissipated": pick_first(raw, ["average_energy_dissipated"]),
        "total_time_travelled": pick_first(raw, ["total_time_travelled"]),
        "average_time_travelled": pick_first(raw, ["average_time_travelled"]),
        "active_trip_id": pick_first(raw, ["active_trip_id", "trip_id"]),
        "active_trip_distance": pick_first(raw, ["active_trip_distance", "distance_travel"]),
        "active_trip_start_time": pick_first(raw, ["active_trip_start_time", "start_time"]),
        "raw_json": json.dumps(raw, ensure_ascii=False, default=str),
    }
    return record


def blank_record() -> dict[str, Any]:
    return {"_raw_parts": [], "_sources": set(), "scraped_at": now_iso()}


def merge_if_value(target: dict[str, Any], source: dict[str, Any]) -> None:
    for key, value in source.items():
        if key in {"raw_json", "_raw_parts", "_sources"}:
            continue
        if value not in (None, ""):
            target[key] = value


def euler_state_value(state: Any) -> Any:
    if isinstance(state, dict):
        return state.get("value", "")
    return state or ""


def marker_status(marker_url: Any) -> str:
    if not marker_url:
        return ""
    name = str(marker_url).rsplit("/", 1)[-1].split(".", 1)[0]
    return name.replace("%20", " ")


def nested_raw(data: dict[str, Any], *paths: str) -> Any:
    for path in paths:
        value: Any = data
        for part in path.split("."):
            if not isinstance(value, dict):
                value = ""
                break
            value = value.get(part, "")
        if value not in (None, ""):
            return value
    return ""


def clean_location_text(value: Any) -> str:
    if value in (None, "") or isinstance(value, (bool, int, float)):
        return ""
    text = str(value).strip()
    if not text:
        return ""
    if text.lower() in {"na", "n/a", "none", "null", "undefined", "unknown location", "current location"}:
        return ""
    return text


def location_text_from(data: dict[str, Any], *paths: str) -> str:
    for path in paths:
        value = nested_raw(data, path)
        if isinstance(value, dict):
            text = clean_location_text(
                first_value(
                    value.get("formatted_address"),
                    value.get("address"),
                    value.get("location_address"),
                    value.get("display_name"),
                    value.get("name"),
                    value.get("text"),
                )
            )
        else:
            text = clean_location_text(value)
        if text:
            return text
    return ""


def trip_end_location_text(data: dict[str, Any]) -> str:
    return location_text_from(
        data,
        "__last_stop_address",
        "last_stop_location_text",
        "last_stop",
        "lastStop",
        "last_location",
        "lastLocation",
        "lastLocationText",
        "end_location_text",
        "end_location",
        "endLocation",
        "end_address",
        "endAddress",
        "end.address",
        "end.location.address",
        "end.location.formatted_address",
        "end.location.location_address",
        "end.location.display_name",
        "end.location.name",
        "destination.address",
        "destination.location.address",
        "trip.end.address",
    )


def latest_trip(rows: Any) -> dict[str, Any]:
    if not isinstance(rows, list):
        return {}
    trip_rows = [row for row in rows if isinstance(row, dict)]
    if not trip_rows:
        return {}

    def sort_key(row: dict[str, Any]) -> float:
        value = first_value(nested_raw(row, "end.time"), row.get("last_moved_at"), row.get("ended_at"))
        number = as_float(value)
        return number if isinstance(number, float) else 0.0

    return max(trip_rows, key=sort_key)


def is_charging_value(*values: Any) -> bool | str:
    text = " ".join(str(value).lower() for value in values if value not in (None, ""))
    if not text:
        return ""
    if "charging" in text and "not" not in text:
        return True
    return as_bool(first_value(*values))


def query_value(url: str, key: str) -> str:
    parsed = urlparse(url)
    values = parse_qs(parsed.query).get(key)
    return values[0] if values else ""


def query_vehicle_id(url: str) -> str:
    raw = query_value(url, "vehicle_ids")
    return raw.strip("[]\"'")


def coordinate_text(latitude: Any, longitude: Any) -> str:
    lat = as_float(latitude)
    lon = as_float(longitude)
    if isinstance(lat, float) and isinstance(lon, float) and (lat != 0 or lon != 0):
        return f"{lat:.6f},{lon:.6f}"
    return ""


def derived_average_speed(distance_km: Any, running_minutes: Any) -> float | str:
    distance = as_float(distance_km)
    minutes = as_float(running_minutes)
    if isinstance(distance, float) and distance >= 0 and isinstance(minutes, float) and minutes > 0:
        return round(distance / (minutes / 60), 2)
    if isinstance(distance, float) and distance == 0:
        return 0.0
    return ""


def derived_energy_kwh(distance_km: Any, direct_energy: Any = "") -> float | str:
    direct = as_float(direct_energy)
    if isinstance(direct, float) and direct > 0:
        return round(direct / 1000, 2) if direct > 100 else round(direct, 2)
    distance = as_float(distance_km)
    wh_per_km = as_float(os.getenv("EULER_DEFAULT_WH_PER_KM", os.getenv("INTELLICAR_DEFAULT_WH_PER_KM", "139.05")))
    if isinstance(distance, float) and distance > 0 and isinstance(wh_per_km, float) and wh_per_km > 0:
        return round(distance * wh_per_km / 1000, 2)
    if isinstance(distance, float) and distance == 0:
        return 0.0
    return ""


def to_unified_euler_record(record: dict[str, Any]) -> dict[str, Any]:
    raw_parts = record.pop("_raw_parts", [])
    sources = record.pop("_sources", set()) or set(str(record.get("source", "")).split(","))
    distance_today = first_non_negative_float(
        record.get("distance_today_km"),
        record.get("analytics_total_distance"),
        record.get("total_distance_travelled"),
        record.get("active_trip_distance"),
    )
    running_minutes = first_non_negative_float(record.get("total_time_travelled"), record.get("average_time_travelled"))
    current_location = first_value(
        record.get("location_text"),
        record.get("address"),
        coordinate_text(record.get("latitude"), record.get("longitude")),
    )
    direct_energy = first_non_negative_float(
        record.get("energy_today_kwh"),
        record.get("analytics_total_energy_kwh"),
        record.get("total_energy_dissipated"),
    )
    average_speed = 0.0 if distance_today == 0.0 else first_non_negative_float(
        record.get("average_speed_kmph"),
        derived_average_speed(distance_today, running_minutes),
    )
    current_status = _normalized_euler_status(first_value(
        record.get("movement_status_raw"),
        record.get("vehicle_state"),
        record.get("route_status"),
        record.get("status"),
    ))
    last_stop = first_value(
        record.get("last_stop_location_text"),
        record.get("end_location_text"),
        coordinate_text(record.get("last_stop_latitude"), record.get("last_stop_longitude")),
        current_location if str(current_status).lower() in {"stopped", "idle", "stationary"} else "",
        current_location,
    )

    return final_vehicle_record(
        "Euler",
        vehicle_id=first_value(record.get("vehicle_id"), record.get("imei")),
        **{
            "Vehcile_no": first_value(record.get("registration_number"), record.get("vehicle_number")),
            "vehicle model/model": first_value(record.get("vehicle_model"), record.get("vehicle_type"), record.get("vehicle_category")),
            "lat": as_float(record.get("latitude")),
            "long": as_float(record.get("longitude")),
            "Dist._today": distance_today,
            "odometer": as_non_negative_float(record.get("odometer_km")),
            "time today": running_minutes,
            "average speed(calculated from distance and time)": average_speed,
            "current status of vehicle": current_status,
            "battery%": as_non_negative_float(record.get("battery_soc")),
            "state of health": first_non_negative_float(record.get("battery_soh"), record.get("battery_soh_percent")),
            "energy consumed": derived_energy_kwh(distance_today, direct_energy),
            "last stop": last_stop,
        },
    )


def extract_euler_vehicle_records(payloads: list[dict[str, Any]]) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    indexes: dict[str, dict[str, Any]] = {}

    def upsert(fields: dict[str, Any], raw: Any, source: str) -> None:
        candidates = []
        if fields.get("imei"):
            candidates.append(f"imei:{fields['imei']}")
        if fields.get("registration_number"):
            candidates.append(f"reg:{fields['registration_number']}")
        if fields.get("vehicle_id"):
            candidates.append(f"id:{fields['vehicle_id']}")

        record = next((indexes[key] for key in candidates if key in indexes), None)
        if record is None:
            record = blank_record()
            record["scraped_at"] = now_iso()
            record["_raw_parts"] = []
            record["_sources"] = set()
            records.append(record)

        merge_if_value(record, fields)
        record["_raw_parts"].append({"source": source, "data": raw})
        record["_sources"].add(source)

        for key in candidates:
            indexes[key] = record

    for payload_wrapper in payloads:
        source_url = str(payload_wrapper.get("_source_url", "api"))
        payload = {
            key: value for key, value in payload_wrapper.items() if key != "_source_url"
        }

        if "vehicles-update" in source_url and isinstance(payload, dict):
            data = payload.get("data", {})
            map_data = data.get("map_data") or {}
            list_data = data.get("list_data") or {}
            for imei, map_record in map_data.items():
                if not isinstance(map_record, dict):
                    continue
                list_record = list_data.get(imei) if isinstance(list_data, dict) else {}
                states = list_record.get("states", {}) if isinstance(list_record, dict) else {}
                vehicle_state = states.get("vehicle_state", {})
                raw = {"map_data": map_record, "list_data": list_record}
                fields = {
                    "imei": map_record.get("imei") or imei,
                    "registration_number": map_record.get("r_num") or list_record.get("r_num", ""),
                    "vehicle_category": map_record.get("v_cat", ""),
                    "battery_soc": map_record.get("battery_soc")
                    or nested_get(states, "battery_state.soc"),
                    "battery_state": euler_state_value(states.get("battery_state")),
                    "battery_state_key": nested_get(states, "battery_state.key"),
                    "connectivity_state": euler_state_value(states.get("connectivity_state")),
                    "lock_state": euler_state_value(states.get("lock_state")),
                    "vehicle_state": euler_state_value(vehicle_state),
                    "vehicle_mode": euler_state_value(states.get("vehicle_mode")),
                    "movement_status_raw": euler_state_value(vehicle_state) or marker_status(map_record.get("marker")),
                    "vehicle_status_raw": json.dumps(states, ensure_ascii=False, default=str),
                    "latitude": nested_get(map_record, "location.coordinate.latitude"),
                    "longitude": nested_get(map_record, "location.coordinate.longitude"),
                    "location_text": location_text_from(
                        map_record,
                        "location.address",
                        "location.formatted_address",
                        "location.location_address",
                        "address",
                    ),
                    "heading": nested_get(map_record, "location.heading"),
                    "location_last_updated": nested_get(map_record, "lua.location"),
                    "vehicle_last_updated": nested_get(map_record, "lua.vehicle"),
                    "wake_up_time": nested_get(vehicle_state, "wake_up_time"),
                }
                upsert(fields, raw, "vehicles-update")

        elif "v5/rvd" in source_url and isinstance(payload, dict):
            raw = payload.get("data", payload)
            if isinstance(raw, dict):
                meta = raw.get("meta", {}) if isinstance(raw.get("meta"), dict) else {}
                states = raw.get("states", {}) if isinstance(raw.get("states"), dict) else {}
                status = raw.get("status", {}) if isinstance(raw.get("status"), dict) else {}
                fields = {
                    "imei": raw.get("imei", ""),
                    "registration_number": meta.get("registration_number", ""),
                    "chassis_number": meta.get("chassis_number", ""),
                    "vehicle_model": first_value(meta.get("vehicle_type"), meta.get("vehicle_sub_category")),
                    "latitude": nested_get(raw, "location.coordinate.latitude"),
                    "longitude": nested_get(raw, "location.coordinate.longitude"),
                    "location_text": location_text_from(
                        raw,
                        "__location_address",
                        "location.address",
                        "location.formatted_address",
                        "location.location_address",
                        "address",
                        "last_location",
                        "lastLocation",
                    ),
                    "heading": nested_get(raw, "location.heading"),
                    "vehicle_updated_at": nested_get(raw, "lua.vehicle"),
                    "location_last_updated": nested_get(raw, "lua.location"),
                    "speed_kmph": raw.get("speed", ""),
                    "battery_soc": nested_get(raw, "battery.soc"),
                    "odometer_km": nested_get(raw, "distance.odo"),
                    "distance_today_km": nested_get(raw, "distance.today"),
                    "active_trip_distance": nested_get(raw, "distance.live"),
                    "battery_voltage": nested_get(raw, "battery.voltage"),
                    "aux_battery_voltage": raw.get("aux_battery_voltage", ""),
                    "battery_temperature": nested_get(raw, "temperature.battery"),
                    "controller_temperature": nested_get(raw, "temperature.controller"),
                    "motor_temperature": nested_get(raw, "temperature.motor"),
                    "charging_status_raw": first_value(
                        nested_get(states, "battery_state.key"),
                        nested_get(states, "battery_state.value"),
                        status.get("battery", ""),
                    ),
                    "battery_state": nested_get(states, "battery_state.value"),
                    "battery_state_key": nested_get(states, "battery_state.key"),
                    "vehicle_state": nested_get(states, "vehicle_state.value"),
                    "vehicle_mode": first_value(nested_get(states, "vehicle_mode.value"), status.get("vehicle_mode", "")),
                    "route_status": status.get("route", ""),
                    "movement_status_raw": first_value(nested_get(states, "vehicle_state.value"), status.get("route", "")),
                    "vehicle_status_raw": json.dumps(
                        {"status": status, "states": states, "cmd": raw.get("cmd", {})},
                        ensure_ascii=False,
                        default=str,
                    ),
                }
                upsert(fields, raw, "rvd-live-detail")

        elif "get-trip-analytics" in source_url and isinstance(payload, dict):
            raw = payload.get("data", {})
            if isinstance(raw, dict):
                upsert(
                    {
                        "registration_number": query_value(source_url, "reg_num"),
                        "imei": query_vehicle_id(source_url),
                        "analytics_total_distance": raw.get("total_distance", ""),
                        "analytics_total_energy_kwh": raw.get("total_energy_consumed", ""),
                        "analytics_updated_at": raw.get("updated_at", ""),
                    },
                    raw,
                    "trip-analytics",
                )

        elif "get-live-trips" in source_url and isinstance(payload, dict):
            raw = nested_get(payload, "data.live", {})
            if isinstance(raw, dict) and raw:
                stop_text = trip_end_location_text(raw)
                upsert(
                    {
                        "imei": raw.get("imei", ""),
                        "vehicle_updated_at": raw.get("last_moved_at", "") or nested_get(raw, "end.time"),
                        "active_trip_end_time": nested_get(raw, "end.time"),
                        "odometer_km": nested_get(raw, "end.odo"),
                        "active_trip_distance": nested_get(raw, "distance.value"),
                        "latitude": nested_get(raw, "end.location.latitude"),
                        "longitude": nested_get(raw, "end.location.longitude"),
                        "last_stop_latitude": nested_get(raw, "end.location.latitude"),
                        "last_stop_longitude": nested_get(raw, "end.location.longitude"),
                        "last_stop_location_text": stop_text,
                        "end_location_text": stop_text,
                    },
                    raw,
                    "live-trip",
                )

        elif "get-trips" in source_url and isinstance(payload, dict):
            data = payload.get("data", {}) if isinstance(payload.get("data"), dict) else {}
            rows: list[dict[str, Any]] = []
            for key in ("today", "all", "history", "trips"):
                value = data.get(key)
                if isinstance(value, list):
                    rows.extend(item for item in value if isinstance(item, dict))
            raw = latest_trip(rows)
            if not raw and isinstance(data.get("live"), dict):
                raw = data["live"]
            if raw:
                stop_text = trip_end_location_text(raw)
                upsert(
                    {
                        "imei": first_value(raw.get("imei"), query_vehicle_id(source_url)),
                        "registration_number": query_value(source_url, "reg_num"),
                        "last_stop_location_text": stop_text,
                        "end_location_text": stop_text,
                        "last_stop_latitude": nested_raw(raw, "end.location.latitude"),
                        "last_stop_longitude": nested_raw(raw, "end.location.longitude"),
                    },
                    raw,
                    "trip-history",
                )

        elif "vehicle-static-details" in source_url and isinstance(payload, dict):
            raw = payload
            upsert(
                {
                    "imei": raw.get("imei", ""),
                    "registration_number": raw.get("registration_number", ""),
                    "chassis_number": raw.get("chassis_number", ""),
                    "vehicle_model": raw.get("model", ""),
                    "vehicle_type": raw.get("type", ""),
                    "latitude": nested_get(raw, "location.latitude"),
                    "longitude": nested_get(raw, "location.longitude"),
                    "location_text": location_text_from(
                        raw,
                        "location.address",
                        "location.formatted_address",
                        "location.location_address",
                        "address",
                    ),
                },
                raw,
                "vehicle-static-details",
            )

        elif "user-vehicles" in source_url and isinstance(payload, dict):
            for raw in payload.get("vehicles", []):
                if not isinstance(raw, dict):
                    continue
                upsert(
                    {
                        "vehicle_id": raw.get("id", ""),
                        "imei": raw.get("imei", ""),
                        "registration_number": raw.get("v_reg_num", ""),
                        "chassis_number": raw.get("chassis_number", ""),
                        "vehicle_model": raw.get("v_model", ""),
                        "vehicle_category": raw.get("v_cat", ""),
                    },
                    raw,
                    "user-vehicles",
                )

        elif "fetch-all-vehicle-data" in source_url and isinstance(payload, dict):
            rows = nested_get(payload, "data.rows", [])
            for raw in rows if isinstance(rows, list) else []:
                if not isinstance(raw, dict):
                    continue
                upsert(
                    {
                        "registration_number": raw.get("registration_number", ""),
                        "chassis_number": raw.get("chassis_number", ""),
                        "total_distance_travelled": raw.get("total_distance_travelled", ""),
                        "average_distance_per_day": raw.get("average_distance_per_day", ""),
                        "total_energy_dissipated": raw.get("total_energy_dissipated", ""),
                        "average_energy_dissipated": raw.get("average_energy_dissipated", ""),
                        "total_time_travelled": raw.get("total_time_travelled", ""),
                        "average_time_travelled": raw.get("average_time_travelled", ""),
                        "last_stop_location_text": trip_end_location_text(raw),
                    },
                    raw,
                    "vehicle-report",
                )

        elif "get-active-trips" in source_url and isinstance(payload, dict):
            rows = nested_get(payload, "data.data", [])
            for raw in rows if isinstance(rows, list) else []:
                if not isinstance(raw, dict):
                    continue
                upsert(
                    {
                        "imei": raw.get("imei", ""),
                        "registration_number": raw.get("registration_number", ""),
                        "vehicle_model": raw.get("vehicle_model", ""),
                        "active_trip_id": raw.get("trip_id", ""),
                        "active_trip_distance": raw.get("distance_travel", ""),
                        "active_trip_start_time": raw.get("start_time", ""),
                        "last_stop_location_text": trip_end_location_text(raw),
                        "last_stop_latitude": first_value(
                            nested_raw(raw, "end.location.latitude"),
                            raw.get("end_lat"),
                            raw.get("endlat"),
                        ),
                        "last_stop_longitude": first_value(
                            nested_raw(raw, "end.location.longitude"),
                            raw.get("end_lng"),
                            raw.get("endlng"),
                        ),
                    },
                    raw,
                    "active-trips",
                )

    for record in records:
        raw_parts = record.pop("_raw_parts", [])
        sources = record.pop("_sources", set())
        record["source"] = ",".join(sorted(sources))
        record["raw_json"] = json.dumps(raw_parts, ensure_ascii=False, default=str)

    return [to_unified_euler_record(record) for record in records]


def _normalized_euler_status(value: Any) -> str:
    text = str(value or "").strip().lower()
    if not text:
        return "N/A"
    if "charg" in text and "not" not in text:
        return "Charging"
    if any(token in text for token in ("offline", "no communication", "disconnected")):
        return "Offline"
    if any(token in text for token in ("running", "moving", "drive")):
        return "Running"
    if any(token in text for token in ("idle", "stopped", "stationary", "parked")):
        return "Idle"
    if "online" in text:
        return "Online"
    return str(value).strip()


def is_vehicle_like_dict(value: dict[str, Any]) -> bool:
    flattened_keys = {flatten_key(key) for key in value}
    hint_score = sum(
        1
        for key in flattened_keys
        if any(hint in key for hint in VEHICLE_HINT_KEYS)
    )
    has_identity = any(key in flattened_keys for key in IDENTITY_KEYS)
    return has_identity and hint_score >= 2


def walk_json(value: Any) -> Iterable[dict[str, Any]]:
    if isinstance(value, dict):
        if is_vehicle_like_dict(value):
            yield value
        for child in value.values():
            yield from walk_json(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk_json(child)


def extract_from_json_payloads(payloads: list[dict[str, Any]]) -> list[dict[str, Any]]:
    euler_records = extract_euler_vehicle_records(payloads)
    if euler_records:
        return euler_records

    records: list[dict[str, Any]] = []
    seen: set[str] = set()

    for payload in payloads:
        source_url = str(payload.get("_source_url", "api"))
        for raw_record in walk_json(payload.get("data", payload)):
            normalized = normalize_vehicle_record(raw_record, source=source_url)
            identity = (
                normalized["vehicle_id"]
                or normalized["registration_number"]
                or normalized["vin"]
                or normalized["imei"]
                or normalized["raw_json"]
            )
            identity_key = f"{identity}|{normalized['source']}"
            if identity_key not in seen:
                seen.add(identity_key)
                records.append(to_unified_euler_record(normalized))

    return records


def extract_tables_from_html(html: str) -> list[dict[str, Any]]:
    soup = BeautifulSoup(html, "lxml")
    records: list[dict[str, Any]] = []

    for table in soup.select("table"):
        header_cells = table.select("thead tr th")
        if not header_cells:
            first_row = table.select_one("tr")
            header_cells = first_row.select("th,td") if first_row else []

        headers = [normalize_label(cell.get_text(" ", strip=True)) for cell in header_cells]
        if not headers:
            continue

        mapped_headers = [
            HEADER_ALIASES.get(header, header.replace(" ", "_")) for header in headers
        ]

        for row in table.select("tbody tr"):
            cells = [cell.get_text(" ", strip=True) for cell in row.select("td")]
            if len(cells) < 2:
                continue
            raw = {
                mapped_headers[index]: cells[index]
                for index in range(min(len(mapped_headers), len(cells)))
            }
            if raw:
                records.append(to_unified_euler_record(normalize_vehicle_record(raw, source="dom_table")))

    return records


def extract_cards_from_html(html: str) -> list[dict[str, Any]]:
    soup = BeautifulSoup(html, "lxml")
    candidates = soup.select(
        "[class*='vehicle'], [class*='Vehicle'], [class*='card'], [class*='Card'], "
        "[class*='list'], [class*='List']"
    )
    records: list[dict[str, Any]] = []
    seen_text: set[str] = set()

    for node in candidates:
        text = node.get_text(" ", strip=True)
        if len(text) < 20 or text in seen_text:
            continue
        lowered = text.lower()
        if not any(token in lowered for token in ["vehicle", "reg", "battery", "status", "driver"]):
            continue
        seen_text.add(text)
        raw = {"vehicle": text}
        records.append(to_unified_euler_record(normalize_vehicle_record(raw, source="dom_card")))

    return records


def extract_from_html(html: str) -> list[dict[str, Any]]:
    table_records = extract_tables_from_html(html)
    if table_records:
        return table_records
    return extract_cards_from_html(html)
