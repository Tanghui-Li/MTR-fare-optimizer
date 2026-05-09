# AI Handover Documentation
**Project**: MTR Fare Optimizer & Transit Interface
**Version**: 2.1.0-neutral-grey
**Target Audience**: AI Coding Assistants / Future Developers

This document provides extremely detailed context, architecture decisions, and current state information to enable seamless handover to another AI agent or developer.

## 1. Project Context & Philosophy
This is an academic project for a Human-Computer Interaction course. The core objective is twofold:
1. **Fare Optimization**: Exploit "Out-of-Station Interchange" rules using a pre-computed fare matrix (Dijkstra's algorithm) to find the absolute cheapest route between two stations, ignoring time. 
2. **Transit Map Interface**: Provide a real-time, interactive Leaflet map that shows the topology of the Heavy Rail (MTR), Light Rail (LRT), and MTR Bus networks using ONLY official open data from `data.gov.hk`. No commercial APIs are allowed.

## 2. Tech Stack & State Management
- **Framework**: React 18 + TypeScript + Vite. No backend.
- **Routing/State**: Handled almost entirely within `App.tsx` (top-level state for selected routes, tickets, and segments). `MapView.tsx` consumes these props to highlight paths.
- **Map Library**: `react-leaflet` v4.
- **Data Source**: Live data fetched from `data.gov.hk` CKAN API (wrapper in `src/services/mtrApi.ts`). Static data (fare matrix, coordinates) are pre-compiled using python scripts in the `/scratch/` directory.

## 3. Core Architectural Mechanisms

### 3.1 Fare Engine (`pathfinder.ts` & `App.tsx`)
- The algorithm calculates paths using `fare_matrix.json`.
- **AEL Rules (Airport Express)**: Handled directly in `App.tsx` (useEffect). If a trip uses Adult Octopus and involves the Airport or Expo, the Heavy Rail segments are marked as $0.0 ("免費港鐵接駁服務").
- **Hub Unification**: Hong Kong, Kowloon, and Tsing Yi MTR and AEL stations have different IDs in the official dataset. They have been unified in `clean_stations.py` and `process_fares.py`.

### 3.2 Map Rendering (`MapView.tsx`)
- **Topology**: Uses an edge-based rendering system (`lineSegments.ts`) instead of simple point-to-point plotting. This ensures accurate branch line rendering (e.g., East Rail Line, Tseung Kwan O Line).
- **Z-Index Layering (CRITICAL)**: In Leaflet SVG, elements rendered later appear on top.
  - The rendering order at the bottom of `MapView.tsx` is strictly:
    1. `<BusLayer />` (Live Buses - Bottom)
    2. `<BusStopLayer />` (Static Bus Stops - Middle)
    3. `<LRTStationLayer />` (LRT Stops - Top)
  - *Bug History*: Previously, LRT was rendered before Bus Stops, causing bus stop icons to completely eclipse LRT icons. This is now fixed.

### 3.3 React-Leaflet Initialization Caveats (CRITICAL)
- *Bug History*: The `react-leaflet` `<Popup>` component intercepts rendering if it has `eventHandlers` bounded directly inside a dynamic map array. 
- In `LRTPopup.tsx`, we previously used `eventHandlers={{ add: () => setActive(true) }}` to achieve "fetch on demand". **This caused the parent `CircleMarker` to silently fail rendering on initial load.**
- **Current Solution**: The `active` state and `eventHandlers` were stripped from `LRTPopup.tsx`. All popups now fetch data immediately on mount (just like `StationPopup.tsx`). The API rate limits are sufficient to handle this.

## 4. Current State & Recent Commits
1. **Accessibility (Barrier-Free)**:
   - `StationPopup.tsx` displays all accessibility options by default (no toggle).
   - `AccessibilityFilter.tsx` implements a CNF (Conjunctive Normal Form) boolean filter. Matching stations highlight purple; non-matching dim to 0.25 opacity.
2. **UI Controls**:
   - The map overlay toggles are strictly ordered: Light Rail, Bus Stops, Live Buses.
3. **Data Polling**:
   - Live transit updates occur every 30 seconds via `setInterval` inside individual popup/layer components.

## 5. Next Steps / Future Enhancements
If you are the next AI taking over, here are the expected upcoming tasks:
- **UI Polish**: The user might request modifications to the popup visual styling or map control placements.
- **Interchange Nodes**: Further refinement of walking paths or interchanges between LRT and MTR (currently LRT and MTR are visually distinct networks on the map).
- **Code Splitting**: `App.tsx` and `MapView.tsx` are getting large. Consider breaking out the state management into a React Context if more complex features are requested.

---
**Prepared By**: Antigravity (DeepMind Agentic AI)
**Timestamp**: May 2026
