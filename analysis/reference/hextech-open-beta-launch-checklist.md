---
id: analysis.reference.hextech-open-beta-launch-checklist
type: analysis_note
title: Hextech Open Beta Launch Checklist
source_kind: local_derived_doc
source_path: /Users/eric/hextech-analytics/docs/HEXTECH_OPEN_BETA_LAUNCH_CHECKLIST.md
source_date: unknown
trust_level: derived_unverified
status: reviewed
tags:
  - hextech-doc
  - derived
  - hextech-open-beta-launch-checklist
---

## Import Notes
- Imported at: `2026-03-27T18:57:16.415160Z`
- This document is non-canonical and remains outside `canon/`.

## Original Content
# Hextech Open Beta Launch Checklist

This is the operator checklist for turning the Hextech Open beta landing page into a live signup funnel that can handle real interest without breaking.

## What shipped in the product
- Homepage now points to the tournament page.
- Navbar exposes the event under **Compete**.
- Tournament landing page is live at `/tournaments/hextech-open`.
- Signup API accepts submissions at `/api/tournaments/custom-signup`.
- Local dev fallback writes signups to `data/tournaments/hextech-open-beta.json`.
- Production-safe durable path uses a Resend audience as the review queue.

## Required production env
Set these before launch:

- `RESEND_API_KEY`
- `TOURNAMENT_SIGNUP_AUDIENCE_ID` **or** `RESEND_AUDIENCE_ID`
- `TOURNAMENT_SIGNUP_NOTIFY_EMAIL` *(recommended)*

Why these matter:
- Without `RESEND_API_KEY` plus an audience id, production signup requests return `503` by design.
- `TOURNAMENT_SIGNUP_NOTIFY_EMAIL` is optional, but it gives Eric an immediate email when a player signs up.

## Launch verification steps
1. Set the env vars in the deployment target.
2. Deploy the current branch.
3. Open `/api/tournaments/custom-signup` in the deployed environment and confirm:
   - `configured: true`
   - `usesDurableSink: true`
   - `sink: "resend-audience"`
4. Submit one real test signup from the live page.
5. Verify the contact appears in the target Resend audience with:
   - signup id
   - region / timezone
   - buy-in interest
   - experience level
   - notes
6. Verify the admin notification email arrives if `TOURNAMENT_SIGNUP_NOTIFY_EMAIL` is set.
7. Remove or clearly label the test signup inside the review workflow.

## Manual review workflow
This launch deliberately keeps payment and approval manual.

For each signup:
1. Check timezone overlap and rough event-slot fit.
2. Check whether the buy-in expectation matches the planned prize support.
3. Confirm whether the player looks like a good fit for the beta event.
4. Follow up by email or Discord with:
   - final date/time
   - final entry fee
   - payment instructions
   - event rules / banned champions confirmation

## Go / no-go standard
### Go
- Production env set
- Test signup stored in Resend audience
- Notification path verified
- Event copy feels clean enough to send traffic to
- Eric is ready to manually review and follow up on submissions

### No-go
- Signup route still reports `configured: false`
- No durable sink exists in production
- No owner is available to manually review and respond to signups
- Final timing / buy-in range is still too vague to handle inbound demand confidently

## Recommended next moves after launch
1. Add a lightweight internal admin view or export for signups.
2. Add a first response template for approval / rejection / waitlist follow-up.
3. Add a visible cap or expected first-wave seat count once demand is clearer.
4. Decide whether payment stays manual or moves to Stripe checkout after validation.
