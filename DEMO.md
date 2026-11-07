# SafeRoute demo script

About **3 minutes** live, plus Q&A. One rider, one day out, four memorable stops, all on the
**MTS Blue Line**:

> **Price Center Theater** (UCSD) → **Old Town** (lunch) → **Balboa Park** (museums) → **USS Midway** (sunset)

The audience sees every kind of problem a wheelchair rider runs into, each from a **real** San Diego
dataset:

| Problem | Source (real data) | Where it shows up |
|---|---|---|
| Construction closures | **MTS alerts feed**, 3 active stop closures (Nov 7, 2026) | State St & Kalmia, First Av & Laurel on the roll up to Balboa Park |
| Missing / non-compliant curb ramps | **City of San Diego ADA curb-ramp layer**, 242 intersections in the corridor | e.g. "Laurel St & 5th Av: 2 missing curb ramps" |
| Broken sidewalks | **Get It Done** open sidewalk reports, 282 near the route | e.g. "Concrete sidewalk lifted 6 inches (346 Kalmia St)" |
| Hills | **USGS 3DEP elevation** | "Steep street: Laurel St, State St to First Ave (8.5%)"; "Climbs 72 m over 2.1 km" |
| Station accessibility | **MTS GTFS** `wheelchair_boarding` | Stop markers |
| **Elevator outages / station closures** | **Simulated MTS alerts** on hotkeys, read by **Gemini** | Pop up live and reroute the trip |

---

## 1. Setup (do this 10 minutes before)

Two terminals, both from the repo root:

```bash
# Terminal 1: backend (Gemini reads the MTS alerts). Needs GEMINI_API_KEY in .env
source .venv/bin/activate
uvicorn backend.main:app --port 8000

# Terminal 2: frontend in demo mode (demo routing + real Gemini alerts)
npm run demo
```

Open **http://localhost:5173**. That's it.

- **Refreshing the page always resets the demo**: the trip, the 4% slope, no route planned, and all
  replayed alerts cleared (on the backend too).
- **Alerts only happen when you press a hotkey** (§4), so you control the timing. Click the map once first so
  the page has keyboard focus.

### Pre-flight checklist

- [ ] `curl localhost:8000/health` returns `{"ok":true,"gemini":true}`.
- [ ] **Warm up Gemini** so alerts appear instantly instead of in ~4 s: press `P`, then each alert key you
      plan to use (`1`, `2`, ...), waiting for each toast, then refresh. The answers are now cached in
      `data/app.db`.
- [ ] Refresh the page. The sidebar shows all four places, the slope preference reads
      **Slope 4.0% (Manual chair)**, and there's no outage banner.
- [ ] Browser zoom at 100–125%, notifications off, the demo panel hidden (`D` toggles it).
- [ ] Backup video recorded (see §5).

---

## 2. The script

| Time | Say | Do | What the audience sees |
|---|---|---|---|
| **0:00** Problem | "Meet Maya. She's a UCSD student who uses a manual wheelchair. Today it's a movie at **Price Center Theater**, lunch in **Old Town**, the museums in **Balboa Park**, and sunset on the **USS Midway**. Google Maps will tell her to take the trolley. It won't tell her the elevator is broken, the curb is torn up, or the street is an 8% hill." | Nothing. The app is already loaded. | The trip is prefilled: start, stops ① and ②, destination. |
| **0:25** Plan | "She asks SafeRoute for the trip, with her manual-chair limit of 4% slope." | Click **Find accessible route** (or press `P`). | **3 route options.** The second, *Fewer construction zones* (2 h 56 min), has a green **Recommended** badge and is selected, even though *Fastest* is 2 h 40 min. |
| **0:40** Real problems | "Everything you're about to see is **real data**. On the roll up to Balboa Park: MTS reports **construction at State & Kalmia and at First & Laurel**. USGS elevation says **Laurel St climbs at 8.5%**. The City's curb-ramp survey says **Laurel & 5th is missing two curb ramps**. And there are **dozens of open Get It Done reports**, like a sidewalk lifted six inches on Kalmia St." | Click the **Fastest** option, then its Balboa Park roll leg so the map zooms in. Point at the ⚠ construction markers, the dashed orange Laurel St line, the ◆ curb ramps and the small amber report dots. | The leg lists each problem by name. |
| **1:05** Non-optimal choice | "So SafeRoute **doesn't** recommend the fastest route. The fastest one gets off at Middletown, rolls past **both** construction zones, and climbs 83 m more. The recommended one gets off at County Center/Little Italy instead. It's **16 minutes slower**, and that's the trade Maya takes." (Reasons in §3.) | Click **Fewer construction zones**. Read its green reason line aloud. | "Rolls past 1 fewer construction zone and climbs 83 m less than the fastest route, for 16 more min." The faster route stays as a faint gray line. |
| **1:25** Live alert | "While she's leaving the theater, MTS posts an alert…" | Press **`1`** as you finish the sentence. | Red toast: **"New MTS alert: Elevator out at UCSD Central Campus"**, suggesting VA Medical Center. A red ⛔ marks the station. |
| **1:40** Reroute | "**Gemini read that alert**, worked out which station it means and what MTS suggests, and SafeRoute replanned. Look how it tells her *why*: the **usual route is crossed out** because that elevator is out, and she boards at **VA Medical Center** instead. 9 more minutes, and still the construction-avoiding route." | Point at the banner's **Usual route → New route** box. Click the first roll leg (tagged **"Changed to avoid: UCSD Central Campus elevator out"**) so the map zooms to campus. Click the **AI-interpreted** chip to show the alert text Gemini read. | Banner: **"Rerouted because of UCSD Central Campus elevator out"**. Map: the **red dashed** usual path ends at the ⛔ station, and the new path heads to VA Medical Center. Every route card has a green **"Avoids: UCSD Central Campus elevator out"** chip. |
| **2:00** *(optional encore)* Second alert | "And if a second alert hits the route she's on…" | Press `2`: **County Center/Little Italy platform closed**. | Banner: "Rerouted because of UCSD Central Campus elevator out + County Center/Little Italy closed". Usual vs new: "Get off at ~~County Center/Little Italy~~ (closed) → Middletown". The explanation adds: "16 min shorter, **but rolls past 1 more construction zone**, which is why it wasn't recommended before." The card chips show the construction it now passes. |
| **2:15** How it works | "Five real data sources: MTS schedule and alerts, the City's curb-ramp survey, Get It Done reports, and USGS elevation. **Gemini turns messy alert text into structured closures.** The route itself comes from a deterministic router, so the AI never guesses a path. It reads the alerts and explains the change." | Optional: open **Route preferences** and click **Power chair** to show a higher slope limit. | |
| **2:40** Impact | "MTS's own data marks 470 stops as not wheelchair accessible, and 747 more as unknown. SafeRoute turns that, plus live alerts, City data and elevation, into routes a wheelchair user can trust. Next: riders confirm unverified sidewalks, send photo hazard reports straight to Get It Done, and get live arrival times." | Press `0` to reset for the next judge. | Back to the start state. |

---

## 3. Why SafeRoute recommends the slower route (talking points)

**Fastest** (2 h 40 min): off at Middletown, then rolls up to Balboa Park past **two** real MTS construction
closures, climbing **83 m more**.
**Fewer construction zones**, the recommended route (2 h 56 min): off at County Center/Little Italy,
passing **one**.

1. **A blocked curb can strand a wheelchair user.** A walker can step off a curb around construction, but a
   wheelchair needs a ramp. One torn-up curb cut can mean doubling back several blocks, which costs far more
   than 16 minutes.
2. **Hills cost energy, not just time.** For a manual chair, 83 m of extra climbing is real physical work
   (and battery range for a power chair). SafeRoute counts about 1 minute per 10 m climbed when it ranks
   routes.
3. **The data is real and current.** MTS says State & Kalmia is closed "due to construction on State
   Street", First & Laurel is closed until 12/31/2028, and USGS elevation puts Laurel St at 8.5%.
4. **The rider stays in control.** SafeRoute *recommends* (each construction zone counts as about 15 minutes
   of risk), but every option is one tap away. If she picks one herself, it keeps her choice when the trip is
   replanned.

---

## 4. Hotkeys (demo mode only)

Each alert key replays a **simulated** MTS alert. Gemini reads it, and the trip reroutes. They stack:
press several keys to combine outages.

| Key | Simulated alert | Effect on the demo trip |
|---|---|---|
| `1` | **UCSD Central Campus elevators out** | Board at VA Medical Center (+9 min) |
| `2` | **County Center/Little Italy platform closed** | Recommended route switches to Middletown, past more construction |
| `3` | **Santa Fe Depot platform closed** | The leg to the USS Midway changes |
| `4` | **VA Medical Center elevator out** | Press after `1`: board at UCSD Health La Jolla |
| `5` | Old Town elevator out | Big detour (≈ +77 min); shows the cost of losing a key station |
| `6` | Balboa Ave platform closed | No effect on this trip (the station isn't used) |
| `P` | Plan the trip | |
| `0` | Reset alerts (frontend and backend) without reloading. A page refresh does the same | |
| `D` | Show/hide the demo panel (lists these keys) | |
| `Esc` | Cancel picking a point on the map | |

Hotkeys are ignored while the cursor is in a text field. Click the map first.

---

## 5. Backup plan

- **Backend or Gemini is down.** `npm run demo` falls back to the built-in alert text automatically. The
  toast and reroute still happen; the only difference is that the text wasn't written live by Gemini.
- **No internet** (map tiles won't load). Play the backup video. Record it the first time you run through this
  script cleanly (QuickTime → New Screen Recording).
- **A hotkey doesn't respond.** The cursor is probably in a text field: click the map, then press the key
  again. Refreshing the page resets everything.

---

## 6. What's real and what's simulated (for Q&A; be upfront)

| Real | Simulated / simplified |
|---|---|
| Blue Line stations, stop IDs, coordinates and ride times (MTS GTFS) | **The elevator outage and station closure alerts** on hotkeys. MTS had no elevator outages on Nov 7; these are written in MTS's alert style. Gemini really does read them |
| Construction closures at State & Kalmia, First & Laurel and Washington & India (MTS alerts feed, `data/demo_alerts/live_feed_2026-11-07.txt`) | **Rolling paths are simplified** street-like lines, not real sidewalks. Problems are matched within ~100–300 m of them. The OSM sidewalk router is the backend's next step |
| 242 curb-ramp intersections (City of San Diego ADA layer) | Grades along a roll come from an ~80 m elevation grid, so they show climbs, not curb-level detail |
| 282 open Get It Done sidewalk reports near the route (City open data, as of Nov 7, 2026) | Time estimates: rolling at about 1 m/s, a 6-minute average trolley wait |
| Elevation and street grades (USGS 3DEP via AWS Terrain Tiles; the USGS API itself was timing out) | |
| Gemini reading each alert into a structured closure (`POST /alerts/ingest`) | |

Suggested line if asked: *"The closures, curb ramps, sidewalk reports and hills are all real San Diego data.
The elevator alerts are simulated, because MTS didn't post one today. When they do, it goes through exactly
the same Gemini pipeline."*

Rebuild the real data: `python3 frontend/scripts/build_demo_data.py <get_it_done_open.csv>` and
`python3 frontend/scripts/build_elevation_grid.py frontend/src/mock/real/elevation_grid.json`.

---

## 7. Reset between judges

**Refresh the page.** Everything goes back to the start.
