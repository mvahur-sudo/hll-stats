# HLL Stats

Simple self-hosted Hell Let Loose squad statistics app.

## Features

- Track games by map and result
- Keep a reusable player roster
- Record per-player stats:
  - kills
  - deaths
  - outposts
  - garrisons
  - longest kill
- Per-game challenge scoring modes:
  - normal: kills + outposts * 3 + garrisons * 6 + longest-kill bonus
  - kill/death: kills - deaths * 2
- Automatic score calculation per challenge
- Map statistics
- Player records and podium stats
- Built-in SQLite database
- Session-based authentication
- Health endpoint at `/health`
- Database backup and download

## Tech stack

- Node.js
- Express
- SQLite
- Plain HTML/CSS/JavaScript frontend

## Quick start

```bash
npm install
npm start
```

App starts on port `3124` by default.

Override port:

```bash
PORT=8080 npm start
```

Open:

- App: `http://localhost:3124`
- Health: `http://localhost:3124/health`

## Configuration

Set via environment variables:

| Variable      | Default  | Description              |
|---------------|----------|--------------------------|
| `PORT`        | `3124`   | Server port              |
| `ACCESS_CODE` | `smile`  | Login access code        |

## Data storage

SQLite database file is created automatically:

- `hll_stats.db`
- Backups are stored in `.backups/` directory

## API endpoints

### Health
- `GET /health`

### Authentication
- `GET /login`
- `POST /login`
- `POST /logout`

### Players
- `GET /api/players`
- `POST /api/players`
- `DELETE /api/players/:id`

### Games
- `GET /api/games`
- `POST /api/games` — accepts `map_name`, `result`, `warmup`, `challenge`
- `DELETE /api/games/:id`
- `GET /api/games/:id/entries`
- `POST /api/games/:id/entries` — accepts `player_name`, `kills`, `deaths`, `outposts`, `garrisons`, `longest_kill`

### Entries
- `DELETE /api/entries/:id`

### Stats
- `GET /api/stats`
- `GET /api/stats/maps`
- `GET /api/maps/:map/games`
- `GET /api/stats/player/:name?window=day|week|month|year`

### Backup
- `GET /api/backup` — create a backup copy
- `GET /api/backup/download` — download current database

## Docker

### Build locally

```bash
docker build -t hll-stats .
docker run -p 3124:3124 -e ACCESS_CODE=mycode hll-stats
```

### GitHub Container Registry

Pre-built images available at `ghcr.io/mvahur-sudo/hll-stats:latest`

```bash
docker pull ghcr.io/mvahur-sudo/hll-stats:latest
docker run -p 3124:3124 -e ACCESS_CODE=mycode ghcr.io/mvahur-sudo/hll-stats:latest
```
