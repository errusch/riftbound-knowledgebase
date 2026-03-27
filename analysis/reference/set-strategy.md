---
id: analysis.reference.set-strategy
type: analysis_note
title: SET_STRATEGY.md
source_kind: local_derived_doc
source_path: /Users/eric/hextech-analytics/docs/SET_STRATEGY.md
source_date: unknown
trust_level: derived_unverified
status: reviewed
tags:
  - hextech-doc
  - derived
  - set-strategy
---

## Import Notes
- Imported at: `2026-03-27T18:57:16.430344Z`
- This document is non-canonical and remains outside `canon/`.

## Original Content
# SET_STRATEGY.md

## Objective
Implement a sitewide "Set Context" architecture to separate data, strategy, and meta analysis by expansion cycle (Origins vs. Spiritforged vs. Combined).

## Set Definitions
1.  **Set 1: Origins (`OGN`)**
    *   *Status:* Legacy / Global Standard (Current)
    *   *Meta:* Defined by Annie, Kai'Sa, Ezreal.
2.  **Set 2: Spiritforged (`SFT`)**
    *   *Status:* New Release / CN Standard
    *   *Meta:* Defined by Draven, Sivir, Irelia.
3.  **Combined / Eternal**
    *   *Status:* All cards legal.

## Implementation Plan

### 1. Card Library (`/learn/cards`)
*   **Current:** Filters by Domain, Type, Rarity.
*   **Change:** Add **"Set / Expansion"** dropdown.
*   **Values:** "All Sets", "Origins (OGN)", "Spiritforged (SFT)".

### 2. Tier List (`/tier-list`)
*   **Current:** Split by Region (CN vs Global).
*   **Change:** Reframe Regions as proxies for Sets, but explicitly label them.
    *   *Global* -> "Origins Meta (Set 1)"
    *   *China* -> "Spiritforged Meta (Set 2)"
    *   Add a "Cross-Set Comparison" section if applicable.

### 3. Champion Analysis (`/learn/legends`)
*   **Current:** Flat list of champions.
*   **Change:** Add a "Meta Context" filter.
    *   "Show Set 1 Performance"
    *   "Show Set 2 Performance"
    *   (Future: Dynamic stats based on selected set).
    *   *Immediate Action:* Add visual tags to champions indicating their peak set (e.g., "Set 2 Breakout").

### 4. Market (`/market`)
*   **Change:** Group "Top Movers" by Set.
*   *Why:* Origins cards move differently (stabilized) than Spiritforged cards (volatile hype).

## Technical Strategy
*   **URL Param:** Use `?set=OGN` or `?set=SFT` as the standard context driver.
*   **Components:** Create reusable `SetBadge` and `SetSelector` components.
