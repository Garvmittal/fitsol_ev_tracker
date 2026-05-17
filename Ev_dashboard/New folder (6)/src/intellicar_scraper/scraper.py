from __future__ import annotations

import logging
import threading
import time
from datetime import datetime, time as datetime_time, timedelta, timezone
from typing import Any

import socketio

from .api_client import IntellicarApiClient
from .config import Settings
from .extractor import normalize_live_gps_records

LOGGER = logging.getLogger(__name__)


class AgenticIntellicarScraper:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.api = IntellicarApiClient(settings)

    def scrape_once(self) -> list[dict[str, Any]]:
        LOGGER.info("Agent step: starting Intellicar scrape cycle")
        token = self.api.ensure_token()
        groups = self.api.get_groups()
        user_info = self.api.get_user_info()
        account_username = _account_username(user_info, self.api.user_info, self.settings.username)
        LOGGER.info("Agent step: found %s visible account group(s)", len(groups))

        collector = LiveGpsSocketCollector(
            socket_base_url=self.settings.socket_base_url,
            app_url=self.settings.app_url,
            timeout_seconds=self.settings.socket_timeout_seconds,
        )
        messages = self._collect_live_messages(collector, token)
        enrichment = self._collect_enrichment(messages, groups)
        enrichment["last_locations"] = self._collect_last_locations(messages)
        records = normalize_live_gps_records(messages, account_username=account_username, enrichment=enrichment)
        LOGGER.info("Agent step: normalized %s Intellicar vehicle record(s)", len(records))
        return records

    def _collect_live_messages(self, collector: "LiveGpsSocketCollector", token: str) -> list[dict[str, Any]]:
        last_error: Exception | None = None
        for attempt in range(1, 3):
            try:
                return collector.collect(token)
            except Exception as exc:
                last_error = exc
                LOGGER.warning("Intellicar live stream attempt %s failed: %s", attempt, exc)
                time.sleep(5)
        if last_error:
            raise last_error
        raise RuntimeError("Intellicar live stream did not return vehicle records.")

    def _collect_enrichment(self, messages: list[dict[str, Any]], groups: list[dict[str, Any]]) -> dict[str, Any]:
        vehicle_ids = sorted(
            {
                int(message["vp"])
                for message in messages
                if str(message.get("vp", "")).isdigit()
            }
        )
        if not vehicle_ids:
            return {}

        start_ms, end_ms = _today_range_ms()
        LOGGER.info("Agent step: collecting Intellicar day reports for %s vehicle(s)", len(vehicle_ids))

        enrichment: dict[str, Any] = {
            "start_ms": start_ms,
            "end_ms": end_ms,
            "daily": self._safe_report(
                "/api/reports/getvehdailytripreport",
                {
                    "vehicleid": vehicle_ids,
                    "starttime": start_ms,
                    "endtime": end_ms,
                    "tzoffset": 330 * 60,
                },
            ),
            "ev_trip": self._safe_report(
                "https://apiplatform.intellicar.in/api/reports/ev/getevtripreport/v3",
                {
                    "vehicleid": vehicle_ids,
                    "starttime": start_ms,
                    "endtime": end_ms,
                    "numpoints": 1000,
                    "frequency": "day",
                    "display": [
                        "date",
                        "totalkm",
                        "totalenergy",
                        "totalsoc",
                        "totalchargingevents",
                        "timespentincharging",
                        "maxenergy",
                        "maxsoc",
                        "avgchargingtime",
                        "avgenergyintake",
                        "avgsocintake",
                        "avgkm",
                    ],
                },
            ),
            "charge": self._safe_report(
                "/api/reports/getchargestatusreport",
                {"vehicleid": vehicle_ids, "starttime": start_ms, "endtime": end_ms},
            ),
            "hourly": self._safe_report(
                "/api/reports/gethourlydistance",
                {"vehicleid": vehicle_ids, "starttime": start_ms, "endtime": end_ms},
            ),
        }

        group_id = _first_group_id(groups)
        if group_id:
            enrichment["ev_dashboard"] = self._safe_report(
                "/api/ev/dashboard",
                {"groupid": group_id, "starttime": start_ms},
            )
        return enrichment

    def _collect_last_locations(self, messages: list[dict[str, Any]]) -> dict[str, str]:
        keyed_locations: list[tuple[str, list[float]]] = []
        for message in messages:
            vehicle_id = str(message.get("vp") or "")
            location = _coordinate_pair(message)
            if vehicle_id and location:
                keyed_locations.append((vehicle_id, location))

        if not keyed_locations:
            return {}

        LOGGER.info("Agent step: resolving Intellicar last-location names for %s vehicle(s)", len(keyed_locations))
        try:
            addresses = self.api.get_addresses_for_track([location for _, location in keyed_locations])
        except Exception as exc:
            LOGGER.warning("Could not resolve Intellicar last locations: %s", exc)
            return {}

        return {
            vehicle_id: address
            for (vehicle_id, _), address in zip(keyed_locations, addresses, strict=False)
            if address
        }

    def _safe_report(self, endpoint: str, body: dict[str, Any]) -> Any:
        try:
            payload = self.api.post(endpoint, body)
        except Exception as exc:
            LOGGER.warning("Intellicar report endpoint failed for %s: %s", endpoint, exc)
            return {}
        if isinstance(payload, dict) and "data" in payload:
            return payload["data"]
        return payload


class LiveGpsSocketCollector:
    def __init__(
        self,
        *,
        socket_base_url: str,
        app_url: str,
        timeout_seconds: int,
    ) -> None:
        self.socket_base_url = socket_base_url
        self.app_url = app_url
        self.timeout_seconds = timeout_seconds
        self.messages_by_vehicle: dict[str, dict[str, Any]] = {}
        self.done = threading.Event()
        self.error: Exception | None = None
        self.total_vehicle_count: int | None = None
        self.bucket_count = 0

    def collect(self, token: str) -> list[dict[str, Any]]:
        LOGGER.info("Agent step: opening Intellicar live GPS stream")
        sio = socketio.Client(
            logger=False,
            engineio_logger=False,
            reconnection=False,
            request_timeout=20,
        )

        @sio.event
        def connect() -> None:
            LOGGER.info("Agent step: live stream connected, sending token")
            sio.emit("authtoken", token)

        @sio.on("authsuccess")
        def authsuccess(data: Any) -> None:
            if isinstance(data, dict):
                self.total_vehicle_count = _as_int(data.get("vehiclecount"))
            LOGGER.info("Agent step: live stream authenticated for %s vehicle(s)", self.total_vehicle_count or "?")
            sio.emit("subscribe", {"data": [{"vehicleid": ["all"], "datarequested": ["gps"]}]})

        @sio.on("authfailure")
        def authfailure(data: Any) -> None:
            self.error = RuntimeError("Intellicar live stream authentication failed.")
            LOGGER.warning("Intellicar live stream auth failed: %s", type(data).__name__)
            self.done.set()

        @sio.on("subscribesuccess")
        def subscribesuccess(data: Any) -> None:
            LOGGER.info("Agent step: subscribed to GPS stream")
            sio.emit("getnextbucket")

        @sio.on("gpsrt")
        def gpsrt(data: Any) -> None:
            self.bucket_count += 1
            if not isinstance(data, dict):
                return

            gps = data.get("gps") if isinstance(data.get("gps"), dict) else {}
            total = _as_int(data.get("totalvehcount"))
            if total:
                self.total_vehicle_count = total

            msglist = gps.get("msglist")
            if isinstance(msglist, list):
                for message in msglist:
                    if not isinstance(message, dict):
                        continue
                    vehicle_id = str(message.get("vp") or "")
                    if vehicle_id:
                        self.messages_by_vehicle[vehicle_id] = message

            bucket_id = gps.get("bucketid")
            loaded = len(self.messages_by_vehicle)
            total_expected = self.total_vehicle_count or 0
            LOGGER.info(
                "Agent step: received GPS bucket %s with %s unique vehicle(s)",
                bucket_id,
                loaded,
            )

            if total_expected and loaded >= total_expected:
                self.done.set()
                return
            if self.bucket_count >= 20:
                self.done.set()
                return
            sio.emit("getnextbucket")

        @sio.event
        def disconnect() -> None:
            LOGGER.debug("Intellicar live stream disconnected")

        try:
            sio.connect(
                self.socket_base_url,
                transports=["websocket", "polling"],
                headers={
                    "Origin": "https://track.intellicar.in",
                    "Referer": self.app_url,
                },
            )
            self.done.wait(self.timeout_seconds)
        finally:
            if sio.connected:
                sio.disconnect()

        if self.error:
            raise self.error
        if not self.messages_by_vehicle:
            raise RuntimeError("No live GPS vehicle records were returned by Intellicar.")
        return list(self.messages_by_vehicle.values())


def _account_username(*candidates: dict[str, Any] | str) -> str:
    for candidate in candidates:
        if isinstance(candidate, dict):
            for key in ("username", "email"):
                value = candidate.get(key)
                if value:
                    return str(value)
            self_data = candidate.get("SELF")
            if isinstance(self_data, dict):
                for key in ("username", "email"):
                    value = self_data.get(key)
                    if value:
                        return str(value)
        elif candidate:
            return str(candidate)
    return ""


def _coordinate_pair(message: dict[str, Any]) -> list[float] | None:
    for lat_key, lng_key in (("lt", "ln"), ("vlt", "vln")):
        try:
            lat = float(message.get(lat_key))
            lng = float(message.get(lng_key))
        except (TypeError, ValueError):
            continue
        if -85.05115 <= lat <= 85.05115 and -180 <= lng <= 180 and (lat != 0 or lng != 0):
            return [lat, lng]
    return None


def _today_range_ms() -> tuple[int, int]:
    ist = timezone(timedelta(hours=5, minutes=30))
    now = datetime.now(ist)
    start = datetime.combine(now.date(), datetime_time.min, ist)
    return int(start.timestamp() * 1000), int(now.timestamp() * 1000)


def _first_group_id(groups: list[dict[str, Any]]) -> int | str | None:
    for group in groups:
        group_id = group.get("groupid")
        if group_id not in (None, ""):
            return group_id
        path = str(group.get("path", ""))
        parts = [part for part in path.split("/") if part]
        if parts:
            return parts[-1]
    return None


def _as_int(value: Any) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None
