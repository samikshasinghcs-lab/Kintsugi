# Kintsugi — eGain implementation map

The local browser experience demonstrates the intended customer journey. The production hackathon agent must be built, published, and tested inside eGain. The local demo does not claim to be an eGain deployment.

| # | Capability | Prototype coverage | eGain implementation |
|---|---|---|---|
| 1 | Two-path triage | Fraud and hardship opening paths | Route from a single gentle opening question / two intents |
| 2 | Plain-language replies | Short prompts and one next step | Agent instruction: plain language, one action per response |
| 3 | Business value | Estimated impact statement in README/demo | State as a hypothesis/estimate, never measured result |
| 4 | English/Hindi | Language selector and bilingual core prompts | Enable supported language configuration; validate all knowledge content |
| 5 | Grounded knowledge | Eight authored fictional policies | Upload each document to Knowledge Hub; validate retrieval and citations |
| 6 | Intent review | Keyword intent smoke-test hook | Review every generated intent and repair false positives |
| 7 | Knowledge-gap fallback | Explicit no-guess fallback | Route unsupported questions to human escalation |
| 8 | Input validation | Amount/date-style validation in conversation design | Add validation and retry paths to workflows |
| 9 | Test coverage | `tests/TEST_MATRIX.md` | Run in Test AI Agent and on the published link |
| 10 | Lightweight pre-chat | Optional first name + two support paths | Keep only Name and issue selection; gather urgency/contact in chat |
| 11 | Workflows | Local fraud and hardship state flows | Publish two intent-linked workflows |
| 12 | Actions | Explicitly simulated local case preparation | Add demo-safe Actions; never imply real card blocking without a real bank integration |
| 13 | Escalation | Specialist, callback, email handoff drafts | Configure at least two real eGain escalation options for the demo environment |
| 14 | Original content | `knowledge-base/` | Upload authored documents, not only tutorial sample content |
| 15 | Empathy | Empathy-first opening | Include in agent instructions and test all first replies |
| 16 | Urgency ordering | Recent/pending transfer gets containment guidance first | Branch immediately before ordinary fraud intake |
| 17 | Elderly-friendly UX | Large-text toggle, short prompts, one question at a time | Keep concise replies and visible human option |
| 18 | Case summary | Live summary panel and handoff draft | Pass approved structured summary to human agent |
| 19 | Honest limits | No refund guarantees; authorised transfer escalation | Enforce in instructions, workflows, and knowledge articles |
| 20 | Safety refusals | Credential and card-data warnings | Refuse requests for PIN/password/OTP/full card number; never store them |

## Demo integrity

The local prototype only creates a local demonstration summary. The action buttons are not connected to bank systems. In the eGain demo, label mock actions clearly and avoid claiming a real card was blocked or money recovered unless a connected, authorised system confirms it.