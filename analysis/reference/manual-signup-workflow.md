---
id: analysis.reference.manual-signup-workflow
type: analysis_note
title: Hextech Custom Tournament: Operator Workflow
source_kind: local_derived_doc
source_path: /Users/eric/hextech-analytics/docs/MANUAL_SIGNUP_WORKFLOW.md
source_date: unknown
trust_level: derived_unverified
status: reviewed
tags:
  - hextech-doc
  - derived
  - manual-signup-workflow
---

## Import Notes
- Imported at: `2026-03-27T18:57:16.417823Z`
- This document is non-canonical and remains outside `canon/`.

## Original Content
# Hextech Custom Tournament: Operator Workflow

This document outlines the operational process for reviewing, approving, and onboarding players who sign up for the Hextech-hosted Riftbound tournament.

## 1. Reviewing Signups

**Daily Rhythm:**
*   Check the signup form submissions daily.
*   Move new submissions from the inbound tracking queue (e.g., sheet or database) to a "Review" status.
*   Cross-reference the player's provided Riftbound ID or Discord handle against any known community red flags.

## 2. Player Qualification Criteria

A player is considered **Qualified** if they meet the following baseline checks:
*   **Complete Application:** All mandatory fields in the signup form are filled out accurately (no obvious troll entries).
*   **Availability:** Their stated availability aligns with the tournament's scheduled match windows.
*   **Region Fit:** The player is physically located in or able to ping reasonably well to the designated tournament servers (e.g., NA, EU).
*   **Experience Level:** Their provided background aligns with the target audience of the beta tournament (e.g., serious competitive mindset, willing to test early formats).

## 3. Clustering by Timing and Region

To ensure smooth bracket scheduling:
*   **Regional Buckets:** Group approved players into primary regional buckets (e.g., NA-East vs NA-West vs EU). Do not intermingle high-ping regions unless necessary for bracket size.
*   **Availability Grouping:**
    *   Create sub-groups based on their preferred play times (e.g., "Weekend Only", "Weekday Evenings").
    *   Match players/teams into pods or early bracket stages with overlapping availability windows to reduce no-shows.

## 4. Manual Follow-Up Sequence (Post-Approval)

Once a player is approved and clustered, execute this manual follow-up sequence:

**Step 1: The Welcome Message (Email/Discord)**
*   Send a message via their provided contact method.
*   *Contents:* Welcome them to the Hextech Open beta, confirm their accepted entry, state their assigned regional/timing cluster, and provide the official Discord server invite link.

**Step 2: Discord Onboarding**
*   Verify the player joins the Discord server within 48-72 hours of the welcome message.
*   Manually assign them the "Tournament Participant" role and their specific "Region" role.
*   Direct them to acknowledge the `#rules` channel.

**Step 3: Final Check-In Confirmation**
*   72 hours before the tournament starts, ping all participants in Discord for a final check-in confirmation.
*   If a player fails to check-in by the 24-hour mark, pull them from the bracket and substitute a waitlisted player.

**Step 4: Bracket & Match Setup**
*   Once check-ins are complete, finalize and publish the bracket.
*   Direct message or ping players with their first round opponent and scheduled match time.
