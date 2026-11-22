// Mikroliike – vaiheet 1 ja 2
// Kaikki tiedot tallennetaan selaimen localStorageen yhtenä kokonaisuutena.

const STORAGE_KEY = "mikroliike-data-v1";
const DEFAULT_STEP_GOAL = 42000;
const GYM_GOAL = 2;

const HABITS = [
  { id: "vitamins", name: "Vitamiinit otettu", short: "Vitamiinit" },
  { id: "hypervibe", name: "Hypervibe 10 min", short: "Hypervibe" },
  { id: "mobility", name: "Liikkuvuus", short: "Liikkuvuus" },
  { id: "meditation", name: "Meditaatio", short: "Meditaatio" },
];

const X_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

const DAY_NAMES = ["ma", "ti", "ke", "to", "pe", "la", "su"];

/* ---------- Tallennus ---------- */

function emptyData() {
  return {
    checks: {},    // { "2026-11-22": { vitamins: "08:15", ... } }
    steps: {},     // { "2026-11-22": 8400 }
    gym: [],       // [ { date: "2026-11-22", time: "17:30" } ]
    weekGoals: {}, // { "2026-11-16": 42000 }  (avain = viikon maanantai)
    notes: {},     // { "2026-11-22": "hyvä energia" }
  };
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyData();
    return Object.assign(emptyData(), JSON.parse(raw));
  } catch (e) {
    return emptyData();
  }
}

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    alert("Tallennus ei onnistunut tässä selaimessa.");
  }
}

let data = loadData();

/* ---------- Päivämääräapurit ---------- */

function dateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function mondayOf(d) {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const offset = (m.getDay() + 6) % 7; // ma = 0 ... su = 6
  m.setDate(m.getDate() - offset);
  return m;
}

function weekDays(d) {
  const mon = mondayOf(d);
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(mon);
    x.setDate(mon.getDate() + i);
    return x;
  });
}

function isoWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t - yearStart) / 86400000 + 1) / 7);
}

function nowTime() {
  const n = new Date();
  return `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
}

function fmtTime(hhmm) {
  // "08:15" -> "8.15"
  const [h, m] = hhmm.split(":");
  return `${Number(h)}.${m}`;
}

function fmt(n) {
  return Math.round(n).toLocaleString("fi-FI");
}

function addDays(d, n) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
}

function parseKey(k) {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function shortDate(d) {
  return `${d.getDate()}.${d.getMonth() + 1}.`;
}

// Käyttäjän kirjoittama teksti näytetään turvallisesti (ei tulkita HTML:ksi)
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ---------- Viikon tiedot ---------- */

function currentWeekGoal() {
  const key = dateKey(mondayOf(new Date()));
  return data.weekGoals[key] ?? latestGoal();
}

function latestGoal() {
  const keys = Object.keys(data.weekGoals).sort();
  return keys.length ? data.weekGoals[keys[keys.length - 1]] : DEFAULT_STEP_GOAL;
}

function weekStepStats() {
  const today = new Date();
  const todayKey = dateKey(today);
  const days = weekDays(today).map(dateKey);
  const logged = days.filter((k) => data.steps[k] !== undefined);
  const total = logged.reduce((sum, k) => sum + data.steps[k], 0);
  const avg = logged.length ? total / logged.length : 0;

  // Jäljellä olevat päivät: tämä päivä (jos ei vielä kirjattu) + tulevat päivät
  const todayIndex = days.indexOf(todayKey);
  let remainingDays = 6 - todayIndex;
  if (data.steps[todayKey] === undefined) remainingDays += 1;

  return { total, avg, loggedCount: logged.length, remainingDays };
}

function weekGymCount() {
  const days = weekDays(new Date()).map(dateKey);
  return data.gym.filter((g) => days.includes(g.date)).length;
}

// Viikon oma tavoite. Jos viikolle ei asetettu tavoitetta, käytetään
// viimeisintä sitä ennen asetettua (tai oletusta 42 000).
function goalForWeek(monKey) {
  if (data.weekGoals[monKey] !== undefined) return data.weekGoals[monKey];
  const earlier = Object.keys(data.weekGoals).filter((k) => k < monKey).sort();
  return earlier.length ? data.weekGoals[earlier[earlier.length - 1]] : DEFAULT_STEP_GOAL;
}

// Yhden viikon yhteenveto (mon = viikon maanantai)
function weekSummary(mon) {
  const days = weekDays(mon).map(dateKey);
  const stepDays = days.filter((k) => data.steps[k] !== undefined);
  const habits = {};
  for (const h of HABITS) habits[h.id] = days.filter((k) => data.checks[k]?.[h.id]).length;
  return {
    steps: stepDays.reduce((s, k) => s + data.steps[k], 0),
    stepDays: stepDays.length,
    gym: data.gym.filter((g) => days.includes(g.date)).length,
    habits,
    goal: goalForWeek(dateKey(mon)),
  };
}

function summaryBadges(s) {
  const stepsDone = s.steps >= s.goal;
  const gymDone = s.gym >= GYM_GOAL;
  const badges = [
    `<span class="badge${stepsDone ? " done" : ""}">Askeleet ${fmt(s.steps)}/${fmt(s.goal)}${stepsDone ? " ✓" : ""}</span>`,
    `<span class="badge${gymDone ? " done" : ""}">Sali ${s.gym}/${GYM_GOAL}${gymDone ? " ✓" : ""}</span>`,
  ];
  for (const h of HABITS) {
    const n = s.habits[h.id];
    badges.push(`<span class="badge${n >= 7 ? " done" : ""}">${h.short} ${n}/7${n >= 7 ? " ✓" : ""}</span>`);
  }
  return `<div class="badges">${badges.join("")}</div>`;
}

// Aikaisin päivä, jolle on jotain kirjattu (historian alku)
function earliestDataKey() {
  const keys = [
    ...Object.keys(data.checks),
    ...Object.keys(data.steps),
    ...Object.keys(data.notes),
    ...Object.keys(data.weekGoals),
    ...data.gym.map((g) => g.date),
  ];
  return keys.length ? keys.sort()[0] : null;
}

/* ---------- Piirtäminen ---------- */

function render() {
  renderHeader();
  renderSteps();
  renderHabits();
  renderGym();
  renderNote();
  if (!document.getElementById("view-history").hidden) renderHistory();
}

function renderNote() {
  const input = document.getElementById("note-input");
  if (document.activeElement !== input) input.value = data.notes[dateKey(new Date())] || "";
}

function renderHeader() {
  const now = new Date();
  const weekdays = ["Sunnuntai", "Maanantai", "Tiistai", "Keskiviikko", "Torstai", "Perjantai", "Lauantai"];
  document.getElementById("date-line").textContent =
    `${weekdays[now.getDay()]} ${now.getDate()}.${now.getMonth() + 1}. · viikko ${isoWeek(now)}`;

  const h = now.getHours();
  const greeting = h < 10 ? "Hyvää huomenta" : h < 18 ? "Hyvää päivää" : "Hyvää iltaa";
  document.getElementById("greeting").textContent = greeting;
}

function renderSteps() {
  const goal = currentWeekGoal();
  const { total, avg, loggedCount, remainingDays } = weekStepStats();
  const ratio = goal > 0 ? total / goal : 0;
  const done = total >= goal;

  // Rengas: ensimmäinen kierros vaaleammalla, ylitys tummemmalla
  const circumference = 2 * Math.PI * 84;
  const fg = document.getElementById("ring-fg");
  const over = document.getElementById("ring-over");
  fg.style.strokeDasharray = circumference;
  over.style.strokeDasharray = circumference;
  fg.style.strokeDashoffset = circumference * (1 - Math.min(ratio, 1));
  const overRatio = Math.min(Math.max(ratio - 1, 0), 1);
  over.style.strokeDashoffset = circumference * (1 - overRatio);
  fg.style.opacity = total > 0 ? 1 : 0;
  over.style.opacity = overRatio > 0 ? 1 : 0;

  document.getElementById("ring-total").textContent = fmt(total);
  const goalEl = document.getElementById("ring-goal");
  goalEl.textContent = `/ ${fmt(goal)}${done ? " ✓" : ""}`;
  goalEl.classList.toggle("done", done);

  document.getElementById("steps-avg").textContent =
    loggedCount ? `ka. ${fmt(avg)} / pv` : "Kirjaa ensimmäiset askeleet, niin näet keskiarvon";

  const needEl = document.getElementById("steps-need");
  needEl.classList.toggle("done", done);
  if (done) {
    needEl.textContent = "Viikon tavoite täynnä – hienoa!";
  } else if (remainingDays <= 0) {
    needEl.textContent = "Hyvä viikko takana";
  } else if (total === 0) {
    needEl.textContent = "Uusi viikko, uudet askeleet";
  } else {
    const perDay = Math.ceil((goal - total) / remainingDays / 100) * 100;
    needEl.textContent = `tarvitset ${fmt(perDay)} / pv loppuviikon`;
  }

  const todayLogged = data.steps[dateKey(new Date())] !== undefined;
  document.getElementById("log-steps-btn").textContent =
    todayLogged ? "Korjaa päivän askeleet" : "Kirjaa päivän askeleet";
}

function renderHabits() {
  const today = new Date();
  const todayKey = dateKey(today);
  const days = weekDays(today);
  const list = document.getElementById("habits");
  list.innerHTML = "";

  for (const habit of HABITS) {
    const time = data.checks[todayKey]?.[habit.id];
    const li = document.createElement("li");
    li.className = "habit";

    const dots = days.map((d, i) => {
      const k = dateKey(d);
      const filled = !!data.checks[k]?.[habit.id];
      const classes = ["dot"];
      if (filled) classes.push("filled");
      else if (k > todayKey) classes.push("future");
      if (k === todayKey) classes.push("today");
      return `<button class="dot-btn${k === todayKey ? " is-today" : ""}" data-day="${k}" ${k > todayKey ? "disabled" : ""}
                aria-label="${habit.name}, ${DAY_NAMES[i]}${filled ? " – tehty" : ""}">
                <span class="${classes.join(" ")}"></span>
                <span class="dot-label">${DAY_NAMES[i]}</span>
              </button>`;
    }).join("");

    li.innerHTML = `
      <button class="check ${time ? "done" : ""}" aria-pressed="${!!time}"
              aria-label="${habit.name}${time ? " – tehty, paina peruaksesi" : ""}">
        <svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
      </button>
      <div class="habit-body">
        <div class="habit-name-row">
          <span class="habit-name">${habit.name}</span>
          ${time ? `<span class="habit-time">✓${time !== "-" ? ` klo ${fmtTime(time)}` : ""}</span>` : ""}
        </div>
        <div class="dots">${dots}</div>
      </div>`;

    li.querySelector(".check").addEventListener("click", () => toggleHabit(habit.id));
    // Pisteestä painamalla voi kuitata tai perua viikon aiemman päivän
    li.querySelectorAll(".dot-btn:not([disabled])").forEach((b) => {
      b.addEventListener("click", () => toggleHabit(habit.id, b.dataset.day));
    });
    list.appendChild(li);
  }
}

function renderGym() {
  const count = weekGymCount();
  const done = count >= GYM_GOAL;
  const countEl = document.getElementById("gym-count");
  countEl.textContent = `${count} / ${GYM_GOAL}${done ? " ✓" : ""}`;
  countEl.classList.toggle("done", done);

  const bars = document.getElementById("gym-bars");
  bars.innerHTML = "";
  for (let i = 0; i < GYM_GOAL; i++) {
    const b = document.createElement("div");
    b.className = "gym-bar" + (i < count ? " filled" : "");
    bars.appendChild(b);
  }
}

/* ---------- Toiminnot ---------- */

function toggleHabit(id, key = dateKey(new Date())) {
  const isToday = key === dateKey(new Date());
  data.checks[key] = data.checks[key] || {};
  if (data.checks[key][id]) {
    delete data.checks[key][id];
  } else {
    // Jälkikäteen kuitatulle päivälle ei tallenneta kellonaikaa ("-")
    data.checks[key][id] = isToday ? nowTime() : "-";
  }
  saveData();
  renderHabits();
}

function logGym() {
  data.gym.push({ date: dateKey(new Date()), time: nowTime() });
  saveData();
  renderGym();
}

/* ---------- Alhaalta nouseva paneeli ---------- */

const sheet = document.getElementById("sheet");
const backdrop = document.getElementById("sheet-backdrop");
const sheetContent = document.getElementById("sheet-content");
let sheetDismissable = true;

function openSheet(html, dismissable = true) {
  sheetContent.innerHTML = html;
  sheetDismissable = dismissable;
  sheet.hidden = false;
  backdrop.hidden = false;
}

function closeSheet() {
  sheet.hidden = true;
  backdrop.hidden = true;
}

backdrop.addEventListener("click", () => { if (sheetDismissable) closeSheet(); });

// Viikon tavoite: kysytään uuden viikon alussa, ja sitä voi muuttaa renkaasta
// Viikkokatsaus: viime viikon tulokset + neljän viime viikon askelkeskiarvo
function weekReviewHtml() {
  const thisMon = mondayOf(new Date());
  const first = earliestDataKey();
  if (!first || first >= dateKey(thisMon)) return ""; // ei aiempia tietoja

  const last = weekSummary(addDays(thisMon, -7));
  const recent = [1, 2, 3, 4]
    .map((n) => weekSummary(addDays(thisMon, -7 * n)))
    .filter((s) => s.stepDays > 0);
  const avgLine = recent.length
    ? `<p class="muted review-note">${recent.length === 4 ? "Neljän" : recent.length === 1 ? "Viime" : `${recent.length}`} viime viikon keskiarvo: <strong>${fmt(recent.reduce((s, w) => s + w.steps, 0) / recent.length)}</strong> askelta / vko</p>`
    : "";
  const cheer = last.steps >= last.goal ? "Askeltavoite täyttyi – hienoa!" : "Hyvä pohja tälle viikolle.";

  return `
    <div class="review">
      <h3>Viime viikko · ${cheer}</h3>
      ${summaryBadges(last)}
      ${avgLine}
    </div>`;
}

function openGoalSheet(isNewWeek) {
  let goal = currentWeekGoal();
  openSheet(`
    <h2>${isNewWeek ? "Tämän viikon askeltavoite?" : "Muuta viikon askeltavoite"}</h2>
    ${isNewWeek ? weekReviewHtml() : ""}
    <p>${isNewWeek ? "Valmiina on edellinen tavoite. Voit hyväksyä sen tai muuttaa sitä." : "Tavoite koskee kuluvaa viikkoa."}</p>
    <div class="stepper">
      <button class="btn btn-outline" id="goal-minus" aria-label="Vähennä 1000">−</button>
      <input class="big-input" id="goal-input" inputmode="numeric" value="${fmt(goal)}" aria-label="Askeltavoite">
      <button class="btn btn-outline" id="goal-plus" aria-label="Lisää 1000">+</button>
    </div>
    <div class="sheet-actions">
      <button class="btn btn-primary" id="goal-save">${isNewWeek ? "Aloita viikko" : "Tallenna"}</button>
      ${isNewWeek ? "" : '<button class="btn btn-outline" id="goal-cancel">Peruuta</button>'}
    </div>
  `, !isNewWeek);

  const input = document.getElementById("goal-input");
  const readInput = () => parseInt(input.value.replace(/\D/g, ""), 10) || 0;
  const setGoal = (v) => { goal = Math.max(1000, v); input.value = fmt(goal); };

  document.getElementById("goal-minus").onclick = () => setGoal(readInput() - 1000);
  document.getElementById("goal-plus").onclick = () => setGoal(readInput() + 1000);
  document.getElementById("goal-save").onclick = () => {
    const v = readInput();
    if (v < 1000) { input.focus(); return; }
    data.weekGoals[dateKey(mondayOf(new Date()))] = v;
    saveData();
    closeSheet();
    renderSteps();
  };
  const cancel = document.getElementById("goal-cancel");
  if (cancel) cancel.onclick = closeSheet;
}

// Askelten kirjaus: oletuksena tänään, mutta viikon aiempia päiviä voi korjata
function openStepsSheet() {
  const today = new Date();
  const todayKey = dateKey(today);
  const days = weekDays(today);
  let selected = todayKey;

  const chips = days.map((d, i) => {
    const k = dateKey(d);
    return `<button class="day-chip" data-day="${k}" ${k > todayKey ? "disabled" : ""}>${DAY_NAMES[i]}</button>`;
  }).join("");

  openSheet(`
    <h2>Päivän askeleet</h2>
    <p>Kirjoita askelmäärä Samsung Healthista. Uusi luku korvaa aiemman.</p>
    <div class="day-picker">${chips}</div>
    <div class="stepper">
      <input class="big-input" id="steps-input" inputmode="numeric" placeholder="esim. 6 500" aria-label="Askeleet">
    </div>
    <div class="sheet-actions">
      <button class="btn btn-primary" id="steps-save">Tallenna</button>
      <button class="btn btn-outline" id="steps-cancel">Peruuta</button>
      <button class="btn-text" id="steps-delete" hidden>Poista tämän päivän askelkirjaus</button>
    </div>
  `);

  const input = document.getElementById("steps-input");
  const chipEls = sheetContent.querySelectorAll(".day-chip");
  const delBtn = document.getElementById("steps-delete");

  function selectDay(k) {
    selected = k;
    chipEls.forEach((c) => c.classList.toggle("selected", c.dataset.day === k));
    input.value = data.steps[k] !== undefined ? fmt(data.steps[k]) : "";
    delBtn.hidden = data.steps[k] === undefined;
  }
  delBtn.onclick = () => {
    delete data.steps[selected];
    saveData();
    closeSheet();
    renderSteps();
  };
  chipEls.forEach((c) => c.addEventListener("click", () => selectDay(c.dataset.day)));
  selectDay(todayKey);
  setTimeout(() => input.focus(), 50);

  const save = () => {
    const digits = input.value.replace(/\D/g, "");
    if (digits === "") { input.focus(); return; }
    data.steps[selected] = parseInt(digits, 10);
    saveData();
    closeSheet();
    renderSteps();
  };
  document.getElementById("steps-save").onclick = save;
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") save(); });
  document.getElementById("steps-cancel").onclick = closeSheet;
}

// Salitreenin korjaus: poista vahinkokirjaus tai lisää unohtunut kerta
function openGymSheet() {
  const today = new Date();
  const todayKey = dateKey(today);
  const days = weekDays(today);
  const dayKeys = days.map(dateKey);
  let selected = todayKey;

  // Viikon kirjaukset aikajärjestyksessä; muistetaan alkuperäinen paikka listassa
  const entries = data.gym
    .map((g, index) => ({ ...g, index }))
    .filter((g) => dayKeys.includes(g.date))
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  const entryHtml = entries.length
    ? entries.map((g) => {
        const d = days[dayKeys.indexOf(g.date)];
        const label = `${DAY_NAMES[dayKeys.indexOf(g.date)]} ${d.getDate()}.${d.getMonth() + 1}.`;
        return `<li class="entry">
          <span class="entry-text">${label}<small>${g.time !== "-" ? `klo ${fmtTime(g.time)}` : "lisätty jälkikäteen"}</small></span>
          <button class="btn btn-outline" data-index="${g.index}">Poista</button>
        </li>`;
      }).join("")
    : `<li class="entry"><span class="muted">Tällä viikolla ei vielä kirjauksia.</span></li>`;

  const chips = days.map((d, i) => {
    const k = dateKey(d);
    return `<button class="day-chip" data-day="${k}" ${k > todayKey ? "disabled" : ""}>${DAY_NAMES[i]}</button>`;
  }).join("");

  openSheet(`
    <h2>Salitreenit tällä viikolla</h2>
    <ul class="entry-list">${entryHtml}</ul>
    <h3>Lisää unohtunut kerta</h3>
    <div class="day-picker">${chips}</div>
    <div class="sheet-actions">
      <button class="btn btn-primary" id="gym-add">Lisää kerta</button>
      <button class="btn btn-outline" id="gym-close">Valmis</button>
    </div>
  `);

  sheetContent.querySelectorAll(".entry .btn").forEach((b) => {
    b.addEventListener("click", () => {
      data.gym.splice(Number(b.dataset.index), 1);
      saveData();
      renderGym();
      openGymSheet(); // päivitä lista
    });
  });

  const chipEls = sheetContent.querySelectorAll(".day-chip");
  const selectDay = (k) => {
    selected = k;
    chipEls.forEach((c) => c.classList.toggle("selected", c.dataset.day === k));
  };
  chipEls.forEach((c) => c.addEventListener("click", () => selectDay(c.dataset.day)));
  selectDay(todayKey);

  document.getElementById("gym-add").onclick = () => {
    data.gym.push({ date: selected, time: selected === todayKey ? nowTime() : "-" });
    saveData();
    renderGym();
    openGymSheet();
  };
  document.getElementById("gym-close").onclick = closeSheet;
}

/* ---------- Päivän muistiinpano ---------- */

document.getElementById("note-input").addEventListener("input", (e) => {
  const key = dateKey(new Date());
  const text = e.target.value.trim();
  if (text) data.notes[key] = text;
  else delete data.notes[key];
  saveData();
});

/* ---------- Historia ---------- */

// Yhden päivän kirjaukset aikajärjestyksessä
function dayEvents(k) {
  const events = [];
  for (const h of HABITS) {
    const t = data.checks[k]?.[h.id];
    if (t) events.push({ time: t, label: h.short, kind: "habit", id: h.id });
  }
  data.gym.forEach((g, index) => {
    if (g.date === k) events.push({ time: g.time, label: "Salitreeni", kind: "gym", index });
  });
  // Jälkikäteen kirjatut ("-") päivän loppuun
  return events.sort((a, b) => (a.time === "-" ? "99" : a.time).localeCompare(b.time === "-" ? "99" : b.time));
}

function renderHistory() {
  const list = document.getElementById("history-list");
  const today = new Date();
  const todayKey = dateKey(today);
  const thisMon = mondayOf(today);
  const first = earliestDataKey();

  if (!first) {
    list.innerHTML = `<section class="card"><p class="muted">Historia täyttyy, kun alat kirjata. Jokainen viikko näkyy täällä omana rivinään.</p></section>`;
    return;
  }

  // Muistetaan, mitkä viikot olivat auki
  const openWeeks = new Set([...list.querySelectorAll("details[open]")].map((d) => d.dataset.week));
  const firstRender = !list.querySelector("details");

  let html = "";
  for (let mon = thisMon; dateKey(mon) >= dateKey(mondayOf(parseKey(first))); mon = addDays(mon, -7)) {
    const monKey = dateKey(mon);
    const isCurrent = monKey === dateKey(thisMon);
    const s = weekSummary(mon);
    const isOpen = firstRender ? isCurrent : openWeeks.has(monKey);

    let days = "";
    weekDays(mon).forEach((d, i) => {
      const k = dateKey(d);
      if (k > todayKey) return;
      const events = dayEvents(k);
      const note = data.notes[k];
      const steps = data.steps[k];
      const del = (attrs, label) => isCurrent
        ? `<button class="del-btn" ${attrs} aria-label="Poista: ${label}">${X_ICON}</button>` : "";

      days += `
        <div class="day">
          <div class="day-head">
            <span class="day-name">${DAY_NAMES[i]} ${shortDate(d)}</span>
            ${steps !== undefined ? `<span class="day-steps">${fmt(steps)} askelta ${del(`data-del="steps" data-day="${k}"`, "askeleet")}</span>` : ""}
          </div>
          ${note ? `<div class="day-note-row"><p class="day-note">”${escapeHtml(note)}”</p>${del(`data-del="note" data-day="${k}"`, "muistiinpano")}</div>` : ""}
          ${events.length
            ? `<ul class="events">${events.map((e) => `
                <li class="event">
                  <span><span class="event-time">${e.time === "-" ? "–" : fmtTime(e.time)}</span>${e.label}</span>
                  ${e.kind === "habit"
                    ? del(`data-del="habit" data-day="${k}" data-id="${e.id}"`, e.label)
                    : del(`data-del="gym" data-index="${e.index}"`, e.label)}
                </li>`).join("")}</ul>`
            : (steps === undefined && !note ? `<p class="day-empty">Ei kirjauksia</p>` : "")}
        </div>`;
    });

    const sun = addDays(mon, 6);
    html += `
      <details class="week" data-week="${monKey}" ${isOpen ? "open" : ""}>
        <summary>
          <div class="week-title">
            <h2>${isCurrent ? "Tämä viikko" : `Vko ${isoWeek(mon)}`}<span class="week-range">${shortDate(mon)}–${shortDate(sun)}</span></h2>
            <svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
          </div>
          ${summaryBadges(s)}
        </summary>
        <div class="week-body">${days}</div>
      </details>`;
  }
  list.innerHTML = html;

  // Poistonapit (vain kuluvalla viikolla)
  list.querySelectorAll("[data-del]").forEach((b) => {
    b.addEventListener("click", () => {
      const { del, day, id, index } = b.dataset;
      if (del === "steps") delete data.steps[day];
      if (del === "note") delete data.notes[day];
      if (del === "habit") delete data.checks[day][id];
      if (del === "gym") data.gym.splice(Number(index), 1);
      saveData();
      render();
    });
  });
}

/* ---------- Varmuuskopio ---------- */

function showSettingsMsg(text) {
  document.getElementById("settings-msg").textContent = text;
}

document.getElementById("export-btn").addEventListener("click", () => {
  const payload = { app: "mikroliike", version: 1, exportedAt: new Date().toISOString(), data };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `mikroliike-varmuuskopio-${dateKey(new Date())}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showSettingsMsg("Tiedosto tallennettu latauksiin.");
});

document.getElementById("import-btn").addEventListener("click", () => {
  showSettingsMsg("");
  document.getElementById("import-file").click();
});

document.getElementById("import-file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  e.target.value = ""; // sama tiedosto voidaan valita uudelleen
  if (!file) return;

  let imported;
  try {
    const parsed = JSON.parse(await file.text());
    imported = parsed.data || parsed;
    const ok = ["checks", "steps", "weekGoals"].every((k) => imported[k] && typeof imported[k] === "object")
      && Array.isArray(imported.gym);
    if (!ok) throw new Error("muoto");
  } catch (err) {
    showSettingsMsg("Tiedostoa ei voitu lukea. Valitse Mikroliikkeen varmuuskopio.");
    return;
  }

  const days = new Set([...Object.keys(imported.checks), ...Object.keys(imported.steps), ...imported.gym.map((g) => g.date)]).size;
  openSheet(`
    <h2>Korvataanko nykyiset tiedot?</h2>
    <p>Tiedostossa on kirjauksia ${days} päivältä. Nykyiset tiedot tässä selaimessa korvataan tiedoston tiedoilla.</p>
    <div class="sheet-actions">
      <button class="btn btn-primary" id="import-confirm">Korvaa tiedot</button>
      <button class="btn btn-outline" id="import-cancel">Peruuta</button>
    </div>
  `);
  document.getElementById("import-confirm").onclick = () => {
    data = Object.assign(emptyData(), imported);
    saveData();
    closeSheet();
    render();
    showSettingsMsg("Tiedot palautettu.");
  };
  document.getElementById("import-cancel").onclick = closeSheet;
});

/* ---------- Alavalikko ---------- */

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t === tab));
    document.querySelectorAll(".view").forEach((v) => { v.hidden = v.id !== `view-${tab.dataset.view}`; });
    if (tab.dataset.view === "history") renderHistory();
    if (tab.dataset.view === "settings") showSettingsMsg("");
    window.scrollTo(0, 0);
  });
});

/* ---------- Käynnistys ---------- */

document.getElementById("ring-button").addEventListener("click", () => openGoalSheet(false));
document.getElementById("log-steps-btn").addEventListener("click", openStepsSheet);
document.getElementById("gym-btn").addEventListener("click", logGym);
document.getElementById("gym-edit-btn").addEventListener("click", openGymSheet);

function checkNewWeek() {
  const key = dateKey(mondayOf(new Date()));
  if (data.weekGoals[key] === undefined && sheet.hidden) openGoalSheet(true);
}

// Päivä vaihtuu keskiyöllä: piirretään näkymä uudelleen, kun päivämäärä muuttuu
let lastDay = dateKey(new Date());
function tick() {
  const k = dateKey(new Date());
  if (k !== lastDay) {
    lastDay = k;
    render();
    checkNewWeek();
  }
}
setInterval(tick, 30000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) { tick(); renderHeader(); } });

render();
checkNewWeek();

// Offline-tuki ja kotinäytölle asennus (toimii vain verkko-osoitteessa, ei tiedostona avattuna)
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
