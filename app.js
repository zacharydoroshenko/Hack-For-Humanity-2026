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
function updateHint(input, hint) {
  const stop = findStop(input.value);
  hint.textContent = stop ? "✓ Confirmed wheelchair boarding" : "";
}
fromInput.addEventListener("input", () => updateHint(fromInput, document.querySelector("#fromHint")));
toInput.addEventListener("input", () => updateHint(toInput, document.querySelector("#toHint")));

document.querySelector("#swapButton").addEventListener("click", () => {
  [fromInput.value, toInput.value] = [toInput.value, fromInput.value];
  fromInput.dispatchEvent(new Event("input"));
  toInput.dispatchEvent(new Event("input"));
});

function routeOptions(fromName, toName) {
  const fromIds = new Set(findStops(fromName).map(stop => stop.id));
  const toIds = new Set(findStops(toName).map(stop => stop.id));
  return data.routes.flatMap(route => route.patterns.flatMap(pattern => {
    const start = pattern.findIndex(id => fromIds.has(id));
    const end = pattern.findIndex((id, index) => toIds.has(id) && index > start);
    if (start < 0 || end <= start) return [];
    return [{ route, stops: pattern.slice(start, end + 1) }];
  })).sort((a, b) => a.stops.length - b.stops.length).filter((option, index, all) =>
    index === all.findIndex(other => other.route.id === option.route.id));
}
function renderRoutes(routes, from, to) {
  resultCount.textContent = `${routes.length} accessible ${routes.length === 1 ? "option" : "options"}`;
  if (!routes.length) {
    resultBox.innerHTML = `<div class="empty"><strong>No direct accessible trip found.</strong><br>Try a nearby stop, or add a transfer-aware planner when the curb-ramp and live-alert datasets are connected.</div>`;
    return;
  }
  resultBox.innerHTML = routes.slice(0, 3).map((option, index) => {
    const { route } = option;
    const isOutage = option.stops.some(id => id === "groS" || id === "grotro");
    const alternative = isOutage ? "Elevator outage: use Route 3 at Euclid" : "Wheelchair boarding confirmed";
    return `<article class="route-card ${index === 0 ? "recommended" : ""}">
      ${index === 0 ? '<span class="recommend">BEST MATCH</span>' : ""}
      <div class="route-label"><span class="route-badge" style="background:${route.color}">${escapeHtml(route.shortName)}</span><span>Route ${escapeHtml(route.shortName)}</span></div>
      <h3>${escapeHtml(from.name)} → ${escapeHtml(to.name)}</h3>
      <p class="direction">${escapeHtml(route.longName)}</p>
      <div class="route-line"></div>
      <p class="route-detail"><span class="check">✓</span> ${option.stops.length - 1} stop${option.stops.length === 2 ? "" : "s"} · direct ride</p>
      <p class="route-detail"><span class="check">✓</span> ${alternative}</p>
      <button class="route-action" data-route="${escapeHtml(route.shortName)}">${isOutage ? "See reroute guidance" : "View step-by-step trip"} <span>→</span></button>
    </article>`;
  }).join("");
  resultBox.querySelectorAll(".route-action").forEach(button => button.addEventListener("click", () => {
    showToast(button.textContent.includes("reroute") ? "Grossmont elevator is out. Take Route 3 from Euclid Transit Center." : `Route ${button.dataset.route} is wheelchair-accessible from boarding to exit.`);
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

document.querySelector("#alertDetails").addEventListener("click", () => showToast("Grossmont elevator is out. Take Route 3 from Euclid Transit Center."));
document.querySelector("#reportLink").addEventListener("click", () => showToast("Photo reporting is next: add a blocked sidewalk photo and Wayfinder will draft the report."));

const demoPattern = data.routes[0]?.patterns[0] || [];
const demoFrom = stops.get(demoPattern[0]);
const demoTo = stops.get(demoPattern[Math.min(4, demoPattern.length - 1)]);
if (demoFrom && demoTo) {
  fromInput.value = demoFrom.name;
  toInput.value = demoTo.name;
  fromInput.dispatchEvent(new Event("input"));
  toInput.dispatchEvent(new Event("input"));
  renderRoutes(routeOptions(demoFrom.name, demoTo.name), demoFrom, demoTo);
}
