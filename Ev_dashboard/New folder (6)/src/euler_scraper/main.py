from __future__ import annotations

import argparse
import logging
import time

from .config import load_settings
from .scraper import EulerScraper
from .sheets import GoogleSheetsAppender
from .storage import CsvAppender


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Scrape Euler vehicle records every 10 minutes.")
    parser.add_argument("--once", action="store_true", help="Run one scrape cycle and exit.")
    parser.add_argument("--debug", action="store_true", help="Enable verbose scraper logs.")
    return parser


def configure_logging(debug: bool) -> None:
    logging.basicConfig(
        level=logging.DEBUG if debug else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s - %(message)s",
    )


def main() -> None:
    args = build_arg_parser().parse_args()
    configure_logging(args.debug)

    settings = load_settings()
    scraper = EulerScraper(settings)
    appender = (
        GoogleSheetsAppender(
            settings.google_sheet_id,
            settings.google_sheet_name,
            settings.google_worksheet_gid,
            settings.google_service_account_json,
        )
        if settings.sheets_enabled
        else CsvAppender(settings.csv_path)
    )

    while True:
        started_at = time.time()
        try:
            records = scraper.scrape_once()
            appender.append(records)
            logging.info("Cycle complete. Appended %s records.", len(records))
        except Exception:
            logging.exception("Scrape cycle failed")

        if args.once:
            break

        elapsed = time.time() - started_at
        sleep_for = max(1, settings.poll_interval_seconds - elapsed)
        logging.info("Sleeping for %.0f seconds", sleep_for)
        time.sleep(sleep_for)


if __name__ == "__main__":
    main()
