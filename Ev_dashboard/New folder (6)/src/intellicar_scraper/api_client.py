from __future__ import annotations

import logging
import time
from typing import Any

import requests

from .config import Settings

LOGGER = logging.getLogger(__name__)


class IntellicarApiClient:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.session = requests.Session()
        self.session.headers.update(
            {
                "Accept": "application/json, text/plain, */*",
                "Content-Type": "application/json",
                "Origin": "https://track.intellicar.in",
                "Referer": settings.app_url,
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/124.0 Safari/537.36"
                ),
            }
        )
        self.token: str | None = None
        self.user_info: dict[str, Any] = {}
        self.token_expires_at: int | None = None

    def ensure_token(self) -> str:
        if self.token and not self._token_needs_refresh():
            return self.token

        self.login()
        if not self.token:
            raise RuntimeError("Intellicar login succeeded but no token was returned.")
        return self.token

    def login(self) -> None:
        if not self.settings.username or not self.settings.password:
            raise RuntimeError(
                "Set INTELLICAR_USERNAME and INTELLICAR_PASSWORD in .env or environment variables."
            )

        LOGGER.info("Agent step: identifying Intellicar login type")
        self._request_json(
            "/sso/getlogininfo",
            {"username": self.settings.username, "referer": self.settings.app_url},
            include_token=False,
        )

        LOGGER.info("Agent step: requesting Intellicar session token")
        payload = self._request_json(
            "/sso/gettokensinglesignon",
            {
                "user": {
                    "username": self.settings.username,
                    "password": self.settings.password,
                },
                "logintype": "password",
                "impersReq": True,
            },
            include_token=False,
        )

        data = self._response_data(payload)
        token = data.get("token") if isinstance(data, dict) else None
        if not token:
            raise RuntimeError("Intellicar did not return an auth token.")

        self.token = str(token)
        self.user_info = data.get("userinfo", {}) if isinstance(data, dict) else {}
        self._refresh_token_expiry()
        LOGGER.info("Agent step: Intellicar token ready for user %s", self.user_info.get("username", ""))

    def get_groups(self) -> list[dict[str, Any]]:
        LOGGER.info("Agent step: discovering account groups")
        try:
            payload = self.post("/api/user/getmygroups", {})
        except Exception as exc:
            LOGGER.warning("Could not fetch Intellicar groups, continuing with live stream only: %s", exc)
            return []
        data = self._response_data(payload)
        if isinstance(data, list):
            return [item for item in data if isinstance(item, dict)]
        if isinstance(data, dict):
            for key in ("groups", "data"):
                value = data.get(key)
                if isinstance(value, list):
                    return [item for item in value if isinstance(item, dict)]
        return []

    def get_user_info(self) -> dict[str, Any]:
        LOGGER.info("Agent step: discovering user permissions")
        try:
            payload = self.post("/api/user/getinfo", {})
        except Exception as exc:
            LOGGER.warning("Could not fetch Intellicar user info, continuing with token user info: %s", exc)
            return {}
        data = self._response_data(payload)
        return data if isinstance(data, dict) else {}

    def get_addresses_for_track(self, locations: list[list[float]]) -> list[str]:
        addresses: list[str] = []
        for start in range(0, len(locations), 300):
            batch = locations[start : start + 300]
            payload = self.post("/api/address/getaddressfortrack", {"data": batch})
            data = self._response_data(payload)
            if not isinstance(data, list):
                addresses.extend("" for _ in batch)
                continue
            for item in data:
                if isinstance(item, list) and len(item) > 1 and item[1]:
                    addresses.append(str(item[1]))
                else:
                    addresses.append("")
            if len(data) < len(batch):
                addresses.extend("" for _ in range(len(batch) - len(data)))
        return addresses

    def post(self, endpoint: str, body: dict[str, Any]) -> dict[str, Any]:
        token = self.ensure_token()
        payload = dict(body)
        payload.setdefault("token", token)
        return self._request_json(endpoint, payload, include_token=False)

    def _refresh_token_expiry(self) -> None:
        if not self.token:
            return
        try:
            payload = self._request_json(
                "/sso/verifytoken",
                {"token": self.token},
                include_token=False,
            )
            data = self._response_data(payload)
            if isinstance(data, dict):
                exp = data.get("exp")
                self.token_expires_at = int(exp) if exp else None
        except Exception as exc:
            LOGGER.debug("Could not verify token expiry: %s", exc)

    def _token_needs_refresh(self) -> bool:
        if not self.token:
            return True
        if not self.token_expires_at:
            return False
        return self.token_expires_at <= int(time.time()) + 120

    def _request_json(
        self,
        endpoint: str,
        payload: dict[str, Any],
        *,
        include_token: bool = True,
    ) -> dict[str, Any]:
        body = dict(payload)
        if include_token and self.token:
            body.setdefault("token", self.token)

        url = endpoint if endpoint.startswith("http") else f"{self.settings.api_base_url}{endpoint}"
        response = self.session.post(url, json=body, timeout=30)
        response.raise_for_status()
        data = response.json()

        status = str(data.get("status", "")).upper() if isinstance(data, dict) else ""
        if status and status not in {"SUCCESS", "OK"}:
            message = data.get("msg") or data.get("message") or "Intellicar API returned a failure."
            raise RuntimeError(str(message))
        return data

    @staticmethod
    def _response_data(payload: dict[str, Any]) -> Any:
        if isinstance(payload, dict) and "data" in payload:
            return payload["data"]
        return payload
