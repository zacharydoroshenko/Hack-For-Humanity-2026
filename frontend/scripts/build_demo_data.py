"""Rebuild the real datasets the demo uses (writes frontend/src/mock/real/*.json).

    python3 frontend/scripts/build_demo_data.py <get_it_done_open.csv>
    python3 frontend/scripts/build_elevation_grid.py frontend/src/mock/real/elevation_grid.json

Sources
- City of San Diego ADA curb-ramp needs (ArcGIS FeatureServer layer 13), corridor bbox
- City of San Diego Get It Done open requests (seshat.datasd.org/get_it_done_reports/get_it_done_requests_open_datasd.csv),
  "Sidewalk Repair Issue" within 450 m of the demo's stations and places
- Elevation: AWS Terrain Tiles (terrarium, built from USGS 3DEP/NED in the US); see build_elevation_grid.py
"""
import csv, json, math, sys, urllib.parse, urllib.request
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "src" / "mock" / "real"
OUT.mkdir(parents=True, exist_ok=True)
BBOX = (-117.250, 32.705, -117.150, 32.890)

# ── curb ramps ──
q = urllib.parse.urlencode({
    "where": "1=1", "geometry": ",".join(map(str, BBOX)), "geometryType": "esriGeometryEnvelope", "inSR": 4326,
    "spatialRel": "esriSpatialRelIntersects", "outFields": "*", "outSR": 4326, "f": "geojson",
})
url = "https://webmaps.sandiego.gov/arcgis/rest/services/Hosted/ADA_Needs_BBSD/FeatureServer/13/query?" + q
feats = json.load(urllib.request.urlopen(url, timeout=120))["features"]
ramps = [{
    "id": f"ramp_{f['properties']['interid']}",
    "name": f["properties"]["name"].title().replace("/", " & "),
    "missing": f["properties"]["missing_ra"], "noncompliant": f["properties"]["noncomplia"], "total": f["properties"]["total_ramp"],
    "coord": [round(c, 6) for c in f["geometry"]["coordinates"][:2]],
} for f in feats]
json.dump(ramps, open(OUT / "curb_ramps.json", "w"), separators=(",", ":"))
print("curb ramps:", len(ramps))

# ── Get It Done sidewalk reports ──
PTS = [(-117.2374, 32.88), (-117.23178, 32.87844), (-117.22982, 32.87425), (-117.2235, 32.88182), (-117.21401, 32.8692),
       (-117.19949, 32.75491), (-117.1966, 32.7545), (-117.18447, 32.74172), (-117.17492, 32.73379), (-117.1699, 32.72149),
       (-117.16978, 32.71732), (-117.1593, 32.7314), (-117.1687, 32.7228), (-117.1751, 32.7137), (-117.21407, 32.80586)]
def dist(a, b):
    k = math.cos(math.radians(a[1])) * 111320
    return math.hypot((a[0] - b[0]) * k, (a[1] - b[1]) * 111320)
by_coord = {}
if len(sys.argv) > 1:
    for r in csv.DictReader(open(sys.argv[1], newline="", encoding="utf-8", errors="replace")):
        if r["service_name"] != "Sidewalk Repair Issue":
            continue
        try:
            p = (round(float(r["lng"]), 5), round(float(r["lat"]), 5))
        except ValueError:
            continue
        if min(dist(p, q) for q in PTS) > 450:
            continue
        rec = {"id": r["service_request_id"], "date": r["date_requested"][:10], "detail": r["service_name_detail"].capitalize(),
               "address": r["street_address"].replace(", San Diego, CA", "").replace(", USA", ""),
               "desc": " ".join((r["public_description"] or "").split())[:180], "coord": list(p)}
        if p not in by_coord or rec["date"] > by_coord[p]["date"]:  # one report per spot, newest
            by_coord[p] = rec
    json.dump(sorted(by_coord.values(), key=lambda x: x["id"]), open(OUT / "get_it_done.json", "w"), separators=(",", ":"))
    print("get it done reports:", len(by_coord))
