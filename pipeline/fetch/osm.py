"""Download the OSM walk graph for the corridor. START THIS FIRST (it's slow).

    python -m pipeline.fetch.osm   -> data/walk_graph.graphml
"""

import osmnx as ox

from pipeline.config import GRAPH_PATH, MAX_LAT, MAX_LON, MIN_LAT, MIN_LON


def classify(data: dict) -> str:
    """OSM tags -> accessible | inaccessible | unverified. Tune freely."""
    wc = str(data.get("wheelchair", "")).lower()
    if wc in ("yes", "designated"):
        return "accessible"
    if wc == "no" or data.get("highway") == "steps":
        return "inaccessible"
    if str(data.get("kerb", "")).lower() == "raised":
        return "inaccessible"
    if data.get("sidewalk") in ("both", "left", "right", "separate") or data.get("footway") == "sidewalk":
        return "accessible"
    return "unverified"


def main() -> None:
    ox.settings.useful_tags_way += ["sidewalk", "wheelchair", "kerb", "incline", "surface", "footway"]
    # osmnx >= 2.0 takes bbox as (left, bottom, right, top)
    G = ox.graph_from_bbox((MIN_LON, MIN_LAT, MAX_LON, MAX_LAT), network_type="walk")
    for _, _, d in G.edges(data=True):
        d["accessibility"] = classify(d)
    GRAPH_PATH.parent.mkdir(parents=True, exist_ok=True)
    ox.save_graphml(G, GRAPH_PATH)
    print(f"saved {GRAPH_PATH} ({G.number_of_nodes()} nodes, {G.number_of_edges()} edges)")


if __name__ == "__main__":
    main()
