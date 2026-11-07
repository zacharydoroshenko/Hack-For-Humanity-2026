"""Fetch City of San Diego ADA curb-ramp needs inside the corridor bbox.

    python -m pipeline.fetch.curb_ramps   -> data/raw/curb_ramps.geojson
"""

import json

import requests

from pipeline.config import MAX_LAT, MAX_LON, MIN_LAT, MIN_LON, RAW_DIR

URL = "https://webmaps.sandiego.gov/arcgis/rest/services/Hosted/ADA_Needs_BBSD/FeatureServer/13/query"


def main() -> None:
    features, offset = [], 0
    while True:
        r = requests.get(URL, params={
            "where": "1=1",
            "outFields": "*",
            "outSR": 4326,
            "geometry": f"{MIN_LON},{MIN_LAT},{MAX_LON},{MAX_LAT}",
            "geometryType": "esriGeometryEnvelope",
            "inSR": 4326,
            "spatialRel": "esriSpatialRelIntersects",
            "resultOffset": offset,
            "f": "geojson",
        }, timeout=60)
        r.raise_for_status()
        batch = r.json().get("features", [])
        features += batch
        if len(batch) < 2000:
            break
        offset += len(batch)
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    out = RAW_DIR / "curb_ramps.geojson"
    out.write_text(json.dumps({"type": "FeatureCollection", "features": features}))
    print(f"saved {len(features)} curb ramps -> {out}")


if __name__ == "__main__":
    main()
