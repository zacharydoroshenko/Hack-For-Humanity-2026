# Architecture: Accessible Trip Planner (San Diego)

> Built at the **DS3 × AIC Hack Day: Hack for Humanity** (Nov 7, 2026).
> **We start at 12:30. Submit by 3:30, demos at 4:00.** That's 3 hours of
> building, so anything not in the [Must-have tier](#2-scope-tiers) gets cut
> first.

## 1. The pitch (lead the demo with this)

**The problem:** A wheelchair user in San Diego plans a trolley ride and gets
to the station, only to find the elevator is broken. MTS does post elevator
outages, but they're buried in an alerts feed, and Google Maps doesn't reroute
around them. Missing curb ramps and steep hills make the walk to and from the
station hard as well.

**What we build:** Pick a start and an end along the UCSD Blue Line corridor.
The app returns a route that avoids inaccessible stops, active elevator
outages, and missing curb ramps. When a new outage alert arrives, **Gemini
reads it, works out what's broken and what MTS suggests instead, and the route
changes** with a plain-English explanation.

**One user. One main flow. One strong demo.**

### How this matches the judging criteria

| Criterion | How we meet it |
|---|---|
| **Impact** | A real San Diego problem with real MTS and City data. We can test the UCSD corridor in person. |
| **Technical** | The routing actually works on real OSM, GTFS, and curb-ramp data, live in the demo. |
| **Creativity** | Gemini reroutes in real time from the city's own messy outage text. Sidewalks missing data are honestly labeled "unverified". |
| **Use of AI** | Gemini does three real jobs: (1) **turns alert text into structured closures**, which the router depends on; (2) **turns the rider's plain-English request into routing settings**; (3) **explains the reroute**. See [section 6](#6-gemini-the-ai-doing-real-work). |
| **Demo** | Live: plan a route, replay a saved elevator alert, watch the route change and the explanation appear. A backup video is recorded by 3:15. |

**Tracks entered:** AI for San Diego Impact (Mobility), **Best Use of Gemini
API**, and Best Use of Copilot (if we use Copilot agent mode, note where it
helped).

---

## 2. Scope tiers

Build them in order. Don't start a tier until the one before it works from
start to finish.

| Tier | Features | Cut if… |
|---|---|---|
| **Must-have** (by **2:15**) | Map of the corridor. GTFS stops colored by `wheelchair_boarding`. Curb-ramp points. **Simple trip:** walk → Blue Line trolley → walk (see [section 9](#9-routing)). **Gemini alert → closure.** Demo alert replay that marks a stop unusable and triggers a reroute. | Never. This is the demo. |
| **Should-have** (by **2:50**) | Gemini reroute explanation (do this first; it's the demo payoff). Gemini plain-English trip request → settings. "Unverified" sidewalk styling. | Anything not working by 2:50 |
| **Nice-to-have** | Slope from USGS elevation. Get It Done hazard layer. Live alert polling. A real transit timetable graph. | **Only if must-have is done early.** Otherwise pitch only. |
| **Pitch only** (slide or verbal) | Photo-to-hazard report, GTFS-Realtime arrivals (the key takes 5–7 days), community verification of sidewalks, the rest of San Diego | Not built |

**Go/no-go check at 1:30:** if `/plan` isn't returning a real route by 1:30,
switch to the Streamlit fallback ([section 5](#5-tech-stack)).

---

## 3. Team and ownership

The rules require **3–4 members**.

| Role | Owner | Directory | Owns |
|---|---|---|---|
| **UI** | Zach | `frontend/` | Map, layers, search, directions, reroute banner, deployment of the frontend |
| **Data + AI** | Partner | `pipeline/`, `backend/` | Data loading, the Gemini prompts, SQLite, router, API |
| **Demo + docs** | 3rd member | `README.md`, `data/demo_alerts/`, slides | Saving real alerts, testing like a judge, README, the AI-usage log, the backup video, the submission |
| **Contract (the glue)** | **Nobody alone** | `shared/`, `frontend/src/api/client.ts`, `backend/contract.py` | **Frozen.** See the rules below. |

The [API contract](#7-api-contract) is how the halves meet. The UI is built
against `shared/fixtures/` from minute one, so it never waits on the backend.

### Boundaries: change your own side freely, don't touch the glue

Each side can be rewritten as often as its owner likes, as long as the shapes
crossing the boundary stay the same.

```
 frontend/ (Zach changes anything)        backend/ + pipeline/ (partner changes anything)
 ┌──────────────────────────────┐         ┌──────────────────────────────────────┐
 │ components, styling, state,  │         │ data sources, Gemini prompts, SQLite │
 │ map library, layout, UX …    │         │ schema, routing algorithm, models …  │
 │              │               │         │                  │                   │
 │              ▼               │         │                  ▼                   │
 │   src/api/client.ts  ◄───────┼── HTTP ─┼──►  backend/contract.py              │
 └──────────────│───────────────┘  JSON   └──────────────────│───────────────────┘
                └──────────── both follow shared/ ───────────┘
                 types.ts · fixtures/*.json · config.json   ← FROZEN GLUE
```

**What each owner can change without asking anyone:**

| Zach (`frontend/`) | Partner (`backend/`, `pipeline/`) |
|---|---|
| Every component, layout, and style choice. The map library itself (Leaflet → MapLibre is fine). State management. New UI-only features. How fixture data is displayed. | Database schema, data sources, Gemini prompts and model, routing weights and algorithm, caching, file layout, adding internal endpoints. Even switching to Streamlit for the internals, as long as the endpoints in §7 still respond. |

**What is frozen (the glue):**

1. **Endpoint paths, methods, and request and response shapes** in [section 7](#7-api-contract).
2. **`shared/types.ts`**, the TypeScript types for every request and response.
3. **`shared/fixtures/*.json`**, sample responses that must always match `types.ts`.
4. **`shared/config.json`**: the bbox, the API base URL variable name, and the
   closure `kind` and `severity` values.

**Each side has exactly one adapter file that touches the glue:**

- **Frontend:** `src/api/client.ts` is the only file that calls `fetch`, knows
  URLs, or swaps `[lon,lat]` to `[lat,lon]`. Components import its typed
  functions (`plan()`, `getLayers()`, `ingestAlert()`) and nothing else. If the
  UI wants the data in a different shape, convert it **inside the frontend**.
  The contract stays the same.
- **Backend:** `backend/contract.py` holds Pydantic models that mirror
  `types.ts`, and every endpoint declares them as `response_model`, so FastAPI
  rejects any response with the wrong shape. Internal code can use any shapes
  it wants and converts to these models at the end.

**Rules for changing the glue:**

- **Adding things is cheap:** you can add a new *optional* response field or
  a new endpoint by updating `types.ts`, `contract.py`, and a fixture **in one
  commit** titled `contract: …`. Post a heads-up in the team chat. Nothing
  breaks, because the other side ignores fields it doesn't know about.
- **Breaking changes need everyone to agree:** renaming or removing a field,
  changing a type, or changing what an enum value means needs a 2-minute
  conversation with both owners first. After **2:15** (must-have done), **no
  breaking changes at all**.
- Never edit the other person's directory. If you need something from their
  side, ask, or open an issue or a TODO in chat.
- `contract:` commits go straight to `main`. Everything else goes on your own
  branch (`ui/*`, `data/*`) and merges often. Because nobody edits the same
  files, there shouldn't be any merge conflicts.

**How we know the glue still holds:**

- `python -m shared.check_contract` validates every fixture against
  `contract.py`, and with `--live` it calls the running backend and validates
  its real responses. Run it before merging to `main`.
- If the frontend runs with `VITE_USE_FIXTURES=1` and also with the real
  backend, the contract is holding.

---

## 4. System overview

```
 DATA (precomputed before the demo; everything is cut to the corridor bbox)
 ─────────────────────────────────────────────────────────────
  MTS GTFS (google_transit/) ──► stops in bbox + Blue Line stop_times
  City ADA curb ramps (ArcGIS) ─► points, snapped to graph nodes
  OSM walk graph (osmnx) ───────► data/walk_graph.graphml  (committed)
  MTS alerts feed / demo_alerts ─► GEMINI ─► structured closures
                                   │
                                   ▼
                        data/app.db (SQLite, committed)
                                   │
 backend/ (FastAPI)                ▼
 ─────────────────────────────────────────────────────────────
  POST /plan   ── GEMINI: request text → settings
               ── router.py: weighted shortest path (networkx)
               ── GEMINI: explain the reroute (diff vs. no closures)
  GET  /layers ── stops + closures + curb ramps (GeoJSON)
  POST /alerts/ingest ── GEMINI: alert text → closure row
                                   │  JSON (shared/ contract)
                                   ▼
 frontend/ (React + Vite + Leaflet, OSM tiles)
 ─────────────────────────────────────────────────────────────
  request box · map + layers · directions · reroute banner · "AI did this" tags
```

**Demo area bounding box (UCSD to Old Town along the Blue Line):** about
`-117.245, 32.745, -117.195, 32.885`. Keeping the area this small means the
graph loads in seconds and the committed files stay small. Confirm the final
bbox in `shared/config.json`.

---

## 5. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React + Vite + TypeScript, **react-leaflet**, OSM tiles | No API key. GeoJSON layers are built in. |
| Backend | Python 3.11 + **FastAPI** | osmnx, networkx, and shapely are Python |
| Routing | **networkx** on the osmnx walk graph, with custom weights | Fully under our control; no OpenTripPlanner build step |
| Storage | **SQLite** `data/app.db` + `walk_graph.graphml`, **both committed** | No database server. Deploying is just copying files. |
| AI | **Gemini API** via `google-genai`, structured JSON output | Gemini sponsor track; reliable to parse |
| Deploy | Frontend → **Vercel**. Backend → **Render** (free tier). | Recommended in the event slides. Deploy by 3:00. |

Fallback if React and the backend aren't talking to each other by 1:30: a single **Streamlit +
streamlit-folium** app that calls `router.py` directly. The slides suggest it,
and both halves can still share the router code.

---

## 6. Gemini: the AI doing real work

Judges ask whether the AI is doing real work. **Every Gemini call returns
schema-validated JSON** (`response_mime_type="application/json"` with a
`response_schema`), and the app uses that output directly. It isn't decoration.

| # | Task | Input | Output (schema) | What uses it |
|---|---|---|---|---|
| 1 | **Alert → closure** (must-have) | MTS alert `header_text`, `description_text`, `informed_entity` stop IDs, and a list of corridor stop names and IDs | `{kind, affected_stop_ids[], facility, alternative_text, alternative_stop_ids[], active_until, confidence}` | Writes a `closures` row. **The router won't avoid the outage without it.** |
| 2 | **Request → settings** (should-have) | "I use a manual wheelchair, going from Gilman to Old Town, avoid hills" | `{from_text, to_text, max_grade, avoid_unverified, needs_elevator_free}` | The `/plan` parameters. Place names are matched to corridor stops in code. |
| 3 | **Reroute explanation** (should-have) | Closure records, plus the changes between the route with closures and without | `{steps: string[]}`, three to five short steps | The reroute banner |

Rules:
- **Gemini never chooses the route.** The router is deterministic. Gemini turns
  messy text into structure and explains what happened. This is easy to
  explain to judges and safe for users.
- Keep the **original text** next to every AI-produced row (`raw_text`), and
  label it **"AI-interpreted"** in the UI.
- Cache results by input hash in `gemini_cache`, so the demo stays the same
  and reloads are free.
- Put each prompt in its own file under `pipeline/gemini/prompts/`.
- Use one model ID, set in `.env` (`GEMINI_MODEL`), so it's easy to change.

---

## 7. API contract

> **This section is the frozen glue.** Change it only by following the rules in
> [section 3](#boundaries-change-your-own-side-freely-dont-touch-the-glue).
> `shared/types.ts` and `backend/contract.py` must always match it.

Base URL comes from `VITE_API_URL`. Coordinates are **`[lon, lat]`**
(GeoJSON). The frontend converts them to Leaflet's `[lat, lon]` only in
`api/client.ts`.

### `POST /plan`

```jsonc
// request: either fill in the fields, or send just "text" for Gemini to parse
{
  "text": "manual wheelchair, Gilman Dr to Old Town, no hills",  // optional
  "from": [-117.2340, 32.8770],          // optional if text is given
  "to":   [-117.2003, 32.7546],
  "max_grade": 0.05,                     // ADA ramp max is 0.0833
  "avoid_unverified": false
}
```

```jsonc
// response
{
  "parsed_request": { "max_grade": 0.04, "avoid_unverified": true, "ai_generated": true }, // null if no text
  "summary": { "duration_min": 34, "walk_m": 620, "transfers": 0 },
  "legs": [
    {
      "mode": "walk",                                  // walk | transit
      "geometry": { "type": "LineString", "coordinates": [[-117.234, 32.877]] },
      "distance_m": 310,
      "warnings": [{ "type": "unverified", "message": "Sidewalk accessibility not verified for 80 m" }],
      "steps": [{ "instruction": "Head south on Voigt Dr", "distance_m": 120 }]
    },
    {
      "mode": "transit",
      "route_short_name": "Blue", "route_color": "0000FF",
      "from_stop": { "stop_id": "...", "name": "UC San Diego Central Campus", "wheelchair_boarding": 1 },
      "to_stop":   { "stop_id": "...", "name": "Washington St",               "wheelchair_boarding": 1 },
      "geometry": { "type": "LineString", "coordinates": [] }
    }
  ],
  "rerouted": true,
  "reroute": {
    "cause_closure_ids": ["c_alert_123"],
    "explanation": [
      "The elevator at Old Town Transit Center is out of service.",
      "MTS suggests Washington St station instead, so you'll get off there.",
      "From Washington St the route uses level sidewalks (max 3% grade)."
    ],
    "ai_generated": true
  }
}
```

### `GET /layers`

```jsonc
{
  "stops":      { "type": "FeatureCollection", "features": [] },  // props: stop_id, name, wheelchair_boarding, active_closure_ids
  "closures":   { "type": "FeatureCollection", "features": [] },  // props below
  "curb_ramps": { "type": "FeatureCollection", "features": [] }   // props: id, description
}
```

Each closure feature's `properties`:

```jsonc
{
  "id": "c_alert_123",
  "kind": "elevator_outage",   // elevator_outage | stop_closure | missing_curb_ramp | steep_segment | reported_hazard
  "severity": "blocking",      // blocking = the router avoids it; warning = the router penalizes it
  "title": "Elevator out at Old Town",
  "alternative": "Use Washington St station",   // nullable
  "source": "mts_alerts",      // mts_alerts | city_ada | usgs | get_it_done
  "raw_text": "...",
  "ai_generated": true
}
```

### `POST /alerts/ingest`

Body: `{ "demo_file": "old_town_elevator.json" }` or `{ "alert": { ...GTFS-RT alert as JSON... } }`.
Runs Gemini task #1, inserts the closure, and returns it. **This is the button
the demo presses.** The UI then fetches `/layers` again and replans.

### `GET /health`

Returns `{ "ok": true, "gemini": true }`. Check it before demoing.

---

## 8. Data layer (partner)

### Sources, in priority order

| Source | How | Notes |
|---|---|---|
| **MTS GTFS** (`google_transit/`, in the repo) | Load `stops.txt`, filtered to the bbox, plus Blue Line `trips` and `stop_times` | 4,359 stops: `wheelchair_boarding` 1 = 3,142, 0 (unknown) = 747, 2 (not accessible) = 470. Every trip has `wheelchair_accessible = 1`, so that field tells us nothing. **There is no `pathways.txt`**, so an elevator outage blocks the whole stop. `stop_times` has about 760k rows; filter to the Blue Line first. |
| **MTS alerts** | `app.mecatran.com/utw/ws/gtfsfeed/alerts/sdmts?apiKey=…&asText=true` | **Save several real elevator alerts to `data/demo_alerts/` right away.** The feed may be quiet during the demo. |
| **ADA curb ramps** | ArcGIS layer 13, `outSR=4326`, filtered to the bbox (`geometry=` + `inSR=4326`) | A bbox filter means you probably won't need paging (the cap is 2,000 rows). It only covers Mobility Element streets; say so in the pitch. |
| **OSM walk graph** | `ox.graph_from_bbox(bbox, network_type="walk")`, then `ox.save_graphml` | Turn the `wheelchair`, `sidewalk`, `kerb`, and `surface` tags into `accessible / inaccessible / unverified` **with code rules** |
| *USGS slope* (nice-to-have) | Elevation per node from a 3DEP DEM tile with `rasterio`, then `ox.add_edge_grades` | Don't query the point service once per node, which is too slow. Use one DEM tile. |
| *Get It Done* (nice-to-have) | Filter the City CSV to sidewalk and curb problem types in the bbox | |

### Schema (`pipeline/schema.sql`)

```sql
CREATE TABLE stops (stop_id TEXT PRIMARY KEY, name TEXT, lat REAL, lon REAL,
                    wheelchair_boarding INTEGER, parent_station TEXT, is_blue_line INTEGER);
CREATE TABLE closures (id TEXT PRIMARY KEY, kind TEXT, severity TEXT, title TEXT,
                       alternative TEXT, stop_id TEXT, osm_node INTEGER,
                       geom_geojson TEXT, source TEXT, raw_text TEXT,
                       ai_generated INTEGER DEFAULT 0, active_until TEXT);
CREATE TABLE curb_ramps (id TEXT PRIMARY KEY, lat REAL, lon REAL, osm_node INTEGER, description TEXT);
CREATE TABLE gemini_cache (input_hash TEXT PRIMARY KEY, task TEXT, output_json TEXT);
```

Edge attributes (`accessibility`, `grade`) live **on the graphml edges**, not
in SQL. `python -m pipeline.build_db` rebuilds everything except the
`gemini_cache` rows.

---

## 9. Routing

Edge cost on the walk graph:

```
cost = length_m
     × (1.5 if accessibility == "unverified")       # ∞ if avoid_unverified
     × (1 + 4·max(0, grade − 0.03))                 # only if grade data exists
     = ∞ if accessibility == "inaccessible"
         or grade > max_grade
         or the edge touches a node with a missing curb ramp, or a blocking closure
```

**Transit (must-have, simple version):** no timetable graph. Instead:

1. Find the **usable** Blue Line stops: `wheelchair_boarding != 2` and no
   active blocking closure. If a closure lists `alternative_stop_ids`, prefer
   those stops.
2. Board at the usable stop with the cheapest accessible walk from the start.
   Get off at the usable stop with the cheapest accessible walk to the
   destination.
3. The transit leg is the Blue Line `shapes.txt` geometry between those two
   stops. Its time is the median scheduled time between them, taken from
   `stop_times.txt` and precomputed in `build_db`.

An elevator outage makes its stop unusable, so step 1 picks a different stop.
**That is the reroute.** A real timetable graph is nice-to-have.

**Rerouting:** `/plan` computes the route with the active closures and again
with none. If they differ, it sets `rerouted: true` and asks Gemini (task #3)
to explain why.

---

## 10. Frontend (Zach)

- **Layout:** a request box at the top (plain-English text **or** clicking the
  map to set start and end), the map filling most of the screen, and a side
  panel with directions and the reroute banner.
- **Layers, each with a toggle:**
  - The route: walk legs dashed, trolley legs solid in `route_color`.
  - Stops: accessible / not accessible / unknown, each with **its own icon,
    not only its own color**.
  - Curb ramps.
  - Closures: blocking in red with an ⛔ icon, warnings in amber with a ⚠
    icon.
- **AI transparency:** a small "AI-interpreted" chip on Gemini output. Tapping
  it shows `raw_text`. This proves "real AI work" to judges.
- **Demo control:** a "Simulate elevator outage" button (only shown with
  `?demo=1`) that calls `POST /alerts/ingest`, then refreshes the layers and
  replans.
- **The app itself must be accessible:** keyboard navigation, ARIA labels,
  high contrast. Judges may ask about this.
- `VITE_USE_FIXTURES=1` makes the app use `shared/fixtures/*.json` with no
  backend.

---

## 11. Repository layout

```
├── ARCHITECTURE.md
├── README.md                 # REQUIRED: problem, how it works, what the AI did
├── AI_USAGE.md               # log of the models and agents used, and for what (judges ask)
├── .env.example              # GEMINI_API_KEY, GEMINI_MODEL, MTS_ALERTS_KEY
├── google_transit/           # MTS GTFS (committed)
├── shared/                   # FROZEN GLUE: types.ts, config.json, fixtures/, check_contract.py
├── frontend/                 # Zach (only src/api/client.ts touches the glue)
├── pipeline/                 # partner: fetch/, gemini/{client.py,prompts/}, build_db.py, schema.sql
├── backend/                  # partner: main.py, router.py, explain.py, requirements.txt
│                             #   contract.py = the only file that touches the glue
└── data/                     # app.db, walk_graph.graphml, demo_alerts/  (committed; small because of the bbox)
```

---

## 12. Timeline (aligned to the event schedule)

| Time | All | Zach (UI) | Partner (Data + AI) | 3rd member |
|---|---|---|---|---|
| **12:30–12:45** | Agree on `shared/` (types, fixtures, bbox) and `contract.py`, commit to `main`. **From here on, the glue is frozen.** | Vite + Leaflet scaffold | Start the OSM graph download (it takes a while) | Save 3–5 real MTS alerts to `data/demo_alerts/` |
| **12:45–1:30** | Build in parallel | Map, stop and curb-ramp layers drawn from fixtures, click to set start and end | `build_db` (GTFS for the bbox, curb ramps, Blue Line stop pairs), `/layers` returning real data | Start the README, pick the demo start and end points |
| **1:30** | **Go/no-go:** does real data appear in the UI? If not, switch to Streamlit. | | | |
| **1:30–2:15** | **Finish the must-have tier** | Route display (walk dashed, trolley solid), "Simulate outage" button | `/plan` with the simple trip, **Gemini alert → closure**, `/alerts/ingest` | Test the API with curl and report bugs |
| **2:15–2:50** | Should-have tier | Reroute banner, AI chips, request box | Gemini explanation first, then request parsing. **Pre-warm `gemini_cache`** with the demo inputs. | Write `AI_USAGE.md`, test like a judge |
| **2:50–3:15** | **Feature freeze at 2:50.** Fix the top 3 bugs only. | Deploy to Vercel | Deploy to Render | **Record the backup video** |
| **3:15–3:30** | Done | Final check on the deployed URL | `/health` checked | **Submit on the MLH page with the repo link by 3:25** |
| **3:30–4:00** | Rehearse the demo twice: problem → live demo → how it works → impact | | | |

---

## 13. Demo script (about 3 minutes)

1. **The problem (30 s):** the broken-elevator story, and that MTS posts these
   outages but no app reroutes around them.
2. **Live (90 s):** type "manual wheelchair, UCSD to Old Town, avoid hills".
   The route appears, avoiding missing curb ramps and stops marked not
   accessible. Press **Simulate elevator outage**. Gemini reads the real MTS
   alert text, the Old Town stop turns red, the route reroutes via the MTS
   suggested alternative, and the banner explains why.
3. **How it works (40 s):** the data sources, the three Gemini jobs, and why
   the router is deterministic.
4. **Impact and next steps (20 s):** riders could verify "unverified"
   sidewalks, report hazards with a photo, live arrivals, and cover all of San
   Diego.

## 14. Risks

| Risk | Mitigation |
|---|---|
| Running out of time (we start at 12:30) | Strict tiers. Go/no-go at 1:30 with the Streamlit fallback. Freeze at 2:50. Simple stop-selection transit instead of a timetable graph. |
| One side breaks the other with a contract change | Glue is frozen; only additive `contract:` commits; `check_contract` before merging; no breaking changes after 2:15 |
| OSM graph download is slow | Start it first, at 12:30. Keep the bbox tight. Commit the graphml once it's saved. |
| No live alerts | Saved real alerts plus `/alerts/ingest` replay |
| Gemini slow, failing, or rate-limited during the demo | `gemini_cache` is pre-warmed with the exact demo inputs, and the `/health` check runs first |
| Render cold start (free tier) | Call `/health` 2 minutes before the demo. The backup video is ready. |
| Uneven OSM sidewalk tags | Shown as "unverified"; turned into a next step in the pitch |
| No `pathways.txt` | Treat outages at the stop level |
| Curb-ramp data covers only Mobility Element streets | Say so in the pitch |
