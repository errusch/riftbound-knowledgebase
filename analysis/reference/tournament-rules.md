---
id: analysis.reference.tournament-rules
type: analysis_note
title: Riftbound Technical Manual: Tournament Regulations (January 2026 Update)
source_kind: local_derived_doc
source_path: /Users/eric/hextech-analytics/docs/TOURNAMENT_RULES.md
source_date: unknown
trust_level: conflicted
status: reviewed
tags:
  - hextech-doc
  - derived
  - tournament-rules
---

## Import Notes
- Imported at: `2026-03-27T18:57:16.431261Z`
- This document is non-canonical and remains outside `canon/`.
- Conflict flags were detected during import.

## Conflict Flags
- `tournament.additional_turns`: Derived source conflicts with local official tournament rules, which specify five additional turns after the active player finishes their turn.
- `tournament.two_point_lead`: Derived source conflicts with local official tournament rules, which determine the winner by score after additional turns rather than a two-point lead.

## Original Content
# Riftbound Technical Manual: Tournament Regulations (January 2026 Update)

## Deck Architecture (Constructed)
- **Main Deck**: Exactly 40 cards (includes 1 **Chosen Champion**).
- **Legend**: Exactly 1 **Champion Legend** card (starts in the Legend Zone).
- **Rune Deck**: Exactly 12 basic or special Runes.
- **Battlefields**: Exactly 3 unique named battlefields.
- **Sideboard**: 0-8 cards (can include an alternate Chosen Champion).

## Units of Play
- **Game**: A single session resulting in a winner or draw (8 VP baseline).
- **Match**: A series of games (standard is **Best of 3**).
- **Extra Turns**: If time expires, the active player finishes their turn, then **3 additional turns** are played. A winner is declared only if there is a **2-point lead**.

## Turn Sequence & Timing (ABCD Protocol)
1. **Awaken**: Untap/ready all exhausted objects.
2. **Beginning Phase**: 
   - Score **+1 Point** for each Battlefield held.
   - Resolve "Start of Turn" and "First Beginning Phase" triggers.
   - *Note*: Missing a Legend grants +1 card draw in this phase.
3. **Channel Phase**: Automatically take 2 Runes from the Rune Deck.
4. **Draw Phase**: Draw 1 card from the Main Deck.

## Information & Privacy (CR 127)
- **Public**: Current phase, scores, rune pools, Chain state, previous turn history.
- **Derived**: Recycled card counts, Rune Deck order, future consequences of static abilities.
- **Private**: Hand, facedown [Hidden] cards (controller only).
- **Secret**: Deck order (until searched/interacted with).

## Competitive Conduct & Shortcuts
- **The Chain (503.9.b)**: Placing a spell on the chain assumes passing priority unless "Retention" is explicitly announced.
- **Observable Impact (506.3)**: Triggers must be acknowledged by the time they change a point total, rune total, or add a buff. Forgotten triggers do not resolve.
- **Layout (High OPL)**: Runes must be closest to the player; Non-runes (units/equipment) closer to the opponent. Legend/Chosen Champion must be together on one side.
