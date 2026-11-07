"""FastAPI app. Owner: Data + AI (partner).

Run from the repo root:  uvicorn backend.main:app --reload --port 8000

PLACEHOLDER: every endpoint currently serves shared/fixtures/ so the frontend
can integrate immediately. Replace the bodies with real logic (router.py,
pipeline/gemini) and keep the signatures + response_model unchanged.
"""

from __future__ import annotations

import json
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


def _fixture(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text())


@app.get("/health", response_model=c.HealthResponse)
def health() -> c.HealthResponse:
    return c.HealthResponse(ok=True, gemini=bool(os.getenv("GEMINI_API_KEY")))


@app.get("/layers", response_model=c.LayersResponse)
def layers() -> c.LayersResponse:
    # TODO(partner): build from data/app.db (stops, closures, curb_ramps) filtered to the bbox.
    data = _fixture("layers.json")
    # Fixture includes the Old Town outage; only show alert closures once ingested.
    data["closures"]["features"] = [
        f for f in data["closures"]["features"]
        if f["properties"]["source"] != "mts_alerts" or f["properties"]["id"] in _ingested
    ]
    active = {f["properties"]["id"] for f in data["closures"]["features"]}
    for s in data["stops"]["features"]:
        s["properties"]["active_closure_ids"] = [
            i for i in s["properties"]["active_closure_ids"] if i in active
        ]
    return c.LayersResponse.model_validate(data)


@app.post("/plan", response_model=c.PlanResponse)
def plan(req: c.PlanRequest) -> c.PlanResponse:
    # TODO(partner):
    #   1. if req.text: pipeline.gemini -> ParsedRequest (task #2)
    #   2. backend.router.plan(...) with active closures, and again with none
    #   3. if they differ: backend.explain.explain_reroute(...) (task #3)
    if req.from_ is None and req.text is None:
        raise HTTPException(422, "Provide `from`/`to` or `text`.")
    name = "plan_rerouted.json" if _ingested else "plan_normal.json"
    return c.PlanResponse.model_validate(_fixture(name))


@app.post("/alerts/ingest", response_model=c.AlertIngestResponse)
def ingest_alert(req: c.AlertIngestRequest) -> c.AlertIngestResponse:
    # TODO(partner): load req.demo_file from data/demo_alerts/ (or use req.alert),
    #   run Gemini task #1 (alert -> closure), insert into the closures table.
    if req.demo_file and not (DEMO_ALERTS / Path(req.demo_file).name).exists():
        pass  # placeholder ignores missing files; real version should 404
    resp = c.AlertIngestResponse.model_validate(_fixture("alert_ingest.json"))
    _ingested[resp.closure.properties.id] = resp.closure
    return resp


@app.post("/demo/reset")
def demo_reset() -> dict:
    """Demo-only helper (not part of the frozen contract): clear ingested alerts."""
    _ingested.clear()
    return {"ok": True}
