# Frontend (owner: Zach)

React + Vite + TypeScript + react-leaflet on OpenStreetMap tiles.

```bash
npm install
npm run dev:fixtures   # built-in mock backend + dummy data (no server needed)
npm run dev            # real backend at VITE_API_URL (default http://localhost:8000); add ?demo=1 for demo controls
npm test               # happy-path test against the mock backend
npm run build          # typecheck + production build
```

## Structure

| Path | What |
|---|---|
| `src/api/client.ts` | **Only file that touches the glue** (HTTP, URLs, `[lon,lat]` ↔ Leaflet). In fixture mode it calls the mock. |
| `src/mock/data.ts` | Dummy data: real Blue Line stations and ride times, plus made-up exit slopes, curb ramps, hazards, and 3 demo MTS alerts |
| `src/mock/server.ts` | In-browser mock of the backend that follows the frozen contract (routing, "AI" parsing/explanations) |
| `src/mock/happyPath.test.ts` | The happy path as a test |
| `src/demoConfig.ts` | Place list, demo alert options, default trip |
| `src/components/` | `MapView`, `SearchPanel`, `PlaceInput`, `DirectionsList`, `RerouteBanner`, `AlertToast`, `DemoControls`, `Legend`, `AiChip` |

## Happy path (the demo)

1. Open the app (`npm run dev`). The trip is prefilled: **Geisel Library → Old Town State Historic Park**,
   with the slope preference set to *Manual chair (4%)*. Open **Route preferences** to change it.
2. **Find accessible routes**. The mode tabs show times for **Transit · Rideshare · Drive · Roll** side by side.
   Transit: roll to **UCSD Central Campus**, take the Blue Line to **Old Town**, then roll to the park.
3. Click a leg in the directions to zoom the map to it. The map only shows the route, the stations you use,
   live outages, and hazards or curb-ramp issues next to the route. To see everything, turn on
   *Show all stops and hazards* in Route preferences.
4. In **Demo controls**, pick *UCSD Central Campus elevator out* and click **Simulate outage**.
   - A toast says "New MTS alert". Expand the *AI-interpreted* label to see the original alert text.
   - The Transit tab gets a **Changed** badge and shows "Your route changed". You now board at **VA Medical Center**,
     with a step-by-step explanation.
5. **Reset** takes you back to step 1.

Other things to try:
- *Old Town elevator out*: you get off at Washington Street instead.
- *Power chair* preset: steep stations (Tecolote, Clairemont) become usable.
- *Only use verified sidewalks*: unverified warnings turn into detours.
- The crosshair buttons or right-click let you drop custom start and destination pins.

The mock is deterministic dummy logic, not the real router. Exit slopes, curb ramps, hazards and alert texts in
`src/mock/data.ts` are made up. The basemap is Esri Light Gray Canvas (no API key).
