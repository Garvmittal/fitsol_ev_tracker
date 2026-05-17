from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import gspread
from google.oauth2.service_account import Credentials

from .extractor import output_headers


SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.file",
]


class GoogleSheetsAppender:
    def __init__(
        self,
        sheet_id: str,
        worksheet_name: str,
        worksheet_gid: str,
        service_account_json: str,
    ) -> None:
        credentials = self._load_credentials(service_account_json)
        client = gspread.authorize(credentials)
        spreadsheet = client.open_by_key(sheet_id)
        self.worksheet = self._get_worksheet(spreadsheet, worksheet_name, worksheet_gid)
        self._ensure_headers()

    def append(self, records: list[dict[str, Any]]) -> None:
        if not records:
            return

        headers = output_headers()
        rows = [[record.get(header, "") for header in headers] for record in records]
        self.worksheet.append_rows(rows, value_input_option="USER_ENTERED")

    @staticmethod
    def _load_credentials(service_account_json: str) -> Credentials:
        candidate_path = Path(service_account_json)
        if candidate_path.exists():
            return Credentials.from_service_account_file(candidate_path, scopes=SCOPES)

        info = json.loads(service_account_json)
        return Credentials.from_service_account_info(info, scopes=SCOPES)

    @staticmethod
    def _get_worksheet(spreadsheet: Any, worksheet_name: str, worksheet_gid: str) -> Any:
        if worksheet_gid:
            try:
                return spreadsheet.get_worksheet_by_id(int(worksheet_gid))
            except Exception:
                pass

        if worksheet_name:
            try:
                return spreadsheet.worksheet(worksheet_name)
            except gspread.WorksheetNotFound:
                return spreadsheet.add_worksheet(title=worksheet_name, rows=1000, cols=len(output_headers()))

        worksheet = spreadsheet.get_worksheet(0)
        if worksheet is None:
            return spreadsheet.add_worksheet(title="Euler Vehicles", rows=1000, cols=len(output_headers()))
        return worksheet

    def _ensure_headers(self) -> None:
        headers = output_headers()
        existing = self.worksheet.row_values(1)
        if existing != headers:
            if len(existing) > len(headers):
                self.worksheet.batch_clear([f"{_column_letter(len(headers) + 1)}1:{_column_letter(len(existing))}1"])
            self.worksheet.update("A1", [headers])
        if self.worksheet.col_count != len(headers):
            self.worksheet.resize(cols=len(headers))


def _column_letter(index: int) -> str:
    letters = ""
    while index:
        index, remainder = divmod(index - 1, 26)
        letters = chr(65 + remainder) + letters
    return letters
