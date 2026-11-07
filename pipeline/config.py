"""Shared paths and the corridor bbox (read from the frozen shared/config.json)."""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONFIG = json.loads((ROOT / "shared" / "config.json").read_text())
MIN_LON, MIN_LAT, MAX_LON, MAX_LAT = CONFIG["bbox"]
GTFS_DIR = ROOT / "google_transit"
DATA_DIR = ROOT / "data"
RAW_DIR = DATA_DIR / "raw"
DB_PATH = DATA_DIR / "app.db"
GRAPH_PATH = DATA_DIR / "walk_graph.graphml"
DEMO_ALERTS_DIR = DATA_DIR / "demo_alerts"


def in_bbox(lon: float, lat: float) -> bool:
    return MIN_LON <= lon <= MAX_LON and MIN_LAT <= lat <= MAX_LAT
