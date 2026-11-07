"""Deterministic accessible routing. Owner: Data + AI (partner).

See ARCHITECTURE.md §9. Internals are free to change; main.py converts the
result into contract.PlanResponse.
"""

from __future__ import annotations

import math
from pathlib import Path

import networkx as nx

ROOT = Path(__file__).resolve().parent.parent
GRAPH_PATH = ROOT / "data" / "walk_graph.graphml"

_graph: nx.MultiDiGraph | None = None


def load_graph() -> nx.MultiDiGraph:
    global _graph
    if _graph is None:
        import osmnx as ox

        _graph = ox.load_graphml(GRAPH_PATH)
    return _graph


def edge_cost(
    data: dict,
    *,
    max_grade: float,
    avoid_unverified: bool,
    blocked_nodes: set[int],
    u: int,
    v: int,
) -> float:
    """Cost of one walk edge. math.inf = never use it."""
    if u in blocked_nodes or v in blocked_nodes:
        return math.inf
    access = data.get("accessibility", "unverified")
    if access == "inaccessible":
        return math.inf
    grade = abs(float(data.get("grade_abs", data.get("grade", 0)) or 0))
    if grade > max_grade:
        return math.inf
    cost = float(data.get("length", 1.0))
    if access == "unverified":
        if avoid_unverified:
            return math.inf
        cost *= 1.5
    cost *= 1 + 4 * max(0.0, grade - 0.03)
    return cost


def walk_path(
    origin_lonlat: tuple[float, float],
    dest_lonlat: tuple[float, float],
    *,
    max_grade: float = 0.05,
    avoid_unverified: bool = False,
    blocked_nodes: set[int] | None = None,
) -> list[int]:
    """Shortest accessible walk as a list of OSM node ids."""
    import osmnx as ox

    G = load_graph()
    blocked = blocked_nodes or set()
    o = ox.distance.nearest_nodes(G, *origin_lonlat)
    d = ox.distance.nearest_nodes(G, *dest_lonlat)

    def weight(u, v, edges):
        return min(
            edge_cost(e, max_grade=max_grade, avoid_unverified=avoid_unverified,
                      blocked_nodes=blocked, u=u, v=v)
            for e in edges.values()
        )

    return nx.shortest_path(G, o, d, weight=weight)


# TODO(partner): plan_trip(origin, dest, closures, ...) implementing §9 "simple transit":
#   usable Blue Line stops -> best board/alight stops -> walk + transit + walk legs.
