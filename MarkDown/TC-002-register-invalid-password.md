# TC-002 — Register using invalid password

| Field | Value |
| --- | --- |
| **Test case ID** | TC-002 |
| **Title** | Register using invalid password |
| **Type** | Negative / Validation |
| **Feature** | Registration (`/register`) — password length rule |
| **Priority** | High |
| **Status** | Not run |
| **Automated** | No |

## Objective

Verify that registration is rejected when the password is shorter than the 8-character minimum, that the user receives a clear error, that **no account is created**, and that **no session is established**.

## Test data

| Input | Value | Notes |
| --- | --- | --- |
| Alias | `marktest24` | 10 chars — a **valid** alias, so the only invalid input is the password |
| Password | `test` | 4 chars — below the 8-character minimum, therefore invalid |
| Account type | `Player user` | Radio option on the registration form |
| Rate | `3.0` | **Assumption:** form default, since the case does not specify it |
| Gender | `Male` | **Assumption:** required by the form; a valid gender keeps the password as the single failure |

## Preconditions

1. The app is running (`npm run dev`) and reachable at `http://localhost:3000`.
2. `MONGODB_URI` is configured and the database connection succeeds.
3. The browser has no active `pc_session` cookie (signed out), or a private window is used.
4. No account already exists with alias `marktest24` — otherwise a `409` could mask the password result.

## Steps

| # | Action | Expected result |
| --- | --- | --- |
| 1 | Navigate to `http://localhost:3000/register`. | Registration form renders. |
| 2 | Enter Alias `marktest24`. | Alias is accepted; no alias error is shown. |
| 3 | Enter Password `test`. | The password input accepts the text without blocking keystrokes. No error appears yet — the form is a `noValidate` form, so HTML5 `minLength` does not pre-block submission. |
| 4 | Select the **Player user** radio button. | Rate and Gender controls appear; submit label becomes **Create player account**. |
| 5 | Leave Rate at `3.0` and select Gender `Male`. | Both player-only fields are satisfied, leaving only the password as invalid. |
| 6 | Press **Create player account**. | The form submits (client validation does **not** reject the short password), the button shows `Creating account…`, then the request completes. |
| 7 | Observe the network response for `POST /api/auth/register`. | Status `400 Bad Request`. Response body is `{ "error": "Password must be between 8 and 128 characters." }`. |
| 8 | Observe the page after the response. | An error message is rendered in the form's alert region (`role="alert"`) reading **Password must be between 8 and 128 characters.** |
| 9 | Observe the URL and session state. | The browser stays on `/register`. There is **no** redirect to `/`. No `pc_session` cookie is set (devtools → Application → Cookies is unchanged). |
| 10 | **Verify in database:** `db.users.findOne({ aliasKey: "marktest24" })` on the `dinkboard` database. | `null` — no user document was created. |
| 11 | **Verify in database:** `db.users.countDocuments({ aliasKey: "marktest24" })`. | `0`. The database is unchanged by the rejected request. |
| 12 | Attempt to sign in at `/login` with `marktest24` / `test`. | Status `401` with `{ "error": "Invalid alias or password. Please try again." }` — the account genuinely does not exist. |
| 13 | Return to `/register` and resubmit the **same** alias `marktest24` with a valid password, e.g. `Verz123$%`. | Registration **succeeds** with `201` — the earlier rejection left no partial or locked record behind. |
| 14 | Clean up: sign out and remove the `marktest24` account if this was a shared test environment. | The environment is left reusable for the next run. |

## Boundary variants

Run each row with alias `marktest24` (creating/removing the account between rows) to confirm the length rule at its edges. The rule is `length >= 8 && length <= 128`.

| # | Password | Length | Expected |
| --- | --- | --- | --- |
| V1 | `test` | 4 | `400` — `Password must be between 8 and 128 characters.` |
| V2 | `test123` | 7 | `400` — same message (one below the minimum) |
| V3 | `test1234` | 8 | `201` — accepted (exactly at the minimum) |
| V4 | 128 chars (e.g. `a` × 128) | 128 | `201` — accepted (exactly at the maximum) |
| V5 | 129 chars (e.g. `a` × 129) | 129 | `400` — same message (one above the maximum) |
| V6 | `testtest` | 8 | `201` — accepted. Documents that **no complexity rule** exists; do not assert a complexity error. |
| V7 | `        ` (8 spaces) | 8 | `201` — accepted, since only length is validated. Record as an observation / product risk. |

## API-only variant

```bash
curl -i -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"alias":"marktest24","password":"test","role":"player","rating":3,"gender":"male"}'
```

Expected: `HTTP/1.1 400 Bad Request`, `{ "error": "Password must be between 8 and 128 characters." }`, and **no** `Set-Cookie: pc_session=…` header.

## Pass criteria

- The request is rejected with `400` and the exact message: `Password must be between 8 and 128 characters.`
- The message is shown to the user in the form's alert region.
- The user stays on `/register` and is not signed in; no `pc_session` cookie is created.
- No `users` document is inserted for `marktest24`.
- Login with the rejected credentials fails with `401`.
- Re-registering the same alias with a valid password succeeds, proving nothing was left half-created.

## Failure signals

- `201` returned, or the user is redirected to `/` — the length rule is not enforced server-side.
- A user document exists for `marktest24` after the rejection.
- A `pc_session` cookie is set despite the failure.
- The error is silent (no visible message) or uses a different/misleading message such as a duplicate-alias or generic server error.
- A `500`/`Could not create the account.` instead of a `400` — indicates the validation check throws rather than returning a clean error.
- A "password is not strong enough" style message: the app has no complexity rule, so that would be wrong behaviour for this build.

## Notes

- Validation is **server-authoritative**: `validatePassword()` in `lib/auth.ts` returns `null` for anything outside 8–128 characters, and the route returns `400` before any database write. The client-side pre-check only covers Rate and Gender for players, not password length, so this error necessarily arrives from the API.
- The form uses `noValidate`, which is why the browser's `minLength={8}` attribute does not stop the submit in step 6. That is intentional and expected.
- Password hashing uses scrypt with a per-account random salt; a rejected password never reaches `hashPassword()`.
- This case does not overlap TC-001: TC-001 uses a valid password and creates an account; TC-002 must leave the system untouched.
