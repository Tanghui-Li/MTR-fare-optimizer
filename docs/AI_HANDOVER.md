# AI Handover Documentation

Project: MTR Fare Optimizer & Transit Interface
Target audience: AI coding assistants and maintainers
Last updated: 2026-05-20

## 1. Project goals
- Compute the lowest fare route (price-first, not time-first).
- Display the full stop sequence with accurate line labels.
- Visualize routes on a map with correct topology and line colors.
- Use only official open data.

## 2. Data flow summary
- Static data from opendata/ is imported at build time.
- Real-time data (bus/LRT arrivals) comes from data.gov.hk APIs in src/services/mtrApi.ts.

## 3. Core routing implementation
File: src/routePlanner.ts
- MTR fares: from mtr_lines_fares.csv into a fare matrix.
- AEL fares: from airport_express_fares.csv; special Octopus rules are enforced in graph building.
- Fare matrix builder: src/data/mtrFareMatrix.ts (normalizes AEL station IDs 44/45/46 -> 39/40/42).
- LRT fares: from light_rail_fares.csv; stop IDs normalized to 3 digits.
- Bus fares: flat per route from mtr_bus_fares.csv (use minimum valid fare for route/variant).
- Bus topology: built per reference-id + direction; path expansion uses ordered stop sequence.
- Bus->rail transfers: explicit only, extracted from bus stop names that explicitly mention MTR/LRT stops.

## 4. Interchange rules
- No fuzzy or name-based interchange inference.
- MTR/LRT official interchange IDs are explicit.
- Bus interchanges are only created when the bus stop explicitly references an MTR/LRT stop ("港鐵...站" / "MTR ... Station" or "輕鐵...站" / "LR ... Stop").

## 5. Route display rules
- MTR uses specific line codes (e.g., TCL, EAL), not generic "MTR".
- LRT uses route number (e.g., 505, 610).
- Bus uses route ID (e.g., K12, K51).
- Exit and entry are displayed as separate steps; no "TRANSFER" label is shown in the UI.
- Entry station must reflect the actual paid leg, not the prior exit (segment building skips leading TRANSFER edges).
- Station type tags are shown: MTR station, Light Rail stop, or Bus stop.

## 6. Map rendering
File: src/components/MapView.tsx
- Heavy rail lines render from edge-based topology (src/data/lineSegments.ts).
- Route polylines are colored by edge line code to avoid premature line changes.

## 7. Common pitfalls
- LRT stop ID mismatch (e.g., 50 vs 050) breaks fares and routing.
- Bus stop IDs are route-scoped; do not treat them as global station IDs.
- Avoid fuzzy station name matching for interchanges.

## 8. Suggested next checks
- Verify bus->MTR and bus->LRT transfer coverage against the official interchange list.
- Validate AEL Octopus vs Single rules with real examples (Airport/AsiaWorld-Expo -> Tsing Yi).
