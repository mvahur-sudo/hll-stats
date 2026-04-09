// public/js/api.js

const API_BASE = ""; // sama origin

async function handleJsonResponse(res) {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} – ${text}`);
  }
  return res.json();
}

// --- PLAYERS (ROOSTER) ---

async function fetchPlayers() {
  const res = await fetch(API_BASE + "/api/players");
  return handleJsonResponse(res);
}

async function createPlayer(name) {
  const res = await fetch(API_BASE + "/api/players", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name })
  });
  return handleJsonResponse(res);
}

async function deletePlayer(playerId) {
  const res = await fetch(API_BASE + `/api/players/${playerId}`, {
    method: "DELETE"
  });

  if (!res.ok && res.status !== 204) {
    const text = await res.text().catch(() => "");
    throw new Error(`Player delete failed (${res.status}): ${text || "unknown error"}`);
  }
}

// --- GAMES ---

async function fetchGames() {
  const res = await fetch(API_BASE + "/api/games");
  return handleJsonResponse(res);
}

async function createGame(payload) {
  const res = await fetch(API_BASE + "/api/games", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return handleJsonResponse(res);
}

async function deleteGame(gameId) {
  const res = await fetch(API_BASE + `/api/games/${gameId}`, {
    method: "DELETE"
  });

  if (!res.ok && res.status !== 204) {
    const text = await res.text().catch(() => "");
    throw new Error(`Delete failed (${res.status}): ${text || "unknown error"}`);
  }
}

// --- ENTRIES ---

async function fetchEntries(gameId) {
  const res = await fetch(API_BASE + `/api/games/${gameId}/entries`);
  return handleJsonResponse(res);
}

async function saveEntry(gameId, data) {
  const res = await fetch(API_BASE + `/api/games/${gameId}/entries`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  return handleJsonResponse(res);
}

async function deleteEntry(entryId) {
  const res = await fetch(API_BASE + `/api/entries/${entryId}`, {
    method: "DELETE"
  });

  if (!res.ok && res.status !== 204) {
    const text = await res.text().catch(() => "");
    throw new Error(`Entry delete failed (${res.status}): ${text || "unknown error"}`);
  }
}

// --- STATS ---

async function fetchStats() {
  const res = await fetch(API_BASE + "/api/stats");
  return handleJsonResponse(res);
}

async function fetchMapGames(mapName) {
  const res = await fetch(API_BASE + `/api/maps/${encodeURIComponent(mapName)}/games`);
  return handleJsonResponse(res);
}