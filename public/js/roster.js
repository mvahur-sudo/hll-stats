function renderRoster(players, rosterEl) {
  rosterEl.innerHTML = "";
  players.forEach(p => {
    const span = document.createElement("span");
    span.className = "roster-pill";
    span.innerHTML = `
      <span class="roster-name">${p.name}</span>
      <button
        type="button"
        class="roster-remove"
        data-player-id="${p.id}"
        data-player-name="${p.name}"
      >×</button>
    `;
    rosterEl.appendChild(span);
  });
}
