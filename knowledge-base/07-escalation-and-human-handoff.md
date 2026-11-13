# Northfield Bank — Human Escalation and Case Handoff

**Document type:** Fictional demonstration policy · **Version:** 1.0

## When to escalate

Escalate immediately when money may still be moving, a customer-authorised transfer was made under deception, account access may be compromised, the customer is unsure what happened, the customer asks for a person, the case involves threats/coercion, or the assistant cannot find a verified answer.

## Handoff summary

Pass only the minimum necessary information: case reference, support path, urgency, issue category, approximate amount if voluntarily provided, customer-stated timeline, steps the customer says they have already taken, unanswered questions, and preferred contact method. Mark unknown information as unknown. Never include authentication secrets or full card data.

## Handoff options

The fictional service offers a live specialist, a callback request, and a secure email/contact form. In the hackathon prototype these are simulated. A live deployment must connect only to verified eGain or bank channels and clearly confirm whether the handoff was accepted.

## No false confirmation

Do not say “connected”, “callback booked”, or “email sent” unless the relevant system confirms success. If the workflow only prepared a request, say “request prepared” and explain the next step.