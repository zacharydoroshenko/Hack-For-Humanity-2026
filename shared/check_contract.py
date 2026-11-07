"""Check that the glue still holds.

    python -m shared.check_contract          # validate every fixture against backend/contract.py
    python -m shared.check_contract --live   # also call the running backend and validate real responses

Run from the repo root before merging to main.
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.request
from pathlib import Path

from pydantic import BaseModel, ValidationError

from backend import contract as c

FIXTURES = Path(__file__).parent / "fixtures"

FIXTURE_MODELS: dict[str, type[BaseModel]] = {
    "plan_normal.json": c.PlanResponse,
    "plan_rerouted.json": c.PlanResponse,
    "plan_rideshare.json": c.PlanResponse,
    "plan_options.json": c.PlanResponse,
    "layers.json": c.LayersResponse,
    "alert_ingest.json": c.AlertIngestResponse,
    "health.json": c.HealthResponse,
}

# (method, path, body, model)
LIVE_CHECKS = [
    ("GET", "/health", None, c.HealthResponse),
    ("GET", "/layers", None, c.LayersResponse),
    ("POST", "/plan", {"from": [-117.2376, 32.8811], "to": [-117.1935, 32.7500]}, c.PlanResponse),
]


def check(name: str, data: object, model: type[BaseModel]) -> bool:
    try:
        model.model_validate(data)
        print(f"  ok    {name}")
        return True
    except ValidationError as e:
        print(f"  FAIL  {name}\n{e}")
        return False


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--live", action="store_true")
    ap.add_argument("--base", default="http://localhost:8000")
    args = ap.parse_args()

    ok = True
    print("fixtures:")
    for fname, model in FIXTURE_MODELS.items():
        ok &= check(fname, json.loads((FIXTURES / fname).read_text()), model)

    if args.live:
        print(f"live ({args.base}):")
        for method, path, body, model in LIVE_CHECKS:
            req = urllib.request.Request(
                args.base + path,
                method=method,
                data=json.dumps(body).encode() if body is not None else None,
                headers={"Content-Type": "application/json"},
            )
            try:
                with urllib.request.urlopen(req, timeout=30) as r:
                    ok &= check(f"{method} {path}", json.load(r), model)
            except Exception as e:  # noqa: BLE001
                print(f"  FAIL  {method} {path}: {e}")
                ok = False

    print("CONTRACT OK" if ok else "CONTRACT BROKEN")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
