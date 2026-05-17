from __future__ import annotations

import argparse
import logging
import os
import time

from src.euler_scraper.config import load_settings as load_euler_settings
from src.euler_scraper.scraper import EulerScraper
from src.euler_scraper.sheets import GoogleSheetsAppender
from src.euler_scraper.storage import CsvAppender
from src.intellicar_scraper.config import load_settings as load_intellicar_settings
from src.intellicar_scraper.scraper import AgenticIntellicarScraper


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run all vehicle portal scrapers into one unified table.")
    parser.add_argument("--once", action="store_true", help="Run one combined scrape cycle and exit.")
    parser.add_argument("--debug", action="store_true", help="Enable verbose scraper logs.")
    return parser


def configure_logging(debug: bool) -> None:
    logging.basicConfig(
        level=logging.DEBUG if debug else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s - %(message)s",
    )
    for noisy_logger in ("engineio.client", "socketio.client", "urllib3"):
        logging.getLogger(noisy_logger).setLevel(logging.WARNING)


def main() -> None:
    args = build_arg_parser().parse_args()
    configure_logging(args.debug)

    euler_settings = load_euler_settings()
    intellicar_settings = load_intellicar_settings()
    poll_interval_seconds = int(
        os.getenv(
            "UNIFIED_POLL_INTERVAL_SECONDS",
            str(min(euler_settings.poll_interval_seconds, intellicar_settings.poll_interval_seconds)),
        )
    )

    appender = (
        GoogleSheetsAppender(
            euler_settings.google_sheet_id,
            euler_settings.google_sheet_name,
            euler_settings.google_worksheet_gid,
            euler_settings.google_service_account_json,
        )
        if euler_settings.sheets_enabled
        else CsvAppender(euler_settings.csv_path)
    )

    scrapers = [
        ("Euler", EulerScraper(euler_settings)),
        ("Intellicar", AgenticIntellicarScraper(intellicar_settings)),
    ]

    while True:
        started_at = time.time()
        records = []
        for source_system, scraper in scrapers:
            try:
                source_records = scraper.scrape_once()
                records.extend(source_records)
                logging.info("%s complete. Collected %s record(s).", source_system, len(source_records))
            except Exception as exc:
                logging.exception("%s scrape failed", source_system)

        if records:
            appender.append(records)
        logging.info("Combined cycle complete. Appended %s unified record(s).", len(records))

        if args.once:
            break

        elapsed = time.time() - started_at
        sleep_for = max(1, poll_interval_seconds - elapsed)
        logging.info("Sleeping for %.0f seconds", sleep_for)
        time.sleep(sleep_for)


if __name__ == "__main__":
    main()
