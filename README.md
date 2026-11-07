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
- Transfer-aware journey matching with up to two accessible transfers at
  shared stops or stations.
- Nearby accessible-stop fallback within 800 meters, so a rider can walk to a
  practical boarding platform when the selected stop only has service in one
  direction.
- Multiple-platform handling when several stop IDs share a station name.
- A live MTS alert banner with plain-language guidance taken from the alert
  description, including suggested alternatives when the feed provides them.
- Live GTFS-Realtime alert polling from the MTS alert feed. Accessibility,
  closure, stop-moved, and modified-service alerts are parsed and used to
  remove affected direct routes when a live alternative remains available.
- A photo-reporting placeholder that identifies the next AI-powered workflow.
- Responsive UI suitable for a demo or hackathon pitch.

`data.js` is a browser-ready index generated from the current GTFS files. It
contains accessible stops and all accessible route patterns so the prototype
does not need to parse the full `stop_times.txt` file in the browser.

The browser fetches the MTS `asText=true` GTFS-Realtime endpoint every 60
seconds. If the endpoint blocks browser CORS or is unavailable, the UI keeps
the static accessible planner available and clearly reports that real-time
rerouting is unavailable. A production deployment should proxy this feed
server-side rather than expose the feed key in client code.

## Next data integrations

The current planner intentionally does not claim that a route is fully
wheelchair-completable on sidewalks. The next integrations should add the
City's curb-ramp layer, MTS live elevator alerts, and a sidewalk photo
classification/reporting endpoint. Those datasets should become constraints in
the route matcher rather than only UI warnings.
