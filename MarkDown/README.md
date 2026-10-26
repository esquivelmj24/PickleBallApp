# Pickle & Chill — Registration Test Cases

Manual test cases for the account registration flow at `/register`.

## Index

| ID | Title | Type | Expected result | Status |
| --- | --- | --- | --- | --- |
| [TC-001](./TC-001-register-valid-details.md) | Register using valid details | Positive | Account created, signed in, dashboard shown | Not run |
| [TC-002](./TC-002-register-invalid-password.md) | Register using invalid password | Negative | Registration rejected with password error, no account created | Not run |

## Application under test

| Item | Value |
| --- | --- |
| App | Pickle & Chill — Pickleball Leveling Console |
| Framework | Next.js 15 (App Router), TypeScript, MongoDB |
| Registration page | `/register` |
| Registration endpoint | `POST /api/auth/register` |
| Login endpoint | `POST /api/auth/login` |
| Dashboard after success | `/` — "Balanced Courts, Better Games" |
| Session cookie | `pc_session` (HttpOnly, SameSite=Lax, Path=/, 7 days) |
| Default dev URL | `http://localhost:3000` |

## Registration rules enforced by the app

Source of truth: `app/api/auth/register/route.ts`, `lib/auth.ts`, `components/AuthForm.tsx`.

| Field | Required | Rule | Error message |
| --- | --- | --- | --- |
| Role | Yes | `Admin user` or `Player user` | `Choose Admin user or Player user to create an account.` |
| Alias | Yes | 3–30 chars; must start with a letter or number; letters, numbers, spaces, `.`, `_`, `-` only; trimmed and inner whitespace collapsed | `Alias must be 3–30 characters using letters, numbers, spaces, dots, dashes, or underscores.` |
| Password | Yes | 8–128 characters. **No complexity rule** (no uppercase/digit/symbol requirement) | `Password must be between 8 and 128 characters.` |
| Rate | Player only | Number 2.0–4.0 (or NR toggle) | `Rate must be between 2.0 and 4.0.` |
| Gender | Player only | One of Female, Male, Non-binary, Prefer not to say | `Choose a gender for the player account.` |
| Alias uniqueness | — | Case-insensitive `aliasKey` is unique | `That alias is already registered. Choose another one.` (HTTP 409) |

Response codes: `201` created, `400` validation failure, `409` duplicate alias, `500` server error.

## Conventions

- **Preconditions** state everything that must be true before step 1.
- **Steps** are numbered and each has its own expected result where useful.
- **Verify in database** steps use MongoDB (default database name `dinkboard`, collection `users`).
- **Status** is `Not run`, `Pass`, `Fail`, or `Blocked`. These cases are documented, not yet executed against a running instance.

## Known gaps in the supplied inputs

The two supplied test cases specify only **Alias**, **Password**, and **Role**. The app additionally requires **Rate** and **Gender** for a `Player user`. Each case therefore documents explicit assumptions:

- Rate assumed to stay at the form default of `3.0` (Low Intermediate band) unless a case states otherwise.
- Gender must be explicitly selected — the form starts at "Select gender" and submission is blocked without it.

Both assumptions are recorded per case so results stay reproducible.
