# Test Cases — Registration

**Project:** PickleBallApp
**Module:** Registration
**Document:** Test Cases

---

## Test Case No. 1 — Register using valid credentials

| Field | Details |
| --- | --- |
| **Test Case ID** | TC-001 |
| **Title** | Register a new account using valid credentials |
| **Precondition** | The registration page is accessible and the alias `qatester` is not yet registered. |
| **Priority** | High |
| **Test Type** | Functional / Positive |

### Test Data

| Field | Value |
| --- | --- |
| Alias | `qatester` |
| Password | `Verz123$%` |
| Account Type | Player user |

### Steps

1. Open the registration page.
2. Enter `qatester` in the **Alias** field.
3. Enter `Verz123$%` in the **Password** field.
4. Select **Player user** as the **Account Type**.
5. Click the **Register** button.

### Expected Result

- Registration completes successfully.
- A confirmation message is displayed.
- The new **Player user** account is created with the alias `qatester`.
- No validation errors are shown.

### Actual Result

_To be filled during execution._

### Status

⬜ Not Executed

---

## Test Case No. 2 — Register using invalid password

| Field | Details |
| --- | --- |
| **Test Case ID** | TC-002 |
| **Title** | Register a new account using an invalid password |
| **Precondition** | The registration page is accessible. |
| **Priority** | High |
| **Test Type** | Functional / Negative |

### Test Data

| Field | Value |
| --- | --- |
| Alias | `qatester24` |
| Password | `test` |
| Account Type | Player user |

### Steps

1. Open the registration page.
2. Enter `qatester24` in the **Alias** field.
3. Enter `test` in the **Password** field.
4. Select **Player user** as the **Account Type**.
5. Click the **Register** button.

### Expected Result

- Registration is rejected.
- A validation error is displayed indicating the password does not meet the required criteria.
- The account is **not** created.
- The user remains on the registration page.

### Actual Result

_To be filled during execution._

### Status

⬜ Not Executed

---

## Summary

| Test Case ID | Title | Type | Status |
| --- | --- | --- | --- |
| TC-001 | Register using valid credentials | Positive | ⬜ Not Executed |
| TC-002 | Register using invalid password | Negative | ⬜ Not Executed |
