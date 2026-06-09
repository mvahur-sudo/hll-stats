// public/js/table.js

const CHALLENGE_NORMAL = "normal";
const CHALLENGE_KILL_DEATH = "kill_death";

function normalizeChallenge(value) {
  return value === CHALLENGE_KILL_DEATH ? CHALLENGE_KILL_DEATH : CHALLENGE_NORMAL;
}

function getChallengeLabel(value) {
  const challenge = normalizeChallenge(value);
  if (challenge === CHALLENGE_KILL_DEATH) return "Kill/death (+1 / -2)";
  return "Tavaline";
}

function normalizeCount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.trunc(n));
}

function calculateScoreParts(entry, maxLongest, challengeValue) {
  const challenge = normalizeChallenge(challengeValue ?? entry.challenge);
  const kills = normalizeCount(entry.kills);
  const deaths = normalizeCount(entry.deaths);
  const outposts = normalizeCount(entry.outposts);
  const garrisons = normalizeCount(entry.garrisons);
  const longest_kill = normalizeCount(entry.longest_kill);

  if (challenge === CHALLENGE_KILL_DEATH) {
    const base = kills;
    const penalty = deaths * 2;
    return {
      challenge,
      kills,
      deaths,
      outposts,
      garrisons,
      longest_kill,
      base,
      bonus: 0,
      penalty,
      total: base - penalty
    };
  }

  const base = kills + outposts * 3 + garrisons * 6;
  const bonus = maxLongest > 0 && longest_kill === maxLongest ? 1 : 0;
  return {
    challenge,
    kills,
    deaths,
    outposts,
    garrisons,
    longest_kill,
    base,
    bonus,
    penalty: 0,
    total: base + bonus
  };
}

function getEntriesChallenge(entries, fallback) {
  const row = Array.isArray(entries) ? entries.find(e => e && e.challenge) : null;
  return normalizeChallenge(row?.challenge ?? fallback);
}

function formatScoreNote(row) {
  if (normalizeChallenge(row.challenge) === CHALLENGE_KILL_DEATH) {
    return row.penalty > 0 ? `<span class="penalty-tag">-${row.penalty}</span>` : "";
  }
  return row.bonus ? '<span class="bonus-tag">kaugeim kill</span>' : "";
}

// Formaat mängu label: kaart + tulemus + 24h aeg
function formatGameLabel(game) {
  const map = game.map_name || game.name || "Mäng";
  const d = new Date(game.created_at);

  const when = isNaN(d.getTime())
    ? game.created_at
    : d.toLocaleString("et-EE", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      });

  let resText = "";
  if (game.result === "win") resText = " – Võit";
  else if (game.result === "loss") resText = " – Kaotus";

  const warmupText = game.warmup ? " – Soojendus" : "";
  const challengeText = normalizeChallenge(game.challenge) !== CHALLENGE_NORMAL
    ? ` – ${getChallengeLabel(game.challenge)}`
    : "";

  return `${map}${resText}${warmupText}${challengeText} – ${when}`;
}

// Arvuta punktid sama loogikaga mis server.
function calculateScores(entries, challengeValue) {
  const challenge = getEntriesChallenge(entries, challengeValue);
  const arr = entries.map(e => ({
    ...e,
    challenge,
    kills: normalizeCount(e.kills),
    deaths: normalizeCount(e.deaths),
    outposts: normalizeCount(e.outposts),
    garrisons: normalizeCount(e.garrisons),
    longest_kill: normalizeCount(e.longest_kill)
  }));

  const maxLongest = arr.reduce(
    (m, e) => (e.longest_kill > m ? e.longest_kill : m),
    0
  );

  return arr
    .map(e => {
      const parts = calculateScoreParts(e, maxLongest, challenge);
      return {
        ...e,
        ...parts
      };
    })
    .sort((a, b) =>
    (b.total - a.total) ||
    (b.kills - a.kills) ||
     a.player_name.localeCompare(b.player_name)
);
}

// ---- Desktop (tabel) render ----
function renderDesktopTable(scored, maxLongest, tbodyEl) {
  tbodyEl.innerHTML = "";
  scored.forEach((e, index) => {
    const tr = document.createElement("tr");
    tr.dataset.playerName = e.player_name;
    if (e.id) tr.dataset.entryId = e.id;

    if (index === 0) tr.classList.add("rank-1");
    else if (index === 1) tr.classList.add("rank-2");
    else if (index === 2) tr.classList.add("rank-3");

    if (e.longest_kill === maxLongest && maxLongest > 0) {
      tr.classList.add("highlight");
    }

    tr.innerHTML = `
      <td class="pos-cell">${index + 1}</td>
      <td class="name-cell">${e.player_name}</td>
      <td><input type="number" class="score-input" data-field="kills" min="0" value="${e.kills}" inputmode="numeric" pattern="[0-9]*"></td>
      <td><input type="number" class="score-input" data-field="deaths" min="0" value="${e.deaths}" inputmode="numeric" pattern="[0-9]*"></td>
      <td><input type="number" class="score-input" data-field="outposts" min="0" value="${e.outposts}" inputmode="numeric" pattern="[0-9]*"></td>
      <td><input type="number" class="score-input" data-field="garrisons" min="0" value="${e.garrisons}" inputmode="numeric" pattern="[0-9]*"></td>
      <td><input type="number" class="score-input" data-field="longest_kill" min="0" value="${e.longest_kill || 0}" inputmode="numeric" pattern="[0-9]*"></td>
      <td class="bonus-cell">${formatScoreNote(e)}</td>
      <td class="total-cell">${e.total}</td>
      <td><button class="btn btn-secondary" data-delete="${e.id || ''}" tabindex="-1">X</button></td>
    `;
    tbodyEl.appendChild(tr);
  });
}

// ---- Mobile (card) render ----
function renderMobileCards(scored, maxLongest, container) {
  container.innerHTML = "";
  scored.forEach((e, index) => {
    const card = document.createElement("div");
    card.className = "mobile-card";
    card.dataset.playerName = e.player_name;
    if (e.id) card.dataset.entryId = e.id;

    if (index === 0) card.classList.add("rank-1");
    else if (index === 1) card.classList.add("rank-2");
    else if (index === 2) card.classList.add("rank-3");

    if (e.longest_kill === maxLongest && maxLongest > 0) {
      card.classList.add("highlight");
    }

    card.innerHTML = `
      <div class="mobile-card__header">
        <span class="mobile-card__pos">#${index + 1}</span>
        <span class="mobile-card__name">${e.player_name}</span>
        <span class="mobile-card__score">${e.total}<span class="mobile-card__score-label">pt</span></span>
      </div>
      <div class="mobile-card__fields">
        <div class="mobile-card__field">
          <label class="mobile-card__label">Kills</label>
          <input type="number" class="score-input" data-field="kills" min="0" value="${e.kills}" inputmode="numeric" pattern="[0-9]*">
        </div>
        <div class="mobile-card__field">
          <label class="mobile-card__label">Deaths</label>
          <input type="number" class="score-input" data-field="deaths" min="0" value="${e.deaths}" inputmode="numeric" pattern="[0-9]*">
        </div>
        <div class="mobile-card__field">
          <label class="mobile-card__label">OP</label>
          <input type="number" class="score-input" data-field="outposts" min="0" value="${e.outposts}" inputmode="numeric" pattern="[0-9]*">
        </div>
        <div class="mobile-card__field">
          <label class="mobile-card__label">Gar</label>
          <input type="number" class="score-input" data-field="garrisons" min="0" value="${e.garrisons}" inputmode="numeric" pattern="[0-9]*">
        </div>
        <div class="mobile-card__field">
          <label class="mobile-card__label">Longest</label>
          <input type="number" class="score-input" data-field="longest_kill" min="0" value="${e.longest_kill || 0}" inputmode="numeric" pattern="[0-9]*">
        </div>
      </div>
      <div class="mobile-card__footer">
        <span class="mobile-card__bonus">${formatScoreNote(e)}</span>
        <button class="btn btn-secondary" data-delete="${e.id || ''}" tabindex="-1">✕</button>
      </div>
    `;
    container.appendChild(card);
  });
}

function isMobile() {
  return window.matchMedia('(max-width: 640px)').matches;
}

// Joonista tabel entries põhjal
function renderTable(entries, tbodyEl) {
  if (!entries || !entries.length) {
    const container = document.getElementById("mobileCardsContainer");
    if (container) container.innerHTML = "";
    tbodyEl.innerHTML = "";
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 10;
    td.textContent = "Selles mängus pole mängijaid.";
    tr.appendChild(td);
    tbodyEl.appendChild(tr);
    return;
  }

  const challenge = getEntriesChallenge(entries);
  tbodyEl.dataset.challenge = challenge;
  const scored = calculateScores(entries, challenge);
  const maxLongest = scored.reduce(
    (m, e) => (e.longest_kill > m ? e.longest_kill : m),
    0
  );

  if (isMobile()) {
    // Peida tabel, näita mobiilseid kaarte
    tbodyEl.closest('.table-wrap').style.display = 'none';
    let container = document.getElementById("mobileCardsContainer");
    if (!container) {
      container = document.createElement("div");
      container.id = "mobileCardsContainer";
      container.className = "mobile-cards";
      tbodyEl.closest('.table-wrap').parentElement.appendChild(container);
    }
    container.style.display = '';
    renderMobileCards(scored, maxLongest, container);
  } else {
    // Peida mobiilne, näita tabel
    const container = document.getElementById("mobileCardsContainer");
    if (container) container.style.display = 'none';
    tbodyEl.closest('.table-wrap').style.display = '';
    renderDesktopTable(scored, maxLongest, tbodyEl);
  }
}

// Kogu tabelist / mobiilikaartidest andmed, et salvestamiseks payload teha
function collectTablePayloads(tbodyEl) {
  if (isMobile()) {
    const container = document.getElementById("mobileCardsContainer");
    if (!container) return [];
    const cards = container.querySelectorAll(".mobile-card");
    const result = [];
    cards.forEach(card => {
      const nameEl = card.querySelector(".mobile-card__name");
      const inputs = card.querySelectorAll(".score-input");
      if (!nameEl || !inputs.length) return;
      const player_name = nameEl.textContent.trim();
      const data = { player_name };
      inputs.forEach(inp => {
        const field = inp.dataset.field;
        data[field] = normalizeCount(inp.value);
      });
      result.push(data);
    });
    return result;
  }

  const rows = [...tbodyEl.querySelectorAll("tr")];
  const result = [];
  rows.forEach(row => {
    const nameCell = row.querySelector(".name-cell");
    const inputs = row.querySelectorAll(".score-input");
    if (!nameCell || !inputs.length) return;

    const player_name = nameCell.textContent.trim();
    const data = { player_name };
    inputs.forEach(inp => {
      const field = inp.dataset.field;
      const val = normalizeCount(inp.value);
      data[field] = val;
    });
    result.push(data);
  });
  return result;
}

// Recalc + sort + medalikohad live
function recalcFromTable(tbodyEl) {
  if (isMobile()) {
    const container = document.getElementById("mobileCardsContainer");
    if (!container) return;
    const cards = container.querySelectorAll(".mobile-card");
    const cardData = [];
    cards.forEach(card => {
      const nameEl = card.querySelector(".mobile-card__name");
      const inputs = card.querySelectorAll(".score-input");
      if (!nameEl || !inputs.length) return;
      const player_name = nameEl.textContent.trim();
      const data = { card, player_name };
      inputs.forEach(inp => {
        const field = inp.dataset.field;
        data[field] = normalizeCount(inp.value);
      });
      cardData.push(data);
    });
    if (!cardData.length) return;

    const challenge = normalizeChallenge(tbodyEl.dataset.challenge);
    const maxLongest = cardData.reduce((m, d) => (d.longest_kill > m ? d.longest_kill : m), 0);
    cardData.forEach(d => Object.assign(d, calculateScoreParts(d, maxLongest, challenge)));

    const uniqueTotals = [...new Set(cardData.map(d => d.total))]
      .filter(t => t !== 0)
      .sort((a, b) => b - a);
    const firstTotal = uniqueTotals[0];
    const secondTotal = uniqueTotals[1];
    const thirdTotal = uniqueTotals[2];

    cards.forEach(c => c.classList.remove("rank-1", "rank-2", "rank-3", "highlight"));

    cardData.forEach(d => {
      const card = d.card;
      const scoreEl = card.querySelector(".mobile-card__score");
      if (scoreEl) scoreEl.innerHTML = `${d.total}<span class="mobile-card__score-label">pt</span>`;

      const bonusEl = card.querySelector(".mobile-card__bonus");
      if (bonusEl) bonusEl.innerHTML = formatScoreNote(d);

      if (d.total === firstTotal && firstTotal !== undefined) card.classList.add("rank-1");
      else if (secondTotal !== undefined && d.total === secondTotal) card.classList.add("rank-2");
      else if (thirdTotal !== undefined && d.total === thirdTotal) card.classList.add("rank-3");

      if (d.longest_kill === maxLongest && maxLongest > 0) card.classList.add("highlight");
    });
    return;
  }

  const rows = [...tbodyEl.querySelectorAll("tr")];
  const rowData = [];

  rows.forEach(row => {
    const nameCell = row.querySelector(".name-cell");
    const inputs = row.querySelectorAll(".score-input");
    if (!nameCell || !inputs.length) return;

    const player_name = nameCell.textContent.trim();
    const data = { row, player_name };

    inputs.forEach(inp => {
      const field = inp.dataset.field;
      const val = normalizeCount(inp.value);
      data[field] = val;
    });

    rowData.push(data);
  });

  if (!rowData.length) return;

  const challenge = normalizeChallenge(tbodyEl.dataset.challenge);
  const maxLongest = rowData.reduce(
    (m, d) => (d.longest_kill > m ? d.longest_kill : m),
    0
  );

  rowData.forEach(d => {
    Object.assign(d, calculateScoreParts(d, maxLongest, challenge));
  });

  const uniqueTotals = [...new Set(rowData.map(d => d.total))]
    .filter(t => t !== 0)
    .sort((a, b) => b - a);

  const firstTotal = uniqueTotals[0];
  const secondTotal = uniqueTotals[1];
  const thirdTotal = uniqueTotals[2];

  rows.forEach(r => {
    r.classList.remove("rank-1", "rank-2", "rank-3", "highlight");
  });

  rowData.forEach(d => {
    const row = d.row;

    const totalCell = row.querySelector(".total-cell");
    if (totalCell) totalCell.textContent = d.total;

    const bonusCell = row.querySelector(".bonus-cell");
    if (bonusCell) bonusCell.innerHTML = formatScoreNote(d);

    if (d.total === firstTotal && firstTotal !== undefined) {
      row.classList.add("rank-1");
    } else if (secondTotal !== undefined && d.total === secondTotal) {
      row.classList.add("rank-2");
    } else if (thirdTotal !== undefined && d.total === thirdTotal) {
      row.classList.add("rank-3");
    }

    if (d.longest_kill === maxLongest && maxLongest > 0) {
      row.classList.add("highlight");
    }
  });
}
