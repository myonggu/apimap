const places = {
  origin: null,
  destination: null
};

const lastSearch = {
  origin: "",
  destination: ""
};

let lastNominatimRequestAt = 0;
let nominatimQueue = Promise.resolve();
let isRouting = false;

const routeButton = document.querySelector("#route-button");
const routeResult = document.querySelector("#route-result");
const routeError = document.querySelector("#route-error");

document.querySelectorAll("[data-search]").forEach((button) => {
  button.addEventListener("click", () => searchField(button.dataset.search));
});

document.querySelectorAll(".place-field input").forEach((input) => {
  input.addEventListener("input", () => {
    const field = input.closest(".place-field").dataset.field;
    if (places[field] && input.value.trim() !== places[field].name) {
      places[field] = null;
      document.querySelector(`#${field}-selected`).hidden = true;
      document.querySelector(`#${field}-results`).replaceChildren();
      updateRouteButton();
      hideRouteResult();
    }
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      searchField(input.closest(".place-field").dataset.field);
    }
  });
});

routeButton.addEventListener("click", calculateRoute);

function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function searchNominatim(query) {
  const request = nominatimQueue.then(async () => {
    const elapsed = Date.now() - lastNominatimRequestAt;
    if (elapsed < 1000) {
      await wait(1000 - elapsed);
    }

    lastNominatimRequestAt = Date.now();
    const params = new URLSearchParams({
      q: query,
      format: "jsonv2",
      addressdetails: "1",
      limit: "5"
    });
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { Accept: "application/json" }
    });

    if (!response.ok) {
      throw new Error("장소 검색 서비스에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.");
    }
    return response.json();
  });

  nominatimQueue = request.catch(() => {});
  return request;
}

async function searchField(field) {
  const input = document.querySelector(`#${field}-input`);
  const button = document.querySelector(`[data-search="${field}"]`);
  const help = document.querySelector(`#${field}-help`);
  const results = document.querySelector(`#${field}-results`);
  const selected = document.querySelector(`#${field}-selected`);
  const query = input.value.trim();

  if (!query) {
    showFieldMessage(help, "장소 이름을 입력해 주세요.", true);
    input.focus();
    return;
  }
  if (lastSearch[field] === query && results.childElementCount > 0) {
    return;
  }

  lastSearch[field] = query;
  places[field] = null;
  selected.hidden = true;
  selected.replaceChildren();
  results.replaceChildren();
  button.disabled = true;
  button.textContent = "검색 중";
  showFieldMessage(help, "실제 장소를 찾고 있어요.", false);
  updateRouteButton();
  hideRouteResult();

  try {
    const matches = await searchNominatim(query);
    if (input.value.trim() !== query) {
      return;
    }
    if (!matches.length) {
      showFieldMessage(help, "장소를 찾지 못했어요. 다른 이름으로 검색해 주세요.", true);
      return;
    }
    showFieldMessage(help, "목록에서 정확한 장소를 선택해 주세요.", false);
    matches.forEach((place) => results.append(createPlaceOption(place, field)));
  } catch (error) {
    showFieldMessage(help, error.message, true);
  } finally {
    button.disabled = false;
    button.textContent = "검색";
  }
}

function createPlaceOption(place, field) {
  const option = document.createElement("button");
  option.className = "place-option";
  option.type = "button";
  const name = document.createElement("strong");
  name.textContent = place.name || place.display_name.split(",")[0];
  const address = document.createElement("span");
  address.textContent = place.display_name;
  option.append(name, address);
  option.addEventListener("click", () => selectPlace(place, field));
  return option;
}

function selectPlace(place, field) {
  const input = document.querySelector(`#${field}-input`);
  const help = document.querySelector(`#${field}-help`);
  const results = document.querySelector(`#${field}-results`);
  const selected = document.querySelector(`#${field}-selected`);
  const name = place.name || place.display_name.split(",")[0];

  places[field] = {
    name,
    address: place.display_name,
    lat: Number(place.lat),
    lon: Number(place.lon)
  };
  input.value = name;
  results.replaceChildren();

  const details = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = name;
  const address = document.createElement("span");
  address.textContent = place.display_name;
  details.append(title, address);

  const clear = document.createElement("button");
  clear.className = "clear-selection";
  clear.type = "button";
  clear.textContent = "변경";
  clear.setAttribute("aria-label", `${field === "origin" ? "출발지" : "도착지"} 선택 변경`);
  clear.addEventListener("click", () => {
    places[field] = null;
    selected.hidden = true;
    input.focus();
    showFieldMessage(help, "장소 이름을 입력하고 검색해 주세요.", false);
    updateRouteButton();
    hideRouteResult();
  });

  selected.replaceChildren(details, clear);
  selected.hidden = false;
  showFieldMessage(help, "검색 결과에서 장소를 선택했어요.", false);
  updateRouteButton();
  hideRouteResult();
}

function showFieldMessage(element, message, isError) {
  element.textContent = message;
  element.classList.toggle("error", isError);
}

function updateRouteButton() {
  routeButton.disabled = isRouting || !(places.origin && places.destination);
}

async function calculateRoute() {
  if (!places.origin || !places.destination) {
    return;
  }

  isRouting = true;
  routeButton.disabled = true;
  routeButton.classList.add("is-loading");
  document.querySelector("#route-button-label").textContent = "경로 찾는 중";
  hideRouteResult();

  try {
    const start = places.origin;
    const end = places.destination;
    const coordinates = `${start.lon},${start.lat};${end.lon},${end.lat}`;
    const response = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=false&steps=false`
    );
    if (!response.ok) {
      throw new Error("경로 서비스에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.");
    }

    const data = await response.json();
    if (data.code !== "Ok" || !data.routes || !data.routes.length) {
      throw new Error("두 장소 사이의 자동차 경로를 찾지 못했어요.");
    }

    if (places.origin !== start || places.destination !== end) {
      return;
    }

    renderRoute(start, end, data.routes[0]);
  } catch (error) {
    showRouteError(error.message);
  } finally {
    isRouting = false;
    updateRouteButton();
    routeButton.classList.remove("is-loading");
    document.querySelector("#route-button-label").textContent = "경로와 거리 확인하기";
  }
}

function renderRoute(start, end, route) {
  document.querySelector("#route-distance").textContent = formatDistance(route.distance);
  document.querySelector("#route-duration").textContent = formatDuration(route.duration);

  const routeSummary = document.querySelector("#result-route");
  const origin = document.createElement("span");
  origin.textContent = start.name;
  const arrow = document.createElement("span");
  arrow.className = "route-arrow";
  arrow.textContent = "→";
  arrow.setAttribute("aria-hidden", "true");
  const destination = document.createElement("span");
  destination.textContent = end.name;
  routeSummary.replaceChildren(origin, arrow, destination);

  const params = new URLSearchParams({
    engine: "fossgis_osrm_car",
    route: `${start.lat},${start.lon};${end.lat},${end.lon}`
  });
  document.querySelector("#map-link").href = `https://www.openstreetmap.org/directions?${params}`;
  routeResult.hidden = false;
  routeResult.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function formatDistance(meters) {
  return (meters / 1000).toLocaleString("ko-KR", {
    minimumFractionDigits: meters < 10000 ? 1 : 0,
    maximumFractionDigits: 1
  });
}

function formatDuration(seconds) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours === 0) {
    return `약 ${minutes}분`;
  }
  if (remainingMinutes === 0) {
    return `약 ${hours}시간`;
  }
  return `약 ${hours}시간 ${remainingMinutes}분`;
}

function showRouteError(message) {
  routeError.textContent = message;
  routeError.hidden = false;
}

function hideRouteResult() {
  routeResult.hidden = true;
  routeError.hidden = true;
}
