from __future__ import annotations

import logging
import os
import time

from src.euler_scraper.config import load_settings as load_euler_settings
from src.euler_scraper.scraper import EulerScraper
from src.euler_scraper.sheets import GoogleSheetsAppender
from src.intellicar_scraper.config import load_settings as load_intellicar_settings
from src.intellicar_scraper.scraper import AgenticIntellicarScraper
from src.supabase_appender import build_supabase_appender_from_env
from src.vehicle_snapshot_schema import output_headers


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s - %(message)s")
    for noisy_logger in ("engineio.client", "socketio.client", "urllib3"):
        logging.getLogger(noisy_logger).setLevel(logging.WARNING)
    euler_settings = load_euler_settings()
    intellicar_settings = load_intellicar_settings()

    records = []
    for source_system, scraper in [
        ("Euler", EulerScraper(euler_settings)),
        ("Intellicar", AgenticIntellicarScraper(intellicar_settings)),
    ]:
        last_error: Exception | None = None
        for attempt in range(1, 4):
            try:
                source_records = scraper.scrape_once()
                if not source_records:
                    raise RuntimeError(f"{source_system} returned no records")
                records.extend(source_records)
                logging.info("%s complete. Collected %s record(s).", source_system, len(source_records))
                break
            except Exception as exc:
                last_error = exc
                logging.warning("%s attempt %s failed: %s", source_system, attempt, exc)
                time.sleep(10 * attempt)
        else:
            raise RuntimeError(f"{source_system} failed after retries: {last_error}") from last_error

    if len(records) < 40:
        raise RuntimeError(f"Refusing to write incomplete scrape. Only collected {len(records)} rows.")

    supabase_appender = build_supabase_appender_from_env()
    if supabase_appender:
        supabase_appender.append(records)
        logging.info("Wrote %s rows to Supabase", len(records))
        return

    appender = GoogleSheetsAppender(
        euler_settings.google_sheet_id,
        euler_settings.google_sheet_name,
        euler_settings.google_worksheet_gid,
        euler_settings.google_service_account_json,
    )

    for attempt in range(1, 6):
        try:
            existing_rows = len(appender.worksheet.get_all_values())
            if existing_rows <= 1:
                appender.worksheet.update("A1", [output_headers()])
            appender.append(records)
            logging.info("Wrote %s rows to %s", len(records), euler_settings.google_sheet_name)
            return
        except Exception as exc:
            logging.warning("Sheet write attempt %s failed: %s", attempt, exc)
            time.sleep(10 * attempt)
    raise RuntimeError("Could not write records to Google Sheets after retries.")


if __name__ == "__main__":
    os.environ.setdefault("GOOGLE_WORKSHEET_GID", "")
    main()
