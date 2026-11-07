# Wayfinder MVP

Wayfinder is a wheelchair-aware San Diego trip planner prototype built from the
MTS GTFS feed in [`google_transit/`](./google_transit/).

## Run locally

Because the browser loads the generated GTFS index as a script, serve the
repository over HTTP:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## What is included

- Accessible-stop search using `stops.wheelchair_boarding=1`.
- Direct-trip matching across wheelchair-accessible GTFS trips.
- Multiple-platform handling when several stop IDs share a station name.
- A visible MTS elevator outage state with a plain-language Route 3 / Euclid
  alternative message.
- A photo-reporting placeholder that identifies the next AI-powered workflow.
- Responsive UI suitable for a demo or hackathon pitch.

`data.js` is a browser-ready index generated from the current GTFS files. It
contains accessible stops and route patterns so the prototype does not need to
parse the full `stop_times.txt` file in the browser.

## Next data integrations

The current planner intentionally does not claim that a route is fully
wheelchair-completable on sidewalks. The next integrations should add the
City's curb-ramp layer, MTS live elevator alerts, and a sidewalk photo
classification/reporting endpoint. Those datasets should become constraints in
the route matcher rather than only UI warnings.
