"""Gemini task #3: explain why a route changed. Owner: Data + AI (partner)."""

from __future__ import annotations

from pydantic import BaseModel

from pipeline.gemini.client import generate_json, load_prompt


class Explanation(BaseModel):
    steps: list[str]


def explain_reroute(closures: list[dict], route_without: dict, route_with: dict) -> list[str]:
    prompt = load_prompt("explain_reroute").format(
        closures=closures, route_without=route_without, route_with=route_with
    )
    return generate_json(prompt, Explanation, task="explain_reroute").steps
