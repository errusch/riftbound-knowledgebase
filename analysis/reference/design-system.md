---
id: analysis.reference.design-system
type: analysis_note
title: DESIGN_SYSTEM.md - Hextech Analytics
source_kind: local_derived_doc
source_path: /Users/eric/hextech-analytics/docs/DESIGN_SYSTEM.md
source_date: unknown
trust_level: derived_unverified
status: reviewed
tags:
  - hextech-doc
  - derived
  - design-system
---

## Import Notes
- Imported at: `2026-03-27T18:57:16.413724Z`
- This document is non-canonical and remains outside `canon/`.

## Original Content
# DESIGN_SYSTEM.md - Hextech Analytics

## Visual Philosophy
"Inevitability through Hextech Precision." The app should feel like a high-end Runeterran interface—obsessively detailed, stable, and effortless.

## Color Palette (Tokens)
| Token | Hex | Usage |
|-------|-----|-------|
| `hextech` | #0AC8B9 | Primary actions, key highlights |
| `zaun` | #C8AA6E | Secondary accents, borders, framing |
| `void` | #091428 | Primary backgrounds (The abyss) |
| `void-light`| #1A2639 | Card surfaces, secondary containers |
| `parchment` | #F4EBD0 | Primary text, high readability elements |

## Typography
- **Headings**: `Beaufort` (Serif) — Bold, cinematic, authoritative.
- **Body**: `Inter` (Sans-serif) — Clean, functional, modern readability.

## Spacing & Rhythm
- Base Unit: `4px`
- Containers: `16px` or `24px` padding.
- Rhythm: Use `8-point grid` for all vertical spacing.

## Components
- **Cards**: `void-light` background, `zaun/20` border, `rounded-lg` (8px).
- **Buttons**: `hextech` for primary, `zaun` outline for secondary.
- **Motion**: Transitions should be fast (`150ms`) and use `ease-in-out`.
