from __future__ import annotations

import logging
import re
from datetime import UTC, datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from playwright.sync_api import Browser, BrowserContext, Page, TimeoutError, sync_playwright

from .config import Settings
from .extractor import extract_from_html, extract_from_json_payloads

LOGGER = logging.getLogger(__name__)

USERNAME_SELECTORS = [
    "input[name='username']",
    "input[name='userName']",
    "input[name='email']",
    "input[type='email']",
    "input[placeholder*='User' i]",
    "input[placeholder*='Email' i]",
    "input[placeholder*='Login' i]",
    "input[type='text']",
]

PASSWORD_SELECTORS = [
    "input[name='password']",
    "input[type='password']",
    "input[placeholder*='Password' i]",
]

SUBMIT_SELECTORS = [
    "button[type='submit']",
    "input[type='submit']",
    "button:has-text('Login')",
    "button:has-text('Log in')",
    "button:has-text('Sign in')",
    "button:has-text('Sign In')",
    "button:has-text('Submit')",
]

VEHICLE_ENDPOINT_PATTERN = re.compile(
    r"(vehicle|fleet|asset|tracking|location|dashboard|inventory|car|trip|report|user-vehicles|charging|stats)",
    re.IGNORECASE,
)


class EulerScraper:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.captured_payloads: list[dict[str, Any]] = []
        self.captured_urls: set[str] = set()

    def scrape_once(self) -> list[dict[str, Any]]:
        self.captured_payloads = []
        self.captured_urls = set()

        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=self.settings.headless)
            try:
                context = self._new_context(browser)
                page = context.new_page()
                page.on("response", self._capture_response)

                LOGGER.info("Opening %s", self.settings.euler_url)
                page.goto(self.settings.euler_url, wait_until="domcontentloaded", timeout=60_000)
                self._settle_page(page)
                try:
                    self._login_if_needed(page, context)
                except Exception:
                    if self.captured_payloads:
                        LOGGER.warning(
                            "Euler login validation failed, but %s vehicle API payload(s) were already captured; continuing with captured data.",
                            len(self.captured_payloads),
                        )
                    else:
                        raise
                self._settle_page(page)
                self._explore_vehicle_page(page)
                self._fetch_today_vehicle_report_payload(page)
                self._fetch_vehicle_detail_payloads(page)

                records = extract_from_json_payloads(self.captured_payloads)
                if records:
                    LOGGER.info("Extracted %s records from API responses", len(records))
                    return records

                LOGGER.info("No API records found, falling back to DOM extraction")
                html = page.content()
                records = extract_from_html(html)
                LOGGER.info("Extracted %s records from DOM", len(records))
                return records
            finally:
                browser.close()

    def _new_context(self, browser: Browser) -> BrowserContext:
        kwargs: dict[str, Any] = {
            "viewport": {"width": 1440, "height": 1000},
            "user_agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0 Safari/537.36"
            ),
        }
        if self.settings.storage_state_path.exists():
            kwargs["storage_state"] = str(self.settings.storage_state_path)
        return browser.new_context(**kwargs)

    def _capture_response(self, response: Any) -> None:
        url = response.url
        content_type = response.headers.get("content-type", "")
        if "json" not in content_type.lower():
            return
        if not VEHICLE_ENDPOINT_PATTERN.search(url):
            return
        if url in self.captured_urls:
            return

        try:
            payload = response.json()
        except Exception as exc:
            LOGGER.debug("Skipping non-readable JSON response %s: %s", url, exc)
            return

        if isinstance(payload, dict):
            payload["_source_url"] = url
            self.captured_payloads.append(payload)
            self.captured_urls.add(url)
            LOGGER.info("Captured JSON endpoint: %s", url)
        elif isinstance(payload, list):
            self.captured_payloads.append({"_source_url": url, "data": payload})
            self.captured_urls.add(url)
            LOGGER.info("Captured JSON endpoint: %s", url)

    def _login_if_needed(self, page: Page, context: BrowserContext) -> None:
        if not self._looks_like_login(page):
            return

        if not self.settings.euler_username or not self.settings.euler_password:
            raise RuntimeError(
                "Login is required. Set EULER_USERNAME and EULER_PASSWORD in .env or environment variables."
            )

        LOGGER.info("Login page detected")
        username_selector = self._first_visible_selector(page, USERNAME_SELECTORS)
        password_selector = self._first_visible_selector(page, PASSWORD_SELECTORS)
        if not username_selector or not password_selector:
            raise RuntimeError("Could not find login fields on the page.")

        page.locator(username_selector).fill(self.settings.euler_username, timeout=10_000)
        page.locator(password_selector).fill(self.settings.euler_password, timeout=10_000)

        submit_selector = self._first_visible_selector(page, SUBMIT_SELECTORS)
        if submit_selector:
            page.locator(submit_selector).click(timeout=10_000)
        else:
            page.locator(password_selector).press("Enter", timeout=10_000)

        self._settle_page(page)
        try:
            page.wait_for_url("**/dashboard/**", timeout=20_000)
        except TimeoutError:
            LOGGER.debug("Dashboard URL was not reached immediately after login")

        if self._looks_like_login(page):
            raise RuntimeError("Login did not complete. Check credentials or captcha/OTP requirements.")

        self._save_storage_state(context)

    def _looks_like_login(self, page: Page) -> bool:
        try:
            if self._first_visible_selector(page, PASSWORD_SELECTORS):
                return True
            url = page.url.lower()
            return any(token in url for token in ["login", "signin", "auth"])
        except Exception:
            return False

    def _first_visible_selector(self, page: Page, selectors: list[str]) -> str | None:
        for selector in selectors:
            try:
                locator = page.locator(selector)
                if locator.count() > 0 and locator.first.is_visible(timeout=1_000):
                    return selector
            except Exception:
                continue
        return None

    def _save_storage_state(self, context: BrowserContext) -> None:
        path = self.settings.storage_state_path
        path.parent.mkdir(parents=True, exist_ok=True) if path.parent != Path(".") else None
        context.storage_state(path=str(path))
        LOGGER.info("Saved browser session to %s", path)

    def _settle_page(self, page: Page) -> None:
        for state in ("domcontentloaded", "networkidle"):
            try:
                page.wait_for_load_state(state, timeout=20_000)
            except TimeoutError:
                LOGGER.debug("Timed out waiting for %s", state)

    def _explore_vehicle_page(self, page: Page) -> None:
        origin = self._current_origin(page)
        routes = ["/dashboard/realtime", "/vehicles", "/reports", "/charging-station"]

        for route in routes:
            target_url = f"{origin}{route}"
            try:
                LOGGER.info("Collecting read-only portal data from %s", target_url)
                page.goto(target_url, wait_until="domcontentloaded", timeout=60_000)
            except TimeoutError:
                LOGGER.warning("Timed out navigating to %s", target_url)
                continue

            self._settle_page(page)
            if route == "/vehicles":
                self._click_safe_text(page, ["Vehicles", "Fleet", "Refresh", "Search", "Apply"])
                self._scroll_to_load(page)

    def _current_origin(self, page: Page) -> str:
        match = re.match(r"^(https?://[^/]+)", page.url)
        if match:
            return match.group(1)
        fallback = re.match(r"^(https?://[^/]+)", self.settings.euler_url)
        return fallback.group(1) if fallback else "https://shepherd.eulermotors.com"

    def _click_safe_text(self, page: Page, labels: list[str]) -> None:
        for label in labels:
            try:
                locator = page.get_by_text(label, exact=True)
                count = locator.count()
                if count == 1 and locator.first.is_visible(timeout=1_000):
                    LOGGER.info("Clicking visible control: %s", label)
                    locator.first.click(timeout=5_000)
                    self._settle_page(page)
            except Exception as exc:
                LOGGER.debug("Skipping control %s: %s", label, exc)

    def _scroll_to_load(self, page: Page) -> None:
        for _ in range(4):
            page.mouse.wheel(0, 900)
            try:
                page.wait_for_load_state("networkidle", timeout=5_000)
            except TimeoutError:
                pass

    def _known_vehicles(self) -> list[dict[str, str]]:
        vehicles: dict[str, dict[str, str]] = {}
        for payload_wrapper in self.captured_payloads:
            source_url = str(payload_wrapper.get("_source_url", ""))
            payload = {key: value for key, value in payload_wrapper.items() if key != "_source_url"}

            if "vehicles-update" in source_url:
                data = payload.get("data", {}) if isinstance(payload, dict) else {}
                map_data = data.get("map_data", {}) if isinstance(data, dict) else {}
                for imei, item in map_data.items():
                    if isinstance(item, dict):
                        vehicles[str(imei)] = {
                            "imei": str(imei),
                            "vehicle_number": str(item.get("r_num", "")),
                        }

            if "user-vehicles" in source_url and isinstance(payload, dict):
                for item in payload.get("vehicles", []):
                    if not isinstance(item, dict) or not item.get("imei"):
                        continue
                    imei = str(item["imei"])
                    vehicles[imei] = {
                        "imei": imei,
                        "vehicle_number": str(item.get("v_reg_num", "")),
                    }

        return list(vehicles.values())

    def _fetch_vehicle_detail_payloads(self, page: Page) -> None:
        vehicles = self._known_vehicles()
        if not vehicles:
            return

        from_iso, to_iso = self._today_range_iso()
        full_day_from_iso, full_day_to_iso = self._today_full_day_iso()
        LOGGER.info("Collecting detailed live telemetry for %s Euler vehicle(s)", len(vehicles))
        try:
            detail_payloads = page.evaluate(
                """
                async ({ vehicles, fromIso, toIso, fullDayFromIso, fullDayToIso }) => {
                  const auth = localStorage.getItem("auth");
                  const headers = { accept: "application/json", Authorization: auth };
                  const results = [];

                  async function getJson(url) {
                    const response = await fetch(url, { headers });
                    const text = await response.text();
                    try {
                      return { url: response.url, ok: response.ok, status: response.status, payload: JSON.parse(text) };
                    } catch (error) {
                      return { url: response.url, ok: response.ok, status: response.status, payload: { raw_text: text } };
                    }
                  }

                  function firstTripEndAddress(payload) {
                    const data = payload && payload.data ? payload.data : {};
                    const rows = []
                      .concat(Array.isArray(data.today) ? data.today : [])
                      .concat(Array.isArray(data.all) ? data.all : []);
                    for (const row of rows) {
                      const address = row && row.end && row.end.address;
                      if (address) return address;
                    }
                    return "";
                  }

                  function latestTripEndLocation(payload) {
                    const data = payload && payload.data ? payload.data : {};
                    const rows = []
                      .concat(Array.isArray(data.today) ? data.today : [])
                      .concat(Array.isArray(data.all) ? data.all : [])
                      .filter((row) => row && row.end && row.end.location);
                    if (!rows.length) return null;
                    rows.sort((a, b) => {
                      const bTime = Number((b.end && b.end.time) || b.last_moved_at || 0);
                      const aTime = Number((a.end && a.end.time) || a.last_moved_at || 0);
                      return bTime - aTime;
                    });
                    const row = rows[0];
                    const location = row.end.location;
                    const lat = location.latitude;
                    const lng = location.longitude;
                    if (lat === null || lng === null || lat === undefined || lng === undefined || lat === "" || lng === "") {
                      return null;
                    }
                    return { lat, lng, row };
                  }

                  function liveTripEndLocation(payload) {
                    const live = payload && payload.data && payload.data.live;
                    const location = live && live.end && live.end.location;
                    if (!location) return null;
                    const lat = location.latitude;
                    const lng = location.longitude;
                    if (lat === null || lng === null || lat === undefined || lng === undefined || lat === "" || lng === "") {
                      return null;
                    }
                    return { lat, lng };
                  }

                  function currentVehicleLocation(payload) {
                    const raw = payload && payload.data ? payload.data : payload;
                    const coordinate = raw && raw.location && raw.location.coordinate;
                    if (!coordinate) return null;
                    const lat = coordinate.latitude;
                    const lng = coordinate.longitude;
                    if (lat === null || lng === null || lat === undefined || lng === undefined || lat === "" || lng === "") {
                      return null;
                    }
                    return { lat, lng, raw };
                  }

                  async function reverseGeocode(lat, lng) {
                    const response = await getJson(
                      `/api/fetch-reverse-geoencode?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`
                    );
                    const resp = response.payload && response.payload.resp;
                    if (!Array.isArray(resp)) return "";
                    const first = resp.find((item) => item && item.formatted_address);
                    return first ? first.formatted_address : "";
                  }

                  for (const vehicle of vehicles) {
                    const imei = vehicle.imei;
                    const reg = vehicle.vehicle_number || "";
                    const rvd = await getJson(`/api/v5/rvd?imei=${encodeURIComponent(imei)}`);
                    results.push(rvd);
                    results.push(await getJson(
                      `/api/v3/get-trip-analytics?vehicle_ids=${encodeURIComponent(JSON.stringify([imei]))}` +
                      `&from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}&reg_num=${encodeURIComponent(reg)}`
                    ));

                    let tripsPayload = null;
                    let trips = null;
                    if (reg) {
                      trips = await getJson(
                        `/api/v3/get-trips?vehicle_ids=${encodeURIComponent(JSON.stringify([Number(imei) || imei]))}` +
                        `&from=${encodeURIComponent(fullDayFromIso)}&to=${encodeURIComponent(fullDayToIso)}` +
                        `&page_no=0&limit=20&reg_num=${encodeURIComponent(reg)}`
                      );
                      tripsPayload = trips.payload;
                    }

                    let hasReadableStop = Boolean(firstTripEndAddress(tripsPayload));
                    if (!hasReadableStop && tripsPayload) {
                      const location = latestTripEndLocation(tripsPayload);
                      if (location) {
                        const address = await reverseGeocode(location.lat, location.lng);
                        if (address) {
                          location.row.__last_stop_address = address;
                          if (location.row.end) location.row.end.address = address;
                          hasReadableStop = true;
                        }
                      }
                    }
                    if (trips) {
                      results.push(trips);
                    }

                    const liveTrips = await getJson(
                      `/api/v3/get-live-trips?vehicle_ids=${encodeURIComponent(JSON.stringify([Number(imei) || imei]))}` +
                      `&from=${encodeURIComponent(fullDayFromIso)}&to=${encodeURIComponent(fullDayToIso)}&page_no=0&limit=20`
                    );
                    if (!hasReadableStop) {
                      const location = liveTripEndLocation(liveTrips.payload);
                      if (location) {
                        const address = await reverseGeocode(location.lat, location.lng);
                        if (address && liveTrips.payload && liveTrips.payload.data && liveTrips.payload.data.live) {
                          liveTrips.payload.data.live.__last_stop_address = address;
                          hasReadableStop = true;
                        }
                      }
                    }
                    results.push(liveTrips);

                    if (!hasReadableStop) {
                      const currentLocation = currentVehicleLocation(rvd.payload);
                      if (currentLocation) {
                        const address = await reverseGeocode(currentLocation.lat, currentLocation.lng);
                        if (address && currentLocation.raw) {
                          currentLocation.raw.__location_address = address;
                        }
                      }
                    }
                  }
                  return results;
                }
                """,
                {
                    "vehicles": vehicles,
                    "fromIso": from_iso,
                    "toIso": to_iso,
                    "fullDayFromIso": full_day_from_iso,
                    "fullDayToIso": full_day_to_iso,
                },
            )
        except Exception as exc:
            LOGGER.warning("Could not collect Euler detail telemetry: %s", exc)
            return

        for item in detail_payloads:
            if not isinstance(item, dict):
                continue
            payload = item.get("payload")
            if isinstance(payload, dict):
                payload["_source_url"] = str(item.get("url", "api"))
                self.captured_payloads.append(payload)
                LOGGER.info("Captured detailed Euler endpoint: %s", item.get("url", ""))

    def _fetch_today_vehicle_report_payload(self, page: Page) -> None:
        from_iso, to_iso = self._today_full_day_iso()
        LOGGER.info("Collecting Euler current-day vehicle report")
        try:
            item = page.evaluate(
                """
                async ({ fromIso, toIso }) => {
                  const auth = localStorage.getItem("auth");
                  const headers = {
                    accept: "application/json",
                    "content-type": "application/json",
                    Authorization: auth
                  };
                  const response = await fetch("/api/v4/fetch-all-vehicle-data", {
                    method: "POST",
                    headers,
                    body: JSON.stringify({
                      _from: btoa(fromIso),
                      _to: btoa(toIso),
                      limit: 100,
                      page: 1,
                      signal: {}
                    })
                  });
                  const text = await response.text();
                  try {
                    return { url: response.url + "?range=today", ok: response.ok, status: response.status, payload: JSON.parse(text) };
                  } catch (error) {
                    return { url: response.url + "?range=today", ok: response.ok, status: response.status, payload: { raw_text: text } };
                  }
                }
                """,
                {"fromIso": from_iso, "toIso": to_iso},
            )
        except Exception as exc:
            LOGGER.warning("Could not collect Euler current-day vehicle report: %s", exc)
            return

        if isinstance(item, dict) and isinstance(item.get("payload"), dict):
            payload = item["payload"]
            payload["_source_url"] = str(item.get("url", "api"))
            self.captured_payloads.append(payload)
            LOGGER.info("Captured Euler current-day report endpoint: %s", item.get("url", ""))

    def _today_range_iso(self) -> tuple[str, str]:
        ist = timezone(timedelta(hours=5, minutes=30))
        now_ist = datetime.now(ist)
        start_ist = now_ist.replace(hour=0, minute=0, second=0, microsecond=0)
        return (
            start_ist.astimezone(UTC).isoformat().replace("+00:00", "Z"),
            now_ist.astimezone(UTC).isoformat().replace("+00:00", "Z"),
        )

    def _today_full_day_iso(self) -> tuple[str, str]:
        ist = timezone(timedelta(hours=5, minutes=30))
        now_ist = datetime.now(ist)
        start_ist = now_ist.replace(hour=0, minute=0, second=0, microsecond=0)
        end_ist = now_ist.replace(hour=23, minute=59, second=59, microsecond=999000)
        return (
            start_ist.astimezone(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
            end_ist.astimezone(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
        )
