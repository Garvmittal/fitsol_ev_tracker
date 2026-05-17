from __future__ import annotations

import json
import os
import re
from typing import Any

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
    output_headers,
)


BUCKET_STATUS_MAP = {
    0: "onroad",
    1: "offroad",
    2: "allvehicles",
    3: "running",
    4: "stopped",
    5: "immobilized",
    6: "nocomm",
    7: "devicepullout",
    8: "nocomm-kle",
    9: "panic_button",
    10: "mil",
    11: "tampered",
}


def millis_to_iso(value: Any) -> str:
    return epoch_to_iso(value)


def pick(data: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        value = data.get(key)
        if value not in (None, ""):
            return value
    return ""


def normalize_live_gps_records(
    messages: list[dict[str, Any]],
    *,
    account_username: str = "",
    enrichment: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    seen: set[str] = set()
    enrichment = enrichment or {}

    for message in messages:
        vehicle_id = str(message.get("vp") or "")
        if not vehicle_id or vehicle_id in seen:
            continue
        seen.add(vehicle_id)
        records.append(
            normalize_live_gps_record(
                message,
                account_username=account_username,
                enrichment=enrichment,
            )
        )

    return records


def normalize_live_gps_record(
    message: dict[str, Any],
    *,
    account_username: str = "",
    enrichment: dict[str, Any] | None = None,
) -> dict[str, Any]:
    vm = message.get("vm") if isinstance(message.get("vm"), dict) else {}
    modelinfo = vm.get("modelinfo") if isinstance(vm.get("modelinfo"), dict) else {}
    devices = _devices_by_tag(vm.get("deviceinfo"))
    groups = _groups(vm.get("groups"))
    status_filters = _status_filters(message.get("bci"))
    enrichment = enrichment or {}
    vehicle_id = str(message.get("vp") or "")
    vehicle_number = str(vm.get("vehicleno", "") or "")
    day_summary = _day_summary(enrichment.get("daily"), vehicle_id)
    ev_summary = _ev_trip_summary(enrichment.get("ev_trip"), vehicle_id)
    dashboard_summary = _dashboard_summary(enrichment.get("ev_dashboard"), vehicle_number)
    charge_summary = _charge_summary(enrichment.get("charge"), vehicle_id)
    hourly_summary = _hourly_summary(enrichment.get("hourly"), vehicle_id)
    last_locations = enrichment.get("last_locations") if isinstance(enrichment.get("last_locations"), dict) else {}

    event_times = [
        message.get("uts"),
        message.get("gpts"),
        message.get("cpts"),
        message.get("cts"),
    ]
    last_talked = max(
        [int(value) for value in event_times if _is_number(value)],
        default=0,
    )
    status_filters_text = "; ".join(status_filters)
    charging_status = first_value(message.get("charging"), message.get("bcs"), message.get("cs"))
    charging_status = first_value(
        charging_status,
        dashboard_summary.get("charging_status_raw"),
        charge_summary.get("charging_status_raw"),
    )
    model = " ".join(
        str(value)
        for value in [modelinfo.get("oem", ""), modelinfo.get("model", ""), modelinfo.get("variant", "")]
        if value not in (None, "")
    ).strip()
    location_text = first_value(message.get("add", ""), _coord_text(message.get("lt"), message.get("ln")))
    distance_today = first_non_negative_float(
        day_summary.get("distance_today_km"),
        ev_summary.get("distance_today_km"),
        dashboard_summary.get("distance_today_km"),
        0 if _zero_speed(message) else "",
    )
    estimated_energy = _estimated_energy_kwh(
        distance_today=distance_today,
        direct_energy=first_value(ev_summary.get("energy_today_kwh"), message.get("energyconsume")),
        soc_consumed=first_value(ev_summary.get("soc_consumed_today"), day_summary.get("soc_consumed_today")),
        battery_capacity=modelinfo.get("batterycapacity") or modelinfo.get("battery_capacity") or modelinfo.get("fueltankcapacity"),
    )
    avg_speed_today = 0.0 if distance_today == 0.0 else first_non_negative_float(
        day_summary.get("avg_speed_kmph"),
        _derived_average_speed(distance_today, first_non_negative_float(day_summary.get("running_minutes"), hourly_summary.get("running_minutes"))),
    )

    running_minutes = first_non_negative_float(
        _derived_running_minutes(distance_today, avg_speed_today),
        day_summary.get("running_minutes"),
        hourly_summary.get("running_minutes"),
    )
    current_status = _normalized_vehicle_status(
        status_filters=status_filters,
        speed=message.get("sp"),
        charging_status=charging_status,
    )
    last_stop = first_value(
        last_locations.get(vehicle_id, ""),
        day_summary.get("end_location_text"),
        message.get("add", ""),
        _coord_text(message.get("vlt"), message.get("vln")),
        location_text,
    )

    return final_vehicle_record(
        "Intellicar",
        vehicle_id=vehicle_id,
        **{
            "Vehcile_no": vehicle_number,
            "vehicle model/model": model or modelinfo.get("model", ""),
            "lat": as_float(message.get("lt")),
            "long": as_float(message.get("ln")),
            "Dist._today": distance_today,
            "odometer": first_non_negative_float(message.get("od"), message.get("cod"), message.get("sod")),
            "time today": running_minutes,
            "average speed(calculated from distance and time)": avg_speed_today,
            "current status of vehicle": current_status,
            "battery%": as_non_negative_float(first_value(message.get("fl"), dashboard_summary.get("battery_percent"))),
            "state of health": as_non_negative_float(message.get("soh")),
            "energy consumed": as_non_negative_float(estimated_energy.get("energy_today_kwh", "")),
            "last stop": last_stop,
        },
    )


def _devices_by_tag(value: Any) -> dict[str, dict[str, Any]]:
    devices: dict[str, dict[str, Any]] = {}
    if not isinstance(value, list):
        return devices
    for item in value:
        if not isinstance(item, dict):
            continue
        tag = str(item.get("bindtag") or item.get("devicetype") or "").strip()
        if tag:
            devices[tag] = item
    return devices


def _device_no(devices: dict[str, dict[str, Any]], tag: str) -> str:
    device = devices.get(tag, {})
    return str(device.get("deviceno", "") or "")


def _device_types(devices: dict[str, dict[str, Any]]) -> list[str]:
    values = []
    for device in devices.values():
        value = str(device.get("devicetype", "") or "")
        if value and value not in values:
            values.append(value)
    return values


def _groups(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    groups: list[dict[str, Any]] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        group = dict(item)
        if "groupid" not in group:
            path = str(group.get("path", ""))
            parts = [part for part in path.split("/") if part]
            if parts:
                group["groupid"] = parts[-1]
        groups.append(group)
    return groups


def _status_filters(value: Any) -> list[str]:
    filters: list[str] = []
    if not isinstance(value, list):
        return filters
    for item in value:
        if not isinstance(item, dict):
            continue
        bucket_id = item.get("bucketid")
        try:
            bucket_id_int = int(bucket_id)
        except (TypeError, ValueError):
            continue
        filters.append(BUCKET_STATUS_MAP.get(bucket_id_int, str(bucket_id_int)))
    return filters


def _direction(value: Any) -> Any:
    try:
        return int(float(value)) % 360
    except (TypeError, ValueError):
        return ""


def _is_number(value: Any) -> bool:
    try:
        int(value)
    except (TypeError, ValueError):
        return False
    return True


def _items_for_vehicle(payload: Any, vehicle_id: str) -> list[dict[str, Any]]:
    if isinstance(payload, dict):
        value = payload.get(vehicle_id) or payload.get(str(vehicle_id))
        if isinstance(value, list):
            return [item for item in value if isinstance(item, dict)]
        if isinstance(value, dict):
            return [value]
    return []


def _day_summary(payload: Any, vehicle_id: str) -> dict[str, Any]:
    items = _items_for_vehicle(payload, vehicle_id)
    if not items:
        return {}
    distance = _sum_numeric(items, "tripdistance")
    running = _sum_numeric(items, "tripduration")
    idling = _sum_numeric(items, "idlingtime") + _sum_numeric(items, "acidlingtime")
    soc_used = _sum_numeric(items, "fuelused")
    speeds = [as_float(item.get("avgspeed")) for item in items]
    speeds = [value for value in speeds if isinstance(value, float)]
    max_speeds = [as_float(item.get("maxspeed")) for item in items]
    max_speeds = [value for value in max_speeds if isinstance(value, float)]
    mileage = [as_float(item.get("mileage")) for item in items]
    mileage = [value for value in mileage if isinstance(value, float)]
    start_item = min(items, key=lambda item: _time_sort_key(item.get("starttime")))
    end_item = max(items, key=lambda item: _time_sort_key(first_value(item.get("endtime"), item.get("starttime"))))
    return {
        "distance_today_km": distance,
        "running_minutes": running,
        "idling_minutes": idling,
        "trip_count": len([item for item in items if as_float(item.get("tripdistance")) not in ("", 0.0)]),
        "avg_speed_kmph": round(sum(speeds) / len(speeds), 2) if speeds else "",
        "max_speed_kmph": max(max_speeds) if max_speeds else "",
        "soc_consumed_today": soc_used,
        "range_today_km_per_soc": round(sum(mileage) / len(mileage), 2) if mileage else "",
        "start_time": millis_to_iso(start_item.get("starttime")),
        "end_time": millis_to_iso(first_value(end_item.get("endtime"), end_item.get("starttime"))),
        "start_location_text": _location_from_report_item(start_item, "start"),
        "end_location_text": _location_from_report_item(end_item, "end"),
        "raw": items,
    }


def _ev_trip_summary(payload: Any, vehicle_id: str) -> dict[str, Any]:
    if not isinstance(payload, dict):
        return {}
    history = payload.get("history")
    if not isinstance(history, list):
        return {}
    for item in history:
        if not isinstance(item, dict) or str(item.get("vehicleid", "")) != vehicle_id:
            continue
        data = item.get("data") if isinstance(item.get("data"), dict) else {}
        stats = data.get("stats") if isinstance(data.get("stats"), dict) else {}
        return {
            "distance_today_km": first_value(stats.get("totaldistance"), stats.get("totalkm")),
            "energy_today_kwh": first_value(stats.get("totalenergy"), stats.get("energy")),
            "soc_consumed_today": first_value(stats.get("totsocconsumed"), stats.get("totalsoc")),
            "soc_charged_today": stats.get("totsoccharged", ""),
            "charging_events_today": stats.get("totalchargingevents", ""),
            "charging_time_today_minutes": stats.get("timespentincharging", ""),
            "range_today_km_per_soc": stats.get("mileage", ""),
            "trip_count": stats.get("totaldischargingevents", ""),
            "raw": item,
        }
    return {}


def _dashboard_summary(payload: Any, vehicle_number: str) -> dict[str, Any]:
    if not isinstance(payload, dict) or not vehicle_number:
        return {}
    summary: dict[str, Any] = {}
    for item in _history_items(payload, "csd"):
        if str(item.get("vehno", "")) == vehicle_number:
            summary["battery_percent"] = item.get("soc", "")
            summary["distance_to_empty_km"] = item.get("dte", "")
            break
    for item in _history_items(payload, "batterytemp"):
        if str(item.get("vehno", "")) == vehicle_number:
            summary["battery_temperature_c"] = item.get("battery_temp", "")
            break
    for item in _history_items(payload, "todaydistance"):
        if str(first_value(item.get("vehicleno"), item.get("vehno"))) == vehicle_number:
            summary["distance_today_km"] = item.get("totaldistance", "")
            summary["soc_consumed_today"] = item.get("soc", "")
            summary["range_today_km_per_soc"] = item.get("range", "")
            break
    for item in _history_items(payload, "currentcharging"):
        if str(item.get("vehno", "")) == vehicle_number:
            summary["is_charging"] = True
            summary["charging_status_raw"] = "currentcharging"
            break
    return summary


def _charge_summary(payload: Any, vehicle_id: str) -> dict[str, Any]:
    items = _items_for_vehicle(payload, vehicle_id)
    if not items:
        return {"charging_events_today": 0}
    return {
        "charging_events_today": len(items),
        "charging_status_raw": "charge_events_today" if items else "",
        "raw": items,
    }


def _hourly_summary(payload: Any, vehicle_id: str) -> dict[str, Any]:
    items = _items_for_vehicle(payload, vehicle_id)
    if not items:
        return {}
    running_minutes = 0.0
    for item in items:
        status = str(item.get("status", "")).lower()
        distance = as_float(item.get("distance"))
        if ("move" in status and "not" not in status) or (isinstance(distance, float) and distance > 0):
            start = as_float(item.get("starttime"))
            end = as_float(item.get("endtime"))
            if isinstance(start, float) and isinstance(end, float) and end > start:
                running_minutes += (end - start) / 60000
    return {"running_minutes": round(running_minutes, 2), "raw": items}


def _history_items(payload: dict[str, Any], key: str) -> list[dict[str, Any]]:
    value = payload.get(key)
    if isinstance(value, dict):
        history = value.get("history")
        if isinstance(history, list):
            return [item for item in history if isinstance(item, dict)]
    return []


def _sum_numeric(items: list[dict[str, Any]], key: str) -> float:
    total = 0.0
    for item in items:
        value = as_float(item.get(key))
        if isinstance(value, float) and value >= 0:
            total += value
    return round(total, 2)


def _vehicle_has_not_run_today(day_summary: dict[str, Any], hourly_summary: dict[str, Any], message: dict[str, Any]) -> bool:
    if day_summary or hourly_summary:
        return False
    return _zero_speed(message)


def _zero_speed(message: dict[str, Any]) -> bool:
    speed = as_float(message.get("sp"))
    return speed in ("", 0.0)


def _derived_average_speed(distance_km: Any, running_minutes: Any) -> float | str:
    distance = as_float(distance_km)
    minutes = as_float(running_minutes)
    if isinstance(distance, float) and distance >= 0 and isinstance(minutes, float) and minutes > 0:
        return round(distance / (minutes / 60), 2)
    if isinstance(distance, float) and distance == 0:
        return 0.0
    return ""


def _derived_running_minutes(distance_km: Any, avg_speed_kmph: Any) -> float | str:
    distance = as_float(distance_km)
    speed = as_float(avg_speed_kmph)
    if isinstance(distance, float) and distance >= 0 and isinstance(speed, float) and speed > 0:
        return round(distance / speed * 60, 2)
    if isinstance(distance, float) and distance == 0:
        return 0.0
    return ""


def _normalized_vehicle_status(*, status_filters: list[str], speed: Any, charging_status: Any) -> str:
    charging_text = str(charging_status).lower()
    if "charg" in charging_text and "not" not in charging_text:
        return "Charging"
    if any(status in status_filters for status in ("nocomm", "offroad", "devicepullout")):
        return "Offline"
    if "running" in status_filters:
        return "Running"
    if "stopped" in status_filters:
        return "Idle"
    numeric_speed = as_float(speed)
    if isinstance(numeric_speed, float) and numeric_speed > 0:
        return "Running"
    if isinstance(numeric_speed, float) and numeric_speed == 0:
        return "Idle"
    if "onroad" in status_filters:
        return "Online"
    return "N/A"


def _coord_text(latitude: Any, longitude: Any) -> str:
    lat = as_float(latitude)
    lon = as_float(longitude)
    if isinstance(lat, float) and isinstance(lon, float) and (lat != 0 or lon != 0):
        return f"{lat:.6f},{lon:.6f}"
    return ""


def _location_from_report_item(item: dict[str, Any], prefix: str) -> str:
    text = first_value(
        item.get(f"{prefix}location"),
        item.get(f"{prefix}_location"),
        item.get(f"{prefix}address"),
        item.get(f"{prefix}_address"),
    )
    if text:
        return str(text)
    return _coord_text(
        first_value(item.get(f"{prefix}lat"), item.get(f"{prefix}_lat"), item.get(f"{prefix}latitude")),
        first_value(item.get(f"{prefix}lon"), item.get(f"{prefix}_lon"), item.get(f"{prefix}lng"), item.get(f"{prefix}longitude")),
    )


def _time_sort_key(value: Any) -> float:
    number = as_float(value)
    return number if isinstance(number, float) else 0.0


def _numeric_from_text(value: Any) -> float | str:
    if value in (None, ""):
        return ""
    number = as_float(value)
    if isinstance(number, float):
        return number
    match = re.search(r"-?\d+(?:\.\d+)?", str(value))
    return float(match.group(0)) if match else ""


def _estimated_energy_kwh(
    *,
    distance_today: Any,
    direct_energy: Any,
    soc_consumed: Any,
    battery_capacity: Any,
) -> dict[str, Any]:
    direct = as_float(direct_energy)
    if isinstance(direct, float) and direct > 0:
        return {"energy_today_kwh": direct, "method": "direct_report_energy"}

    capacity = _numeric_from_text(battery_capacity)
    soc = as_float(soc_consumed)
    if isinstance(capacity, float) and capacity > 0 and isinstance(soc, float) and soc > 0:
        return {
            "energy_today_kwh": round(capacity * soc / 100, 2),
            "method": "battery_capacity_x_soc_consumed",
            "battery_capacity_kwh": capacity,
            "soc_consumed": soc,
        }

    distance = as_float(distance_today)
    wh_per_km = _numeric_from_text(os.getenv("INTELLICAR_DEFAULT_WH_PER_KM", "139.05"))
    if isinstance(distance, float) and distance > 0 and isinstance(wh_per_km, float) and wh_per_km > 0:
        return {
            "energy_today_kwh": round(distance * wh_per_km / 1000, 2),
            "method": "distance_x_default_wh_per_km",
            "distance_today_km": distance,
            "wh_per_km": wh_per_km,
        }
    if isinstance(distance, float) and distance == 0:
        return {"energy_today_kwh": 0.0, "method": "no_trip_report_and_zero_speed"}

    return {"energy_today_kwh": "", "method": "unavailable"}
