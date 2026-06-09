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
//        second: "2-digit",
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

// Joonista tabel entries põhjal
function renderTable(entries, tbodyEl) {
  tbodyEl.innerHTML = "";

  if (!entries || !entries.length) {
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

  scored.forEach((e, index) => {
    const tr = document.createElement("tr");
    tr.dataset.playerName = e.player_name;
    if (e.id) tr.dataset.entryId = e.id;

    // medalikohad
    if (index === 0) tr.classList.add("rank-1");
    else if (index === 1) tr.classList.add("rank-2");
    else if (index === 2) tr.classList.add("rank-3");

    // pikim kill highlight
    if (e.longest_kill === maxLongest && maxLongest > 0) {
      tr.classList.add("highlight");
    }

    const stepHtml = (val) => `
      <div class="score-stepper">
        <button type="button" class="step-down" tabindex="-1" aria-label="Vähenda">−</button>
        <button type="button" class="step-up" tabindex="-1" aria-label="Suurenda">+</button>
      </div>`;

    tr.innerHTML = `
      <td class="pos-cell">${index + 1}</td>
      <td class="name-cell">${e.player_name}</td>
      <td><input type="number" class="score-input" data-field="kills" min="0" value="${e.kills}" inputmode="numeric" pattern="[0-9]*">${stepHtml(e.kills)}</td>
      <td><input type="number" class="score-input" data-field="deaths" min="0" value="${e.deaths}" inputmode="numeric" pattern="[0-9]*">${stepHtml(e.deaths)}</td>
      <td><input type="number" class="score-input" data-field="outposts" min="0" value="${e.outposts}" inputmode="numeric" pattern="[0-9]*">${stepHtml(e.outposts)}</td>
      <td><input type="number" class="score-input" data-field="garrisons" min="0" value="${e.garrisons}" inputmode="numeric" pattern="[0-9]*">${stepHtml(e.garrisons)}</td>
      <td><input type="number" class="score-input" data-field="longest_kill" min="0" value="${e.longest_kill || 0}" inputmode="numeric" pattern="[0-9]*">${stepHtml(e.longest_kill || 0)}</td>
      <td class="bonus-cell">${formatScoreNote(e)}</td>
      <td class="total-cell">${e.total}</td>
      <td><button class="btn btn-secondary" data-delete="${e.id || ''}" tabindex="-1">X</button></td>
    `;

    tbodyEl.appendChild(tr);
  });

  ensureStepperDelegation(tbodyEl);
}

// Kogu tabelist andmed, et salvestamiseks payload teha
function collectTablePayloads(tbodyEl) {
  const rows = [...tbodyEl.querySelectorAll("tr")];
  const result = [];

  rows.forEach(row => {
    const nameCell = row.querySelector(".name-cell");
    const inputs = row.querySelectorAll(".score-input");
    if (!nameCell || !inputs.length) return; // placeholder row

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

  // leia max longest kill
  const maxLongest = rowData.reduce(
    (m, d) => (d.longest_kill > m ? d.longest_kill : m),
    0
  );

  // arvuta punktid
  rowData.forEach(d => {
    Object.assign(d, calculateScoreParts(d, maxLongest, challenge));
  });

  // leia unikaalsed skoorid, et teada kes on 1., 2., 3. koht
  const uniqueTotals = [...new Set(rowData.map(d => d.total))]
    .filter(t => t !== 0)
    .sort((a, b) => b - a);

  const firstTotal = uniqueTotals[0];
  const secondTotal = uniqueTotals[1];
  const thirdTotal = uniqueTotals[2];

  // puhasta klassid
  rows.forEach(r => {
    r.classList.remove("rank-1", "rank-2", "rank-3", "highlight");
  });

  // uuenda iga rea total + klassid, aga ÄRA liiguta ridu
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

    // NB! mitte mingit tbodyEl.appendChild(row) siin!
  });
}

// Stepper buttons (+ / -) — attach once via delegation
function ensureStepperDelegation(tbodyEl) {
  if (tbodyEl.dataset.stepperHooked === '1') return;
  tbodyEl.dataset.stepperHooked = '1';

  tbodyEl.addEventListener('click', (e) => {
    const stepBtn = e.target.closest('.step-up, .step-down');
    if (!stepBtn) return;

    const td = stepBtn.closest('td');
    const input = td ? td.querySelector('.score-input') : null;
    if (!input) return;

    const delta = stepBtn.classList.contains('step-up') ? 1 : -1;
    const min = parseInt(input.getAttribute('min') || '0', 10);
    let val = parseInt(input.value || '0', 10);
    if (isNaN(val)) val = 0;

    val = Math.max(min, val + delta);
    input.value = val;

    // Trigger recalc
    input.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
  });
}
