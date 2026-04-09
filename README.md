# HLL Stats

Simple self-hosted Hell Let Loose squad statistics app.

## Features

- Track games by map and result
- Keep a reusable player roster
- Record per-player stats:
  - kills
  - outposts
  - garrisons
  - longest kill
- Automatic score calculation
- Map statistics
- Player records and podium stats
- Built-in SQLite database
- Simple access-code login
- Health endpoint at `/health`

## Tech stack

- Node.js
- Express
- SQLite
- Plain HTML/CSS/JavaScript frontend

## Run locally

```bash
npm install
npm start
```

App starts on port `3124` by default.

You can override it:

```bash
PORT=8080 npm start
```

Open:

- App: `http://localhost:3124`
- Health: `http://localhost:3124/health`

## Login

Current access code is defined in `server.js`:

```js
const ACCESS_CODE = 'smile';
```

For production, move this to an environment variable.

## Data storage

SQLite database file is created automatically:

- `hll_stats.db`

## API endpoints

### Health
- `GET /health`

### Players
- `GET /api/players`
- `POST /api/players`
- `DELETE /api/players/:id`

### Games
- `GET /api/games`
- `POST /api/games`
- `DELETE /api/games/:id`
- `GET /api/games/:id/entries`
- `POST /api/games/:id/entries`

### Entries
- `DELETE /api/entries/:id`

### Stats
- `GET /api/stats`
- `GET /api/maps/:map/games`
- `GET /api/stats/player/:name?window=day|week|month|year`

## Recommended next improvements

- Move access code to `ACCESS_CODE` environment variable
- Add proper session handling instead of simple auth cookie
- Add Dockerfile and compose setup
- Add export/backup for SQLite database
- Add `.gitignore` for database and dependencies
