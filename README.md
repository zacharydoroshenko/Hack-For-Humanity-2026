# Accessible Trip Planner (San Diego)

> DS3 × AIC Hack Day: Hack for Humanity · Nov 7, 2026

**Problem:** A wheelchair user takes the trolley, and the station elevator is out. MTS posts
these outages, but they're buried in an alerts feed and no trip planner reroutes around them.
Missing curb ramps and steep hills make the walk to and from the station hard too.

**What it does:** Plans walk + Blue Line trips that avoid inaccessible stops, active elevator
outages, and missing curb ramps. When an outage alert arrives, **Gemini reads it**, figures out
what's broken and what MTS suggests instead, and the route changes with a plain-English explanation.

**How it works:** see [ARCHITECTURE.md](ARCHITECTURE.md).
**What the AI did:** see [AI_USAGE.md](AI_USAGE.md).

## Data
MTS GTFS · MTS alerts feed · City of San Diego ADA curb ramps (Mobility Element streets only) ·
OpenStreetMap (via osmnx) · *(stretch)* USGS 3DEP elevation, Get It Done reports.

## Run it

```bash
# backend (repo root)
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # add GEMINI_API_KEY
uvicorn backend.main:app --reload --port 8000

# check the contract
python -m shared.check_contract          # fixtures
python -m shared.check_contract --live   # running backend

# frontend
cd frontend && npm install
npm run dev:fixtures            # no backend needed
npm run dev                     # against localhost:8000
# demo controls: http://localhost:5173/?demo=1
```

## Data pipeline (partner)
```bash
python -m pipeline.fetch.osm          # slow: start first
python -m pipeline.fetch.curb_ramps
python -m pipeline.fetch.alerts       # save elevator alerts to data/demo_alerts/
python -m pipeline.build_db
```

## Wayfinder MVP (static prototype)

A wheelchair-aware trip planner prototype built from the MTS GTFS feed in
[`google_transit/`](./google_transit/), running without the backend
(`index.html`, `app.js`, `data.js`, `styles.css` at the repo root).

### Run locally

Because the browser loads the generated GTFS index as a script, serve the
repository over HTTP. Use a port other than 8000 so it doesn't clash with the backend:

```bash
python3 -m http.server 8080
```

Then open <http://localhost:8080>.

### What is included

- Accessible-stop search using `stops.wheelchair_boarding=1`.
- Direct-trip matching across wheelchair-accessible GTFS trips.
- Transfer-aware journey matching with up to two accessible transfers at
  shared stops or stations.
- Nearby accessible-stop fallback within 800 meters, so a rider can walk to a
  practical boarding platform when the selected stop only has service in one
  direction.
- An interactive Leaflet/OpenStreetMap map showing the selected accessible
  journey, route-colored transit legs, boarding point, transfer points, and
  destination.
- Multiple-platform handling when several stop IDs share a station name.
- A live MTS alert banner with plain-language guidance taken from the alert
  description, including suggested alternatives when the feed provides them.
- Live GTFS-Realtime alert polling from the MTS alert feed. Accessibility,
  closure, stop-moved, and modified-service alerts are parsed and used to
  remove affected direct routes when a live alternative remains available.
- A photo-reporting placeholder that identifies the next AI-powered workflow.
- Responsive UI suitable for a demo or hackathon pitch.

`data.js` is a browser-ready index generated from the current GTFS files. It
contains accessible stops and all accessible route patterns so the prototype
does not need to parse the full `stop_times.txt` file in the browser.

The browser fetches the MTS `asText=true` GTFS-Realtime endpoint every 60
seconds. If the endpoint blocks browser CORS or is unavailable, the UI keeps
the static accessible planner available and clearly reports that real-time
rerouting is unavailable. A production deployment should proxy this feed
server-side rather than expose the feed key in client code.

The map currently draws the selected route from MTS stop coordinates. It does
not yet claim that the line between stops is a wheelchair-safe sidewalk path;
the City's curb-ramp and sidewalk layers should be used to replace or augment
that geometry once imported.

### Next data integrations

The current planner intentionally does not claim that a route is fully
wheelchair-completable on sidewalks. The next integrations should add the
City's curb-ramp layer, MTS live elevator alerts, and a sidewalk photo
classification/reporting endpoint. Those datasets should become constraints in
the route matcher rather than only UI warnings.

## Team
- UI: Zach
- Data + AI: _partner_
- Demo + docs: _3rd member_
