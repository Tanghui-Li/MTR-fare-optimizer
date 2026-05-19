# Fare and Route Display Requirements (MTR/LRT/Bus)

Last updated: 2026-05-20

## 1) Scope and goals
This document defines the fare and route display behaviors that must be implemented using the opendata datasets plus official MTR policy constraints and earlier user guidance.

Primary goals:
- Fare results must be finite and correct across MTR, Airport Express (AEL), Light Rail (LRT), and MTR bus networks.
- Route display must show the full sequence of stations/stops and the correct line per segment.
- Interchanges must be strictly controlled by official transfer lists (no name-based inference).

## 2) Opendata sources and how they are used
### 2.1 Heavy rail (MTR) lines and fares
- File: opendata/mtr_lines_and_stations.csv
  - Fields: Line Code, Direction, Station ID, Sequence, (Chinese/English name)
  - Use: build the adjacency (station-to-station topology) per line and direction.
- File: opendata/mtr_lines_fares.csv
  - Fields: SRC_STATION_ID, DEST_STATION_ID, OCT_ADT_FARE, SINGLE_ADT_FARE, etc.
  - Use: build fare matrix for MTR (non-AEL) by station ID.

### 2.2 Airport Express (AEL) fares
- File: opendata/airport_express_fares.csv
  - Fields: ST_FROM_ID, ST_TO_ID, OCT_ADT_FARE, SINGLE_ADT_FARE, etc.
  - Use: override/define fares between AEL stations (Hong Kong/Kowloon/Tsing Yi/Airport/AsiaWorld-Expo).

### 2.3 Light Rail fares and topology
- File: opendata/light_rail_fares.csv
  - Fields: from_station_id, to_station_id, fare_octo_adult, fare_single_adult, etc.
  - Use: fare lookup between LRT stop IDs. Must normalize stop IDs to 3 digits (e.g., 050 == 50).
- File: opendata/light_rail_routes_and_stops.csv
  - Fields: Line Code, Direction, Stop ID, Sequence, Chinese/English name
  - Use: build adjacency and stop order per LRT route (Line Code + Direction).

### 2.4 MTR bus fares and topology
- File: opendata/mtr_bus_fares.csv
  - Fields: ROUTE_ID, FARE_OCTO_ADULT, FARE_SINGLE_ADULT, REFERENCE_ID, etc.
  - Use: fare per bus route. If multiple rows exist per route or reference, use the minimum valid fare for the chosen ticket type.
- File: opendata/mtr_bus_routes.csv
  - Fields: ROUTE_ID, ROUTE_NAME_CHI, ROUTE_NAME_ENG, IS_CIRCULAR, LINE_UP, LINE_DOWN, REFERENCE_ID
  - Use: route name labeling and grouping of route variants.
- File: opendata/mtr_bus_stops.csv
  - Fields: ROUTE_ID, DIRECTION, STATION_SEQNO, STATION_ID, STATION_NAME_*, REFERENCE_ID
  - Use: stop sequence per route and direction. STATION_ID is route-scoped (e.g., K12-U010) and not shared between routes.

## 3) Fare computation rules
### 3.1 Ticket types
- UI supports Adult Octopus and Adult Single (consistent with current UI).
- Fares must use the correct columns for each mode:
  - MTR: OCT_ADT_FARE / SINGLE_ADT_FARE
  - AEL: OCT_ADT_FARE / SINGLE_ADT_FARE
  - LRT: fare_octo_adult / fare_single_adult
  - Bus: FARE_OCTO_ADULT / FARE_SINGLE_ADULT

### 3.2 MTR fare matrix
- Build from mtr_lines_fares.csv using numeric Station ID as keys.
- If a fare is missing or non-finite, the edge must not be connected.

### 3.3 AEL fares and policy constraints
- AEL station IDs and line topology come from mtr_lines_and_stations.csv, but fares must use airport_express_fares.csv.
- AEL policies based on user guidance:
  - Octopus: allow transfer at Tsing Yi to the Tung Chung Line, charging only the fare to Tsing Yi when starting/ending at Airport or AsiaWorld-Expo (no extra MTR fare for the transfer leg).
  - Single: the cheapest routing is to ride to Tsing Yi and transfer to Tung Chung Line, paying the normal MTR fare after transfer (no free AEL-to-MTR shuttle for single ticket).
- Do not block LRT or bus connections when the trip involves Airport/AsiaWorld-Expo.

### 3.4 LRT fares
- LRT fares are defined between stop IDs in light_rail_fares.csv.
- Treat fares as undirected if only one direction exists in the table.

### 3.5 Bus fares
- Bus fares are flat per route (not per stop).
- If there are multiple entries for a route or its variants, select the minimum valid fare for the chosen ticket type.

## 4) Topology and path construction
### 4.1 MTR path expansion
- Use mtr_lines_and_stations.csv to build adjacency for each line.
- To show intermediate stations, expand any MTR edge into the station-by-station path along the relevant line.

### 4.2 LRT path expansion
- Use light_rail_routes_and_stops.csv to build adjacency per route and direction.
- For a given LRT route code, expand edges into the ordered stop sequence.

### 4.3 Bus path expansion
- Use mtr_bus_stops.csv to build adjacency per route and direction (use STATION_SEQNO).
- Build adjacency per route variant (REFERENCE_ID) + direction to avoid mixing sequences.
- Expand bus edges into ordered stop sequences for display.

## 5) Interchange rules (critical)
- Interchanges must be defined ONLY by explicit official lists. No name-based or fuzzy matching.
- LRT <-> MTR official interchange points (from prior guidance) must be explicit by station ID:
  - LRT stop IDs: 100 (Siu Hong), 295 (Tuen Mun), 430 (Tin Shui Wai), 600 (Yuen Long)
  - MTR station IDs: 119 (Siu Hong), 120 (Tuen Mun), 118 (Tin Shui Wai), 117 (Long Ping), 116 (Yuen Long), 72 (Tai Po Market)
- Bus stops must NOT be treated as interchanges by fuzzy name matching. Only bus stops that explicitly reference a rail stop (e.g., containing “港鐵…站” / “MTR … Station” or “輕鐵…站” / “LR … Stop”) can be linked to rail, unless an official interchange list is provided.
- Bus->MTR/LRT transfers are created only via explicit stop name markers or an official whitelist.

## 6) Route display requirements
### 6.1 Line labels
- MTR display must show the specific line name (e.g., TCL, EAL), not just “MTR.”
- LRT display must show the route number (e.g., 505, 610), not generic “LRT.”
- Bus display must show the route ID (e.g., K12, K51).

### 6.2 Transfer point accuracy
- The interchange station must be the true station where the line changes (B), not the station before it (D).
- Use edge-based line grouping: each segment is colored and labeled by the line of the edge from station i to station i+1.

### 6.3 Exit/Re-enter visibility
- If the optimized route uses multiple paid fare legs, each paid leg must be a separate segment.
- UI must show exit and enter gates as separate steps.
- Do not show the label “TRANSFER” in route cards; use exit/enter plus optional transfer notes instead.
- Entry station names must reflect the actual paid leg (skip leading TRANSFER edges).
- Each gate step must include a station type tag (MTR/LRT/Bus).

## 7) Filtering and line selection labels
- Line selector must use the correct official labels:
  - 港鐵巴士（新界西北） / MTR Bus (Northwest New Territories)
  - 港鐵接駁巴士 / MTR Feeder Bus

## 8) Data normalization and integrity
- LRT stop IDs: normalize to 3-digit strings to avoid mismatches (e.g., 50 vs 050).
- Do not match by station names for interchanges or routing; use IDs.
- Missing fare data must not be treated as zero; treat as not connected.

## 9) Validation checklist (minimum)
- Airport/AsiaWorld-Expo to LRT/bus routes are finite with Octopus and Single.
- AEL + Tsing Yi transfer behaves as required for Octopus vs Single.
- Optimized route shows exit/re-enter points; direct route does not.
- Transfer station labels on the left panel align with actual interchange stations.
- No bus stop name is treated as a transfer unless explicitly whitelisted.
