"""Build data/app.db from GTFS + fetched raw files. Safe to rerun.

    python -m pipeline.build_db

Run pipeline.fetch.curb_ramps first if you want curb ramps loaded.
"""

from __future__ import annotations

import csv
import json
import sqlite3
import statistics
from collections import defaultdict

from pipeline.config import CONFIG, DB_PATH, GTFS_DIR, RAW_DIR, ROOT, in_bbox

BLUE = CONFIG["blue_line_route_id"]


def _secs(t: str) -> int:
    h, m, s = map(int, t.split(":"))
    return h * 3600 + m * 60 + s


def load_stops(db: sqlite3.Connection) -> None:
    rows = []
    with open(GTFS_DIR / "stops.txt", newline="") as f:
        for s in csv.DictReader(f):
            lon, lat = float(s["stop_lon"]), float(s["stop_lat"])
            if s["location_type"] in ("", "0") and in_bbox(lon, lat):
                rows.append((s["stop_id"], s["stop_name"], lat, lon,
                             int(s["wheelchair_boarding"] or 0), s["parent_station"] or None))
    db.executemany(
        "INSERT OR REPLACE INTO stops (stop_id, name, lat, lon, wheelchair_boarding, parent_station) "
        "VALUES (?,?,?,?,?,?)", rows)
    print(f"stops in bbox: {len(rows)}")


def load_blue_line(db: sqlite3.Connection) -> None:
    with open(GTFS_DIR / "trips.txt", newline="") as f:
        trips = {t["trip_id"]: t for t in csv.DictReader(f) if t["route_id"] == BLUE}

    by_trip: dict[str, list[tuple[int, str, int]]] = defaultdict(list)
    with open(GTFS_DIR / "stop_times.txt", newline="") as f:
        for r in csv.DictReader(f):
            if r["trip_id"] in trips:
                by_trip[r["trip_id"]].append((int(r["stop_sequence"]), r["stop_id"], _secs(r["arrival_time"])))

    pair_minutes: dict[tuple[str, str], list[float]] = defaultdict(list)
    longest: list[str] = []
    for tid, seq in by_trip.items():
        seq.sort()
        ids = [s for _, s, _ in seq]
        if trips[tid]["direction_id"] == "0" and len(ids) > len(longest):
            longest = ids
        for i in range(len(seq)):
            for j in range(i + 1, len(seq)):
                pair_minutes[(seq[i][1], seq[j][1])].append((seq[j][2] - seq[i][2]) / 60)

    db.executemany("INSERT OR REPLACE INTO blue_line_times VALUES (?,?,?)",
                   [(a, b, statistics.median(v)) for (a, b), v in pair_minutes.items()])
    for i, sid in enumerate(longest):
        db.execute("UPDATE stops SET is_blue_line = 1, blue_line_seq = ? WHERE stop_id = ?", (i, sid))
    print(f"blue line trips: {len(trips)}, stop pairs: {len(pair_minutes)}")


def load_curb_ramps(db: sqlite3.Connection) -> None:
    path = RAW_DIR / "curb_ramps.geojson"
    if not path.exists():
        print("curb ramps: skipped (run python -m pipeline.fetch.curb_ramps)")
        return
    feats = json.loads(path.read_text())["features"]
    rows = []
    for i, f in enumerate(feats):
        lon, lat = f["geometry"]["coordinates"][:2]
        props = f.get("properties") or {}
        fid = str(props.get("objectid") or props.get("OBJECTID") or i)
        rows.append((fid, lat, lon, None, json.dumps(props)[:300]))
    db.executemany("INSERT OR REPLACE INTO curb_ramps VALUES (?,?,?,?,?)", rows)
    print(f"curb ramps: {len(rows)}")
    # TODO(partner): snap to nearest graph node (osmnx.distance.nearest_nodes) -> osm_node


def main() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(DB_PATH) as db:
        db.executescript((ROOT / "pipeline" / "schema.sql").read_text())
        load_stops(db)
        load_blue_line(db)
        load_curb_ramps(db)
    print(f"built {DB_PATH}")


if __name__ == "__main__":
    main()
