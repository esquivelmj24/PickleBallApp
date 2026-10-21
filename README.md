# Dinkboard — Pickleball Leveling Console

A committee dashboard for rating players, generating fair pickleball rotations, recording scores, and keeping a live Top 5 leaderboard.

Built with **Next.js 15 (App Router)**, **TypeScript**, and **MongoDB**.

## Features

- **Committee-assigned ratings** — enter a player's name and set a rating from 2.0 to 4.0 with a slider, stepper, or exact number input.
- **Rating bands** — the level is calculated automatically:
  - Beginner: 2.0 – 2.5
  - Low Intermediate: 2.6 – 3.2
  - High Intermediate: 3.3 – 4.0
- **Level match mode** — the default automatic rotation:
  - never puts the same player in two lineups,
  - groups players by rating band before building courts,
  - only creates a court when four players share the same band,
  - prioritizes players with the fewest completed games,
  - uses the longest rest as the next tie-breaker,
  - splits each foursome into the most evenly rated teams possible.
- **Open rate mode** — a second automatic mode that ignores rating bands. Use it when a level does not have four players, or when the group wants mixed-level games. Fair play counts and longest rest still decide who plays next.
- **One-court queue** — when the court stepper is set to **1**, every available lineup is scheduled on the same physical court. The active match is **Court 01**, and the remaining lineups appear as **Next lineup** cards instead of Court 02, Court 03, etc. The next card becomes active as soon as the current result is saved.
- **Waiting list** — players left over after the queue is filled are shown with their play count and receive priority in the next rotation.
- **Manual lineup override** — the committee can change any player on a scheduled court or queued lineup with an available roster player. Manual changes are not restricted by rating band, and a court that spans bands is labeled **Mixed levels**.
- **Win/loss result labels** — completed lineups show **Win** and **Loss** tags on the teams, plus a `Team A won` / `Team B lost` result beside the score.
- **Clear all** — removes every player, match, and leaderboard entry so the board can start fresh. The action requires typing `CLEAR ALL` before it can run.
- **Scorebook** — save and correct match scores. Player play counts, wins, losses, and point differential update automatically.
- **Top 5 leaderboard** — ranked by wins, then point differential, then rating.
- **Played count for every player** — visible in the roster with a comparison bar so the committee can spot frequent players.
- **Pickleball-inspired interface** — court green, navy, and optic-ball lime, with a responsive layout for desktop, tablet, and mobile.

## Getting started

```bash
npm install
cp .env.example .env.local
# edit .env.local with your MongoDB connection string
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `MONGODB_URI` | Yes | MongoDB Atlas / MongoDB connection string |
| `MONGODB_DB` | No | Database name. Defaults to `dinkboard` |
| `MONGODB_USERNAME` | No | Kept for local credential reference |
| `MONGODB_PASSWORD` | No | Kept for local credential reference |

Credentials belong in `.env.local`, which is ignored by Git. Never commit database secrets.

### Database

The app creates these collections automatically:

- `players` — name, rating, play counts, record, point totals
- `matches` — round id, court number, matchmaking mode, queue position, team snapshots, scores, status

Indexes for player uniqueness and match lookups are created on first connection.

To try the interface with a sample roster, use **Load sample roster** in the empty roster panel. It is only available while the roster is empty.

## Run scripts

```bash
npm run dev     # development server
npm run build   # production build
npm run start   # production server
```

## Matching rules

### Automatic matchmaking

The match board has two automatic modes:

- **Level match** (default) enforces the rating bands.
- **Open rate** allows players from different bands to share a court.

#### Level match

1. Every generated round uses unique players in every lineup.
2. Players are split into separate pools by rating band: Beginner, Low Intermediate, and High Intermediate.
3. A court is only built from four players in the **same** band. Bands are never mixed automatically.
4. A band with fewer than four players waits until it has enough for a full court.
5. Within each band, players with fewer completed games are selected first.
6. If play counts tie, the player who has rested longest is selected first.
7. Each foursome is split into the two most evenly rated teams possible.
8. Repeatedly starting new rounds balances play counts within each level.

If no rating band has four players, switch to **Open rate** to build a mixed-level court.

#### Open rate

1. The full roster is one pool; rating bands are ignored.
2. Players with fewer completed games are selected first.
3. Longest rest is the tie-breaker.
4. Each foursome is still split into the most evenly rated teams possible.
5. Courts are labeled **Open rate** on the board.

#### One-court queue

When **Courts** is set to `1`, all full lineups from the available players are scheduled on the same court:

- the first lineup is **Court 01**,
- every following lineup is a **Next lineup** card,
- the queue moves up automatically when the current match gets a score,
- leftover players who cannot fill a full lineup stay on the waiting list.

Selecting more than one court creates one active lineup per physical court and leaves additional players on the waiting list.

### Manual overrides

The committee can replace any player on a scheduled court or queued lineup with any available roster player. Manual changes do **not** check rating bands, so a lineup may intentionally mix levels. Those courts are labeled **Mixed levels** on the board.

The "Shuffle new round" action replaces any **unscored** courts and queued lineups. Completed results are kept permanently.

## Rankings

The Top 5 updates after each saved result:

1. Wins
2. Point differential
3. Win rate
4. Committee rating
5. Name (alphabetical tie-breaker)

Until the first result is entered, the top five are ordered by committee rating.

## API overview

| Route | Purpose |
| --- | --- |
| `GET /api/state` | Dashboard state: players, active round, recent results, Top 5 |
| `POST /api/players` | Add a rated player |
| `PATCH /api/players/:id` | Update a player's name or rating |
| `DELETE /api/players/:id` | Remove a player not assigned to an active court |
| `POST /api/matches/generate` | Build a rotation with `mode: "level"` or `mode: "open"` and a court count |
| `PATCH /api/matches/:id` | Manually change a scheduled lineup |
| `POST /api/matches/:id/score` | Save or correct a result |
| `DELETE /api/reset` | Clear all players and match history (requires `confirm: "CLEAR ALL"`) |
| `POST /api/demo` | Add a sample roster when the roster is empty |
