// ====================================================
// 1. THEME TOGGLE (Light / Dark)
// ====================================================

const body = document.body;
const themeToggleBtn = document.getElementById("themeToggle");

const savedTheme = localStorage.getItem("theme") || "light";
setTheme(savedTheme);

themeToggleBtn.addEventListener("click", () => {
  const newTheme = body.dataset.theme === "dark" ? "light" : "dark";
  setTheme(newTheme);
});

function setTheme(theme) {
  body.dataset.theme = theme;
  localStorage.setItem("theme", theme);
}



// ====================================================
// 2. CONSTANTE ȘI STARE GLOBALĂ (date, selecții, elemente DOM)
// ====================================================

const EU_COUNTRIES = [
  "BE","BG","CZ","DK","DE","EE","IE","EL","ES","FR","HR",
  "IT","CY","LV","LT","LU","HU","MT","NL","AT","PL","PT",
  "RO","SI","SK","FI","SE"
];

const data = {};

let years = [];

let currentIndicator = "gdp";
let currentCountry = "RO";
let currentYear = null;

let bubbleAnimationId = null;

const indicatorSelect = document.getElementById("indicatorSelect");
const countrySelect   = document.getElementById("countrySelect");
const yearSelect      = document.getElementById("yearSelect");

const playButton  = document.getElementById("playButton");
const pauseButton = document.getElementById("pauseButton");

const svgChart   = document.getElementById("svgChart");
const svgTooltip = document.getElementById("svgTooltip");

const bubbleCanvas = document.getElementById("bubbleCanvas");
const tableElement = document.getElementById("dataTable");

const SVG_NS = "http://www.w3.org/2000/svg";



// ====================================================
// 3. INITIALIZARE
// ====================================================

document.addEventListener("DOMContentLoaded", () => {
  initControls();
  loadAllData();
});

function initControls() {

  // Indicatori disponibili
  const indicatorLabels = {
    gdp: "PIB pe cap de locuitor",
    life: "Speranță de viață",
    pop: "Populație"
  };

  indicatorSelect.innerHTML = "";
  for (const [key, label] of Object.entries(indicatorLabels)) {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = label;
    indicatorSelect.appendChild(option);
  }
  indicatorSelect.value = currentIndicator;

  EU_COUNTRIES.forEach(code => {
    const option = document.createElement("option");
    option.value = code;
    option.textContent = code;
    countrySelect.appendChild(option);
  });
  countrySelect.value = currentCountry;

  indicatorSelect.addEventListener("change", () => {
    currentIndicator = indicatorSelect.value;
    drawSvgChart();
    drawBubbleChart();
    renderTable();
  });

  countrySelect.addEventListener("change", () => {
    currentCountry = countrySelect.value;
    drawSvgChart();
  });

  yearSelect.addEventListener("change", () => {
    currentYear = Number(yearSelect.value);
    drawBubbleChart();
    renderTable();
  });

  playButton.addEventListener("click", startBubbleAnimation);
  pauseButton.addEventListener("click", stopBubbleAnimation);
}



// ====================================================
// 4. ÎNCĂRCARE DATE DIN eurostat.json
// ====================================================

async function loadAllData() {
  try {
    const response = await fetch("media/eurostat.json");
    if (!response.ok) throw new Error("Nu pot citi media/eurostat.json");

    const rawArray = await response.json();

    buildDataFromLocalJson(rawArray);

    years = getAvailableYears();
    years.sort((a, b) => a - b);

    currentYear = years[years.length - 1];

    populateYearSelect();

    drawSvgChart();
    drawBubbleChart();
    renderTable();

  } catch (err) {
    console.error("Eroare încărcare date:", err);
    alert("Nu pot încărca eurostat.json.");
  }
}

function buildDataFromLocalJson(rows) {
  rows.forEach(row => {
    const country = row.tara;
    const year = Number(row.an);
    const value = row.valoare;

    if (!EU_COUNTRIES.includes(country)) return;
    if (!Number.isFinite(year)) return;
    if (value == null) return;

    let key;
    if (row.indicator === "SV") key = "life";
    else if (row.indicator === "PIB") key = "gdp";
    else if (row.indicator === "POP") key = "pop";
    else return;

    if (!data[country]) data[country] = {};
    if (!data[country][year]) data[country][year] = {};

    data[country][year][key] = value;
  });
}

function getAvailableYears() {
  const set = new Set();
  for (const country of Object.keys(data)) {
    for (const year of Object.keys(data[country])) {
      set.add(Number(year));
    }
  }
  return Array.from(set);
}

function populateYearSelect() {
  yearSelect.innerHTML = "";
  years.forEach(y => {
    const opt = document.createElement("option");
    opt.value = y;
    opt.textContent = y;
    yearSelect.appendChild(opt);
  });
  yearSelect.value = currentYear;
}



// ====================================================
// 5. SVG – GRAFIC EVOLUȚIE
// ====================================================

function drawSvgChart() {
  while (svgChart.firstChild) svgChart.removeChild(svgChart.firstChild);

  const countryData = data[currentCountry];
  if (!countryData) return;

  const points = years
    .map(y => countryData[y]?.[currentIndicator] != null ?
      { year: y, value: countryData[y][currentIndicator] } : null)
    .filter(x => x !== null);

  if (!points.length) return;

  const width = 800;
  const height = 400;

  const padL = 60, padR = 20, padT = 20, padB = 40;

  const minVal = Math.min(...points.map(p => p.value));
  const maxVal = Math.max(...points.map(p => p.value));

  const xStep = (width - padL - padR) / (points.length - 1);
  const yScale = (height - padT - padB) / (maxVal - minVal || 1);

  const poly = document.createElementNS(SVG_NS, "polyline");
  poly.setAttribute("fill", "none");
  poly.setAttribute("stroke", "steelblue");
  poly.setAttribute("stroke-width", "2");

  poly.setAttribute("points", points.map((p, i) => {
    const x = padL + i * xStep;
    const y = height - padB - (p.value - minVal) * yScale;
    return `${x},${y}`;
  }).join(" "));

  svgChart.appendChild(poly);

  points.forEach((p, i) => {
    const x = padL + i * xStep;
    const y = height - padB - (p.value - minVal) * yScale;

    const c = document.createElementNS(SVG_NS, "circle");
    c.setAttribute("cx", x);
    c.setAttribute("cy", y);
    c.setAttribute("r", 4);
    c.setAttribute("fill", "orange");
    c.style.cursor = "pointer";

    c.addEventListener("mouseenter", evt => {
      const e = data[currentCountry][p.year];

      svgTooltip.innerHTML = `
        <strong>${currentCountry} – ${p.year}</strong><br>
        PIB/loc: ${e.gdp ?? "n/a"}<br>
        SV: ${e.life ?? "n/a"}<br>
        Pop: ${e.pop ?? "n/a"}
      `;

      svgTooltip.style.left = evt.pageX + "px";
      svgTooltip.style.top  = evt.pageY + "px";
      svgTooltip.hidden = false;
    });

    c.addEventListener("mouseleave", () => svgTooltip.hidden = true);

    svgChart.appendChild(c);
  });
}



// ====================================================
// 6. BUBBLE CHART (CANVAS)
// ====================================================

function drawBubbleChart() {
  const ctx = bubbleCanvas.getContext("2d");
  ctx.clearRect(0, 0, bubbleCanvas.width, bubbleCanvas.height);

  if (!currentYear) return;

  const bubbles = [];

  EU_COUNTRIES.forEach(code => {
    const entry = data[code]?.[currentYear];
    if (entry?.gdp != null && entry?.life != null && entry?.pop != null) {
      bubbles.push({
        country: code,
        gdp: entry.gdp,
        life: entry.life,
        pop: entry.pop
      });
    }
  });

  if (!bubbles.length) return;

  const minGdp = Math.min(...bubbles.map(b => b.gdp));
  const maxGdp = Math.max(...bubbles.map(b => b.gdp));

  const minLife = Math.min(...bubbles.map(b => b.life));
  const maxLife = Math.max(...bubbles.map(b => b.life));

  const minPop = Math.min(...bubbles.map(b => b.pop));
  const maxPop = Math.max(...bubbles.map(b => b.pop));

  const padL = 60, padR = 20, padT = 20, padB = 40;
  const w = bubbleCanvas.width;
  const h = bubbleCanvas.height;

  function scaleX(val) {
    return padL + (val - minGdp) * (w - padL - padR) / (maxGdp - minGdp);
  }
  function scaleY(val) {
    return h - padB - (val - minLife) * (h - padT - padB) / (maxLife - minLife);
  }
  function radius(pop) {
    return 5 + (pop - minPop) * 20 / (maxPop - minPop);
  }

  bubbles.forEach(b => {
    const x = scaleX(b.gdp);
    const y = scaleY(b.life);
    const r = radius(b.pop);

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = "lightblue";
    ctx.fill();
    ctx.strokeStyle = "navy";
    ctx.stroke();

    ctx.fillStyle = body.dataset.theme === "dark" ? "white" : "black";
    ctx.font = "10px Arial";
    ctx.textAlign = "center";
    ctx.fillText(b.country, x, y - r - 2);
  });
}



// ====================================================
// 7. ANIMAȚIE BUBBLE CHART
// ====================================================

function startBubbleAnimation() {
  if (bubbleAnimationId !== null) return;

  let i = years.indexOf(currentYear);
  if (i === -1) i = 0;

  bubbleAnimationId = setInterval(() => {
    currentYear = years[i];
    yearSelect.value = currentYear;
    drawBubbleChart();
    renderTable();

    i = (i + 1) % years.length;
  }, 1000);
}

function stopBubbleAnimation() {
  clearInterval(bubbleAnimationId);
  bubbleAnimationId = null;
}



// ====================================================
// 8. TABEL COLORAT ROȘU → VERDE
// ====================================================

function renderTable() {
  const thead = tableElement.querySelector("thead");
  const tbody = tableElement.querySelector("tbody");
  thead.innerHTML = "";
  tbody.innerHTML = "";

  if (!currentYear) return;

  const header = document.createElement("tr");
  ["Țara", "PIB/locuitor", "Speranță de viață", "Populație"].forEach(text => {
    const th = document.createElement("th");
    th.textContent = text;
    header.appendChild(th);
  });
  thead.appendChild(header);

  const valuesGdp = [];
  const valuesLife = [];
  const valuesPop = [];

  EU_COUNTRIES.forEach(code => {
    const e = data[code]?.[currentYear];
    if (!e) return;
    if (e.gdp) valuesGdp.push(e.gdp);
    if (e.life) valuesLife.push(e.life);
    if (e.pop) valuesPop.push(e.pop);
  });

  const minGdp = Math.min(...valuesGdp);
  const maxGdp = Math.max(...valuesGdp);

  const minLife = Math.min(...valuesLife);
  const maxLife = Math.max(...valuesLife);

  const minPop = Math.min(...valuesPop);
  const maxPop = Math.max(...valuesPop);

  function color(v, min, max) {
    const t = (v - min) / (max - min);
    const r = Math.round(255 * (1 - t));
    const g = Math.round(255 * t);
    return `rgb(${r},${g},0)`;
  }

  EU_COUNTRIES.forEach(code => {
    const e = data[code]?.[currentYear];
    if (!e) return;

    const tr = document.createElement("tr");

    const c1 = document.createElement("td");
    c1.textContent = code;
    tr.appendChild(c1);

    const c2 = document.createElement("td");
    c2.textContent = e.gdp ?? "n/a";
    if (e.gdp) c2.style.backgroundColor = color(e.gdp, minGdp, maxGdp);
    tr.appendChild(c2);

    const c3 = document.createElement("td");
    c3.textContent = e.life ?? "n/a";
    if (e.life) c3.style.backgroundColor = color(e.life, minLife, maxLife);
    tr.appendChild(c3);

    const c4 = document.createElement("td");
    c4.textContent = e.pop ?? "n/a";
    if (e.pop) c4.style.backgroundColor = color(e.pop, minPop, maxPop);
    tr.appendChild(c4);

    tbody.appendChild(tr);
  });
}
