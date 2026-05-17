# Vehicle Portal Scrapers

Python scraper that logs into the Euler Logistics / Shepherd Enterprise portal, captures the real vehicle APIs, merges each vehicle into one row, and appends records every 10 minutes.

This folder also includes an Intellicar scraper for `https://track.intellicar.in/`.

## Setup

```powershell
python -m venv .venv
.\\.venv\\Scripts\\Activate.ps1
pip install -r requirements.txt
python -m playwright install chromium
```

Create a local `.env` based on `.env.example`:

```ini
EULER_URL=https://eulerlogistics.com/vehicles
EULER_USERNAME=your_username
EULER_PASSWORD=your_password
POLL_INTERVAL_SECONDS=600
HEADLESS=true
```

## Run

One test cycle:

```powershell
python .\run_scraper.py --once --debug
```

Continuous 10-minute scraper:

```powershell
python .\run_scraper.py
```

Intellicar one test cycle:

```powershell
python .\run_intellicar_scraper.py --once --debug
```

Intellicar continuous 10-minute scraper:

```powershell
python .\run_intellicar_scraper.py
```

Both dashboards into one synchronized table:

```powershell
python .\run_all_scrapers.py
```

If Google Sheets is not configured, records are appended to:

```text
data/euler_vehicle_records.csv
data/intellicar_vehicle_records.csv
```

## Google Sheets

1. Create a Google Cloud service account.
2. Enable Google Sheets API and Google Drive API.
3. Share the target Google Sheet with the service account email.
4. Set these values in `.env`:

```ini
GOOGLE_SHEET_ID=1_A58jO3bLmeZor0kwjNFaypqRGpW9KG0EOirrU9rbjA
GOOGLE_WORKSHEET_GID=
GOOGLE_SHEET_NAME=Unified Vehicle Snapshots
GOOGLE_SERVICE_ACCOUNT_JSON=C:\path\to\service-account.json
```

For your current setup, share the sheet with:

```text
fitsol-sheets-bot@firm-dimension-494017-s9.iam.gserviceaccount.com
```

`GOOGLE_SERVICE_ACCOUNT_JSON` can be a file path or the full JSON string. If it is blank, the scraper automatically looks for a valid service-account JSON file in this project folder.

Both scrapers now write to the same synchronized tab by default:

```ini
UNIFIED_GOOGLE_SHEET_NAME=Unified Vehicle Snapshots
GOOGLE_SHEET_NAME=Unified Vehicle Snapshots
INTELLICAR_GOOGLE_SHEET_NAME=Unified Vehicle Snapshots
GOOGLE_WORKSHEET_GID=
INTELLICAR_GOOGLE_WORKSHEET_GID=
```

Leave worksheet gid values blank unless you specifically want to target an existing tab by gid.

## How Euler Extraction Works

The scraper logs in, then visits these read-only portal pages:

- Dashboard realtime
- Vehicles
- Reports

It watches the API responses behind those pages and merges the useful data from:

- `/api/v2/vehicles-update`
- `/api/user-vehicles`
- `/api/v4/fetch-all-vehicle-data`
- `/api/v1/get-active-trips`
- `/api/v5/rvd?imei=...`
- `/api/v3/get-trip-analytics`

The `/api/v5/rvd?imei=...` endpoint is the detail endpoint behind the live vehicle popup. It provides popup-grade fields such as live speed, battery SOC, odometer, today's distance, battery temperature, auxiliary battery voltage, location, movement state, and source last-updated timestamps.

## How Intellicar Extraction Works

The Intellicar scraper is agentic in the practical workflow sense:

1. It identifies the login flow with `/sso/getlogininfo`.
2. It creates a real portal session token with `/sso/gettokensinglesignon`.
3. It checks user context and groups with `/api/user/getinfo` and `/api/user/getmygroups`.
4. It connects to the same live Socket.IO GPS stream used by the web dashboard.
5. It subscribes to all vehicle GPS records, collects live buckets, deduplicates vehicles, normalizes useful fields, and appends the snapshot.
6. It keeps `raw_payload` in every row so more columns can be added later from the original source data.

The synchronized output columns are:

```text
scraped_at, source, vehicle_id, Vehcile_no,
vehicle model/model, lat, long, Dist._today,
odometer, time today, average speed(calculated from distance and time),
current status of vehicle, battery%, state of health,
energy consumed, last stop
```

For Euler, the scraper now also calls `/api/v5/rvd?imei=...`, which is the detail endpoint behind the live vehicle popup. That adds speed, live odometer, today's distance, battery temperature, auxiliary battery voltage, movement status, and popup-grade last update timestamps, with the dashboard-required fields mapped into the unified columns.

The final `last stop` column is populated from the dashboards' address sources: Euler trip history (`Trip Ended` under Trips) and Intellicar's same reverse-geocoded location endpoint used by `Download View` for `Last Location`.

Important generated files:

- `storage_state.json`: saved browser login session.
- `data/euler_vehicle_records.csv`: CSV fallback output.

Both are ignored by git.
