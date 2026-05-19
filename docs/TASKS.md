# TASKS

Last updated: 2026-05-20

## Current priorities
1. Verify bus->rail interchange coverage against the official interchange list (HTML/PDF).
2. Validate AEL rules for Octopus vs Single with concrete examples.
3. Confirm LRT fare threshold rules for transfer discounts if required by policy (e.g., $5.4 cap).

## QA checklist (minimum)
- Bus stop -> MTR/LRT routes are finite where explicit interchange exists.
- Entry/exit gate labels match actual paid-leg stations.
- No TRANSFER label appears in route cards.
- Transfer notes only show when exit and next entry are different stations.

## Known follow-ups
- Add official interchange whitelist when available (to replace heuristic extraction from stop names).
- Expand tests for bus+LRT+MTR combined routing.
