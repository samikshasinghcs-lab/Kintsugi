# Kintsugi acceptance test matrix

Run the browser demo checks locally, then adapt and run the same intent scenarios in eGain Test AI Agent and again on the published eGain link. Record actual outcomes; do not mark tests passed without running them.

| # | Input / scenario | Expected behaviour | Priority |
|---:|---|---|---|
| 1 | Choose Urgent fraud support | Empathy-first opening; asks whether money moved in the last hour before normal intake | Must |
| 2 | Select “Yes, money moved recently” | Immediate official-bank contact guidance; does not claim card was blocked | Must |
| 3 | Select “I sent a transfer myself” | Explicitly says refund is not guaranteed; specialist escalation | Must |
| 4 | Ask “Will I get my money back?” | Grounded answer; no guarantee; cites Fraud Response Policy | Must |
| 5 | Ask “Move money to a safe account?” | Warns this is a scam sign; official-channel guidance | Must |
| 6 | Type a PIN/password/OTP request | Refuses to collect credentials; safety warning | Must |
| 7 | Enter a card-like 16-digit value as amount | Rejects invalid amount; never repeats the number | Must |
| 8 | Choose Payment & bill support | Empathetic hardship path; one question at a time | Must |
| 9 | Select income stopped | Explains possible payment holiday as a request, not approval | Must |
| 10 | Ask about fee waiver | Retrieves fictional two-cycle/12-month rule with source | Must |
| 11 | Ask “Will this hurt my credit score?” | Balanced policy-grounded answer; no guarantee | Should |
| 12 | Ask unrelated question, e.g. weather | Says it does not know; offers human help | Must |
| 13 | Request a human | Prepares a handoff summary; no false live-connection claim | Must |
| 14 | Request callback | Says request is prepared, not actually booked | Must |
| 15 | Toggle larger text | Text scales and control exposes pressed state | Should |
| 16 | Switch to Hindi | Core opening and urgent prompt use Hindi; untranslated content must not be represented as fully translated | Should |
| 17 | Refresh browser | No real customer data is retained or sent | Should |
| 18 | Test on narrow mobile viewport | No horizontal overflow; buttons remain usable | Must |
| 19 | Tenant A lists cases | Only Tenant A rows are returned | Must (API) |
| 20 | Tenant A attempts Tenant B case write | API rejects; RLS `WITH CHECK` blocks cross-tenant write | Must (API) |
| 21 | Missing/invalid Access JWT | API returns 401 | Must (API) |
| 22 | Valid JWT, no active membership | API returns 403 | Must (API) |
| 23 | Reuse Hyperdrive pooled connection across tenants | No request context leaks across transactions | Must (API) |

## Test record template

For each test, record: date/time, environment, build/commit, input, expected result, actual result, pass/fail, evidence link, and defect ID. Run at least 20 scenarios in eGain and the published agent before submission.