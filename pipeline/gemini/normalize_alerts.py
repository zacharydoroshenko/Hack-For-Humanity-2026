"""Gemini task #1: MTS alert text -> structured closure. Owner: Data + AI (partner).

    python -m pipeline.gemini.normalize_alerts data/demo_alerts/old_town_elevator.json
"""

from __future__ import annotations

import json
import sys
from typing import Literal

from pydantic import BaseModel

from pipeline.gemini.client import generate_json, load_prompt


class AlertClosure(BaseModel):
    kind: Literal["elevator_outage", "stop_closure", "other"]
    affected_stop_ids: list[str]
    facility: str | None
    title: str
    alternative_text: str | None
    alternative_stop_ids: list[str]
    active_until: str | None
    confidence: float


def normalize_alert(alert_text: str, informed_stop_ids: list[str], corridor_stops: list[dict]) -> AlertClosure:
    prompt = load_prompt("alert_to_closure").format(
        alert_text=alert_text,
        informed_stop_ids=json.dumps(informed_stop_ids),
        corridor_stops=json.dumps(corridor_stops),
    )
    return generate_json(prompt, AlertClosure, task="alert_to_closure")


if __name__ == "__main__":
    raw = json.loads(open(sys.argv[1]).read())
    # TODO(partner): pull header/description/informed_entity out of the saved alert format.
    print(normalize_alert(json.dumps(raw), [], []).model_dump_json(indent=2))
