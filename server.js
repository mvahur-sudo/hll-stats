const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3124;

// Ühine kood, millega lehele pääseb
const ACCESS_CODE = 'smile';

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.get('/favicon.ico', (req, res) => {
  res.sendFile(path.join(__dirname, 'favicon.ico'));
});

// --- HEALTH (võib jääda ilma koodita) ---
app.get('/health', (req, res) => {
  res.send('OK');
});

// --- LOGIN LEHT (ilma autentimiseta) ---
app.get('/login', (req, res) => {
  const error = req.query.error === '1';
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="et">
<head>
  <meta charset="UTF-8">
  <title>HLL stats – sisselogimine</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">

  <link rel="icon" href="/favicon.ico" type="image/x-icon">

  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: radial-gradient(circle at top, #0b1120 0, #020617 45%, #000 100%);
      color: #e5e7eb;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .login-card {
      background: #020617;
      border-radius: 0.9rem;
      border: 1px solid #1f2937;
      box-shadow: 0 16px 40px rgba(15,23,42,0.7);
      padding: 1.5rem 1.75rem;
      width: 100%;
      max-width: 360px;
    }
    h1 {
      margin: 0 0 0.75rem;
      font-size: 1.25rem;
      text-align: center;
    }
    p {
      margin: 0 0 0.75rem;
      font-size: 0.85rem;
      color: #9ca3af;
      text-align: center;
    }
    form {
      margin-top: 0.5rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    label {
      font-size: 0.8rem;
    }
    input[type="password"] {
      width: 100%;
      padding: 0.4rem 0.6rem;
      border-radius: 0.4rem;
      border: 1px solid #374151;
      background: #020617;
      color: #e5e7eb;
      font-size: 0.9rem;
    }
    .btn {
      border-radius: 999px;
      border: 1px solid transparent;
      padding: 0.4rem 0.9rem;
      font-size: 0.9rem;
      cursor: pointer;
      font-weight: 500;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      background: linear-gradient(135deg, #2dd4bf, #22c55e);
      color: #020617;
      border-color: #064e3b;
      margin-top: 0.25rem;
    }
    .btn:hover {
      filter: brightness(1.05);
    }
    .error {
      margin-bottom: 0.5rem;
      font-size: 0.8rem;
      color: #fecaca;
      background: rgba(127,29,29,0.25);
      border-radius: 0.4rem;
      padding: 0.35rem 0.5rem;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="login-card">
    <h1>HLL stats</h1>
    <p>Sisesta ligipääsu kood</p>
    ${error ? '<div class="error">Vale kood, proovi uuesti.</div>' : ''}
    <form method="POST" action="/login">
      <label for="code">Kood</label>
      <input id="code" name="code" type="password" autocomplete="off" autofocus>
      <button class="btn" type="submit">Sisene</button>
    </form>
  </div>
</body>
</html>`);
});

app.post('/login', (req, res) => {
  const code = (req.body.code || '').trim();
  if (!code || code !== ACCESS_CODE) {
    return res.redirect('/login?error=1');
  }
  // Õige kood -> sea cookie ja suuna avalehele
  res.setHeader('Set-Cookie', 'hll_auth=1; HttpOnly; Path=/');
  res.redirect('/');
});

// --- AUTH MIDDLEWARE: kõik muu välja arvatud /login ja /health vajab cookie't ---
app.use((req, res, next) => {
  if (req.path === '/login' || req.path === '/health' || req.path === '/favicon.ico') {
    return next();
  }
  const cookieHeader = req.headers.cookie || '';
  const authed = cookieHeader.split(';').some(c => c.trim().startsWith('hll_auth=1'));
  if (authed) return next();
  res.redirect('/login');
});

// --- STATIC FRONTEND ---
app.use(express.static(path.join(__dirname, 'public')));

// --- ANDMEBAAS ---
const dbFile = path.join(__dirname, 'hll_stats.db');
const db = new sqlite3.Database(dbFile);

db.serialize(() => {
  // mängud
  db.run(`
    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      map_name TEXT,
      result TEXT,
      created_at TEXT NOT NULL
    )
  `);

  // mängijate read mängude juures
  db.run(`
    CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL,
      player_name TEXT NOT NULL,
      kills INTEGER NOT NULL DEFAULT 0,
      outposts INTEGER NOT NULL DEFAULT 0,
      garrisons INTEGER NOT NULL DEFAULT 0,
      longest_kill INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
    )
  `);

  // püsiv mängijate nimekiri (rooster)
  db.run(`
    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      active INTEGER NOT NULL DEFAULT 1
    )
  `);
});

// --- API: players (rooster) ---
// kõik aktiivsed mängijad
app.get('/api/players', (req, res) => {
  db.all(
    'SELECT id, name FROM players WHERE active = 1 ORDER BY name ASC',
    (err, rows) => {
      if (err) {
        console.error('DB error /api/players:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(rows);
    }
  );
});

// lisa mängija roosteri (või tee uuesti aktiivseks, kui sama nimi juba olemas)
app.post('/api/players', (req, res) => {
  const { name } = req.body || {};
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Nimi on kohustuslik' });
  }
  const clean = name.trim();

  db.run(
    'INSERT INTO players (name, active) VALUES (?, 1)',
    [clean],
    function (err) {
      if (err) {
        // kui nimi juba olemas -> tee lihtsalt aktiivseks
        if (err.message && err.message.includes('UNIQUE')) {
          db.get(
            'SELECT id, name FROM players WHERE name = ?',
            [clean],
            (err2, row) => {
              if (err2 || !row) {
                console.error('DB error SELECT /api/players (revive):', err2);
                return res.status(500).json({ error: 'Database error' });
              }
              db.run(
                'UPDATE players SET active = 1 WHERE id = ?',
                [row.id],
                function (err3) {
                  if (err3) {
                    console.error('DB error UPDATE /api/players (revive):', err3);
                    return res.status(500).json({ error: 'Database error' });
                  }
                  return res.status(200).json(row);
                }
              );
            }
          );
          return;
        }
        console.error('DB error INSERT /api/players:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.status(201).json({ id: this.lastID, name: clean });
    }
  );
});

// eemalda mängija roosteri nimekirjast (active = 0)
app.delete('/api/players/:id', (req, res) => {
  const playerId = req.params.id;

  db.run(
    'UPDATE players SET active = 0 WHERE id = ?',
    [playerId],
    function (err) {
      if (err) {
        console.error('DB error DELETE /api/players/:id:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Mängijat ei leitud' });
      }
      return res.status(204).send();
    }
  );
});

// --- API: games ---
// kõik mängud
app.get('/api/games', (req, res) => {
  db.all(
    'SELECT id, name, map_name, result, created_at FROM games ORDER BY created_at DESC',
    (err, rows) => {
      if (err) {
        console.error('DB error /api/games:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(rows);
    }
  );
});

// loo uus mäng
app.post('/api/games', (req, res) => {
  const { map_name, result } = req.body || {};

  if (!map_name || !map_name.trim()) {
    return res.status(400).json({ error: 'Kaardi nimi on kohustuslik' });
  }

  const createdAt = new Date().toISOString();
  const cleanMap = map_name.trim();

  let cleanResult = null;
  if (result === 'win' || result === 'loss') {
    cleanResult = result;
  }

  const name = cleanMap;

  db.run(
    'INSERT INTO games (name, map_name, result, created_at) VALUES (?, ?, ?, ?)',
    [name, cleanMap, cleanResult, createdAt],
    function (err) {
      if (err) {
        console.error('DB error INSERT /api/games:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      const gameId = this.lastID;

      // lisa kõik aktiivsed mängijad entries tabelisse
      db.all(
        'SELECT name FROM players WHERE active = 1 ORDER BY name ASC',
        (err2, players) => {
          if (err2) {
            console.error('DB error SELECT players for new game:', err2);
          } else {
            players.forEach(p => {
              db.run(
                `
                INSERT INTO entries
                  (game_id, player_name, kills, outposts, garrisons, longest_kill)
                VALUES (?, ?, 0, 0, 0, 0)
                `,
                [gameId, p.name],
                (err3) => {
                  if (err3) {
                    console.error('DB error INSERT entry for player in new game:', err3);
                  }
                }
              );
            });
          }
        }
      );

      res.status(201).json({
        id: gameId,
        name,
        map_name: cleanMap,
        result: cleanResult,
        created_at: createdAt
      });
    }
  );
});

// kustuta mäng
app.delete('/api/games/:id', (req, res) => {
  const gameId = req.params.id;
  console.log('DELETE /api/games/:id', gameId);

  db.run('DELETE FROM games WHERE id = ?', [gameId], function (err) {
    if (err) {
      console.error('DB error DELETE /api/games/:id:', err);
      return res.status(500).json({ error: 'Database error', details: err.message });
    }
    return res.status(204).send();
  });
});

// --- API: entries ---
app.get('/api/games/:id/entries', (req, res) => {
  const gameId = req.params.id;
  db.all(
    'SELECT * FROM entries WHERE game_id = ? ORDER BY id ASC',
    [gameId],
    (err, rows) => {
      if (err) {
        console.error('DB error /api/games/:id/entries:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(rows);
    }
  );
});

app.post('/api/games/:id/entries', (req, res) => {
  const gameId = req.params.id;
  const { player_name, kills, outposts, garrisons, longest_kill } = req.body || {};

  if (!player_name || !player_name.trim()) {
    return res.status(400).json({ error: 'Mängija nimi on kohustuslik' });
  }

  const nameClean = player_name.trim();
  const k = Number(kills) || 0;
  const o = Number(outposts) || 0;
  const g = Number(garrisons) || 0;
  const lk = Number(longest_kill) || 0;

  db.get(
    'SELECT id FROM entries WHERE game_id = ? AND player_name = ?',
    [gameId, nameClean],
    (err, row) => {
      if (err) {
        console.error('DB error SELECT /api/games/:id/entries:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (row) {
        db.run(
          `
          UPDATE entries
          SET kills = ?, outposts = ?, garrisons = ?, longest_kill = ?
          WHERE id = ?
          `,
          [k, o, g, lk, row.id],
          function (err2) {
            if (err2) {
              console.error('DB error UPDATE /api/games/:id/entries:', err2);
              return res.status(500).json({ error: 'Database error' });
            }
            res.status(200).json({
              id: row.id,
              game_id: gameId,
              player_name: nameClean,
              kills: k,
              outposts: o,
              garrisons: g,
              longest_kill: lk
            });
          }
        );
      } else {
        db.run(
          `
          INSERT INTO entries
            (game_id, player_name, kills, outposts, garrisons, longest_kill)
          VALUES (?, ?, ?, ?, ?, ?)
          `,
          [gameId, nameClean, k, o, g, lk],
          function (err2) {
            if (err2) {
              console.error('DB error INSERT /api/games/:id/entries:', err2);
              return res.status(500).json({ error: 'Database error' });
            }
            res.status(201).json({
              id: this.lastID,
              game_id: gameId,
              player_name: nameClean,
              kills: k,
              outposts: o,
              garrisons: g,
              longest_kill: lk
            });
          }
        );
      }
    }
  );
});

app.delete('/api/entries/:id', (req, res) => {
  const entryId = req.params.id;
  db.run('DELETE FROM entries WHERE id = ?', [entryId], function (err) {
    if (err) {
      console.error('DB error DELETE /api/entries/:id:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Rida ei leitud' });
    }
    res.status(204).send();
  });
});

// --- API: STATS ---
app.get('/api/stats', (req, res) => {
  const stats = {
    winners: {},
    maps: [],
    players: [],
    records: null
  };

  const mapsSql = `
    SELECT
      COALESCE(map_name, 'Tundmatu') AS map_name,
      COUNT(*) AS games,
      SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) AS wins,
      SUM(CASE WHEN result = 'loss' THEN 1 ELSE 0 END) AS losses
    FROM games
    GROUP BY COALESCE(map_name, 'Tundmatu')
    ORDER BY games DESC, map_name ASC
  `;

  const playersSql = `
    SELECT
      e.player_name,
      SUM(e.kills) AS kills,
      SUM(e.outposts) AS outposts,
      SUM(e.garrisons) AS garrisons,
      MAX(e.longest_kill) AS longest_kill,
      SUM(e.kills + e.outposts * 3 + e.garrisons * 6)
      + SUM(
          CASE
            WHEN e.longest_kill = gm.max_longest AND gm.max_longest > 0
            THEN 1 ELSE 0
          END
        ) AS score
    FROM entries e
    JOIN (
      SELECT game_id, MAX(longest_kill) AS max_longest
      FROM entries
      GROUP BY game_id
    ) gm ON e.game_id = gm.game_id
    GROUP BY e.player_name
    ORDER BY e.player_name ASC
  `;

  const winnersSql = `
    SELECT
      e.game_id,
      e.player_name,
      e.kills,
      e.outposts,
      e.garrisons,
      e.longest_kill,
      g.map_name,
      g.created_at
    FROM entries e
    JOIN games g ON g.id = e.game_id
    JOIN players p ON p.name = e.player_name
    WHERE p.active = 1
  `;

  const overallSql = `
  SELECT
    COUNT(*) AS total_games,
    SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) AS total_wins,
    SUM(CASE WHEN result = 'loss' THEN 1 ELSE 0 END) AS total_losses
  FROM games
  `;

  function computeWinnersForWindow(label, days, rows) {
    const now = Date.now();
    const hours = (label === 'day') ? 18 : days * 24;
    const threshold = now - hours * 60 * 60 * 1000;

    const perGame = new Map();

    rows.forEach(r => {
      const d = new Date(r.created_at);
      if (isNaN(d.getTime())) return;
      if (d.getTime() < threshold) return;

      if (!perGame.has(r.game_id)) perGame.set(r.game_id, []);
      perGame.get(r.game_id).push(r);
    });

    const placements = new Map();

    for (const [gid, gameRows] of perGame.entries()) {
      let maxLongest = 0;
      gameRows.forEach(r => {
        const lk = Number(r.longest_kill) || 0;
        if (lk > maxLongest) maxLongest = lk;
      });

      const scores = gameRows.map(r => {
        const kills = Number(r.kills) || 0;
        const outposts = Number(r.outposts) || 0;
        const garrisons = Number(r.garrisons) || 0;
        const lk = Number(r.longest_kill) || 0;

        const base = kills + outposts * 3 + garrisons * 6;
        const bonus = maxLongest > 0 && lk === maxLongest ? 1 : 0;
        const total = base + bonus;

        return { name: r.player_name, total, kills };
      });

      const anyPositive = scores.some(s => s.total > 0);
      if (!anyPositive) continue;

      scores.sort((a, b) =>
        (b.total - a.total) ||
        (b.kills - a.kills) ||
        a.name.localeCompare(b.name)
      );

      scores.forEach((s, idx) => {
        if (!placements.has(s.name)) {
          placements.set(s.name, { player_name: s.name, first: 0, second: 0, third: 0 });
        }
        const pl = placements.get(s.name);

        if (idx === 0) pl.first += 1;
        else if (idx === 1) pl.second += 1;
        else if (idx === 2) pl.third += 1;
      });
    }

    const arr = Array.from(placements.values())
      .sort(
        (a, b) =>
          b.first - a.first ||
          b.second - a.second ||
          b.third - a.third ||
          a.player_name.localeCompare(b.player_name)
      )
      .slice(0, 5);

    stats.winners[label] = arr;
  }

  db.get(overallSql, [], (err0, overallRow) => {
  if (err0) {
    console.error('DB error /api/stats overall:', err0);
    return res.status(500).json({ error: 'Database error' });
  }

  const totalGames = overallRow?.total_games || 0;
  const totalWins = overallRow?.total_wins || 0;
  const totalLosses = overallRow?.total_losses || 0;
  const winPct = totalGames > 0
    ? Math.round((totalWins / totalGames) * 100)
    : 0;

  stats.overall = {
    total_games: totalGames,
    total_wins: totalWins,
    total_losses: totalLosses,
    win_percentage: winPct
  };

  db.all(mapsSql, [], (err, mapRows) => {
    if (err) {
      console.error('DB error /api/stats maps:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    stats.maps = mapRows;

    db.all(playersSql, [], (err2, playerRows) => {
      if (err2) {
        console.error('DB error /api/stats players:', err2);
        return res.status(500).json({ error: 'Database error' });
      }
      stats.players = playerRows;

      db.all(winnersSql, [], (err3, winnerRows) => {
        if (err3) {
          console.error('DB error /api/stats winners:', err3);
          return res.status(500).json({ error: 'Database error' });
        }

        const records = {
          kills: null,
          outposts: null,
          garrisons: null,
          longest_kill: null,
          score: null
        };

        const gameMaxLongest = new Map();
        winnerRows.forEach(r => {
          const gid = r.game_id;
          const lk = Number(r.longest_kill) || 0;
          const curr = gameMaxLongest.get(gid) || 0;
          if (lk > curr) gameMaxLongest.set(gid, lk);
        });

        function updateRecord(key, value, row, extra) {
          if (value <= 0) return;
          if (!records[key] || value > records[key].value) {
            records[key] = {
              player_name: row.player_name,
              value,
              map_name: row.map_name || "Tundmatu kaart",
              created_at: row.created_at,
              game_id: row.game_id,
              ...(extra || {})
            };
          }
        }

        winnerRows.forEach(r => {
          const kills = Number(r.kills) || 0;
          const outposts = Number(r.outposts) || 0;
          const garrisons = Number(r.garrisons) || 0;
          const lk = Number(r.longest_kill) || 0;
          const maxLkForGame = gameMaxLongest.get(r.game_id) || 0;

          const base = kills + outposts * 3 + garrisons * 6;
          const bonus = maxLkForGame > 0 && lk === maxLkForGame ? 1 : 0;
          const totalScore = base + bonus;

          updateRecord('kills', kills, r);
          updateRecord('outposts', outposts, r);
          updateRecord('garrisons', garrisons, r);
          updateRecord('longest_kill', lk, r);
          updateRecord('score', totalScore, r, { base, bonus });
        });

        stats.records = records;

        computeWinnersForWindow('day', 1, winnerRows);
        computeWinnersForWindow('week', 7, winnerRows);
        computeWinnersForWindow('month', 30, winnerRows);
        computeWinnersForWindow('year', 365, winnerRows);

        res.json(stats);
      });
    });
  });
});
});

// --- API: Map games detail ---
app.get('/api/maps/:map/games', (req, res) => {
  const mapName = req.params.map;

  db.all(
    `
    SELECT id, map_name, result, created_at
    FROM games
    WHERE COALESCE(map_name, 'Tundmatu') = ?
    ORDER BY created_at DESC
    `,
    [mapName],
    (err, rows) => {
      if (err) {
        console.error("DB error /api/maps/:map/games:", err);
        return res.status(500).json({ error: "Database error" });
      }
      res.json(rows);
    }
  );
});

// --- API: Rich per-map stats ---
app.get('/api/stats/maps', (req, res) => {
  const mapGamesSql = `
    SELECT
      g.id,
      COALESCE(g.map_name, 'Tundmatu') AS map_name,
      g.result,
      g.created_at
    FROM games g
    ORDER BY g.created_at DESC
  `;

  const mapEntriesSql = `
    SELECT
      e.game_id,
      COALESCE(g.map_name, 'Tundmatu') AS map_name,
      e.player_name,
      e.kills,
      e.outposts,
      e.garrisons,
      e.longest_kill,
      g.result,
      g.created_at
    FROM entries e
    JOIN games g ON g.id = e.game_id
    LEFT JOIN players p ON p.name = e.player_name
    WHERE p.active = 1 OR p.active IS NULL
    ORDER BY g.created_at DESC, e.player_name ASC
  `;

  db.all(mapGamesSql, [], (err, gameRows) => {
    if (err) {
      console.error('DB error /api/stats/maps mapGamesSql:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    db.all(mapEntriesSql, [], (err2, entryRows) => {
      if (err2) {
        console.error('DB error /api/stats/maps mapEntriesSql:', err2);
        return res.status(500).json({ error: 'Database error' });
      }

      const maps = new Map();

      function ensureMap(mapName) {
        if (!maps.has(mapName)) {
          maps.set(mapName, {
            map_name: mapName,
            total_games: 0,
            wins: 0,
            losses: 0,
            win_rate: 0,
            avg: {
              kills: 0,
              outposts: 0,
              garrisons: 0,
              longest_kill: 0,
              score: 0,
            },
            top_5_players: [],
            full_detail: [],
            trend_last_10: {
              games: 0,
              wins: 0,
              losses: 0,
              win_rate: 0,
              form: [],
              avg_score: 0,
              avg_kills: 0,
              avg_outposts: 0,
              avg_garrisons: 0,
            },
            player_breakdown: [],
            top_player: null,
            most_active: null,
            last_played: null,
          });
        }
        return maps.get(mapName);
      }

      const gameEntries = new Map();
      entryRows.forEach(row => {
        if (!gameEntries.has(row.game_id)) gameEntries.set(row.game_id, []);
        gameEntries.get(row.game_id).push(row);
      });

      gameRows.forEach(game => {
        const mapData = ensureMap(game.map_name);
        mapData.total_games += 1;
        if (game.result === 'win') mapData.wins += 1;
        else if (game.result === 'loss') mapData.losses += 1;
        if (!mapData.last_played || game.created_at > mapData.last_played) {
          mapData.last_played = game.created_at;
        }
      });

      const playersByMap = new Map();
      const detailByMap = new Map();
      const trendByMap = new Map();
      const perMapTotals = new Map();

      gameRows.forEach(game => {
        const entries = gameEntries.get(game.id) || [];
        const mapName = game.map_name;
        if (!detailByMap.has(mapName)) detailByMap.set(mapName, []);
        if (!trendByMap.has(mapName)) trendByMap.set(mapName, []);
        if (!perMapTotals.has(mapName)) {
          perMapTotals.set(mapName, {
            kills: 0,
            outposts: 0,
            garrisons: 0,
            longest_kill: 0,
            score: 0,
            entries: 0,
          });
        }

        let maxLongest = 0;
        entries.forEach(e => {
          const lk = Number(e.longest_kill) || 0;
          if (lk > maxLongest) maxLongest = lk;
        });

        let gameKills = 0;
        let gameOutposts = 0;
        let gameGarrisons = 0;
        let gameScore = 0;
        const playerRows = [];

        entries.forEach(e => {
          const kills = Number(e.kills) || 0;
          const outposts = Number(e.outposts) || 0;
          const garrisons = Number(e.garrisons) || 0;
          const longestKill = Number(e.longest_kill) || 0;
          const bonus = maxLongest > 0 && longestKill === maxLongest ? 1 : 0;
          const score = kills + outposts * 3 + garrisons * 6 + bonus;

          gameKills += kills;
          gameOutposts += outposts;
          gameGarrisons += garrisons;
          gameScore += score;

          const totals = perMapTotals.get(mapName);
          totals.kills += kills;
          totals.outposts += outposts;
          totals.garrisons += garrisons;
          totals.longest_kill += longestKill;
          totals.score += score;
          totals.entries += 1;

          if (!playersByMap.has(mapName)) playersByMap.set(mapName, new Map());
          const playerMap = playersByMap.get(mapName);
          if (!playerMap.has(e.player_name)) {
            playerMap.set(e.player_name, {
              player_name: e.player_name,
              games: 0,
              wins: 0,
              losses: 0,
              kills: 0,
              outposts: 0,
              garrisons: 0,
              longest_kill: 0,
              score: 0,
            });
          }
          const player = playerMap.get(e.player_name);
          player.games += 1;
          if (e.result === 'win') player.wins += 1;
          else if (e.result === 'loss') player.losses += 1;
          player.kills += kills;
          player.outposts += outposts;
          player.garrisons += garrisons;
          player.score += score;
          if (longestKill > player.longest_kill) player.longest_kill = longestKill;

          playerRows.push({
            player_name: e.player_name,
            kills,
            outposts,
            garrisons,
            longest_kill: longestKill,
            bonus,
            score,
            result: e.result,
          });
        });

        playerRows.sort((a, b) =>
          b.score - a.score ||
          b.kills - a.kills ||
          a.player_name.localeCompare(b.player_name)
        );

        detailByMap.get(mapName).push({
          game_id: game.id,
          created_at: game.created_at,
          result: game.result || null,
          total_kills: gameKills,
          total_outposts: gameOutposts,
          total_garrisons: gameGarrisons,
          total_score: gameScore,
          players: playerRows,
        });

        trendByMap.get(mapName).push({
          created_at: game.created_at,
          result: game.result || null,
          total_kills: gameKills,
          total_outposts: gameOutposts,
          total_garrisons: gameGarrisons,
          total_score: gameScore,
        });
      });

      const result = Array.from(maps.values()).map(mapData => {
        const totals = perMapTotals.get(mapData.map_name) || { kills: 0, outposts: 0, garrisons: 0, longest_kill: 0, score: 0, entries: 0 };
        const entryCount = totals.entries || 0;

        mapData.win_rate = mapData.total_games > 0
          ? Math.round((mapData.wins / mapData.total_games) * 100)
          : 0;

        mapData.avg = {
          kills: entryCount ? Number((totals.kills / entryCount).toFixed(1)) : 0,
          outposts: entryCount ? Number((totals.outposts / entryCount).toFixed(1)) : 0,
          garrisons: entryCount ? Number((totals.garrisons / entryCount).toFixed(1)) : 0,
          longest_kill: entryCount ? Math.round(totals.longest_kill / entryCount) : 0,
          score: entryCount ? Number((totals.score / entryCount).toFixed(1)) : 0,
        };

        const playerMap = playersByMap.get(mapData.map_name) || new Map();
        const players = Array.from(playerMap.values()).map(player => ({
          ...player,
          win_rate: player.games > 0 ? Math.round((player.wins / player.games) * 100) : 0,
          avg_kills: player.games > 0 ? Number((player.kills / player.games).toFixed(1)) : 0,
          avg_outposts: player.games > 0 ? Number((player.outposts / player.games).toFixed(1)) : 0,
          avg_garrisons: player.games > 0 ? Number((player.garrisons / player.games).toFixed(1)) : 0,
          avg_score: player.games > 0 ? Number((player.score / player.games).toFixed(1)) : 0,
        })).sort((a, b) =>
          b.score - a.score ||
          b.games - a.games ||
          a.player_name.localeCompare(b.player_name)
        );

        mapData.top_5_players = players.slice(0, 5);
        mapData.player_breakdown = players;
        mapData.top_player = players[0] || null;
        mapData.most_active = [...players].sort((a, b) =>
          b.games - a.games ||
          b.score - a.score ||
          a.player_name.localeCompare(b.player_name)
        )[0] || null;

        const details = (detailByMap.get(mapData.map_name) || []).sort((a, b) =>
          new Date(b.created_at) - new Date(a.created_at)
        );
        mapData.full_detail = details;

        const last10 = (trendByMap.get(mapData.map_name) || [])
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .slice(0, 10);
        const trendGames = last10.length;
        const trendWins = last10.filter(g => g.result === 'win').length;
        const trendLosses = last10.filter(g => g.result === 'loss').length;
        mapData.trend_last_10 = {
          games: trendGames,
          wins: trendWins,
          losses: trendLosses,
          win_rate: trendGames ? Math.round((trendWins / trendGames) * 100) : 0,
          form: last10.map(g => g.result === 'win' ? 'W' : g.result === 'loss' ? 'L' : '-'),
          avg_score: trendGames ? Number((last10.reduce((sum, g) => sum + g.total_score, 0) / trendGames).toFixed(1)) : 0,
          avg_kills: trendGames ? Number((last10.reduce((sum, g) => sum + g.total_kills, 0) / trendGames).toFixed(1)) : 0,
          avg_outposts: trendGames ? Number((last10.reduce((sum, g) => sum + g.total_outposts, 0) / trendGames).toFixed(1)) : 0,
          avg_garrisons: trendGames ? Number((last10.reduce((sum, g) => sum + g.total_garrisons, 0) / trendGames).toFixed(1)) : 0,
        };

        return mapData;
      }).sort((a, b) =>
        b.total_games - a.total_games ||
        a.map_name.localeCompare(b.map_name)
      );

      res.json({ maps: result });
    });
  });
});

// --- API: PLAYER STATS (per window) ---
app.get('/api/stats/player/:name', (req, res) => {
  const playerName = (req.params.name || '').trim();
  const window = (req.query.window || 'week').trim(); // day/week/month/year

  if (!playerName) {
    return res.status(400).json({ error: 'player name missing' });
  }

  let hours = 7 * 24;
  if (window === 'day') hours = 18;
  else if (window === 'week') hours = 7 * 24;
  else if (window === 'month') hours = 30 * 24;
  else if (window === 'year') hours = 365 * 24;

  const thresholdIso = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const sql = `
    SELECT
      g.id AS game_id,
      g.map_name,
      g.result,
      g.created_at,
      e.kills,
      e.outposts,
      e.garrisons,
      e.longest_kill
    FROM entries e
    JOIN games g ON g.id = e.game_id
    WHERE e.player_name = ?
      AND g.created_at >= ?
    ORDER BY g.created_at ASC
  `;

  db.all(sql, [playerName, thresholdIso], (err, rows) => {
    if (err) {
      console.error('DB error /api/stats/player/:name', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (!rows || rows.length === 0) {
      return res.json({
        player_name: playerName,
        window,
        totals: { kills: 0, outposts: 0, garrisons: 0, longest_kill: 0, score: 0 },
        maps: [],
        fastest: null
      });
    }

    const gameIds = [...new Set(rows.map(r => r.game_id))];
    const placeholders = gameIds.map(() => '?').join(',');
    const maxSql = `
      SELECT game_id, MAX(longest_kill) AS max_longest
      FROM entries
      WHERE game_id IN (${placeholders})
      GROUP BY game_id
    `;

    db.all(maxSql, gameIds, (err2, maxRows) => {
      if (err2) {
        console.error('DB error maxSql', err2);
        return res.status(500).json({ error: 'Database error' });
      }

      const maxMap = new Map();
      maxRows.forEach(r => {
        maxMap.set(r.game_id, Number(r.max_longest) || 0);
      });

      let totalKills = 0;
      let totalOutposts = 0;
      let totalGarrisons = 0;
      let maxLongestKill = 0;
      let totalScore = 0;

      const perMap = new Map();

      rows.forEach(r => {
        const kills = Number(r.kills) || 0;
        const outposts = Number(r.outposts) || 0;
        const garrisons = Number(r.garrisons) || 0;
        const lk = Number(r.longest_kill) || 0;

        const base = kills + outposts * 3 + garrisons * 6;
        const maxLkForGame = maxMap.get(r.game_id) || 0;
        const bonus = maxLkForGame > 0 && lk === maxLkForGame ? 1 : 0;
        const score = base + bonus;

        totalKills += kills;
        totalOutposts += outposts;
        totalGarrisons += garrisons;
        if (lk > maxLongestKill) maxLongestKill = lk;
        totalScore += score;

        const mapName = r.map_name || 'Tundmatu';
        if (!perMap.has(mapName)) {
          perMap.set(mapName, {
            map_name: mapName,
            games: 0,
            wins: 0,
            losses: 0,
            kills: 0,
            outposts: 0,
            garrisons: 0,
            longest_kill: 0,
            score: 0
          });
        }
        const m = perMap.get(mapName);
        m.games += 1;
        if (r.result === 'win') m.wins += 1;
        else if (r.result === 'loss') m.losses += 1;
        m.kills += kills;
        m.outposts += outposts;
        m.garrisons += garrisons;
        if (lk > m.longest_kill) m.longest_kill = lk;
        m.score += score;
      });

      let fastest = null;
      for (let i = 1; i < rows.length; i++) {
        const prev = rows[i - 1];
        const next = rows[i];
        const diff = new Date(next.created_at) - new Date(prev.created_at);
        if (diff >= 0 && (!fastest || diff < fastest.ms)) {
          fastest = {
            ms: diff,
            from: { game_id: prev.game_id, map_name: prev.map_name, created_at: prev.created_at },
            to: { game_id: next.game_id, map_name: next.map_name, created_at: next.created_at },
            map_name: next.map_name || 'Tundmatu'
          };
        }
      }

      return res.json({
        player_name: playerName,
        window,
        totals: {
          kills: totalKills,
          outposts: totalOutposts,
          garrisons: totalGarrisons,
          longest_kill: maxLongestKill,
          score: totalScore
        },
        maps: Array.from(perMap.values()).sort(
          (a, b) => b.games - a.games || a.map_name.localeCompare(b.map_name)
        ),
        fastest
      });
    });
  });
});

// --- käivitus ---
app.listen(PORT, () => {
  console.log(`Hell Let Loose stats server kuulab porti ${PORT}`);
});
