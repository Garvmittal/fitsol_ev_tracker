from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


def _find_service_account_json() -> str:
    ignored_names = {"storage_state.json"}
    for path in sorted(Path(".").glob("*.json")):
        if path.name in ignored_names:
            continue
        try:
            with path.open("r", encoding="utf-8") as file:
                data = json.load(file)
        except Exception:
            continue
        if (
            isinstance(data, dict)
            and data.get("type") == "service_account"
            and data.get("client_email")
            and data.get("private_key")
        ):
            return str(path)
    return ""


@dataclass(frozen=True)
class Settings:
    username: str
    password: str
    app_url: str
    api_base_url: str
    socket_base_url: str
    poll_interval_seconds: int
    socket_timeout_seconds: int
    csv_path: Path
    google_sheet_id: str
    google_sheet_name: str
    google_worksheet_gid: str
    google_service_account_json: str

    @property
    def sheets_enabled(self) -> bool:
        return bool(self.google_sheet_id and self.google_service_account_json)


def load_settings() -> Settings:
    load_dotenv()
    service_account_json = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON", "") or _find_service_account_json()

    return Settings(
        username=os.getenv("INTELLICAR_USERNAME", ""),
        password=os.getenv("INTELLICAR_PASSWORD", ""),
        app_url=os.getenv("INTELLICAR_URL", "https://track.intellicar.in/"),
        api_base_url=os.getenv("INTELLICAR_API_BASE_URL", "https://apiplatform.intellicar.in"),
        socket_base_url=os.getenv(
            "INTELLICAR_SOCKET_BASE_URL",
            "https://statsapiplatform.intellicar.in",
        ),
        poll_interval_seconds=int(os.getenv("INTELLICAR_POLL_INTERVAL_SECONDS", "600")),
        socket_timeout_seconds=int(os.getenv("INTELLICAR_SOCKET_TIMEOUT_SECONDS", "60")),
        csv_path=Path(os.getenv("INTELLICAR_CSV_PATH", "data/intellicar_vehicle_records.csv")),
        google_sheet_id=os.getenv("GOOGLE_SHEET_ID", "1_A58jO3bLmeZor0kwjNFaypqRGpW9KG0EOirrU9rbjA"),
        google_sheet_name=os.getenv(
            "INTELLICAR_GOOGLE_SHEET_NAME",
            os.getenv("UNIFIED_GOOGLE_SHEET_NAME", "Unified Vehicle Snapshots"),
        ),
        google_worksheet_gid=os.getenv("INTELLICAR_GOOGLE_WORKSHEET_GID", ""),
        google_service_account_json=service_account_json,
    )
