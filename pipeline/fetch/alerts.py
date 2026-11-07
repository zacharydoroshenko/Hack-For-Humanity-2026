"""Snapshot the MTS alerts feed. Run it now and save any elevator alerts for the demo.

    python -m pipeline.fetch.alerts   -> data/raw/alerts_<timestamp>.txt
"""

import os
import time

import requests
from dotenv import load_dotenv

from pipeline.config import RAW_DIR

load_dotenv()

URL = "http://app.mecatran.com/utw/ws/gtfsfeed/alerts/sdmts"


def main() -> None:
    key = os.environ["MTS_ALERTS_KEY"]
    r = requests.get(URL, params={"apiKey": key, "asText": "true"}, timeout=30)
    r.raise_for_status()
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    out = RAW_DIR / f"alerts_{int(time.time())}.txt"
    out.write_text(r.text)
    print(f"saved {out} ({len(r.text)} bytes, 'elevator' appears {r.text.lower().count('elevator')}x)")
    print("Copy interesting alerts into data/demo_alerts/<name>.json for replay.")


if __name__ == "__main__":
    main()
