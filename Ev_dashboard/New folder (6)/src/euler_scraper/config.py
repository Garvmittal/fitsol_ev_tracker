from __future__ import annotations

import os
import json
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


def _bool_env(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "y", "on"}


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
    euler_url: str
    euler_username: str
    euler_password: str
    poll_interval_seconds: int
    headless: bool
    storage_state_path: Path
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
        euler_url=os.getenv("EULER_URL", "https://eulerlogistics.com/vehicles"),
        euler_username=os.getenv("EULER_USERNAME", ""),
        euler_password=os.getenv("EULER_PASSWORD", ""),
        poll_interval_seconds=int(os.getenv("POLL_INTERVAL_SECONDS", "600")),
        headless=_bool_env("HEADLESS", True),
        storage_state_path=Path(os.getenv("STORAGE_STATE_PATH", "storage_state.json")),
        csv_path=Path(os.getenv("CSV_PATH", "data/euler_vehicle_records.csv")),
        google_sheet_id=os.getenv("GOOGLE_SHEET_ID", "1_A58jO3bLmeZor0kwjNFaypqRGpW9KG0EOirrU9rbjA"),
        google_sheet_name=os.getenv("GOOGLE_SHEET_NAME", os.getenv("UNIFIED_GOOGLE_SHEET_NAME", "Unified Vehicle Snapshots")),
        google_worksheet_gid=os.getenv("GOOGLE_WORKSHEET_GID", ""),
        google_service_account_json=service_account_json,
    )
