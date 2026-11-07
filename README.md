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

## Team
- UI: Zach
- Data + AI: _partner_
- Demo + docs: _3rd member_
