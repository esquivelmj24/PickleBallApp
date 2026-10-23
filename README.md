# Pickle & Chill — Pickleball Leveling Console

A committee dashboard for rating players, generating fair pickleball rotations, recording scores, and keeping a live Top 5 leaderboard.

Built with **Next.js 15 (App Router)**, **TypeScript**, and **MongoDB**.

## Features

- **Admin and player accounts** — choose **Admin user** or **Player user** during registration. Admins register with an alias and password. Players register with an alias, password, **Rate** (2.0–4.0), and **Gender**. Passwords are hashed with scrypt, and signed HTTP-only session cookies keep users signed in for seven days.
- **Private admin boards** — every player, match, and reset is scoped to the signed-in admin, so each admin creates and manages only their own games.
- **Player participation** — a signed-in player lands on the **Balanced Courts, Better Games** dashboard and sees every active scheduled game roster. Opening a roster shows the board linked to that roster’s admin. Players can review game and player details, but all setup, score, lineup, reset, and roster-management controls are hidden. The only write action is joining a scheduled roster.
- **Scheduled game rosters** — admins create rosters with a location, a roster name, a date, start and end times, and a manually assigned player capacity from 4 to 200 (with 10, 20, 30, 40, 50, and 60 quick presets). Each roster displays its name, location, date, time range, and joined/capacity ratio (for example `1/10`), with a progress bar and remaining slot count.
- **End Transaction** — an admin can close a roster from its details page. The app returns to the main **Game rosters** list, and the ended roster is removed from every roster list. Ended rosters reject new joins and keep their history in the database, but they are no longer shown or actionable in the app.
- **Dedicated roster details page** — selecting any roster card opens `/rosters/:id`. The page shows the roster name, location, date, time range, host, joined/capacity ratio, and the full list of joined players. The main dashboard stays focused on the hero, profile image card, and roster list; the **Set up the game** board and **Players & ratings** section render only after opening a roster. A **Back to rosters** button returns to the roster list.
- **Player roster review and Join** — players open a roster to review its details and full joined-player list before pressing **Join this roster**. Joined and full states are shown, the player’s own entry is marked, and the ratio refreshes automatically for everyone viewing the page.
- **Rate-based Join** — joining a roster is idempotent and always uses the player account's registered alias and rate. It links an existing same-name board entry when possible, otherwise adds a new player, then reserves a roster slot with an atomic capacity check.
- **Background themes** — choose **Classic**, **Dark**, **Gray**, or **Black & Yellow** from the theme selector. The choice is saved in the browser and applied on the login and dashboard screens.
- **Profile image upload** — every signed-in account can upload a profile image from the dashboard. The browser center-crops and resizes the image to a 512px square before saving it to the account, and the image can be changed or removed at any time.
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
- **Mandatory pre-game setup** — before any table or team appears, the committee must choose **Level match** or **Open Rate**, choose **Single court** or **Multiple courts**, set the number of courts, and press **Start game**. The setup board is hidden from the main roster list and appears only on a roster’s details page when there is no active session. Once the game starts, the queue continues across scores and page refreshes until the committee presses **Reset**.
- **Continuous automatic queue** — there is no manual shuffle and no **Start next game** button. When every active and queued court has a result, the next rotation is built automatically with the same mode and layout. Opening the link again keeps the active session and queue.
- **Reset game** — shown during an active session. It clears the current rotation, saved matches, and session W/L totals, keeps the roster and ratings, and returns the app to setup. The reset action requires typing `RESET`. **Clear all** remains available for wiping the entire roster and history.
- **Court layouts** — choose **Single court** for one active **Court** plus a **Next Player** queue, or **Multiple courts** for two to six physical courts labeled **Court A**, **Court B**, **Court C**, and so on. Court names do not use numbers.
- **Add next lineup** — in Single court, queues another **Next Player** group below the active Court. In Multiple courts, adds another physical court up to **6 courts**. The queued group stays locked until the active court result is saved. Players on completed courts become available again, while players on active or queued courts stay locked.
- **Live court board** — courts stack vertically, one court per row. In Single court the active **Court** is on top and the **Next Player** group sits below it until the result is saved.
- **Catch-up priority** — players with the fewest completed games are selected first, so a late arrival with `0 played` gets priority for the next suitable game and can catch up to the rest of the roster. Within the same play count, players who finished their previous match earlier are ranked first, then the longest rest.
- **Partner and opponent rotation** — completed match history is used to avoid repeating the same opponents, rotate former teammates into opposing teams, and keep pairings moving so every player eventually plays with and against every other player.
- **Available next list** — shows every player who can fill the next court or Next Player group, including players whose earlier court is already complete. The list is ordered by fewest games first, then finish order and longest rest.
- **Manual lineup override** — the committee can change any player on an active court with an available roster player. Manual changes are not restricted by rating band, and a court that spans bands is labeled **Mixed levels**.
- **Win/loss result labels** — completed lineups show **Win** and **Loss** tags on the teams, plus a `Team A won` / `Team B lost` result beside the score.
- **Clear all** — removes every player, match, scheduled roster, and leaderboard entry so the board can start fresh. The action requires typing `CLEAR ALL` before it can run. Use **Reset** instead when you only want to restart the session and keep the roster.
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

Open [http://localhost:3000](http://localhost:3000). On first run, open [http://localhost:3000/register](http://localhost:3000/register) and create an **Admin user** account to start a board. Players can register from the same screen as **Player user** with their alias, password, rate, and gender. The dashboard is at `/` and requires a session. The main dashboard lists scheduled rosters; selecting one opens `/rosters/:id` with its joined players and game controls. Each admin account has its own private board and scheduled rosters; player accounts can browse every scheduled roster and, when they open one, see the board belonging to that roster’s admin.

### Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `MONGODB_URI` | Yes | MongoDB Atlas / MongoDB connection string |
| `MONGODB_DB` | No | Database name. Defaults to `dinkboard` |
| `AUTH_SECRET` | Recommended | Long random value used to sign admin session cookies. If omitted, the app falls back to `MONGODB_URI` |
| `MONGODB_USERNAME` | No | Kept for local credential reference |
| `MONGODB_PASSWORD` | No | Kept for local credential reference |

Credentials belong in `.env.local`, which is ignored by Git. Never commit database secrets. Set a separate `AUTH_SECRET` in production so sessions remain valid independently of database credentials.

> The default database name remains `dinkboard` so existing deployments keep their saved players and matches. Only the visible app branding changed to **Pickle & Chill**.

### Database

The app creates these collections automatically:

- `players` — `ownerId` (admin account), optional `userId` for a linked player account, name, optional gender, rating, play counts, record, point totals
- `matches` — `ownerId` (admin account), round id, court number, matchmaking mode, queue position, team snapshots, scores, status
- `rosters` — `ownerId` (admin account), roster name, location, scheduled date (`YYYY-MM-DD`), scheduled start and end times (`HH:MM`), capacity, the atomic joined-slot counter, and an optional `endedAt` timestamp
- `rosterEntries` — one membership per roster and player account, including owner, linked board player, name, rating, and join timestamp
- `users` — alias, normalized alias key, scrypt password hash, role (`admin` or `player`), optional player rate and gender, optional resized profile image data URL, and timestamps

Player names are unique per admin, not across the whole database. A player account can link to one board per admin, so the same account may join rosters hosted by more than one admin. Indexes for owner-scoped player names, per-admin player-account links, unique roster memberships, active/ended roster lookups, and owner-scoped match and roster lookups are created on first connection.

To try the interface with a sample roster, use **Load sample roster** in the empty roster panel. It is only available while the roster is empty.

## Run scripts

```bash
npm run dev     # development server
npm run build   # production build
npm run start   # production server
```

## Matching rules

### Court layouts

The match board has two layouts. The layout controls how the next game is built and is independent of Level match / Open rate. Both are selected once in the mandatory pre-game setup panel before teams are revealed. The same layout is reused automatically for every following rotation until the committee presses **Reset**.

- **Single court** — one active **Court** and one **Next Player** queue. The active group plays first; saving its result promotes the next queued group. The queued group is locked — it cannot be edited or scored — until the active Court result is saved. After the last queued group is scored, the next Court + Next Player rotation is built automatically.
- **Multiple courts** — two to six physical courts labeled **Court A**, **Court B**, **Court C**, and so on. Each court has its own active lineup, stacked one per row. When every active court has a score, the next Multiple courts rotation is built automatically. Players with fewer games are prioritized first; players who finished earlier break ties within the same play count.

Single court and Multiple courts both keep the rating-band rules of the selected matchmaking mode. Court labels deliberately avoid numbers. The court board scrolls vertically when the stacked courts are taller than the board area.

### New players and late arrivals

A new roster entry starts with a real `0 played` record. Players with fewer completed games are selected first, so a late arrival who missed earlier games gets catch-up priority for the next suitable game. If several players have the same play count, players who finished their previous match earlier are ranked first, then the player who has rested longest. This keeps the roster converging toward an equal number of games.

### Automatic matchmaking

The match board has two automatic modes:

- **Level match** (default) enforces the rating bands.
- **Open rate** allows players from different bands to share a court.

#### Level match

1. A player can only be on one active court at a time.
2. Players are split into separate pools by rating band: Beginner, Low Intermediate, and High Intermediate.
3. A court is only built from four available players in the **same** band. Bands are never mixed automatically.
4. A band with fewer than four available players waits until it has enough for a full court.
5. Players with fewer completed games are selected first within each band, so late arrivals can catch up.
6. Within the same play count, players who finished their previous match earlier are selected first, then the longest rest.
7. Each foursome is split into the two most evenly rated teams possible.
8. Completed courts free their players for later courts in the same round.
9. When every court in the rotation has a result, the next Level match rotation is built automatically with the same layout.

If no rating band has four available players, use **Reset** and start a new session with **Open rate** to build a mixed-level court.

#### Open rate

1. The full roster is one pool; rating bands are ignored.
2. Players not currently on an active court are available.
3. Players with fewer completed games are selected first.
4. Within the same play count, players who finished their previous match earlier are selected first.
5. Longest rest is the next tie-breaker.
6. Each foursome is still split into the most evenly rated teams possible.
7. Courts are labeled **Open rate** on the board.
8. When every court in the rotation has a result, the next Open rate rotation is built automatically.

#### Partnership and opponent rotation

Both modes use every completed game as rotation history:

1. Players who have not met recently are grouped together first.
2. Repeated opponents are moved onto the same team when possible, so the same matchup is not repeated.
3. Former teammates are moved onto opposite teams when possible, giving them a chance to compete against each other.
4. Pairings keep rotating, so over a series of games every player gets the opportunity to partner with and compete against every other player.
5. Fair play counts, rest, finish order, rating bands, and balanced teams still apply; history only chooses between otherwise valid groups and team splits.

#### Starting, continuing, and resetting

The pre-game setup panel is required only when there is no active session. Choose **Level match** or **Open Rate**, choose **Single court** or **Multiple courts**, and set the court count. The **Courts** stepper appears only for Multiple courts and sets how many physical courts to build. Press **Start game** once to reveal the first teams.

After that, there is no shuffle button and no **Start next game** step:

- When every active and queued court has a saved result, the next rotation is generated automatically.
- The next rotation keeps the same match mode, layout, and court count, clamped to the available roster.
- Refreshing or reopening the link keeps the active session and queue.
- The **Reset** button is shown during an active session. It clears the current rotation, saved matches, and session W/L totals, keeps the roster and ratings, and returns the app to setup.
- The game never returns to setup on its own.

- **Single court** shows one active **Court** and one **Next Player** group below it. Each **Add next lineup** click queues another group. The queued card has no score fields or lineup button and is locked until the active Court result is saved.
- **Multiple courts** shows **Court A**, **Court B**, **Court C**, and so on, stacked vertically one per row. Each **Add next lineup** click adds the next free physical court, up to **Court F** (six courts).
- Every new lineup is built from players who are not currently on an active or queued court.
- Players on completed courts are available again.
- Level match needs four available players in the same rating band; Open Rate can mix levels.

When a result is saved in Single court, the completed team leaves the board and the queued group moves up to **Court**. After the queued group is scored, the next rotation is built automatically. If the roster cannot form another full court, the board shows a waiting state instead of returning to setup.

### Manual overrides

The committee can replace any player on an active court with any available roster player. Manual changes do **not** check rating bands, so a lineup may intentionally mix levels. Those courts are labeled **Mixed levels** on the board. Players on completed courts are available; players on another active or queued court are locked. A queued Next Player group cannot be edited until the active Court result is saved and the group is promoted.

The session is continuous: the next rotation is built automatically after every active and queued court has a result, and the board stays on **Live rotation** / **Current rotation**. Use **Reset** during the session to return to setup, or **Clear all** to wipe the entire roster and history.

## Rankings

The Top 5 updates after each saved result:

1. Wins
2. Point differential
3. Win rate
4. Committee rating
5. Name (alphabetical tie-breaker)

Until the first result is entered, the top five are ordered by committee rating.

## Authentication, roles, and isolation

### Registration and login

- Choose **Admin user** or **Player user** on the registration form.
- An **Admin user** needs **Alias** and **Password**.
- A **Player user** needs **Alias**, **Password**, **Rate** (2.0–4.0), and **Gender**.
- Aliases are case-insensitive and must be 3–30 characters. Passwords must be 8–128 characters.
- Successful registration signs the account in and redirects to the **Balanced Courts, Better Games** dashboard at `/`.
- Login rejects unknown aliases and wrong passwords with the same message: **“Invalid alias or password. Please try again.”**
- Sessions are stored in a signed, HTTP-only `pc_session` cookie for seven days and include the account role. **Log out** clears it.

> Registration is open: anyone who completes `/register` can create an admin or player account. Before exposing the app publicly, restrict access to `/register` (for example with a deployment-level password or invite code).

### Player access

- Players see every active scheduled game roster, whether or not they have joined one. Ended rosters are hidden from every roster list and cannot be joined. Selecting a roster card opens its dedicated details page at `/rosters/:id`, scoped to that roster’s admin board.
- Roster cards display the name, location, date, time range, host alias, joined/capacity ratio, progress bar, remaining slots, and a compact preview of joined players. The signed-in player's own entry is marked, and the ratio is derived from roster memberships and refreshes automatically.
- The roster details page shows the location, date, time range, and full joined-player list with ratings, and marks the signed-in player. The **Join this roster** action appears below the list. After joining, the player banner names the roster with its location, date, time range, and ratio above the current rotation, players & ratings, leaderboard, level key, and recent results cards. A **Back to rosters** button returns to the main list.
- Players cannot create, edit, or delete rosters, players, matches, or scores. Those controls are removed from the player interface, and admin API routes reject player sessions.
- **Join this roster** is the player write action. It uses the account's registered alias and rate, links a same-name board entry when one exists, creates a new player entry otherwise, and reserves one roster slot. Join is idempotent, and the capacity check is atomic so the final slot cannot be taken twice. Repeated joins return the current ratio instead of creating a duplicate membership.
- If no admin board or roster exists yet, the player sees an empty waiting state until an admin schedules a game.

### Per-admin game isolation

- Each player, match, and scheduled roster stores the `_id` of the admin account that created it.
- Every admin API query — players, matches, rosters, live state, lineups, scores, reset, clear, and sample data — filters by the signed-in admin's id.
- Auto-advancing the queue is also scoped per admin, so two admins can run games at the same time without interfering.
- Admins cannot view, score, edit, reset, or delete another admin's games or rosters. Using another admin's player, match, or roster id returns “not found.”
- The previous public guest board and login QR code have been removed. Access requires an Admin or Player account.
- Players and matches created before owner scoping are assigned to the earliest admin account on the next server start or sign-in. Later admins always start with an empty board.

## API overview

| Route | Purpose |
| --- | --- |
| `POST /api/auth/register` | Create an account with `alias`, `password`, and `role: "admin"` or `role: "player"`; players also send `rating` and `gender`; signs the account in |
| `POST /api/auth/login` | Sign in with `alias` and `password`; returns the account role and `401` for invalid credentials |
| `POST /api/auth/logout` | Clear the session cookie |
| `GET /api/state` | Role-aware. Admins get their own board, rosters, and automatic next rotation; players get all scheduled rosters and Join availability, plus the board they joined or the latest active admin board. Add `?rosterId=:id` to scope the board to a specific roster’s admin (used by the roster details page) |
| `GET /api/rosters` | Signed-in users. Admins get their own active scheduled rosters; players get all active scheduled rosters, with joined counts and their own joined state. Ended rosters are excluded |
| `POST /api/rosters` | Admin only. Create a roster with `name`, `location`, `date` (`YYYY-MM-DD`), `startTime` and `endTime` (`HH:MM`, end must be later), and a whole-number `capacity` from 4 to 200 |
| `POST /api/rosters/:id/end` | Admin only, owner-scoped. End a roster transaction by setting `endedAt`; ended rosters are removed from all roster lists and reject new joins |
| `POST /api/rosters/:id/join` | Player only. Select and join an active scheduled roster. Rejects ended or full rosters, reserves a slot atomically, links or creates the player's board entry, and is idempotent |
| `POST /api/player/join` | Player only. Legacy direct board join using the account's registered alias and rate; links or creates the board entry and is idempotent |
| `GET /api/profile/avatar` | Signed-in users. Return the current account's resized profile image data URL |
| `POST /api/profile/avatar` | Signed-in users. Save a PNG, JPG, or WebP data URL for the current account; the image must be 2 MB or smaller |
| `DELETE /api/profile/avatar` | Signed-in users. Remove the current account's profile image |
| `GET /api/players` | Admin only. The signed-in admin's roster |
| `POST /api/players` | Admin only. Add a rated player to the signed-in admin's roster |
| `PATCH /api/players/:id` | Admin only. Update one of the admin's players |
| `DELETE /api/players/:id` | Admin only. Remove one of the admin's players when not on an active court |
| `POST /api/matches/generate` | Admin only. Build the first rotation with `layout: "single" \| "multiple"`, `mode: "level"` or `mode: "open"`, and a court count; rejected while a session is already active |
| `POST /api/matches/next` | Admin only. Append the Next Player group on a single-court round, or another physical court up to 6; queued groups stay locked until the active result is saved |
| `PATCH /api/matches/:id` | Admin only. Manually change an active scheduled lineup; returns `409` for a queued Next Player group |
| `POST /api/matches/:id/score` | Admin only. Save or correct a result; automatically builds the next rotation when the last court is scored |
| `DELETE /api/reset/session` | Admin only. Reset the game session: clear matches and session W/L totals, keep the roster and ratings (requires `confirm: "RESET"`) |
| `DELETE /api/reset` | Admin only. Clear all of the admin's players, match history, rosters, and roster memberships (requires `confirm: "CLEAR ALL"`) |
| `POST /api/demo` | Admin only. Add a sample roster when the admin's roster is empty |

All owner-scoped routes operate only on the signed-in admin's `ownerId`; another admin's ids are treated as not found.
