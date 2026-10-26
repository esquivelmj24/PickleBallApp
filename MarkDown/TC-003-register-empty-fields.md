# TC-003 — Register using empty fields

| Field | Value |
| --- | --- |
| **Test case ID** | TC-003 |
| **Title** | Register using empty fields |
| **Type** | Negative / Required-field validation |
| **Feature** | Registration (`/register`) — mandatory fields |
| **Priority** | High |
| **Status** | Not run |
| **Automated** | No |

## Objective

Verify that submitting the registration form with **no data entered** is rejected, that the user gets a clear message, that no account or session is created, and that the app never redirects away from `/register`.

This case also maps which layer reports the empty field: the client-side gate handles the missing **Account type**, **Rate**, and **Gender**, while missing **Alias** and **Password** are reported by `POST /api/auth/register`.

## Test data

| Input | Value | Notes |
| --- | --- | --- |
| Alias | *(empty)* | Field left untouched |
| Password | *(empty)* | Field left untouched |
| Account type | *(none selected)* | Neither **Admin user** nor **Player user** chosen |
| Rate | `3.0` | The form default — present but untouched, not cleared |
| Gender | *(none selected)* | Dropdown stays on `Select gender` |

## Preconditions

1. The app is running (`npm run dev`) and reachable at `http://localhost:3000`.
2. `MONGODB_URI` is configured and the database connection succeeds.
3. The browser has no active `pc_session` cookie (signed out), or a private window is used.
4. Browser devtools is open on the **Network** tab so the presence or absence of a request can be observed.
5. Note the current `db.users.countDocuments()` total so the test can prove nothing was inserted.

## Steps

| # | Action | Expected result |
| --- | --- | --- |
| 1 | Navigate to `http://localhost:3000/register`. | Registration form renders with empty **Alias**, empty **Password**, no **Account type** selected, and a **Create account** submit button. Because no role is selected, the Rate and Gender controls are **not** rendered. |
| 2 | Confirm the form opens in a clean state. | No error message is displayed on load. The alert region (`role="alert"`) is absent. |
| 3 | Press **Create account** without entering anything. | The submit is intercepted by JavaScript. An error appears in the alert region reading **Choose Admin user or Player user to create an account.** |
| 4 | Observe the **Network** tab. | **No** request to `POST /api/auth/register` is made. The client-side gate rejects the submit before `fetch` is called. |
| 5 | Observe the URL and page. | The browser stays on `/register`. Nothing is submitted, cleared, or reloaded. |
| 6 | Observe the browser's built-in validation. | No native "Please fill out this field" tooltip appears. The form is a `noValidate` form, so the app's own message is the only feedback. |
| 7 | Observe cookies (devtools → Application → Cookies). | No `pc_session` cookie is created. |
| 8 | **Verify in database:** `db.users.countDocuments()` on the `dinkboard` database. | The total is unchanged from the precondition. No user document was created. |
| 9 | Select **Player user** only, leaving Alias, Password, and Gender empty. | Rate (default `3.0`) and Gender appear; the submit label becomes **Create player account**. Rate shows `Low Intermediate · used automatically for balanced matchmaking.` |
| 10 | Press **Create player account**. | A new client-side error appears: **Choose a gender for the player account.** Still no `POST /api/auth/register` request in the Network tab. |
| 11 | Clear the **Rate** field, leaving Gender unselected. | The hint switches to `Set a rate from 2.0 to 4.0, or choose NR.` |
| 12 | Press **Create player account** again. | The rate is checked before gender, so the error becomes **Rate must be between 2.0 and 4.0.** (client-side). No request is sent. |
| 13 | Restore Rate to `3.0`, select Gender `Male`, then press **Create player account** with Alias and Password still empty. | The client gate now passes, so `POST /api/auth/register` **is** sent. Response is `400 Bad Request` with `{ "error": "Alias must be 3–30 characters using letters, numbers, spaces, dots, dashes, or underscores." }` — the API validates alias first. |
| 14 | Observe the page after that response. | The API error is displayed in the same alert region. The user stays on `/register`. No `pc_session` cookie. |
| 15 | Enter a valid Alias, e.g. `marktest25`, leave Password empty, keep Player user / Rate `3.0` / Gender `Male`, and submit. | `400` with `{ "error": "Password must be between 8 and 128 characters." }` — the API validates password second. No account is created. |
| 16 | Switch to **Admin user**, clear Alias and Password, and submit. | `400` with the alias error again. The admin path has no Rate/Gender requirements, so alias is the first failure. |
| 17 | Enter an Alias of three spaces (`"   "`) and a valid Password, select **Admin user**, and submit. | The alias is trimmed to empty, so it still fails: `400`, alias error. Whitespace does not count as a value. |
| 18 | **Verify in database** after all attempts: `db.users.countDocuments()` and `db.users.findOne({ aliasKey: "marktest25" })`. | Total still equals the precondition value, and the lookup returns `null`. No partial documents were written by any failed attempt. |
| 19 | Confirm the form is still usable: fill every field correctly and submit. | Registration succeeds with `201` and redirects to `/`. The earlier empty-field failures left the form fully functional. |

## Scenario matrix

Each row is a variant of "empty fields" and states exactly which field fails and at which layer.

| # | Alias | Password | Role | Rate | Gender | Rejected by | Expected message |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A | empty | empty | none | n/a | n/a | Client | `Choose Admin user or Player user to create an account.` |
| B | empty | empty | Player | 3.0 | none | Client | `Choose a gender for the player account.` |
| C | empty | empty | Player | cleared | none | Client | `Rate must be between 2.0 and 4.0.` |
| D | empty | empty | Player | 3.0 | Male | API `400` | alias message |
| E | `marktest25` | empty | Player | 3.0 | Male | API `400` | `Password must be between 8 and 128 characters.` |
| F | `"   "` | valid | Admin | n/a | n/a | API `400` | alias message (whitespace trims to empty) |
| G | empty | valid | none | n/a | n/a | API `400` | alias message (API checks alias before role) |

Rows A–C must produce **zero** network requests. Rows D–G must produce a `400` and **no** database write. In every row: no redirect, no `pc_session` cookie, no new `users` document.

## API-only variants

All of these bypass the client gate and must be rejected server-side.

```bash
# 1. Completely empty payload — malformed/absent JSON body is treated as {}
curl -i -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{}'
# Expect 400 · Alias must be 3–30 characters using letters, numbers, spaces, dots, dashes, or underscores.

# 2. Empty strings for every field
curl -i -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"alias":"","password":"","role":"player","rating":3,"gender":"male"}'
# Expect 400 · alias message (alias is validated first)

# 3. Valid alias, empty password
curl -i -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"alias":"marktest25","password":"","role":"player","rating":3,"gender":"male"}'
# Expect 400 · Password must be between 8 and 128 characters.

# 4. Valid alias and password, no role
curl -i -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"alias":"marktest25","password":"Verz123$%"}'
# Expect 400 · Choose Admin user or Player user to create an account.

# 5. Empty body with no JSON at all
curl -i -X POST http://localhost:3000/api/auth/register
# Expect 400 · alias message (unparseable body falls back to {})
```

For every variant, confirm there is **no** `Set-Cookie: pc_session=…` response header.

## Pass criteria

- An all-empty submit is rejected with `Choose Admin user or Player user to create an account.` and sends **no** network request.
- Once a role is selected, the client gate reports missing Gender and then missing Rate, in that order, still without a network request.
- Missing Alias and Password are rejected by the API with `400` and the correct message, in the order alias → password → role.
- Every rejected attempt leaves the user on `/register` with a visible, specific error.
- No `pc_session` cookie is set and no `users` document is created by any attempt.
- A correctly filled form still works afterwards (redirect to `/` with `201`).

## Failure signals

- The form redirects to `/` or renders the dashboard after an empty submit.
- The request returns `201`, or a `users` document appears with an empty/`undefined` alias.
- A `500` or `Could not create the account.` — an empty field is reaching `hashPassword()`/`insertOne()` or throwing, instead of being validated.
- No message is shown at all (silent failure), or the message is generic rather than naming the specific field.
- A `pc_session` cookie is set despite rejection.
- A native browser tooltip is the only feedback (would mean `noValidate` was removed and validation relies on HTML attributes).
- Validation order differs from documented (e.g. gender reported before rate, or password before alias) — not necessarily a bug, but it means this case and its expected messages need updating.

## Notes

- **Two validation layers.** `components/AuthForm.tsx` pre-checks only **role**, **rate**, and **gender** before calling `fetch`. It does **not** pre-check alias or password emptiness, so those two empty fields always reach the API and are reported by `app/api/auth/register/route.ts`.
- **Server validation order** in the register route: alias → password → role → (player only) rating → gender. The first failure wins, which is why row G reports the alias rather than the missing role.
- **`noValidate`** on the form means the `required`/`minLength` HTML attributes never block submission or show native tooltips; all user feedback comes from the app's own alert region.
- **Rate cannot be "empty" as a number.** The Rate input is a number field seeded at `3.0`; clearing it yields `""`, and `normalizeRating("")` resolves to `0`, which is below the `2.0` minimum, so it is treated as invalid rather than defaulted. With **NR** toggled on, the rate field is disabled and the rate check is skipped.
- Empty fields are rejected **before any database work**: the route returns early, so `hashPassword()` and `insertOne()` are never reached.
- Related coverage for the signed-out login form: `/login` with both fields empty returns `400` with `Enter your alias and password.` (the login route checks for empty values before any database lookup). That is a separate feature from this registration case and is recorded here only for reference.
