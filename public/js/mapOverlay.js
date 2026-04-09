/* public/js/mapOverlay.js */

(function () {
  let overlayEl = null;

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

    // sulgemine (X nupp)
    overlayEl.querySelector("#overlayCloseBtn").addEventListener("click", closeOverlay);

    // sulgemine backdrop click
    overlayEl.querySelector(".overlay-backdrop").addEventListener("click", closeOverlay);

    // sulgemine ESC
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeOverlay();
    });

    return overlayEl;
  }

  function closeOverlay() {
    if (!overlayEl) return;
    overlayEl.classList.add("hidden");
  }

  async function openMapOverlay(mapName) {
    const ov = ensureOverlay();
    ov.classList.remove("hidden");

    const titleEl = ov.querySelector("#overlayTitle");
    const bodyEl = ov.querySelector("#overlayBody");

    titleEl.textContent = mapName;
    bodyEl.innerHTML = `<div class="overlay-loading">Laen mängud...</div>`;

    try {
      if (typeof fetchMapGames !== "function") {
        bodyEl.innerHTML = `<div class="overlay-error">fetchMapGames puudub.</div>`;
        return;
      }

      const games = await fetchMapGames(mapName);

      if (!games || games.length === 0) {
        bodyEl.innerHTML = `<div class="overlay-empty">Selle kaardi kohta pole ühtegi mängu.</div>`;
        return;
      }

      const list = document.createElement("div");
      list.className = "overlay-list";

      games.forEach(g => {
        const d = new Date(g.created_at);
        const dateStr = isNaN(d.getTime())
          ? g.created_at
          : d.toLocaleString("et-EE", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              hour12: false
            });

        let resultStr = "Pole oluline";
        if (g.result === "win") resultStr = "Võit ✅";
        else if (g.result === "loss") resultStr = "Kaotus ❌";

        const row = document.createElement("div");
        row.className = "overlay-row";
        row.innerHTML = `
          <div class="overlay-row-date">${dateStr}</div>
          <div class="overlay-row-result">${resultStr}</div>
        `;

        list.appendChild(row);
      });

      bodyEl.innerHTML = "";
      bodyEl.appendChild(list);

    } catch (err) {
      console.error(err);
      bodyEl.innerHTML = `<div class="overlay-error">Viga mängude laadimisel: ${err?.message || err}</div>`;
    }
  }

  // teeme globaalseks, et main.js saaks kasutada
  window.openMapOverlay = openMapOverlay;
})();
