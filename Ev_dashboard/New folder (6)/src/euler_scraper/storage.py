from __future__ import annotations

import csv
from pathlib import Path
from typing import Any

from .extractor import output_headers


class CsvAppender:
    def __init__(self, path: Path) -> None:
        self.path = path

    def append(self, records: list[dict[str, Any]]) -> None:
        if not records:
            return

        self.path.parent.mkdir(parents=True, exist_ok=True)
        should_write_header = not self.path.exists() or self.path.stat().st_size == 0

        with self.path.open("a", newline="", encoding="utf-8") as file:
            writer = csv.DictWriter(file, fieldnames=output_headers(), extrasaction="ignore")
            if should_write_header:
                writer.writeheader()
            writer.writerows(records)
