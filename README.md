# Pickle & Chill — Pickleball Leveling Console

A committee dashboard for rating players, generating fair pickleball rotations, recording scores, and keeping a live Top 5 leaderboard.

Built with **Next.js 15 (App Router)**, **TypeScript**, and **MongoDB**.

## Features

- **Committee-assigned ratings** — enter a player's name and set a rating from 2.0 to 4.0 with a slider, stepper, or exact number input.
- **Rating bands** — the level is calculated automatically:
  - Beginner: 2.0 – 2.5
  - Low Intermediate: 2.6 – 3.2
  - High Intermediate: 3.3 – 4.0
- **Level match mode** — the default automatic rotation:
  - never puts the same player on two active courts,
  - groups players by rating band before building courts,
  - only creates a court when four available players share the same band,
  - prioritizes players with the fewest completed games,
  - uses the longest rest as the next tie-breaker,
  - splits each foursome into the most evenly rated teams possible.
- **Open rate mode** — a second automatic mode that ignores rating bands. Use it when a level does not have four players, or when the group wants mixed-level games. Fair play counts and longest rest still decide who plays next.
- **Mandatory pre-game setup** — before any table or team appears, the committee must choose **Level match** or **Open Rate**, choose **Single court** or **Multiple courts**, set the number of courts, and press **Start game**. The setup gate returns after every result is saved, with the previous choices pre-filled for **Start next game**.
- **Court layouts** — choose **Single court** for one active **Court** plus a **Next Player** queue, or **Multiple courts** for two to six physical courts labeled **Court A**, **Court B**, **Court C**, and so on. Court names do not use numbers.
- **Add next lineup** — in Single court, queues another **Next Player** group below the active Court. In Multiple courts, adds another physical court up to **6 courts**. The queued group stays locked until the active court result is saved. Players on completed courts become available again, while players on active or queued courts stay locked.
- **Live court board** — courts stack vertically, one court per row. In Single court the active **Court** is on top and the **Next Player** group sits below it until the result is saved.
- **Fair newcomer priority** — a newly added player keeps a real `0 played` record, but rotation priority levels them with the lowest positive play count. They do not jump ahead of players like **tesss** who already waited through four games.
- **Setup gate** — the next game cannot start until every active or queued court has a saved result. Once the round is complete, the court board is replaced by the setup panel.
- **Finish-first multiple-court shuffle** — when you randomly shuffle a new Multiple courts round, players who finished their previous game first are ranked first, followed by the players who were waiting. Rating bands still apply in Level match.
- **Available next list** — shows every player who can fill the next court or Next Player group, including players whose earlier court is already complete. In Single court, the fewest games played are selected first; in Multiple courts, finish order comes first.
- **Manual lineup override** — the committee can change any player on an active court with an available roster player. Manual changes are not restricted by rating band, and a court that spans bands is labeled **Mixed levels**.
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

> The default database name remains `dinkboard` so existing deployments keep their saved players and matches. Only the visible app branding changed to **Pickle & Chill**.

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

### Court layouts

The match board has two layouts. The layout controls how the next game is built and is independent of Level match / Open rate. Both are selected in the mandatory pre-game setup panel before teams are revealed.

- **Single court** — one active **Court** and one **Next Player** queue. The active group plays first; saving its result removes it from the board and promotes the next queued group. The queued group is locked — it cannot be edited or scored — until the active Court result is saved.
- **Multiple courts** — two to six physical courts labeled **Court A**, **Court B**, **Court C**, and so on. Each court has its own active lineup, stacked one per row. When you press **Start game** or **Start next game**, players from completed matches are ranked first by completion time, then waiting players are ranked by fewest games, longest rest, and name.

Single court and Multiple courts both keep the rating-band rules of the selected matchmaking mode. Court labels deliberately avoid numbers. The court board scrolls vertically when the stacked courts are taller than the board area.

### New players

A new roster entry still starts with a real `0 played` record. For rotation priority only, the app levels that player with the lowest positive play count in the pool, so a newcomer does not jump ahead of an existing player who has been waiting, such as **tesss** with four games. The newcomer then catches up through normal play. The roster count remains accurate.

### Automatic matchmaking

The match board has two automatic modes:

- **Level match** (default) enforces the rating bands.
- **Open rate** allows players from different bands to share a court.

#### Level match

1. A player can only be on one active court at a time.
2. Players are split into separate pools by rating band: Beginner, Low Intermediate, and High Intermediate.
3. A court is only built from four available players in the **same** band. Bands are never mixed automatically.
4. A band with fewer than four available players waits until it has enough for a full court.
5. In Single court, players with fewer completed games are selected first within each band.
6. In Multiple courts, players who finished their previous game first are selected first within each band, then waiting players by fewest games and longest rest.
7. If play counts tie, the player who has rested longest is selected first.
8. Each foursome is split into the two most evenly rated teams possible.
9. Completed courts free their players for later courts in the same round.

If no rating band has four available players, switch to **Open rate** to build a mixed-level court.

#### Open rate

1. The full roster is one pool; rating bands are ignored.
2. Players not currently on an active court are available.
3. In Single court, players with fewer completed games are selected first.
4. In Multiple courts, players who finished their previous game first are ranked first, then waiting players by fewest games and longest rest.
5. Longest rest is the tie-breaker.
6. Each foursome is still split into the most evenly rated teams possible.
7. Courts are labeled **Open rate** on the board.

#### Adding courts and Next Player

The pre-game setup panel is required before every game. Choose **Level match** or **Open Rate**, choose **Single court** or **Multiple courts**, and set the court count. The **Courts** stepper appears only for Multiple courts and sets how many physical courts to build. Press **Start game** to reveal the first teams; after the round is complete, the same panel returns with **Start next game**.

- **Single court** shows one active **Court** and one **Next Player** group below it. Each **Add next lineup** click queues another group. The queued card has no score fields or lineup button and is locked until the active Court result is saved.
- **Multiple courts** shows **Court A**, **Court B**, **Court C**, and so on, stacked vertically one per row. Each **Add next lineup** click adds the next free physical court, up to **Court F** (six courts).
- Every new lineup is built from players who are not currently on an active or queued court.
- Players on completed courts are available again.
- Level match needs four available players in the same rating band; Open Rate can mix levels.

When a result is saved in Single court, the completed team leaves the board and the queued group moves up to **Court**. The setup panel for the next game stays locked until every active and queued court has a result.

### Manual overrides

The committee can replace any player on an active court with any available roster player. Manual changes do **not** check rating bands, so a lineup may intentionally mix levels. Those courts are labeled **Mixed levels** on the board. Players on completed courts are available; players on another active or queued court are locked. A queued Next Player group cannot be edited until the active Court result is saved and the group is promoted.

The next-game setup is only available after all current results are scored. Completed results are kept permanently, and the live board is labeled **Live rotation** / **Current rotation** so it fits daytime games as well as evening ones.

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
| `POST /api/matches/generate` | Build a rotation with `layout: "single" \| "multiple"`, `mode: "level"` or `mode: "open"`, and a court count; Multiple courts applies finish-first priority; rejected while any current court is unscored |
| `POST /api/matches/next` | Append the Next Player group on a single-court round, or another physical court up to 6; queued groups stay locked until the active result is saved |
| `PATCH /api/matches/:id` | Manually change an active scheduled lineup; returns `409` for a queued Next Player group |
| `POST /api/matches/:id/score` | Save or correct a result; a queued Next Player group returns `409` until it is promoted |
| `DELETE /api/reset` | Clear all players and match history (requires `confirm: "CLEAR ALL"`) |
| `POST /api/demo` | Add a sample roster when the roster is empty |
