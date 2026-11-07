"""FROZEN GLUE: the API contract between frontend/ and backend/.

Must match shared/types.ts exactly. See ARCHITECTURE.md §3 for the change rules.
Every endpoint in main.py declares one of these as `response_model`, so FastAPI
rejects any response that drifts from the contract.

All coordinates are GeoJSON order: [lon, lat].
"""

from __future__ import annotations

from typing import Annotated, Any, Generic, Literal, TypeVar, Union

from pydantic import BaseModel, ConfigDict, Field

LngLat = tuple[float, float]
WheelchairBoarding = Literal[0, 1, 2]  # 0 unknown, 1 accessible, 2 not accessible
ClosureKind = Literal[
    "elevator_outage", "stop_closure", "missing_curb_ramp", "steep_segment", "reported_hazard"
]
Severity = Literal["blocking", "warning"]
ClosureSource = Literal["mts_alerts", "city_ada", "usgs", "get_it_done"]
TravelMode = Literal["transit", "rideshare", "drive", "walk"]
WarningType = Literal["unverified", "steep", "hazard", "missing_curb_ramp"]


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class PointGeometry(Strict):
    type: Literal["Point"]
    coordinates: LngLat


class LineStringGeometry(Strict):
    type: Literal["LineString"]
    coordinates: list[LngLat]


# ───────────────────────── POST /plan ─────────────────────────


class PlanRequest(Strict):
    text: str | None = None
    from_: LngLat | None = Field(default=None, alias="from")
    to: LngLat | None = None
    via: list[LngLat] = []  # intermediate stops, in order
    max_grade: float = 0.05
    avoid_unverified: bool = False
    mode: TravelMode = "transit"

    model_config = ConfigDict(extra="forbid", populate_by_name=True)


class ParsedRequest(Strict):
    from_text: str | None
    to_text: str | None
    max_grade: float
    avoid_unverified: bool
    ai_generated: bool


class RouteWarning(Strict):
    type: WarningType
    message: str


class Step(Strict):
    instruction: str
    distance_m: float


class StopRef(Strict):
    stop_id: str
    name: str
    wheelchair_boarding: WheelchairBoarding


class WalkLeg(Strict):
    mode: Literal["walk"]
    geometry: LineStringGeometry
    distance_m: float
    duration_min: float
    warnings: list[RouteWarning]
    steps: list[Step]


class TransitLeg(Strict):
    mode: Literal["transit"]
    route_short_name: str
    route_color: str
    from_stop: StopRef
    to_stop: StopRef
    duration_min: float
    geometry: LineStringGeometry


class CarLeg(Strict):
    mode: Literal["drive", "rideshare"]
    geometry: LineStringGeometry
    distance_m: float
    duration_min: float
    steps: list[Step]
    warnings: list[RouteWarning]
    note: str | None


Leg = Annotated[Union[WalkLeg, TransitLeg, CarLeg], Field(discriminator="mode")]


class Reroute(Strict):
    cause_closure_ids: list[str]
    explanation: list[str]
    ai_generated: bool


class Summary(Strict):
    duration_min: float
    walk_m: float
    transfers: int


class RouteOption(Strict):
    id: str
    label: str  # e.g. "Fastest", "Least rolling"
    summary: Summary
    legs: list[Leg]


class PlanResponse(Strict):
    mode: TravelMode | None = None
    parsed_request: ParsedRequest | None
    summary: Summary
    legs: list[Leg]
    rerouted: bool
    reroute: Reroute | None
    # All candidates, best first. options[0] mirrors summary/legs above.
    options: list[RouteOption] | None = None


# ───────────────────────── GET /layers ─────────────────────────

G = TypeVar("G")
P = TypeVar("P")
F = TypeVar("F")


class Feature(Strict, Generic[G, P]):
    type: Literal["Feature"]
    geometry: G
    properties: P


class FeatureCollection(Strict, Generic[F]):
    type: Literal["FeatureCollection"]
    features: list[F]


class StopProps(Strict):
    stop_id: str
    name: str
    wheelchair_boarding: WheelchairBoarding
    is_blue_line: bool
    active_closure_ids: list[str]


class ClosureProps(Strict):
    id: str
    kind: ClosureKind
    severity: Severity
    title: str
    description: str | None
    alternative: str | None
    stop_id: str | None
    source: ClosureSource
    raw_text: str | None
    ai_generated: bool


class CurbRampProps(Strict):
    id: str
    description: str | None


StopFeature = Feature[PointGeometry, StopProps]
ClosureFeature = Feature[Union[PointGeometry, LineStringGeometry], ClosureProps]
CurbRampFeature = Feature[PointGeometry, CurbRampProps]


class LayersResponse(Strict):
    stops: FeatureCollection[StopFeature]
    closures: FeatureCollection[ClosureFeature]
    curb_ramps: FeatureCollection[CurbRampFeature]


# ───────────────────────── POST /alerts/ingest ─────────────────────────


class AlertIngestRequest(Strict):
    demo_file: str | None = None
    alert: dict[str, Any] | None = None


class AlertIngestResponse(Strict):
    closure: ClosureFeature


# ───────────────────────── GET /health ─────────────────────────


class HealthResponse(Strict):
    ok: bool
    gemini: bool
