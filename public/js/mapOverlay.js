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
      <div class="overlay-card">
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

  function buildStatsBar(mapData) {
    const { total_games, wins, losses, win_rate, avg } = mapData;

    return `
      <div class="map-stats-bar">
        <div class="map-stats-bar__item">
          <div class="map-stats-bar__value">${total_games}</div>
          <div class="map-stats-bar__label">Mänge</div>
        </div>
        <div class="map-stats-bar__item">
          <div class="map-stats-bar__value">${wins}</div>
          <div class="map-stats-bar__label">Võite</div>
        </div>
        <div class="map-stats-bar__item">
          <div class="map-stats-bar__value">${losses}</div>
          <div class="map-stats-bar__label">Kaotusi</div>
        </div>
        <div class="map-stats-bar__item">
          <div class="map-stats-bar__value">${win_rate}%</div>
          <div class="map-stats-bar__label">Võid %</div>
        </div>
        <div class="map-stats-bar__item">
          <div class="map-stats-bar__value">${avg.kills}</div>
          <div class="map-stats-bar__label">Ø Kills</div>
        </div>
        <div class="map-stats-bar__item">
          <div class="map-stats-bar__value">${avg.outposts}</div>
          <div class="map-stats-bar__label">Ø OP</div>
        </div>
        <div class="map-stats-bar__item">
          <div class="map-stats-bar__value">${avg.garrisons}</div>
          <div class="map-stats-bar__label">Ø Gar</div>
        </div>
        <div class="map-stats-bar__item">
          <div class="map-stats-bar__value">${avg.longest_kill}m</div>
          <div class="map-stats-bar__label">Ø Kaugeim</div>
        </div>
      </div>
    `;
  }

  function buildPlayersSection(mapData) {
    const parts = [];

    if (mapData.top_player) {
      const p = mapData.top_player;
      parts.push(`
        <div class="map-player-chip map-player-chip--top">
          <span class="map-player-chip__badge">🏆</span>
          <span class="map-player-chip__name">${p.player_name}</span>
          <span class="map-player-chip__detail">${p.total_kills} killi / ${p.games} mängu</span>
        </div>
      `);
    }

    if (mapData.most_active && mapData.most_active.player_name !== mapData.top_player?.player_name) {
      const a = mapData.most_active;
      parts.push(`
        <div class="map-player-chip">
          <span class="map-player-chip__badge">👤</span>
          <span class="map-player-chip__name">${a.player_name}</span>
          <span class="map-player-chip__detail">${a.games} mängu</span>
        </div>
      `);
    }

    if (!parts.length) return "";

    return `
      <div class="map-players-section">
        <div class="map-section-title">Mängijad</div>
        <div class="map-players-row">${parts.join("")}</div>
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
      // Load both in parallel
      const [games, allMapStats] = await Promise.all([
        fetchMapGames(mapName),
        statsCache ? Promise.resolve(statsCache) : fetchMapStats().then(s => { statsCache = s; return s; })
      ]);

      const mapData = (allMapStats.maps || []).find(m => m.map_name === mapName) || null;

      // --- Stats summary ---
      let statsHtml = "";
      if (mapData) {
        statsHtml = `
          ${buildStatsBar(mapData)}
          ${buildPlayersSection(mapData)}
          ${mapData.last_played ? `<div class="map-last-played">Viimati mängitud: ${formatDate(mapData.last_played)}</div>` : ""}
        `;
      }

      // --- Games list ---
      let listHtml = "";
      if (!games || games.length === 0) {
        listHtml = `<div class="overlay-empty">Selle kaardi kohta pole ühtegi mängu.</div>`;
      } else {
        const rows = games.map(g => {
          const resultStr = g.result === "win" ? "Võit ✅" : g.result === "loss" ? "Kaotus ❌" : "Pole oluline";
          const cls = g.result === "win" ? "result-win" : g.result === "loss" ? "result-loss" : "result-none";
          return `
            <div class="overlay-row">
              <div class="overlay-row-date">${formatDate(g.created_at)}</div>
              <div class="overlay-row-result ${cls}">${resultStr}</div>
            </div>
          `;
        }).join("");

        listHtml = `
          <div class="map-section-title" style="margin-top:1.2rem;">Mängud (${games.length})</div>
          <div class="overlay-list">${rows}</div>
        `;
      }

      bodyEl.innerHTML = `
        <div class="map-stats-block">${statsHtml || `<div class="overlay-empty">Statistikat pole veel.</div>`}</div>
        ${listHtml}
      `;

    } catch (err) {
      console.error(err);
      bodyEl.innerHTML = `<div class="overlay-error">Viga laadimisel: ${err?.message || err}</div>`;
    }
  }

  window.openMapOverlay = openMapOverlay;
})();
