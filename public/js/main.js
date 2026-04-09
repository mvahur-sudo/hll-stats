/* public/js/main.js */
'use strict';

/* ===========================
   TOAST: stiil + utiliidid (automaatselt)
   =========================== */
(function injectToastStyles() {
  if (document.getElementById('toastStyles')) return;
  const style = document.createElement('style');
  style.id = 'toastStyles';
  style.textContent = `
    .toast-container { position: fixed; top: 12px; right: 12px; z-index: 9999;
      display: flex; flex-direction: column; gap: 8px; }
    .toast { min-width: 240px; max-width: 380px; background: #1f2937; color: #fff;
      border-radius: 8px; box-shadow: 0 6px 20px rgba(0,0,0,0.2);
      padding: 10px 12px; display: flex; align-items: flex-start; gap: 8px;
      font-size: 14px; line-height: 1.4; opacity: 0; transform: translateY(-6px);
      animation: toast-in 180ms ease-out forwards; }
    .toast.success { border-left: 4px solid #22c55e; }
    .toast.error   { border-left: 4px solid #ef4444; }
    .toast.info    { border-left: 4px solid #3b82f6; }
    .toast .toast-close { margin-left: auto; background: transparent; border: none;
      color: #cbd5e1; cursor: pointer; font-size: 16px; line-height: 1; }
    .toast .toast-close:hover { color: #fff; }
    @keyframes toast-in { to { opacity: 1; transform: translateY(0); } }
    @keyframes toast-out { to { opacity: 0; transform: translateY(-6px); } }
    .toast.hide { animation: toast-out 180ms ease-in forwards; }
  `;
  document.head.appendChild(style);
})();

function ensureToastContainer() {
  let c = document.getElementById('toastContainer');
  if (!c) {
    c = document.createElement('div');
    c.id = 'toastContainer';
    c.className = 'toast-container';
    c.setAttribute('aria-live', 'polite');
    c.setAttribute('aria-atomic', 'true');
    document.body.appendChild(c);
  }
  return c;
}

function showToast(message, type = 'success', timeoutMs = 3000) {
  const container = ensureToastContainer();
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.setAttribute('role', 'status');

  const text = document.createElement('div');
  text.textContent = message;

  const closeBtn = document.createElement('button');
  closeBtn.className = 'toast-close';
  closeBtn.setAttribute('aria-label', 'Sulge teavitus');
  closeBtn.innerHTML = '×';
  closeBtn.addEventListener('click', () => removeToast(toast));

  toast.appendChild(text);
  toast.appendChild(closeBtn);
  container.appendChild(toast);

  if (timeoutMs > 0) setTimeout(() => removeToast(toast), timeoutMs);
}
function removeToast(toast) {
  toast.classList.add('hide');
  toast.addEventListener('animationend', () => toast.remove(), { once: true });
}

/* ===========================
   DOM elemendid
   =========================== */
const mapSelect             = document.getElementById("mapSelect");
const resultRadios          = document.querySelectorAll("input[name='result']");
const newGameBtn            = document.getElementById("newGameBtn");
const gamesSelect           = document.getElementById("gamesSelect");
const currentGameInfo       = document.getElementById("currentGameInfo");
const tableEl               = document.getElementById("scoresTable");
const tbody                 = tableEl ? tableEl.querySelector("tbody") : null;
const saveAllBtn            = document.getElementById("saveAllBtn");
const deleteGameBtn         = document.getElementById("deleteGameBtn");

// Rooster
const rosterList            = document.getElementById("rosterList");
const newPlayerNameInput    = document.getElementById("newPlayerName");
const addPlayerBtn          = document.getElementById("addPlayerBtn");

// Mängu sees lisatav mängija
const addGamePlayerNameInput= document.getElementById("addGamePlayerName");
const addGamePlayerBtn      = document.getElementById("addGamePlayerBtn");
const playersDatalist       = document.getElementById("playersList");

// Statistikaploki elemendid
const statsWinnersEl        = document.getElementById("statsWinners");
const statsMapsEl           = document.getElementById("statsMaps");
const statsPlayersEl        = document.getElementById("statsPlayers");

/* ===========================
   Rakenduse seis
   =========================== */
let currentGameId = null;
let currentPlayers = [];
let liveHooked = false;

/* ✅ UUS: mängude cache “kõige kiiremini järjest loodud mängude” statistika jaoks */
let gamesCache = [];

/* ===========================
   Abifunktsioonid
   =========================== */
function getSelectedResult() {
  const checked = Array.from(resultRadios).find(r => r.checked);
  return checked ? checked.value : null; // "win" | "loss" | null
}

// Fallback, kui formatGameLabel mujal puudub
if (typeof window.formatGameLabel !== 'function') {
  window.formatGameLabel = function formatGameLabel(g) {
    const d = g.created_at ? new Date(g.created_at) : null;
    const dateStr = d && !isNaN(d.getTime())
      ? d.toLocaleString("et-EE", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })
      : '';
    const resultStr = g.result === 'win' ? ' (Võit)' : (g.result === 'loss' ? ' (Kaotus)' : '');
    const name = g.map_name || g.name || 'Mäng';
    return `${name}${dateStr ? ' – ' + dateStr : ''}${resultStr}`;
  };
}

/* ===========================
   Snapshot & restore salvestamata sisenditele
   =========================== */
function captureTableEdits(tbodyEl) {
  const snap = new Map();
  if (!tbodyEl) return snap;
  // eeldame, et renderTable jätab <tr data-player-name="..."> + .score-input väljad
  tbodyEl.querySelectorAll("tr[data-player-name]").forEach(tr => {
    const name = tr.dataset.playerName;
    if (!name) return;
    const inputs = tr.querySelectorAll(".score-input");
    const asInt = (el) => {
      const n = Number(el?.value ?? 0);
      return Number.isFinite(n) ? n : 0;
    };
    snap.set(name, {
      kills:       asInt(inputs[0]),
      outposts:    asInt(inputs[1]),
      garrisons:   asInt(inputs[2]),
      longest_kill:asInt(inputs[3]),
    });
  });
  return snap;
}

function restoreTableEdits(snap, tbodyEl) {
  if (!tbodyEl || !snap || snap.size === 0) return;
  tbodyEl.querySelectorAll("tr[data-player-name]").forEach(tr => {
    const name = tr.dataset.playerName;
    const data = snap.get(name);
    if (!data) return;
    const inputs = tr.querySelectorAll(".score-input");
    if (inputs[0]) inputs[0].value = data.kills ?? 0;
    if (inputs[1]) inputs[1].value = data.outposts ?? 0;
    if (inputs[2]) inputs[2].value = data.garrisons ?? 0;
    if (inputs[3]) inputs[3].value = data.longest_kill ?? 0;
  });
  // uuenda arvutatud veerge, kui sul on vastav funktsioon
  if (typeof recalcFromTable === 'function') {
    recalcFromTable(tbodyEl);
  }
}

/* ===========================
   Andmete laadimine backendist
   =========================== */
async function loadPlayers() {
  if (typeof fetchPlayers !== 'function') return;
  currentPlayers = await fetchPlayers();
  if (rosterList && typeof renderRoster === 'function') {
    renderRoster(currentPlayers, rosterList);
  }
  if (playersDatalist) {
    playersDatalist.innerHTML = "";
    currentPlayers.forEach(p => {
      const opt = document.createElement("option");
      opt.value = p.name;
      playersDatalist.appendChild(opt);
    });
  }
}

async function loadGames() {
  if (typeof fetchGames !== 'function') return;
  const games = await fetchGames();

  /* ✅ UUS: hoia mängud cache'is statistika jaoks */
  gamesCache = Array.isArray(games) ? games.slice() : [];

  if (!gamesSelect) return;

  const prev = currentGameId;
  gamesSelect.innerHTML = "";
  const placeholderOpt = document.createElement("option");
  placeholderOpt.value = "";
  placeholderOpt.textContent = "Vali mäng...";
  gamesSelect.appendChild(placeholderOpt);

  games.forEach(g => {
    const opt = document.createElement("option");
    opt.value = String(g.id);
    opt.textContent = formatGameLabel(g);
    gamesSelect.appendChild(opt);
  });

  if (games.length === 0) {
    currentGameId = null;
    if (currentGameInfo) currentGameInfo.textContent = "Ühtegi mängu pole loodud.";
    if (tbody) tbody.innerHTML = "";
    return;
  }

  let toSelect = prev;
  if (!toSelect || !games.some(g => String(g.id) === String(toSelect))) {
    toSelect = games[0].id;
  }
  currentGameId = toSelect;
  gamesSelect.value = String(toSelect);

  const game = games.find(g => String(g.id) === String(toSelect));
  if (currentGameInfo && game) currentGameInfo.textContent = formatGameLabel(game);

  await loadEntries();
}

async function loadEntries() {
  if (!tbody) return;
  if (!currentGameId) { tbody.innerHTML = ""; return; }
  if (typeof fetchEntries !== 'function') return;

  const entries = await fetchEntries(currentGameId);

  if (typeof renderTable === 'function') {
    renderTable(entries, tbody);
  } else {
    // Fallback render (kui renderTable puudub)
    tbody.innerHTML = "";
    entries.forEach((e, idx) => {
      const tr = document.createElement('tr');
      tr.dataset.playerName = e.player_name;
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td>${e.player_name}</td>
        <td><input class="score-input" type="number" min="0" value="${e.kills||0}"></td>
        <td><input class="score-input" type="number" min="0" value="${e.outposts||0}"></td>
        <td><input class="score-input" type="number" min="0" value="${e.garrisons||0}"></td>
        <td><input class="score-input" type="number" min="0" value="${e.longest_kill||0}"></td>
        <td class="bonus-cell"></td>
        <td class="total-cell"></td>
        <td><button data-delete="${e.id}" title="Eemalda sellest mängust">×</button></td>
      `;
      tbody.appendChild(tr);
    });
  }

  // live arvutus – kõik sisendväljad
  if (!liveHooked) {
    tbody.addEventListener("input", e => {
      if (e.target.classList && e.target.classList.contains("score-input")) {
        if (typeof recalcFromTable === 'function') recalcFromTable(tbody);
      }
    });

    // ridade kustutamine mängust: säilitame sisestatud väärtused
    tbody.addEventListener("click", async e => {
      const btn = e.target.closest("button[data-delete]");
      if (!btn) return;
      const entryId = btn.dataset.delete;
      if (!entryId) return;

      // 1) snapshot
      const snap = captureTableEdits(tbody);

      try {
        if (typeof deleteEntry === 'function') {
          await deleteEntry(entryId);
        }
        // 2) reload
        await loadEntries();
        // 3) restore snapshot (välja arvatud kustutatud rida)
        restoreTableEdits(snap, tbody);
        if (typeof loadStats === 'function') await loadStats();

        showToast('Kasutaja kustutatud', 'success');
      } catch (err) {
        console.error(err);
        showToast('Rea kustutamine ebaõnnestus: ' + (err?.message || err), 'error', 5000);
      }
    });

    liveHooked = true;
  }
}

/* ===========================
   Statistika laadimine ja renderdus
   =========================== */
async function loadStats() {
  try {
    if (typeof fetchStats !== 'function') return;
    const stats = await fetchStats();
    renderStatsWinners(stats.winners);
    renderStatsMaps(stats.maps);
    renderStatsRecords(stats.records, stats.overall);
  } catch (err) {
    console.error("Failed to load stats", err);
  }
}

function renderStatsWinners(winners) {
  if (!statsWinnersEl) return;
  statsWinnersEl.innerHTML = "";

  const sections = [
    { key: "day",   label: "Viimased 18h" },
    { key: "week",  label: "Viimased 7 päeva" },
    { key: "month", label: "Viimased 30 päeva" },
    { key: "year",  label: "Viimased 365 päeva" }
  ];

  sections.forEach(section => {
    const raw = winners?.[section.key] || [];

    /* sorteerime punktide järgi (rohkem = ettepoole) */
    const data = [...raw].sort((a, b) => {
      const pa = (a.first  || 0) * 3 + (a.second || 0) * 2 + (a.third || 0);
      const pb = (b.first  || 0) * 3 + (b.second || 0) * 2 + (b.third || 0);
      return pb - pa;
    });

    const block = document.createElement("div");
    block.className = "podium-block";

    /* ---- Pealkirja rida ---- */
    const titleRow = document.createElement("div");
    titleRow.className = "podium-title-row";

    const title = document.createElement("div");
    title.className = "podium-title";
    title.textContent = section.label;

    const medalsHeader = document.createElement("div");
    medalsHeader.className = "podium-medals-header";
    medalsHeader.innerHTML = "<span>🥇</span><span>🥈</span><span>🥉</span><span>⭐</span>";

    titleRow.appendChild(title);
    titleRow.appendChild(medalsHeader);
    block.appendChild(titleRow);

    /* ---- Sisu ---- */
    if (!data.length) {
      const empty = document.createElement("div");
      empty.className = "podium-empty";
      empty.textContent = "– andmeid pole –";
      block.appendChild(empty);
    } else {
      data.forEach(row => {
        const line = document.createElement("div");
        line.className = "podium-row";

        const f = row.first  || 0;
        const s = row.second || 0;
        const t = row.third  || 0;

        // punktide arvutus
        const points = f * 3 + s * 2 + t * 1;

        const name = document.createElement("button");
        name.type = "button";
        name.className = "podium-name player-link";
        name.textContent = row.player_name;
        name.addEventListener("click", () => openPlayerModal(row.player_name, section.key));

        const first = document.createElement("div");
        first.className = "podium-col";
        first.textContent = f;

        const second = document.createElement("div");
        second.className = "podium-col";
        second.textContent = s;

        const third = document.createElement("div");
        third.className = "podium-col";
        third.textContent = t;

        const total = document.createElement("div");
        total.className = "podium-total";
        total.textContent = points;

        line.appendChild(name);
        line.appendChild(first);
        line.appendChild(second);
        line.appendChild(third);
        line.appendChild(total);

        block.appendChild(line);
      });
    }

    statsWinnersEl.appendChild(block);
  });
}

function renderStatsMaps(maps) {
  if (!statsMapsEl) return;
  statsMapsEl.innerHTML = "";

  if (!maps || !maps.length) {
    statsMapsEl.textContent = "Kaardi statistikat pole veel.";
    return;
  }

  maps.forEach(m => {
    const wins   = m.wins   || 0;
    const losses = m.losses || 0;
    const total  = m.games ?? (wins + losses);
    const pct    = total ? Math.round((wins / total) * 100) : 0;

    const block = document.createElement("div");
    block.className = "map-stat";

    // ✅ Klikitav overlay
    block.style.cursor = "pointer";
    block.title = "Vaata selle kaardi kõiki mänge";

    block.addEventListener("click", () => {
      if (typeof openMapOverlay === "function") {
        openMapOverlay(m.map_name);
      } else {
        console.warn("openMapOverlay() puudub - kas mapOverlay.js on lisatud?");
      }
    });

    const title = document.createElement("div");
    title.className = "map-name";
    title.textContent = m.map_name;

    const stats = document.createElement("div");
    stats.className = "map-results";
    stats.textContent =
      `Mänge: ${total} · Võidud: ${wins} · Kaotused: ${losses} · ${pct}%`;

    block.appendChild(title);
    block.appendChild(stats);
    statsMapsEl.appendChild(block);
  });
}


/* ✅ UUS: abid “kõige kiiremini järjest loodud mängud” jaoks */
function formatDuration(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);

  if (d > 0) return `${d}p ${h % 24}h`;
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}
function computeFastestCreatedGap(games) {
  const valid = (Array.isArray(games) ? games : [])
    .filter(g => g && g.created_at && !isNaN(new Date(g.created_at).getTime()))
    .slice()
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  if (valid.length < 2) return null;

  let best = { ms: Infinity, prev: null, next: null };
  for (let i = 1; i < valid.length; i++) {
    const prev = valid[i - 1];
    const next = valid[i];
    const diff = new Date(next.created_at) - new Date(prev.created_at);
    if (diff >= 0 && diff < best.ms) best = { ms: diff, prev, next };
  }
  return best.prev && best.next ? best : null;
}

function renderStatsRecords(records, overall) {
  if (!statsPlayersEl) return;
  statsPlayersEl.innerHTML = "";
  if (overall) {
  const block = document.createElement("div");
  block.className = "overall-stats";

  block.innerHTML = `
    <div class="record-label">Kokku mängitud kaarte:</div>
    <div class="record-value">${overall.total_games}</div>

    <div class="record-label">Võite:</div>
    <div class="record-value">${overall.total_wins}</div>

    <div class="record-label">Kaotusi:</div>
    <div class="record-value">${overall.total_losses}</div>

    <div class="record-label">Võiduprotsent:</div>
    <div class="record-value">${overall.win_percentage}%</div>
    <hr style="margin:10px 0;">
  `;

  statsPlayersEl.appendChild(block);
}
  if (!records) {
    statsPlayersEl.textContent = "Mängijate rekordid puuduvad.";
    return;
  }

  function formatDate(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso || "";
    return d.toLocaleString("et-EE", {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false
    });
  }

  const items = [];
  if (records.kills) {
    items.push({ label: "Kõige rohkem kille",
      text: `${records.kills.player_name} – ${records.kills.value} killi (${records.kills.map_name}, ${formatDate(records.kills.created_at)})` });
  }
  if (records.outposts) {
    items.push({ label: "Kõige rohkem outposte",
      text: `${records.outposts.player_name} – ${records.outposts.value} outposti (${records.outposts.map_name}, ${formatDate(records.outposts.created_at)})` });
  }
  if (records.garrisons) {
    items.push({ label: "Kõige rohkem garrisone",
      text: `${records.garrisons.player_name} – ${records.garrisons.value} garrisonit (${records.garrisons.map_name}, ${formatDate(records.garrisons.created_at)})` });
  }
  if (records.longest_kill) {
    items.push({ label: "Kõige kaugem kill",
      text: `${records.longest_kill.player_name} – ${records.longest_kill.value} m (${records.longest_kill.map_name}, ${formatDate(records.longest_kill.created_at)})` });
  }
  if (records.score) {
    items.push({ label: "Suurim punktisumma",
      text: `${records.score.player_name} – ${records.score.value} punkti (${records.score.map_name}, ${formatDate(records.score.created_at)})` });
  }

  /* ✅ UUS: kõige lühem vahe kahe järjestikuse mängu loomise vahel */
  const fastest = computeFastestCreatedGap(gamesCache);
  if (fastest) {
    const prevLabel = (typeof formatGameLabel === "function")
      ? formatGameLabel(fastest.prev)
      : `${fastest.prev.map_name || "Mäng"} – ${formatDate(fastest.prev.created_at)}`;

    const nextLabel = (typeof formatGameLabel === "function")
      ? formatGameLabel(fastest.next)
      : `${fastest.next.map_name || "Mäng"} – ${formatDate(fastest.next.created_at)}`;

    items.push({
      label: "Kõige kiiremini mängitud kaart",
      text: `${nextLabel} - aeg ${formatDuration(fastest.ms)}`
    });
  }

  if (!items.length) {
    statsPlayersEl.textContent = "Mängijate rekordid puuduvad.";
    return;
  }

  const ul = document.createElement("ul");

  items.forEach(item => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span class="record-label">${item.label}:</span>
      <span class="record-value">${item.text}</span>
    `;
    ul.appendChild(li);
});

statsPlayersEl.appendChild(ul);
}

/* ===========================
   Event listenerid
   =========================== */

// Uus mäng
if (newGameBtn) {
  newGameBtn.addEventListener("click", async () => {
    const mapName = mapSelect ? mapSelect.value.trim() : "";
    const result = getSelectedResult();
    if (!mapName) {
      showToast("Vali kaart.", "error", 4000);
      return;
    }
    try {
      if (typeof createGame !== 'function') return;
      const game = await createGame({ map_name: mapName, result });
      await loadGames();
      currentGameId = game.id;
      if (gamesSelect) gamesSelect.value = String(game.id);
      if (currentGameInfo) currentGameInfo.textContent = formatGameLabel(game);
      await loadEntries();
      await loadStats();
      showToast("Mäng loodud", "success");
    } catch (err) {
      console.error(err);
      showToast("Mängu loomine ebaõnnestus: " + (err?.message || err), "error", 5000);
    }
  });
}

// Vali mäng
if (gamesSelect) {
  gamesSelect.addEventListener("change", async () => {
    const val = gamesSelect.value;
    if (!val) {
      currentGameId = null;
      if (tbody) tbody.innerHTML = "";
      if (currentGameInfo) currentGameInfo.textContent = "";
      return;
    }
    currentGameId = Number(val);
    if (typeof fetchGames === 'function') {
      const games = await fetchGames();
      const game = games.find(g => String(g.id) === String(currentGameId));
      if (currentGameInfo && game) currentGameInfo.textContent = formatGameLabel(game);
    }
    await loadEntries();
    await loadStats();
  });
}

// Salvesta kõik
if (saveAllBtn && tbody) {
  saveAllBtn.addEventListener("click", async () => {
    if (!currentGameId) { showToast("Mängu pole valitud.", "error", 4000); return; }
    if (typeof collectTablePayloads !== 'function') {
      showToast("Tabeli sisu kogumise funktsioon puudub.", "error", 5000);
      return;
    }
    const payload = collectTablePayloads(tbody);
    if (!payload.length) { showToast("Tabel on tühi.", "info", 3500); return; }
    try {
      if (typeof saveEntry !== 'function') return;
      await Promise.all(payload.map(row => saveEntry(currentGameId, row)));
      await loadEntries();
      await loadStats();
      showToast("Salvestatud!", "success");
    } catch (err) {
      console.error(err);
      showToast("Salvestamine ebaõnnestus: " + (err?.message || err), "error", 5000);
    }
  });
}

// Kustuta mäng
if (deleteGameBtn) {
  deleteGameBtn.addEventListener("click", async () => {
    if (!currentGameId) { showToast("Mängu pole valitud.", "error", 4000); return; }
    const ok = confirm("Kas oled kindel, et soovid selle mängu KUSTUTADA? Kõik selle mängu punktid kaovad.");
    if (!ok) return;
    try {
      if (typeof deleteGame !== 'function') return;
      await deleteGame(currentGameId);
    } catch (err) {
      console.error(err);
      showToast("Mängu kustutamine ebaõnnestus: " + (err?.message || err), "error", 5000);
      return;
    }
    await loadGames();
    await loadStats();
    showToast("Mäng kustutatud", "success");
  });
}

// Lisa mängija roostrisse
if (addPlayerBtn) {
  addPlayerBtn.addEventListener("click", async () => {
    const name = (newPlayerNameInput?.value || "").trim();
    if (!name) return;
    try {
      if (typeof createPlayer !== 'function') return;
      await createPlayer(name);
      if (newPlayerNameInput) newPlayerNameInput.value = "";
      await loadPlayers();
      showToast("Mängija lisatud roostrisse", "success");
    } catch (err) {
      console.error(err);
      showToast("Mängija lisamine ebaõnnestus: " + (err?.message || err), "error", 5000);
    }
  });
}

// Lisa mängija PRAEGUSESSE mängu (säilitame muude ridade sisestused)
if (addGamePlayerBtn && tbody) {
  addGamePlayerBtn.addEventListener("click", async () => {
    if (!currentGameId) { showToast("Kõigepealt vali või loo mäng.", "error", 4000); return; }
    const name = (addGamePlayerNameInput?.value || "").trim();
    if (!name) return;

    const existingRow = [...tbody.querySelectorAll("tr[data-player-name]")]
      .find(row => row.dataset.playerName.toLowerCase() === name.toLowerCase());
    if (existingRow) { showToast("See mängija on juba selles mängus.", "info", 3500); return; }

    const existsInRoster = currentPlayers.some(p => p.name.toLowerCase() === name.toLowerCase());
    if (!existsInRoster) {
      try {
        if (typeof createPlayer === 'function') await createPlayer(name);
        await loadPlayers();
      } catch (e) { console.warn("createPlayer failed or already exists", e); }
    }

    // snapshot enne uue rea lisamist
    const snap = captureTableEdits(tbody);

    try {
      if (typeof saveEntry !== 'function') return;
      await saveEntry(currentGameId, { player_name: name, kills: 0, outposts: 0, garrisons: 0, longest_kill: 0 });
      if (addGamePlayerNameInput) addGamePlayerNameInput.value = "";
      await loadEntries();
      // taastame muud ridade sisestused
      restoreTableEdits(snap, tbody);
      await loadStats();
      showToast(`"${name}" lisatud mängu`, "success");
    } catch (err) {
      console.error(err);
      showToast("Mängija lisamine mängu ebaõnnestus: " + (err?.message || err), "error", 5000);
    }
  });
}

function formatDuration(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}p ${h % 24}h`;
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

async function openPlayerModal(playerName, windowKey) {
  const modal = document.getElementById("playerModal");
  const titleEl = document.getElementById("playerModalTitle");
  const bodyEl = document.getElementById("playerModalBody");
  const closeBackdrop = document.getElementById("playerModalClose");
  const closeX = document.getElementById("playerModalX");

  if (!modal || !titleEl || !bodyEl) return;

  const close = () => modal.classList.add("hidden");
  closeBackdrop?.addEventListener("click", close, { once: true });
  closeX?.addEventListener("click", close, { once: true });

  modal.classList.remove("hidden");
  titleEl.textContent = `${playerName} – detailid (${windowKey})`;
  bodyEl.innerHTML = "Laen...";

  try {
    const res = await fetch(`/api/stats/player/${encodeURIComponent(playerName)}?window=${encodeURIComponent(windowKey)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const t = data.totals || {};
    const fastest = data.fastest;
    const trend = data.trend_last_10 || {};
    const maps = Array.isArray(data.maps) ? data.maps : [];
    const bestByScore = Array.isArray(data.best_maps_by_score) ? data.best_maps_by_score : [];
    const bestByWinrate = Array.isArray(data.best_maps_by_winrate) ? data.best_maps_by_winrate : [];
    const profile = data.profile || {};
    const achievements = data.achievements || {};

    const fastestHtml = fastest
      ? `<div><b>Kõige kiiremini mängitud kaart:</b> ${fastest.map_name} – aeg ${formatDuration(fastest.ms)}</div>`
      : `<div><b>Kõige kiiremini mängitud kaart:</b> –</div>`;

    const renderMapRows = (rows, mode = 'default') => rows.map(m => `
      <tr>
        <td>${m.map_name}</td>
        <td>${m.games}</td>
        <td>${m.wins}</td>
        <td>${m.losses}</td>
        <td>${m.win_rate ?? 0}%</td>
        <td>${mode === 'score' ? m.avg_score : m.avg_kills}</td>
        <td>${mode === 'score' ? m.score : m.avg_outposts}</td>
      </tr>
    `).join("");

    const mapsHtml = maps.length
      ? `
        <div class="overlay-table-wrap">
          <table class="scores-table player-stats-table" style="margin-top:12px;">
            <thead>
              <tr>
                <th>Kaart</th>
                <th>Mänge</th>
                <th>Võite</th>
                <th>Kaotusi</th>
                <th>WR</th>
                <th>Kills</th>
                <th>OP</th>
                <th>Gar</th>
                <th>Longest</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              ${maps.map(m => `
                <tr>
                  <td>${m.map_name}</td>
                  <td>${m.games}</td>
                  <td>${m.wins}</td>
                  <td>${m.losses}</td>
                  <td>${m.win_rate ?? 0}%</td>
                  <td>${m.kills}</td>
                  <td>${m.outposts}</td>
                  <td>${m.garrisons}</td>
                  <td>${m.longest_kill}</td>
                  <td>${m.score}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `
      : `<div style="margin-top:12px;">Selles perioodis pole selle mängija mänge.</div>`;

    const achievementsHtml = [
      achievements.highest_kills ? `<li><span class="record-label">Highest kills:</span> <span class="record-value">${achievements.highest_kills.value} (${achievements.highest_kills.map_name})</span></li>` : '',
      achievements.most_outposts ? `<li><span class="record-label">Most outposts:</span> <span class="record-value">${achievements.most_outposts.value} (${achievements.most_outposts.map_name})</span></li>` : '',
      achievements.most_garrisons ? `<li><span class="record-label">Most garrisons:</span> <span class="record-value">${achievements.most_garrisons.value} (${achievements.most_garrisons.map_name})</span></li>` : '',
      achievements.longest_kill ? `<li><span class="record-label">Longest kill:</span> <span class="record-value">${achievements.longest_kill.value} m (${achievements.longest_kill.map_name})</span></li>` : '',
      achievements.best_score ? `<li><span class="record-label">Best score:</span> <span class="record-value">${achievements.best_score.value} (${achievements.best_score.map_name})</span></li>` : '',
      typeof achievements.best_win_streak === 'number' ? `<li><span class="record-label">Best win streak:</span> <span class="record-value">${achievements.best_win_streak}</span></li>` : ''
    ].join('');

    const formHtml = (trend.form || []).map(item => `<span class="map-form-pill map-form-pill--${item === 'W' ? 'win' : item === 'L' ? 'loss' : 'neutral'}">${item}</span>`).join('');

    bodyEl.innerHTML = `
      <div class="map-overlay-grid">
        <section class="map-panel map-panel--full">
          <div class="map-stats-bar">
            <div class="map-stats-bar__item"><div class="map-stats-bar__value">${t.games || 0}</div><div class="map-stats-bar__label">Mänge</div></div>
            <div class="map-stats-bar__item"><div class="map-stats-bar__value">${t.wins || 0}</div><div class="map-stats-bar__label">Võite</div></div>
            <div class="map-stats-bar__item"><div class="map-stats-bar__value">${t.losses || 0}</div><div class="map-stats-bar__label">Kaotusi</div></div>
            <div class="map-stats-bar__item"><div class="map-stats-bar__value">${t.win_rate || 0}%</div><div class="map-stats-bar__label">Winrate</div></div>
            <div class="map-stats-bar__item"><div class="map-stats-bar__value">${t.kills || 0}</div><div class="map-stats-bar__label">Kills</div></div>
            <div class="map-stats-bar__item"><div class="map-stats-bar__value">${t.outposts || 0}</div><div class="map-stats-bar__label">OP</div></div>
            <div class="map-stats-bar__item"><div class="map-stats-bar__value">${t.garrisons || 0}</div><div class="map-stats-bar__label">Gar</div></div>
            <div class="map-stats-bar__item"><div class="map-stats-bar__value">${t.longest_kill || 0}m</div><div class="map-stats-bar__label">Longest</div></div>
            <div class="map-stats-bar__item"><div class="map-stats-bar__value">${t.score || 0}</div><div class="map-stats-bar__label">Score</div></div>
            <div class="map-stats-bar__item"><div class="map-stats-bar__value">${data.squad_rank || '–'}</div><div class="map-stats-bar__label">Squad rank</div></div>
            <div class="map-stats-bar__item"><div class="map-stats-bar__value">${data.squad_percentile ?? '–'}${data.squad_percentile != null ? '%' : ''}</div><div class="map-stats-bar__label">Percentile</div></div>
          </div>
          <div class="map-last-played" style="margin-top:0.75rem;"><b>Profiil:</b> ${profile.type || 'balanced'} · ${profile.reason || ''}</div>
          <div class="map-last-played">${fastestHtml}</div>
        </section>

        <section class="map-panel">
          <div class="map-section-title">Vorm, viimased 10 mängu</div>
          <div class="map-trend-grid">
            <div class="map-trend-card"><span class="map-trend-card__value">${trend.games || 0}</span><span class="map-trend-card__label">Mänge</span></div>
            <div class="map-trend-card"><span class="map-trend-card__value">${trend.wins || 0}</span><span class="map-trend-card__label">Võite</span></div>
            <div class="map-trend-card"><span class="map-trend-card__value">${trend.losses || 0}</span><span class="map-trend-card__label">Kaotusi</span></div>
            <div class="map-trend-card"><span class="map-trend-card__value">${trend.win_rate || 0}%</span><span class="map-trend-card__label">WR</span></div>
            <div class="map-trend-card"><span class="map-trend-card__value">${trend.avg_score || 0}</span><span class="map-trend-card__label">Ø Score</span></div>
            <div class="map-trend-card"><span class="map-trend-card__value">${trend.avg_kills || 0}</span><span class="map-trend-card__label">Ø Kills</span></div>
          </div>
          <div class="map-form-row" style="margin-top:0.65rem;">${formHtml || '<span class="map-form-pill map-form-pill--neutral">-</span>'}</div>
        </section>

        <section class="map-panel">
          <div class="map-section-title">Saavutused</div>
          <ul>${achievementsHtml || '<li>Saavutused puuduvad.</li>'}</ul>
        </section>

        <section class="map-panel">
          <div class="map-section-title">Parimad kaardid score järgi</div>
          <div class="overlay-table-wrap">
            <table class="overlay-table overlay-table--compact">
              <thead><tr><th>Kaart</th><th>Mänge</th><th>Võite</th><th>Kaotusi</th><th>WR</th><th>Avg Score</th><th>Total Score</th></tr></thead>
              <tbody>${renderMapRows(bestByScore, 'score')}</tbody>
            </table>
          </div>
        </section>

        <section class="map-panel">
          <div class="map-section-title">Parimad kaardid winrate järgi</div>
          <div class="overlay-table-wrap">
            <table class="overlay-table overlay-table--compact">
              <thead><tr><th>Kaart</th><th>Mänge</th><th>Võite</th><th>Kaotusi</th><th>WR</th><th>Avg Kills</th><th>Avg OP</th></tr></thead>
              <tbody>${renderMapRows(bestByWinrate, 'winrate')}</tbody>
            </table>
          </div>
        </section>

        <section class="map-panel map-panel--full">
          <div class="map-section-title">Mängitud kaardid</div>
          ${mapsHtml}
        </section>
      </div>
    `;
  } catch (err) {
    console.error(err);
    bodyEl.innerHTML = `Viga mängija statistika laadimisel: ${err?.message || err}`;
  }
}


/* ===========================
   INITIALISEERI RAKENDUS
   =========================== */
(async () => {
  if (typeof initMapSelect === "function" && mapSelect) {
    initMapSelect(mapSelect);
  }
  try {
    await loadPlayers();
    await loadGames();
    await loadStats();
  } catch (err) {
    console.error("Initial load failed", err);
    showToast("Alglaadimine ebaõnnestus. Vaata konsooli.", "error", 6000);
  }
})();
