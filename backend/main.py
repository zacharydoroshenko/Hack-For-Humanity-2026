"""FastAPI app. Owner: Data + AI (partner).

Run from the repo root:  uvicorn backend.main:app --reload --port 8000

PLACEHOLDER: every endpoint currently serves shared/fixtures/ so the frontend
can integrate immediately. Replace the bodies with real logic (router.py,
pipeline/gemini) and keep the signatures + response_model unchanged.
"""

from __future__ import annotations

import json
import math
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from backend import contract as c

load_dotenv()

ROOT = Path(__file__).resolve().parent.parent
FIXTURES = ROOT / "shared" / "fixtures"
DEMO_ALERTS = ROOT / "data" / "demo_alerts"

app = FastAPI(title="Accessible Trip Planner")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory demo state: closures ingested via /alerts/ingest.
# TODO(partner): move to the `closures` table in data/app.db.
_ingested: dict[str, c.ClosureFeature] = {}

WALK_M_PER_MIN = 60  # ~1 m/s wheelchair pace
CAR_M_PER_MIN = 500  # ~30 km/h city average
RIDESHARE_WAIT_MIN = 9  # wheelchair-accessible vehicles take longer to arrive
DETOUR = 1.3  # straight line -> street distance


def _fixture(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text())


def _haversine(a: c.LngLat, b: c.LngLat) -> float:
    r = 6371000
    p1, p2 = math.radians(a[1]), math.radians(b[1])
    dp, dl = p2 - p1, math.radians(b[0] - a[0])
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def _dogleg(a: c.LngLat, b: c.LngLat) -> list[c.LngLat]:
    """Street-ish L-shaped line between two points (placeholder for the real router)."""
    mid = a[1] + (b[1] - a[1]) / 2
    return [a, (a[0], mid), (b[0], mid), b]


def _non_transit_plan(req: c.PlanRequest) -> c.PlanResponse:
    """walk / drive / rideshare. Placeholder geometry; outages never affect these modes.

    TODO(partner): walk -> router.walk_path; drive/rideshare -> OSM drive graph.
    """
    if req.from_ is None or req.to is None:
        raise HTTPException(422, "Provide `from` and `to` (text parsing is not wired yet).")
    coords = _dogleg(req.from_, req.to)
    meters = round(_haversine(req.from_, req.to) * DETOUR)
    if req.mode == "walk":
        leg: dict = {
            "mode": "walk", "geometry": {"type": "LineString", "coordinates": coords},
            "distance_m": meters, "duration_min": max(1, round(meters / WALK_M_PER_MIN)),
            "warnings": [], "steps": [{"instruction": "Head to your destination", "distance_m": meters},
                                      {"instruction": "Arrive", "distance_m": 0}],
        }
        legs, walk_m = [leg], meters
    else:
        wait = RIDESHARE_WAIT_MIN if req.mode == "rideshare" else 3
        steps = (
            [{"instruction": f"Wait about {wait} min for a wheelchair-accessible vehicle", "distance_m": 0},
             {"instruction": "Ride to your destination", "distance_m": meters}]
            if req.mode == "rideshare"
            else [{"instruction": "Drive to your destination", "distance_m": meters},
                  {"instruction": "Park in an accessible (ADA) space near the entrance", "distance_m": 0}]
        )
        note = (
            "Request a wheelchair-accessible vehicle (WAV) in your rideshare app. Availability varies by time of day."
            if req.mode == "rideshare"
            else "Accessible parking near the destination is not verified."
        )
        legs = [{
            "mode": req.mode, "geometry": {"type": "LineString", "coordinates": coords},
            "distance_m": meters, "duration_min": max(3, round(meters / CAR_M_PER_MIN)) + wait,
            "steps": steps, "warnings": [], "note": note,
        }]
        walk_m = 0
    return c.PlanResponse.model_validate({
        "mode": req.mode, "parsed_request": None,
        "summary": {"duration_min": round(sum(l["duration_min"] for l in legs)), "walk_m": walk_m, "transfers": 0},
        "legs": legs, "rerouted": False, "reroute": None,
    })


def _load_demo_alert(demo_file: str) -> dict:
    path = DEMO_ALERTS / Path(demo_file).name  # .name blocks path traversal
    if not path.exists():
        raise HTTPException(404, f"Unknown demo alert: {demo_file}")
    return json.loads(path.read_text())


@app.get("/health", response_model=c.HealthResponse)
def health() -> c.HealthResponse:
    return c.HealthResponse(ok=True, gemini=bool(os.getenv("GEMINI_API_KEY")))


@app.get("/layers", response_model=c.LayersResponse)
def layers() -> c.LayersResponse:
    # TODO(partner): build from data/app.db (stops, closures, curb_ramps) filtered to the bbox.
    data = _fixture("layers.json")
    # Fixture includes the Old Town outage; only show alert closures once ingested.
    data["closures"]["features"] = [
        f for f in data["closures"]["features"] if f["properties"]["source"] != "mts_alerts"
    ] + [json.loads(cl.model_dump_json()) for cl in _ingested.values()]
    by_stop: dict[str, list[str]] = {}
    for f in data["closures"]["features"]:
        if f["properties"]["stop_id"]:
            by_stop.setdefault(f["properties"]["stop_id"], []).append(f["properties"]["id"])
    for s in data["stops"]["features"]:
        s["properties"]["active_closure_ids"] = by_stop.get(s["properties"]["stop_id"], [])
    return c.LayersResponse.model_validate(data)


@app.post("/plan", response_model=c.PlanResponse)
def plan(req: c.PlanRequest) -> c.PlanResponse:
    # TODO(partner):
    #   1. if req.text: pipeline.gemini -> ParsedRequest (task #2)
    #   2. backend.router.plan(...) with active closures, and again with none
    #   3. if they differ: backend.explain.explain_reroute(...) (task #3)
    if req.from_ is None and req.text is None:
        raise HTTPException(422, "Provide `from`/`to` or `text`.")
    if req.mode != "transit":
        return _non_transit_plan(req)
    name = "plan_rerouted.json" if _ingested else "plan_normal.json"
    return c.PlanResponse.model_validate(_fixture(name))


@app.post("/alerts/ingest", response_model=c.AlertIngestResponse)
def ingest_alert(req: c.AlertIngestRequest) -> c.AlertIngestResponse:
    # TODO(partner): load req.demo_file from data/demo_alerts/ (or use req.alert),
    #   run Gemini task #1 (alert -> closure), insert into the closures table.
    # Placeholder: use the closure saved next to the raw alert instead of calling Gemini.
    if req.demo_file:
        resp = c.AlertIngestResponse.model_validate({"closure": _load_demo_alert(req.demo_file)["closure"]})
    else:
        resp = c.AlertIngestResponse.model_validate(_fixture("alert_ingest.json"))
    _ingested[resp.closure.properties.id] = resp.closure
    return resp


@app.post("/demo/reset")
def demo_reset() -> dict:
    """Demo-only helper (not part of the frozen contract): clear ingested alerts."""
    _ingested.clear()
    return {"ok": True}
