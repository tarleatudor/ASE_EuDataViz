// 1. THEME TOGGLE (Light / Dark)

const body = document.body;
const themeToggleBtn = document.getElementById("themeToggle");

const savedTheme = localStorage.getItem("theme") || "light";
setTheme(savedTheme);

//La apasarea pe buton, se schimba tema
themeToggleBtn.addEventListener("click", () => {
  let newTheme = "dark";
  if (body.dataset.theme === "dark") newTheme = "light";
  setTheme(newTheme);
});

//Functia care aplica tema si o salveaza
function setTheme(theme) {
  body.dataset.theme = theme;
  localStorage.setItem("theme", theme);
}

// 2. CONSTANTE SI STARE GLOBALA (date, selectii, elemente DOM)

// Lista tarilor UE
const EU_COUNTRIES = [
  "BE",
  "BG",
  "CZ",
  "DK",
  "DE",
  "EE",
  "IE",
  "EL",
  "ES",
  "FR",
  "HR",
  "IT",
  "CY",
  "LV",
  "LT",
  "LU",
  "HU",
  "MT",
  "NL",
  "AT",
  "PL",
  "PT",
  "RO",
  "SI",
  "SK",
  "FI",
  "SE",
];

//Obiectul principal unde sunt stocate datele
const data = {};

//Lista anilor disponibili
let years = [];

//Selectiile curente ale utilizatorului
let currentIndicator = "gdp";
let currentCountry = "RO";
let currentYear = null;

//Id pentru animatia bubble chart
let bubbleAnimationId = null;

//Referintele catre elementele din HTML
const indicatorSelect = document.getElementById("indicatorSelect");
const countrySelect = document.getElementById("countrySelect");
const yearSelect = document.getElementById("yearSelect");

const playButton = document.getElementById("playButton");
const pauseButton = document.getElementById("pauseButton");

const svgChart = document.getElementById("svgChart");
const svgTooltip = document.getElementById("svgTooltip");

const bubbleCanvas = document.getElementById("bubbleCanvas");
const tableElement = document.getElementById("dataTable");

//Pentru ca elementele SVG create din javaScript sa fie recunoscute corect de browser e nevoie de namespace-ul SVG
const SVG_NS = "http://www.w3.org/2000/svg";

// 3. INITIALIZARE

//Folosim DOMContentLoaded pentru a ne asigura ca toate elementele HTML sunt incarcate inainte de a le folosi
document.addEventListener("DOMContentLoaded", () => {
  initControls();
  loadAllData();
});

//Populeaza selecturile, seteaza valorile initiale
function initControls() {
  // Indicatori disponibili
  const indicatorLabels = {
    gdp: "PIB pe cap de locuitor",
    life: "Speranta de viata",
    pop: "Populatie",
  };

  //Populam selectul pentru indicatori
  indicatorSelect.innerHTML = "";
  for (const [key, label] of Object.entries(indicatorLabels)) {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = label;
    indicatorSelect.appendChild(option);
  }
  indicatorSelect.value = currentIndicator;

  //Populam selectul pentru tari (coduri UE)
  EU_COUNTRIES.forEach((code) => {
    const option = document.createElement("option");
    option.value = code;
    option.textContent = code;
    countrySelect.appendChild(option);
  });
  countrySelect.value = currentCountry;

  //Cand se schimba indicatorul, refacem toate vizualizarile
  indicatorSelect.addEventListener("change", () => {
    currentIndicator = indicatorSelect.value;
    drawSvgChart();
    drawBubbleChart();
    renderTable();
  });

  //Cand se schimba tara, refacem graficul SVG
  countrySelect.addEventListener("change", () => {
    currentCountry = countrySelect.value;
    drawSvgChart();
  });

  //Cand se schimba anul, refacem bubble chart si tabelul
  yearSelect.addEventListener("change", () => {
    currentYear = Number(yearSelect.value);
    drawBubbleChart();
    renderTable();
  });

  //Buton de play/pause pentru animatia bubble chart
  playButton.addEventListener("click", startBubbleAnimation);
  pauseButton.addEventListener("click", stopBubbleAnimation);
}

// 4. INCARCARE DATE DIN eurostat.json

//functie asincorna pentru incarcarea datelor
async function loadAllData() {
  try {
    //Incarcam fisierul eurostat.json
    const response = await fetch("media/eurostat.json");
    if (!response.ok) throw new Error("Nu pot citi media/eurostat.json");

    //Tranforma fisierul JSON intr-un array
    const rawArray = await response.json();

    buildDataFromLocalJson(rawArray);

    //Obtinem lista anilor disponibili, sortam si pastram doar ultimii 15 ani
    years = getAvailableYears();
    years.sort((a, b) => a - b);
    years = years.slice(-15);

    //Setam anul curent ca fiind ultimul an disponibil
    currentYear = years[years.length - 1];

    //Populam dropdownul cu ani
    populateYearSelect();

    //Desenam toate vizualizarile initiale
    drawSvgChart();
    drawBubbleChart();
    renderTable();
  } catch (err) {
    console.error("Eroare incarcare date:", err);
    alert("Nu pot incarca eurostat.json.");
  }
}

function buildDataFromLocalJson(rows) {
  rows.forEach((row) => {
    //Extragem valorile relevante din fiecare rand
    const country = row.tara;
    const year = Number(row.an);
    const value = row.valoare;

    //Ignoram tarile care nu sunt in UE, anii nevalizi sau valorile nule
    if (!EU_COUNTRIES.includes(country)) return;
    if (!Number.isFinite(year)) return;
    if (value == null) return;

    //Mapam indicatorii din fisier la cheile din obiectul nostru de date
    let key;
    if (row.indicator === "SV") key = "life";
    else if (row.indicator === "PIB") key = "gdp";
    else if (row.indicator === "POP") key = "pop";
    else return;

    //Construim structura
    if (!data[country]) data[country] = {};
    if (!data[country][year]) data[country][year] = {};

    //Adaugam valoarea
    data[country][year][key] = value;
  });
}

function getAvailableYears() {
  const set = new Set(); //Set pentru a evita duplicatele
  //Parcurgem toate tarile si anii pentru a colecta anii disponibili
  for (const country of Object.keys(data)) {
    for (const year of Object.keys(data[country])) {
      set.add(Number(year));
    }
  }
  // Returnam array-ul cu anii disponibili
  return Array.from(set);
}

function populateYearSelect() {
  //Populam dropdownul cu ani
  yearSelect.innerHTML = "";
  years.forEach((y) => {
    const opt = document.createElement("option");
    opt.value = y;
    opt.textContent = y;
    yearSelect.appendChild(opt);
  });
  yearSelect.value = currentYear;
}

// 5. SVG – GRAFIC EVOLUTIE

function drawSvgChart() {
  //Curatam graficul SVG
  while (svgChart.firstChild) svgChart.removeChild(svgChart.firstChild);

  //Dimensiunile SVG
  const width = 800;
  const height = 400;

  //Padding pentru axele graficului
  const padL = 60,
    padR = 20,
    padT = 20,
    padB = 40;

  //Adaugam axele
  // Axa X
  const xAxis = document.createElementNS(SVG_NS, "line");
  xAxis.setAttribute("x1", padL);
  xAxis.setAttribute("y1", height - padB);
  xAxis.setAttribute("x2", width - padR);
  xAxis.setAttribute("y2", height - padB);
  xAxis.setAttribute("stroke", "black");
  svgChart.appendChild(xAxis);

  // Axa Y
  const yAxis = document.createElementNS(SVG_NS, "line");
  yAxis.setAttribute("x1", padL);
  yAxis.setAttribute("y1", padT);
  yAxis.setAttribute("x2", padL);
  yAxis.setAttribute("y2", height - padB);
  yAxis.setAttribute("stroke", "black");
  svgChart.appendChild(yAxis);

  //Text pentru axe
  // Text axa X
  const xLabel = document.createElementNS(SVG_NS, "text");
  xLabel.setAttribute("x", width / 2);
  xLabel.setAttribute("y", height - 5);
  xLabel.setAttribute("text-anchor", "middle");
  xLabel.textContent = "Ani";
  svgChart.appendChild(xLabel);

  // Text axa Y
  const yLabel = document.createElementNS(SVG_NS, "text");
  yLabel.setAttribute("x", 15);
  yLabel.setAttribute("y", height / 2);
  yLabel.setAttribute("transform", `rotate(-90 15 ${height / 2})`);
  yLabel.setAttribute("text-anchor", "middle");
  yLabel.textContent =
    currentIndicator === "gdp"
      ? "PIB pe cap de locuitor"
      : currentIndicator === "life"
      ? "Speranta de viata"
      : "Populatie";
  svgChart.appendChild(yLabel);

  //Extragem toate datele pentru tara selectata
  const countryData = data[currentCountry];
  if (!countryData) return;

  //Parcurgerea anilor si extragem punctele pentru grafic
  //daca exista valoarea, cream un punct {year, value}, altfel null
  const points = years
    .map((y) =>
      countryData[y]?.[currentIndicator] != null
        ? { year: y, value: countryData[y][currentIndicator] }
        : null
    )
    .filter((x) => x !== null);

  //daca nu exista date nu desenam nimic
  if (!points.length) return;

  //Determinam valorile minime si maxime pentru scala y
  const minVal = Math.min(...points.map((p) => p.value));
  const maxVal = Math.max(...points.map((p) => p.value));

  //Calculam pasul pe axa x si scala pe axa y
  const xStep = (width - padL - padR) / (points.length - 1);
  const yScale = (height - padT - padB) / (maxVal - minVal || 1); // evitam impartirea la zero

  //Creez linia
  const poly = document.createElementNS(SVG_NS, "polyline");
  poly.setAttribute("fill", "none");
  poly.setAttribute("stroke", "steelblue");
  poly.setAttribute("stroke-width", "2");

  //X=pozitia anului
  //Y= valoarea scalata (inversata deoarece in SVG y creste in jos)
  poly.setAttribute(
    "points",
    points
      .map((p, i) => {
        const x = padL + i * xStep;
        const y = height - padB - (p.value - minVal) * yScale;
        return `${x},${y}`;
      })
      .join(" ")
  );

  //Linia apare pe ecran
  svgChart.appendChild(poly);

  //Creez cerculetele pentru fiecare punct
  points.forEach((p, i) => {
    const x = padL + i * xStep;
    const y = height - padB - (p.value - minVal) * yScale;

    const c = document.createElementNS(SVG_NS, "circle");
    c.setAttribute("cx", x);
    c.setAttribute("cy", y);
    c.setAttribute("r", 4);
    c.setAttribute("fill", "orange");
    c.style.cursor = "pointer";

    //Adaugam tooltip la fiecare cerculet
    c.addEventListener("mouseenter", (evt) => {
      const e = data[currentCountry][p.year];

      svgTooltip.innerHTML = `
        <strong>${currentCountry} - ${p.year}</strong><br>
        PIB/loc: ${e.gdp ?? "n/a"}<br>
        SV: ${e.life ?? "n/a"}<br>
        Pop: ${e.pop ?? "n/a"}
      `;

      //Pozitionam tooltip-ul langa mouse
      svgTooltip.style.left = evt.pageX + "px";
      svgTooltip.style.top = evt.pageY + "px";
      svgTooltip.hidden = false;
    });

    // Ascundem tooltip-ul cand mousele iese din cerculet
    c.addEventListener("mouseleave", () => (svgTooltip.hidden = true));

    svgChart.appendChild(c);
  });
}

// 6. BUBBLE CHART (CANVAS)
//Functia deseneaza un bubble chart pentru fiecare an, la un interval de 1 secunda
//unde pozitia bulei depinde de PIB si speranta de viata, iar marimea de populatie

function drawBubbleChart() {
  //Obtinem contextul 2D al canvas-ului si il curatam pentru a nu se surpapune desenele
  const ctx = bubbleCanvas.getContext("2d");
  ctx.clearRect(0, 0, bubbleCanvas.width, bubbleCanvas.height);

  //Setam spatii libere in jurul graficului
  const padL = 60,
    padR = 20,
    padT = 20,
    padB = 40;
  //Dimensiunea efectiva a canvasului
  const w = bubbleCanvas.width;
  const h = bubbleCanvas.height;

  //Axele
  // Axa X (PIB)
  ctx.beginPath();
  ctx.moveTo(padL, h - padB);
  ctx.lineTo(w - padR, h - padB);
  ctx.strokeStyle = "black";
  ctx.stroke();

  // Axa Y (Speranta de viata)
  ctx.beginPath();
  ctx.moveTo(padL, padT);
  ctx.lineTo(padL, h - padB);
  ctx.stroke();

  //Text pentru axe
  // Text axa X
  ctx.fillStyle = body.dataset.theme === "dark" ? "white" : "black";
  ctx.font = "12px Arial";
  ctx.textAlign = "center";
  ctx.fillText("PIB pe cap de locuitor", w / 2, h - 5);

  // Text axa Y
  ctx.save();
  ctx.translate(15, h / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center";
  ctx.fillText("Speranta de viata", 0, 0);
  ctx.restore();

  //daca nu exista an selectat nu desenam nimic
  if (!currentYear) return;

  //In acest array vom pune doar tarile care au toate cele 3 valori pentru anul curent
  const bubbles = [];

  //Parcurgem fiecare tara UE si extragem datele pentru anul curent
  EU_COUNTRIES.forEach((code) => {
    const entry = data[code]?.[currentYear];
    if (entry?.gdp != null && entry?.life != null && entry?.pop != null) {
      bubbles.push({
        country: code,
        gdp: entry.gdp,
        life: entry.life,
        pop: entry.pop,
      });
    }
  });
  //daca nu exista date nu desenam nimic
  if (!bubbles.length) return;

  //Determinam valorile minime si maxime pentru fiecare indicator
  //Pentru axa X (PIB)
  const minGdp = Math.min(...bubbles.map((b) => b.gdp));
  const maxGdp = Math.max(...bubbles.map((b) => b.gdp));

  //Pentru axa Y (Speranta de viata)
  const minLife = Math.min(...bubbles.map((b) => b.life));
  const maxLife = Math.max(...bubbles.map((b) => b.life));

  //Pentru marimea bulelor (Populatie)
  const minPop = Math.min(...bubbles.map((b) => b.pop));
  const maxPop = Math.max(...bubbles.map((b) => b.pop));

  //Functii de scalare a valorilor la dimensiunile canvas-ului
  function scaleX(val) {
    return padL + ((val - minGdp) * (w - padL - padR)) / (maxGdp - minGdp);
  }
  //Inversam scala pe Y deoarece in canvas y creste in jos
  function scaleY(val) {
    return (
      h - padB - ((val - minLife) * (h - padT - padB)) / (maxLife - minLife)
    );
  }
  //Functia care calculeaza raza bulei in functie de populatie (raza minima 5, maxima 25)
  function radius(pop) {
    return 5 + ((pop - minPop) * 20) / (maxPop - minPop);
  }

  //Desenam fiecare bula
  bubbles.forEach((b) => {
    //Calculam pozitia si raza bulei
    const x = scaleX(b.gdp);
    const y = scaleY(b.life);
    const r = radius(b.pop);

    //Umplere +contur
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = "lightblue";
    ctx.fill();
    ctx.strokeStyle = "navy";
    ctx.stroke();

    //Text cu codul tarii deasupra bulei
    //Culoarea depinde light/dark theme
    ctx.fillStyle = body.dataset.theme === "dark" ? "white" : "black";
    ctx.font = "10px Arial";
    ctx.textAlign = "center";
    ctx.fillText(b.country, x, y - r - 2);
  });
}

// 7. ANIMATIE BUBBLE CHART

//Verifica daca animatia este deja pornita
function startBubbleAnimation() {
  if (bubbleAnimationId !== null) return;

  //Gasim indexul anului curent in lista de ani
  let i = years.indexOf(currentYear);
  //Daca anul nu e gasit, porneste de la primu
  if (i === -1) i = 0;

  //Setam un interval care schimba anul curent si redeseneaza bubble chart si tabelul la 1 secunda
  bubbleAnimationId = setInterval(() => {
    currentYear = years[i];
    //Actualizam selectul de ani
    yearSelect.value = currentYear;
    drawBubbleChart();
    renderTable();

    //Trecem la urmatorul an (cu revenire la inceput)
    //amimatie ciclica, nu se opreste niciodata
    i = (i + 1) % years.length;
  }, 1000); //1000 ms = 1 secunda
}

//Functie pentru oprirea animatiei
function stopBubbleAnimation() {
  clearInterval(bubbleAnimationId);
  bubbleAnimationId = null;
}

// 8. Tabel Colorat

//Functia care construieste tabelul colorat in functie de anul curent
function renderTable() {
  //Curatam tabelul, evitand dublarea randurilro
  const thead = tableElement.querySelector("thead");
  const tbody = tableElement.querySelector("tbody");
  thead.innerHTML = "";
  tbody.innerHTML = "";

  //daca nu exista an selectat nu desenam nimic
  if (!currentYear) return;

  //Construim header-ul tabelului
  //Antetul este creat din JS , nu hardocdat in HTML
  const header = document.createElement("tr");
  ["Tara", "PIB/locuitor", "Speranta de viata", "Populatie"].forEach((text) => {
    const th = document.createElement("th");
    th.textContent = text;
    header.appendChild(th);
  });
  thead.appendChild(header);

  //Colectam valorile pentru fiecare indicator pentru a calcula min/max
  const valuesGdp = [];
  const valuesLife = [];
  const valuesPop = [];

  //Parcurgem tarile UE si extragem valorile pentru anul curent
  EU_COUNTRIES.forEach((code) => {
    const e = data[code]?.[currentYear];
    if (!e) return;
    if (e.gdp) valuesGdp.push(e.gdp);
    if (e.life) valuesLife.push(e.life);
    if (e.pop) valuesPop.push(e.pop);
  });

  //Calculam valorile minime si maxime pentru PIB

  const minGdp = Math.min(...valuesGdp);
  const maxGdp = Math.max(...valuesGdp);

  //Calculam valorile minime si maxime pentru Speranta de viata
  const minLife = Math.min(...valuesLife);
  const maxLife = Math.max(...valuesLife);

  //Calculam valorile minime si maxime pentru Populatie
  const minPop = Math.min(...valuesPop);
  const maxPop = Math.max(...valuesPop);

  //Functia care returneaza o culoare intre rosu (min) si verde (max) pe baza valori
  function color(v, min, max) {
    const t = (v - min) / (max - min);
    const r = Math.round(255 * (1 - t));
    const g = Math.round(255 * t);
    return `rgb(${r},${g},0)`;
  }

  //Parcurgem tarile UE si construim randurile tabelului
  EU_COUNTRIES.forEach((code) => {
    const e = data[code]?.[currentYear];
    if (!e) return;

    const tr = document.createElement("tr");

    //Coloana cu codul tarii
    const c1 = document.createElement("td");
    c1.textContent = code;
    tr.appendChild(c1);

    //Coloana PIB
    const c2 = document.createElement("td");
    c2.textContent = e.gdp ?? "n/a";
    if (e.gdp) c2.style.backgroundColor = color(e.gdp, minGdp, maxGdp);
    tr.appendChild(c2);

    //Coloana Speranta de viata
    const c3 = document.createElement("td");
    c3.textContent = e.life ?? "n/a";
    if (e.life) c3.style.backgroundColor = color(e.life, minLife, maxLife);
    tr.appendChild(c3);

    //Coloana Populatie
    const c4 = document.createElement("td");
    c4.textContent = e.pop ?? "n/a";
    if (e.pop) c4.style.backgroundColor = color(e.pop, minPop, maxPop);
    tr.appendChild(c4);

    //Adaugam randul in corpul tabelului
    tbody.appendChild(tr);
  });
}
