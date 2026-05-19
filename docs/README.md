# MTR Fare Optimizer & Transit Interface

This project is an HCI course capstone. It computes lowest fares and visualizes routes across MTR heavy rail, Airport Express, Light Rail, and MTR Bus using official open data only.

Last updated: 2026-05-20

## What it does
- Fare optimization across paid legs with clear exit/enter gates.
- Full station/stop sequences with correct line labels (MTR line, LRT route number, bus route ID).
- Interactive map with accurate MTR topology and route highlighting.
- Accessibility data filtering.

## Data sources
All static datasets live in opendata/ and are required at build time. The app does not scrape or download data automatically.

Key inputs:
- opendata/mtr_lines_and_stations.csv
- opendata/mtr_lines_fares.csv
- opendata/airport_express_fares.csv
- opendata/light_rail_fares.csv
- opendata/light_rail_routes_and_stops.csv
- opendata/mtr_bus_fares.csv
- opendata/mtr_bus_routes.csv
- opendata/mtr_bus_stops.csv

## Quickstart
1. Install dependencies
   - npm install

2. Start dev server
   - npm run dev

3. Build
   - npm run build

## Documentation index
- fare_path_requirements.md
- AI_HANDOVER.md
- TASKS.md
