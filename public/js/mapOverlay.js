/* public/js/mapOverlay.js */

(function () {
  let overlayEl = null;
  let statsCache = null;

  function ensureOverlay() {
    if (overlayEl) return overlayEl;

    overlayEl = document.createElement("div");
    overlayEl.id = "mapOverlay";
    overlayEl.className = "overlay hidden";
    overlayEl.innerHTML = `
      <div class="overlay-backdrop"></div>
      <div class="overlay-card overlay-card--wide">
        <div class="overlay-header">
          <h3 id="overlayTitle">Kaardi detailid</h3>
          <button id="overlayCloseBtn" class="overlay-close">×</button>
        </div>
        <div id="overlayBody" class="overlay-body">
          <div class="overlay-loading">Laen...</div>
        </div>
      </div>
    `;

    document.body.appendChild(overlayEl);
    overlayEl.querySelector("#overlayCloseBtn").addEventListener("click", closeOverlay);
    overlayEl.querySelector(".overlay-backdrop").addEventListener("click", closeOverlay);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeOverlay();
    });

    return overlayEl;
  }

  function closeOverlay() {
    if (!overlayEl) return;
    overlayEl.classList.add("hidden");
  }

  function formatDate(iso) {
    if (!iso) return "–";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString("et-EE", {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false
    });
  }

  function formatResult(result) {
    if (result === "win") return { text: "Võit", cls: "result-win", short: "W" };
    if (result === "loss") return { text: "Kaotus", cls: "result-loss", short: "L" };
    return { text: "Pole oluline", cls: "result-none", short: "-" };
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function buildStatsBar(mapData) {
    const { total_games, wins, losses, win_rate, avg } = mapData;
    return `
      <div class="map-stats-bar">
        <div class="map-stats-bar__item"><div class="map-stats-bar__value">${total_games}</div><div class="map-stats-bar__label">Mänge</div></div>
        <div class="map-stats-bar__item"><div class="map-stats-bar__value">${wins}</div><div class="map-stats-bar__label">Võite</div></div>
        <div class="map-stats-bar__item"><div class="map-stats-bar__value">${losses}</div><div class="map-stats-bar__label">Kaotusi</div></div>
        <div class="map-stats-bar__item"><div class="map-stats-bar__value">${win_rate}%</div><div class="map-stats-bar__label">Winrate</div></div>
        <div class="map-stats-bar__item"><div class="map-stats-bar__value">${avg.kills}</div><div class="map-stats-bar__label">Ø Kills</div></div>
        <div class="map-stats-bar__item"><div class="map-stats-bar__value">${avg.outposts}</div><div class="map-stats-bar__label">Ø OP</div></div>
        <div class="map-stats-bar__item"><div class="map-stats-bar__value">${avg.garrisons}</div><div class="map-stats-bar__label">Ø Gar</div></div>
        <div class="map-stats-bar__item"><div class="map-stats-bar__value">${avg.longest_kill}m</div><div class="map-stats-bar__label">Ø Kaugeim</div></div>
        <div class="map-stats-bar__item"><div class="map-stats-bar__value">${avg.score}</div><div class="map-stats-bar__label">Ø Score</div></div>
      </div>
    `;
  }

  function buildTop5Table(mapData) {
    const rows = Array.isArray(mapData.top_5_players) ? mapData.top_5_players : [];
    if (!rows.length) return `<div class="overlay-empty">Top mängijaid pole veel.</div>`;

    return `
      <div class="map-section-title">Top 5 mängijat</div>
      <div class="overlay-table-wrap">
        <table class="overlay-table overlay-table--compact">
          <thead>
            <tr>
              <th>#</th>
              <th>Mängija</th>
              <th>Mänge</th>
              <th>WR</th>
              <th>Kills</th>
              <th>OP</th>
              <th>Gar</th>
              <th>Longest</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((row, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td>${escapeHtml(row.player_name)}</td>
                <td>${row.games}</td>
                <td>${row.win_rate}%</td>
                <td>${row.kills}</td>
                <td>${row.outposts}</td>
                <td>${row.garrisons}</td>
                <td>${row.longest_kill}</td>
                <td>${row.score}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function buildTrendBlock(mapData) {
    const trend = mapData.trend_last_10 || {};
    const form = Array.isArray(trend.form) ? trend.form : [];
    return `
      <div class="map-section-title">Trend, viimased 10 mängu</div>
      <div class="map-trend-grid">
        <div class="map-trend-card"><span class="map-trend-card__value">${trend.games || 0}</span><span class="map-trend-card__label">Mänge</span></div>
        <div class="map-trend-card"><span class="map-trend-card__value">${trend.wins || 0}</span><span class="map-trend-card__label">Võite</span></div>
        <div class="map-trend-card"><span class="map-trend-card__value">${trend.losses || 0}</span><span class="map-trend-card__label">Kaotusi</span></div>
        <div class="map-trend-card"><span class="map-trend-card__value">${trend.win_rate || 0}%</span><span class="map-trend-card__label">Winrate</span></div>
        <div class="map-trend-card"><span class="map-trend-card__value">${trend.avg_score || 0}</span><span class="map-trend-card__label">Ø Score</span></div>
        <div class="map-trend-card"><span class="map-trend-card__value">${trend.avg_kills || 0}</span><span class="map-trend-card__label">Ø Kills</span></div>
        <div class="map-trend-card"><span class="map-trend-card__value">${trend.avg_outposts || 0}</span><span class="map-trend-card__label">Ø OP</span></div>
        <div class="map-trend-card"><span class="map-trend-card__value">${trend.avg_garrisons || 0}</span><span class="map-trend-card__label">Ø Gar</span></div>
      </div>
      <div class="map-form-row">
        ${(form.length ? form : ['-']).map(item => `<span class="map-form-pill map-form-pill--${item === 'W' ? 'win' : item === 'L' ? 'loss' : 'neutral'}">${item}</span>`).join("")}
      </div>
    `;
  }

  function buildBreakdownTable(mapData) {
    const rows = Array.isArray(mapData.player_breakdown) ? mapData.player_breakdown : [];
    if (!rows.length) return `<div class="overlay-empty">Player breakdown puudub.</div>`;

    return `
      <div class="map-section-title">Win/loss breakdown mängijate lõikes</div>
      <div class="overlay-table-wrap">
        <table class="overlay-table">
          <thead>
            <tr>
              <th>Mängija</th>
              <th>Mänge</th>
              <th>Võite</th>
              <th>Kaotusi</th>
              <th>WR</th>
              <th>Avg Kills</th>
              <th>Avg OP</th>
              <th>Avg Gar</th>
              <th>Avg Score</th>
              <th>Longest</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(row => `
              <tr>
                <td>${escapeHtml(row.player_name)}</td>
                <td>${row.games}</td>
                <td>${row.wins}</td>
                <td>${row.losses}</td>
                <td>${row.win_rate}%</td>
                <td>${row.avg_kills}</td>
                <td>${row.avg_outposts}</td>
                <td>${row.avg_garrisons}</td>
                <td>${row.avg_score}</td>
                <td>${row.longest_kill}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function buildFullDetailTable(mapData) {
    const rows = Array.isArray(mapData.full_detail) ? mapData.full_detail : [];
    if (!rows.length) return `<div class="overlay-empty">Kaardi detailmänge pole veel.</div>`;

    return `
      <div class="map-section-title">Full detail tabel</div>
      <div class="overlay-table-wrap">
        <table class="overlay-table">
          <thead>
            <tr>
              <th>Aeg</th>
              <th>Tulemus</th>
              <th>Kills</th>
              <th>OP</th>
              <th>Gar</th>
              <th>Score</th>
              <th>Top 3</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(row => {
              const result = formatResult(row.result);
              const top3 = (row.players || []).slice(0, 3).map(p => `${escapeHtml(p.player_name)} (${p.score})`).join(', ');
              return `
                <tr>
                  <td>${formatDate(row.created_at)}</td>
                  <td><span class="${result.cls}">${result.text}</span></td>
                  <td>${row.total_kills}</td>
                  <td>${row.total_outposts}</td>
                  <td>${row.total_garrisons}</td>
                  <td>${row.total_score}</td>
                  <td>${top3 || '–'}</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  async function openMapOverlay(mapName) {
    const ov = ensureOverlay();
    ov.classList.remove("hidden");

    const titleEl = ov.querySelector("#overlayTitle");
    const bodyEl = ov.querySelector("#overlayBody");
    titleEl.textContent = mapName;
    bodyEl.innerHTML = `<div class="overlay-loading">Laen kaardi andmeid...</div>`;

    try {
      const allMapStats = statsCache ? statsCache : await fetchMapStats().then(s => { statsCache = s; return s; });
      const mapData = (allMapStats.maps || []).find(m => m.map_name === mapName) || null;

      if (!mapData) {
        bodyEl.innerHTML = `<div class="overlay-empty">Selle kaardi kohta pole statistikat.</div>`;
        return;
      }

      bodyEl.innerHTML = `
        <div class="map-overlay-grid">
          <section class="map-panel map-panel--full">
            ${buildStatsBar(mapData)}
            ${mapData.last_played ? `<div class="map-last-played">Viimati mängitud: ${formatDate(mapData.last_played)}</div>` : ''}
          </section>

          <section class="map-panel">
            ${buildTop5Table(mapData)}
          </section>

          <section class="map-panel">
            ${buildTrendBlock(mapData)}
          </section>

          <section class="map-panel map-panel--full">
            ${buildBreakdownTable(mapData)}
          </section>

          <section class="map-panel map-panel--full">
            ${buildFullDetailTable(mapData)}
          </section>
        </div>
      `;
    } catch (err) {
      console.error(err);
      bodyEl.innerHTML = `<div class="overlay-error">Viga laadimisel: ${err?.message || err}</div>`;
    }
  }

  window.openMapOverlay = openMapOverlay;
})();
