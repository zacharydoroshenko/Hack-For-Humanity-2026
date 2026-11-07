"""Build an elevation grid (meters) for the demo corridor from AWS Terrain Tiles (terrarium, USGS 3DEP/NED in the US)."""
import io, json, math, sys, urllib.request
from PIL import Image
Z = 14
MIN_LON, MAX_LON, MIN_LAT, MAX_LAT = -117.250, -117.150, 32.705, 32.890
STEP = 0.0008  # ~75-90 m
out_path = sys.argv[1]
cache = {}
def tile_xy(lon, lat):
    n = 2 ** Z
    x = (lon + 180) / 360 * n
    y = (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * n
    return x, y
def tile(tx, ty):
    if (tx, ty) not in cache:
        url = f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{Z}/{tx}/{ty}.png"
        with urllib.request.urlopen(url, timeout=60) as r:
            cache[(tx, ty)] = Image.open(io.BytesIO(r.read())).convert("RGB").load()
    return cache[(tx, ty)]
def elev(lon, lat):
    x, y = tile_xy(lon, lat)
    tx, ty = int(x), int(y)
    px, py = min(255, int((x - tx) * 256)), min(255, int((y - ty) * 256))
    r, g, b = tile(tx, ty)[px, py]
    return (r * 256 + g + b / 256) - 32768
cols = int(round((MAX_LON - MIN_LON) / STEP)) + 1
rows = int(round((MAX_LAT - MIN_LAT) / STEP)) + 1
grid = [[round(elev(MIN_LON + c * STEP, MIN_LAT + r * STEP), 1) for c in range(cols)] for r in range(rows)]
json.dump({"source": "AWS Terrain Tiles (terrarium z14; USGS 3DEP/NED in the US)", "min_lon": MIN_LON, "min_lat": MIN_LAT,
           "step": STEP, "rows": rows, "cols": cols, "elev_m": grid}, open(out_path, "w"), separators=(",", ":"))
print(rows, cols, "tiles:", len(cache))
for name, lon, lat in [("Laurel & 6th (Balboa Park)", -117.1593, 32.7314), ("State & Kalmia", -117.16905, 32.73017), ("Old Town Stn", -117.19949, 32.75491), ("UCSD Central Stn", -117.23178, 32.87844), ("Midway", -117.1751, 32.7137)]:
    print(name, round(elev(lon, lat), 1))
