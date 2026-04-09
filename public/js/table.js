// public/js/table.js

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

  return `${map}${resText} – ${when}`;
}

// Arvuta punktid sama loogikaga mis server: kill + 3*OP + 6*G + boonus pikima killi eest
function calculateScores(entries) {
  const arr = entries.map(e => ({
    ...e,
    kills: Number(e.kills) || 0,
    outposts: Number(e.outposts) || 0,
    garrisons: Number(e.garrisons) || 0,
    longest_kill: Number(e.longest_kill) || 0
  }));

  const maxLongest = arr.reduce(
    (m, e) => (e.longest_kill > m ? e.longest_kill : m),
    0
  );

  return arr
    .map(e => {
      const base = e.kills + e.outposts * 3 + e.garrisons * 6;
      const bonus = maxLongest > 0 && e.longest_kill === maxLongest ? 1 : 0;
      const total = base + bonus;
      return {
        ...e,
        base,
        bonus,
        total
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
    td.colSpan = 9;
    td.textContent = "Selles mängus pole mängijaid.";
    tr.appendChild(td);
    tbodyEl.appendChild(tr);
    return;
  }

  const scored = calculateScores(entries);
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

    tr.innerHTML = `
      <td class="pos-cell">${index + 1}</td>
      <td class="name-cell">${e.player_name}</td>
      <td><input type="number" class="score-input" data-field="kills" min="0" value="${e.kills}"></td>
      <td><input type="number" class="score-input" data-field="outposts" min="0" value="${e.outposts}"></td>
      <td><input type="number" class="score-input" data-field="garrisons" min="0" value="${e.garrisons}"></td>
      <td><input type="number" class="score-input" data-field="longest_kill" min="0" value="${e.longest_kill || 0}"></td>
      <td>${e.bonus || (maxLongest > 0 && e.longest_kill === maxLongest) ? '<span class="bonus-tag">kaugeim kill</span>' : ''}</td>
      <td class="total-cell">${e.total}</td>
      <td><button class="btn btn-secondary" data-delete="${e.id || ''}" tabindex="-1">X</button></td>
    `;

    tbodyEl.appendChild(tr);
  });
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
      const val = Number(inp.value) || 0;
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
      const val = Number(inp.value) || 0;
      data[field] = val;
    });

    rowData.push(data);
  });

  if (!rowData.length) return;

  // leia max longest kill
  const maxLongest = rowData.reduce(
    (m, d) => (d.longest_kill > m ? d.longest_kill : m),
    0
  );

  // arvuta punktid
  rowData.forEach(d => {
    const base = d.kills + d.outposts * 3 + d.garrisons * 6;
    const bonus = maxLongest > 0 && d.longest_kill === maxLongest ? 1 : 0;
    d.base = base;
    d.bonus = bonus;
    d.total = base + bonus;
  });

  // leia unikaalsed skoorid, et teada kes on 1., 2., 3. koht
  const uniqueTotals = [...new Set(rowData.map(d => d.total))]
    .filter(t => t > 0)
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

    if (d.total === firstTotal && firstTotal > 0) {
      row.classList.add("rank-1");
    } else if (secondTotal !== undefined && d.total === secondTotal && secondTotal > 0) {
      row.classList.add("rank-2");
    } else if (thirdTotal !== undefined && d.total === thirdTotal && thirdTotal > 0) {
      row.classList.add("rank-3");
    }

    if (d.longest_kill === maxLongest && maxLongest > 0) {
      row.classList.add("highlight");
    }

    // NB! mitte mingit tbodyEl.appendChild(row) siin!
  });
}
