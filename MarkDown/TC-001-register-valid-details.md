# TC-001 — Register using valid details

| Field | Value |
| --- | --- |
| **Test case ID** | TC-001 |
| **Title** | Register using valid details |
| **Type** | Positive / Functional |
| **Feature** | Registration (`/register`) |
| **Priority** | High |
| **Status** | Not run |
| **Automated** | No |

## Objective

Verify that a new account can be created with valid credentials as a **Player user**, that the account is persisted with a hashed password, that the user is signed in automatically, and that the player lands on the player dashboard.

## Test data

| Input | Value | Notes |
| --- | --- | --- |
| Alias | `marktest` | 8 chars, starts with a letter — valid |
| Password | `Verz123$%` | 9 chars — within the 8–128 range |
| Account type | `Player user` | Radio option on the registration form |
| Rate | `3.0` | **Assumption:** form default, since the case does not specify it |
| Gender | `Male` | **Assumption:** the form requires a selection; any listed gender works |

## Preconditions

1. The app is running (`npm run dev`) and reachable at `http://localhost:3000`.
2. `MONGODB_URI` is configured and the database connection succeeds.
3. No account already exists with alias `marktest` or any case variant of it (`MARKTEST`, `MarkTest`).
4. The browser has no active `pc_session` cookie (signed out), or a private window is used.

## Steps

| # | Action | Expected result |
| --- | --- | --- |
| 1 | Navigate to `http://localhost:3000/register`. | Registration form renders with **Alias**, **Password**, the **Account type** radio group, and a **Create account** submit button. |
| 2 | Leave Alias blank and type into Password, then select **Player user**. | When **Player user** is selected, the form reveals the **Rate** field (default `3.0`) with an **NR** toggle, and the **Gender** dropdown. The submit label changes to **Create player account**. |
| 3 | Enter Alias `marktest`. | Alias is accepted; the field shows `marktest`. |
| 4 | Enter Password `Verz123$%`. | Characters are masked by the password input. No inline error appears. |
| 5 | Select the **Player user** radio button. | The card highlights as selected; Rate and Gender controls appear. |
| 6 | Leave Rate at `3.0`. | Hint text reads `Low Intermediate · used automatically for balanced matchmaking.` |
| 7 | Select Gender `Male`. | Dropdown shows `Male`; the "Choose a gender" block condition is satisfied. |
| 8 | Press **Create player account**. | Button shows `Creating account…` while the request is in flight, then becomes disabled briefly. |
| 9 | Observe the network response for `POST /api/auth/register`. | Status `201 Created`. Response body contains `user.id` (a Mongo ObjectId string), `user.alias: "marktest"`, `user.role: "player"`, `user.rating: 3`, `user.isNR: false`, `user.gender: "male"`. |
| 10 | Observe the response `Set-Cookie` header. | `pc_session` is set with `HttpOnly`, `SameSite=Lax`, `Path=/`, and a 7-day `Max-Age` (604800s). The cookie value is `<base64url payload>.<hmac signature>`. |
| 11 | Observe the redirect. | `router.replace("/")` runs; the app navigates to the dashboard at `/`. |
| 12 | Observe the dashboard. | The hero reads **Balanced Courts, Better Games**. The player view is shown: the **Game rosters** list is visible and the profile image card is present. |
| 13 | Check for admin-only controls. | No roster create/edit/end buttons, no **Set up the game** board, no **Players & ratings** editor, no score fields. Player-only UI is correct for the `player` role. |
| 14 | Open browser devtools → Application → Cookies. | Exactly one session cookie named `pc_session`; it is `HttpOnly` and not readable via `document.cookie`. |
| 15 | **Verify in database:** `db.users.findOne({ aliasKey: "marktest" })` on the `dinkboard` database. | One document exists with `alias: "marktest"`, `aliasKey: "marktest"`, `role: "player"`, `rating: 3`, `isNR: false`, `gender: "male"`, `createdAt`, and `updatedAt`. |
| 16 | Inspect the stored `passwordHash`. | Value has the form `<32-hex-char salt>:<128-hex-char hash>` (scrypt). The plaintext `Verz123$%` appears nowhere in the document. |
| 17 | Refresh the dashboard (F5). | The session persists; the user stays signed in and is not returned to `/login`. |
| 18 | **Duplicate check:** register `marktest` again (signed out first if needed). | Status `409 Conflict` with `{ "error": "That alias is already registered. Choose another one." }`. No second document is inserted. |
| 19 | **Case-insensitive check:** register `MARKTEST` with any valid password. | Also rejected with the same `409` duplicate-alias message, because `aliasKey` lowercases the alias. |
| 20 | Log out, then sign in with `marktest` / `Verz123$%` at `/login`. | Login succeeds (`200`), a fresh `pc_session` is set, and the user lands on `/`. |

## API-only variant

Run steps 1–8 as a direct call instead of through the UI:

```bash
curl -i -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"alias":"marktest","password":"Verz123$%","role":"player","rating":3,"gender":"male"}'
```

Expected: `HTTP/1.1 201 Created`, JSON body with the new user, and a `pc_session` cookie written to `cookies.txt`.

## Pass criteria

- Account is created and persisted with a scrypt-hashed password (never plaintext).
- `pc_session` cookie is set, HttpOnly, and the user is signed in automatically.
- User is redirected to `/` and sees the player dashboard with no admin controls.
- Role, rate, and gender are stored exactly as submitted.
- Duplicate registration (including different letter case of the same alias) is rejected with `409` and no extra document is created.
- Signing out and back in with the same credentials succeeds.

## Failure signals

- `400` returned with a validation message for `marktest` (`Alias must be 3–30 characters…`) or for `Verz123$%` (`Password must be between 8 and 128 characters.`).
- `500` or `Could not create the account.` — indicates a database/connection problem, not a validation problem.
- Dashboard loads but still shows admin controls, or the user is bounced back to `/login`.
- The `users` document stores the password in plaintext or omits `role`/`rating`/`gender`.
- Duplicate alias is accepted, producing two `marktest`/`MARKTEST` accounts.

## Notes

- The app enforces **length only** (8–128 chars) on passwords; `Verz123$%` satisfies this but the symbols/uppercase/digits in it are not actually required by the code.
- Alias handling trims and collapses inner whitespace, so `  marktest  ` would also register as `marktest`.
- Login error messages are intentionally identical for unknown alias and wrong password: `Invalid alias or password. Please try again.`
