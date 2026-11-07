const data = window.MTS_DATA;
const stops = new Map(data.stops.map(stop => [stop.id, stop]));
const stopsByName = new Map();
data.stops.forEach(stop => {
  const key = stop.name.toLowerCase();
  if (!stopsByName.has(key)) stopsByName.set(key, []);
  stopsByName.get(key).push(stop);
});
const fromInput = document.querySelector("#fromInput");
const toInput = document.querySelector("#toInput");
const options = document.querySelector("#stopOptions");
const resultBox = document.querySelector("#routeResults");
const resultCount = document.querySelector("#resultCount");
const toast = document.querySelector("#toast");
const alertBanner = document.querySelector("#alertBanner");
const alertSummary = document.querySelector("#alertSummary");
const alertDetails = document.querySelector("#alertDetails");
const alertsUrl = "https://mna.mecatran.com/utw/ws/gtfsfeed/alerts/sdmts?apiKey=78161d20210d221e242d3f62056b1e764469525a&asText=true";
let liveAlerts = [];
let currentBannerAlert = null;
let routeMap = null;
let mapLayers = [];

// Keep the datalist useful without rendering duplicate stop names thousands of times.
const visibleStops = [...stopsByName.values()].map(group => group[0]).sort((a, b) => a.name.localeCompare(b.name));
options.innerHTML = visibleStops.map(stop => `<option value="${escapeHtml(stop.name)}"></option>`).join("");

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
}
function findStop(value) {
  return stopsByName.get(value.trim().toLowerCase())?.[0];
}
function findStops(value) {
  return stopsByName.get(value.trim().toLowerCase()) || [];
}
function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 3200);
}
function parseGtfsAlerts(text) {
  const timestamp = Number(text.match(/timestamp:\s*"(\d+)"/)?.[1] || 0);
  return [...text.matchAll(/entity\s*\{([\s\S]*?)(?=\nentity\s*\{|$)/g)].flatMap(match => {
    const body = match[1];
    if (!body.includes("alert {")) return [];
    const read = field => body.match(new RegExp(`${field}:\\s*"([^"]*)"`))?.[1] || "";
    const readTranslation = field => body.match(new RegExp(`${field}_text\\s*\\{[\\s\\S]*?text:\\s*"([^"]*)"`))?.[1] || "";
    const stopIds = [...body.matchAll(/stop_id:\s*"([^"]+)"/g)].map(item => item[1]);
    const routeIds = [...body.matchAll(/route_id:\s*"([^"]+)"/g)].map(item => item[1]);
    const start = Number(body.match(/active_period\s*\{[\s\S]*?start:\s*(\d+)/)?.[1] || 0);
    const end = Number(body.match(/active_period\s*\{[\s\S]*?end:\s*(\d+)/)?.[1] || 0);
    const now = Math.floor(Date.now() / 1000);
    if ((start && now < start) || (end && now > end)) return [];
    return [{
      id: body.match(/id:\s*"([^"]+)"/)?.[1] || "",
      stopIds,
      routeIds,
      effect: read("effect"),
      cause: read("cause"),
      title: readTranslation("header"),
      description: readTranslation("description"),
      url: body.match(/url\s*\{[\s\S]*?text:\s*"([^"]+)"/)?.[1] || "",
      feedTimestamp: timestamp
    }];
  });
}
function relevantAlert(alert) {
  const text = `${alert.effect} ${alert.title} ${alert.description}`.toLowerCase();
  return ["accessibility_issue", "no_service", "stop_moved", "modified_service", "reduced_service", "elevator", "lift", "wheelchair", "accessible", "closure", "closed", "out of service"].some(term => text.includes(term));
}
function alertAffectsRoute(alert, route, routeStops) {
  return alert.routeIds.includes(route.id) || alert.stopIds.some(stopId => routeStops.includes(stopId));
}
function alertMessage(alert) {
  return (alert.description || alert.title || "MTS reported a service change affecting this trip.")
    .replace(/\\r?\\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function updateAlertBanner() {
  const relevant = liveAlerts.filter(relevantAlert);
  if (!relevant.length) {
    currentBannerAlert = null;
    alertBanner.classList.remove("alert-error");
    alertBanner.querySelector(".alert-icon").textContent = "✓";
    alertBanner.querySelector("strong").textContent = "Live MTS accessibility status";
    alertSummary.textContent = "No active accessibility alerts are affecting the loaded MTS stops.";
    alertDetails.hidden = true;
    return;
  }
  const first = relevant[0];
  currentBannerAlert = first;
  alertBanner.querySelector("strong").textContent = "Live accessibility alert";
  alertBanner.querySelector(".alert-icon").textContent = "!";
  alertSummary.textContent = alertMessage(first);
  alertDetails.hidden = false;
}
async function loadLiveAlerts() {
  try {
    const response = await fetch(alertsUrl, { cache: "no-store" });
    if (!response.ok) throw new Error(`MTS alert feed returned ${response.status}`);
    liveAlerts = parseGtfsAlerts(await response.text());
    updateAlertBanner();
    if (fromInput.value && toInput.value) {
      const from = findStop(fromInput.value);
      const to = findStop(toInput.value);
      if (from && to) renderRoutes(routeOptions(from.name, to.name), from, to);
    }
  } catch (error) {
    currentBannerAlert = null;
    alertBanner.classList.add("alert-error");
    alertBanner.querySelector(".alert-icon").textContent = "!";
    alertBanner.querySelector("strong").textContent = "MTS live feed unavailable";
    alertSummary.textContent = "The live MTS feed is unavailable. Showing routes without real-time rerouting.";
    alertDetails.hidden = true;
    console.error("Unable to load MTS GTFS-Realtime alerts:", error);
  }
}
function updateHint(input, hint) {
  const stop = findStop(input.value);
  hint.textContent = stop ? "✓ Confirmed wheelchair boarding" : "";
}
function setupStopPicker(input, suggestions) {
  const renderSuggestions = () => {
    const query = input.value.trim().toLowerCase();
    const matches = visibleStops.filter(stop => stop.name.toLowerCase().includes(query)).slice(0, 8);
    suggestions.innerHTML = matches.map(stop => `<button type="button" role="option" data-stop="${escapeHtml(stop.name)}">${escapeHtml(stop.name)}<small>✓ Accessible boarding</small></button>`).join("");
    suggestions.classList.toggle("open", matches.length > 0);
    suggestions.querySelectorAll("button").forEach(button => button.addEventListener("click", () => {
      input.value = button.dataset.stop;
      input.dispatchEvent(new Event("input"));
      suggestions.classList.remove("open");
    }));
  };
  input.addEventListener("focus", renderSuggestions);
  input.addEventListener("click", renderSuggestions);
  input.addEventListener("input", renderSuggestions);
  input.addEventListener("keydown", event => {
    if (event.key === "Escape") suggestions.classList.remove("open");
  });
  document.addEventListener("click", event => {
    if (!input.parentElement.contains(event.target)) suggestions.classList.remove("open");
  });
}
fromInput.addEventListener("input", () => updateHint(fromInput, document.querySelector("#fromHint")));
toInput.addEventListener("input", () => updateHint(toInput, document.querySelector("#toHint")));
setupStopPicker(fromInput, document.querySelector("#fromSuggestions"));
setupStopPicker(toInput, document.querySelector("#toSuggestions"));

document.querySelector("#swapButton").addEventListener("click", () => {
  [fromInput.value, toInput.value] = [toInput.value, fromInput.value];
  fromInput.dispatchEvent(new Event("input"));
  toInput.dispatchEvent(new Event("input"));
});

function routeOptions(fromName, toName) {
  const selectedFrom = findStops(fromName);
  const selectedTo = findStops(toName);
  const distanceMeters = (first, second) => Math.hypot(
    (first.lat - second.lat) * 111000,
    (first.lon - second.lon) * 93000
  );
  const nearbyStops = selected => new Map(data.stops
    .map(stop => [stop.id, Math.min(...selected.map(origin => distanceMeters(origin, stop)))])
    .filter(([, distance]) => distance <= 800));
  const fromCandidates = nearbyStops(selectedFrom);
  const toCandidates = nearbyStops(selectedTo);
  const fromIds = new Set(fromCandidates.keys());
  const toIds = new Set(toCandidates.keys());
  const patterns = data.routes.flatMap(route => route.patterns.map(stops => ({ route, stops })));
  const patternsByStation = new Map();
  patterns.forEach(pattern => pattern.stops.forEach(stopId => {
    const stationName = stops.get(stopId)?.name;
    if (!stationName) return;
    if (!patternsByStation.has(stationName)) patternsByStation.set(stationName, []);
    if (!patternsByStation.get(stationName).includes(pattern)) patternsByStation.get(stationName).push(pattern);
  }));
  const sameStation = (firstId, secondId) => {
    if (firstId === secondId) return true;
    const first = stops.get(firstId);
    const second = stops.get(secondId);
    if (!first || !second) return false;
    if (first.parent && first.parent === second.parent) return true;
    // GTFS feeds may represent the accessible platforms of one bus center
    // as separate stop IDs without assigning a shared parent station.
    return first.name === second.name;
  };
  const journeys = [];
  const maxLegs = 3;
  const search = (current, startIndex, legs, usedRoutes) => {
    const destinationIndex = current.stops.findIndex((stopId, index) =>
      index > startIndex && toIds.has(stopId));
    if (destinationIndex >= 0) {
      journeys.push({ legs: [...legs, {
        route: current.route,
        stops: current.stops.slice(startIndex, destinationIndex + 1)
      }], walkingMeters: (fromCandidates.get(legs[0]?.stops[0] || current.stops[startIndex]) || 0) +
        (toCandidates.get(current.stops[destinationIndex]) || 0) });
    }
    if (legs.length + 1 >= maxLegs) return;

    current.stops.slice(startIndex + 1).forEach((transferId, transferOffset) => {
      const transferName = stops.get(transferId)?.name;
      (patternsByStation.get(transferName) || []).forEach(next => {
        if (usedRoutes.has(next.route.id)) return;
        const nextStart = next.stops.findIndex(nextId => sameStation(transferId, nextId));
        if (nextStart < 0) return;
        search(
          next,
          nextStart,
          [...legs, {
            route: current.route,
            stops: current.stops.slice(startIndex, startIndex + transferOffset + 2)
          }],
          new Set([...usedRoutes, next.route.id])
        );
      });
    });
  };

  patterns.forEach(pattern => pattern.stops.forEach((stopId, startIndex) => {
    if (fromIds.has(stopId)) search(pattern, startIndex, [], new Set([pattern.route.id]));
  }));

  return journeys
    .sort((a, b) => a.legs.length - b.legs.length || journeyStopCount(a) - journeyStopCount(b))
    .filter((journey, index, all) => index === all.findIndex(other =>
      other.legs.map(leg => `${leg.route.id}:${leg.stops[0]}-${leg.stops.at(-1)}`).join(">") ===
      journey.legs.map(leg => `${leg.route.id}:${leg.stops[0]}-${leg.stops.at(-1)}`).join(">")));
}
function journeyStopCount(journey) {
  return journey.legs.reduce((count, leg) => count + leg.stops.length - 1, 0);
}
function clearMap() {
  mapLayers.forEach(layer => layer.remove());
  mapLayers = [];
}
function renderMap(journey, from, to) {
  if (!window.L) return;
  const mapElement = document.querySelector("#routeMap");
  if (!routeMap) {
    routeMap = L.map(mapElement, { scrollWheelZoom: false });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(routeMap);
  }
  clearMap();
  const bounds = [];
  const colors = journey.legs.map(leg => leg.route.color || "#668000");
  journey.legs.forEach((leg, legIndex) => {
    const points = leg.stops.map(stopId => {
      const stop = stops.get(stopId);
      return [stop.lat, stop.lon];
    });
    points.forEach(point => bounds.push(point));
    const line = L.polyline(points, {
      color: colors[legIndex],
      weight: 6,
      opacity: 0.88,
      lineCap: "round",
      lineJoin: "round"
    }).addTo(routeMap);
    line.bindTooltip(`Route ${leg.route.shortName}`, { sticky: true });
    mapLayers.push(line);
  });
  journey.legs.forEach((leg, legIndex) => {
    const start = stops.get(leg.stops[0]);
    const end = stops.get(leg.stops.at(-1));
    const marker = L.circleMarker([start.lat, start.lon], {
      radius: legIndex === 0 ? 8 : 7,
      color: "#fff",
      weight: 3,
      fillColor: legIndex === 0 ? "#668000" : colors[legIndex],
      fillOpacity: 1
    }).bindPopup(`<strong>${legIndex === 0 ? "Board" : "Transfer"}: ${escapeHtml(start.name)}</strong><br>Route ${escapeHtml(leg.route.shortName)}`);
    marker.addTo(routeMap);
    mapLayers.push(marker);
    if (legIndex === journey.legs.length - 1) {
      const destination = L.circleMarker([end.lat, end.lon], {
        radius: 8, color: "#fff", weight: 3, fillColor: "#203b4b", fillOpacity: 1
      }).bindPopup(`<strong>Exit: ${escapeHtml(to.name)}</strong><br>Accessible stop geometry`);
      destination.addTo(routeMap);
      mapLayers.push(destination);
    }
  });
  if (bounds.length) routeMap.fitBounds(bounds, { padding: [28, 28] });
  window.setTimeout(() => routeMap.invalidateSize(), 0);
}
function renderRoutes(routes, from, to) {
  resultCount.textContent = `${routes.length} accessible ${routes.length === 1 ? "option" : "options"}`;
  if (!routes.length) {
    clearMap();
    document.querySelector(".map-panel").classList.remove("visible");
    resultBox.innerHTML = `<div class="empty"><strong>No accessible journey found.</strong><br>Try a nearby accessible stop. We searched direct trips and journeys with up to two transfers in the loaded MTS network.</div>`;
    return;
  }
  const availableRoutes = routes.filter(journey => !journey.legs.some(leg =>
    liveAlerts.some(alert => relevantAlert(alert) && alertAffectsRoute(alert, leg.route, leg.stops))));
  const displayRoutes = availableRoutes.length ? availableRoutes : routes;
  document.querySelector(".map-panel").classList.add("visible");
  resultCount.textContent = `${displayRoutes.length} accessible ${displayRoutes.length === 1 ? "option" : "options"}`;
  const visibleRoutes = displayRoutes.slice(0, 3);
  resultBox.innerHTML = visibleRoutes.map((option, index) => {
    const routesForJourney = option.legs.map(leg => leg.route);
    const affectedAlert = liveAlerts.find(alert => relevantAlert(alert) && option.legs.some(leg =>
      alertAffectsRoute(alert, leg.route, leg.stops)));
    const alternative = affectedAlert ? `Reroute: ${alertMessage(affectedAlert)}` : "Wheelchair boarding confirmed";
    const routeLabels = routesForJourney.map(route =>
      `<span class="route-badge" style="background:${route.color}">${escapeHtml(route.shortName)}</span>`).join('<span class="transfer-arrow">→</span>');
    const walkingDescription = option.walkingMeters >= 20
      ? ` · walk about ${Math.round(option.walkingMeters)} m total`
      : "";
    const journeyDescription = option.legs.length === 1
      ? `${journeyStopCount(option)} stop${journeyStopCount(option) === 1 ? "" : "s"} · direct ride`
      : `${option.legs.length - 1} transfer${option.legs.length > 2 ? "s" : ""} · ${journeyStopCount(option)} stops`;
    return `<article class="route-card ${index === 0 ? "recommended" : ""}" data-index="${index}">
      ${index === 0 ? '<span class="recommend">BEST MATCH</span>' : ""}
      <div class="route-label">${routeLabels}<span>${routesForJourney.map(route => `Route ${escapeHtml(route.shortName)}`).join(" + ")}</span></div>
      <h3>${escapeHtml(from.name)} → ${escapeHtml(to.name)}</h3>
      <p class="direction">${routesForJourney.map(route => escapeHtml(route.longName)).join(" · ")}</p>
      <div class="route-line"></div>
      <p class="route-detail"><span class="check">✓</span> ${journeyDescription}${walkingDescription}</p>
      <p class="route-detail"><span class="check">✓</span> ${alternative}</p>
      <button class="route-action" data-route="${escapeHtml(routesForJourney.map(route => route.shortName).join(" + "))}" data-alert-id="${escapeHtml(affectedAlert?.id || "")}">${affectedAlert ? "See live alert" : "View step-by-step trip"} <span>→</span></button>
    </article>`;
  }).join("");
  renderMap(visibleRoutes[0], from, to);
  resultBox.querySelectorAll(".route-card").forEach((card, index) => {
    card.addEventListener("click", event => {
      if (event.target.closest(".route-action")) return;
      resultBox.querySelectorAll(".route-card").forEach(item => item.classList.remove("selected"));
      card.classList.add("selected");
      renderMap(visibleRoutes[index], from, to);
    });
  });
  resultBox.querySelector(".route-card")?.classList.add("selected");
  resultBox.querySelectorAll(".route-action").forEach(button => button.addEventListener("click", () => {
    const selectedIndex = Number(button.closest(".route-card").dataset.index);
    resultBox.querySelectorAll(".route-card").forEach(item => item.classList.remove("selected"));
    button.closest(".route-card").classList.add("selected");
    renderMap(visibleRoutes[selectedIndex], from, to);
    const alert = liveAlerts.find(item => item.id === button.dataset.alertId);
    showToast(alert ? alertMessage(alert) : `Route ${button.dataset.route} is wheelchair-accessible from boarding to exit.`);
  }));
}

document.querySelector("#plannerForm").addEventListener("submit", event => {
  event.preventDefault();
  const from = findStop(fromInput.value);
  const to = findStop(toInput.value);
  if (!from || !to) {
    showToast("Choose an accessible stop from the suggestions.");
    return;
  }
  if (from.id === to.id) {
    showToast("Choose two different stops.");
    return;
  }
  renderRoutes(routeOptions(from.name, to.name), from, to);
  document.querySelector("#results").scrollIntoView({ behavior: "smooth", block: "start" });
});

alertDetails.addEventListener("click", () => {
  if (currentBannerAlert) showToast(alertMessage(currentBannerAlert));
});
document.querySelector("#reportLink").addEventListener("click", () => showToast("Photo reporting is next: add a blocked sidewalk photo and Wayfinder will draft the report."));

const demoPattern = data.routes[0]?.patterns[0] || [];
const demoFrom = stops.get(demoPattern[0]);
const demoTo = stops.get(demoPattern[Math.min(4, demoPattern.length - 1)]);
if (demoFrom && demoTo) {
  fromInput.value = demoFrom.name;
  toInput.value = demoTo.name;
  fromInput.dispatchEvent(new Event("input"));
  toInput.dispatchEvent(new Event("input"));
  document.querySelectorAll(".stop-suggestions").forEach(suggestions => suggestions.classList.remove("open"));
  renderRoutes(routeOptions(demoFrom.name, demoTo.name), demoFrom, demoTo);
}
loadLiveAlerts();
window.setInterval(loadLiveAlerts, 60 * 1000);
