---
id: analysis.reference.legend-page-template
type: analysis_note
title: Legend Page Template Reference
source_kind: local_derived_doc
source_path: /Users/eric/hextech-analytics/docs/LEGEND-PAGE-TEMPLATE.md
source_date: unknown
trust_level: derived_unverified
status: reviewed
tags:
  - hextech-doc
  - derived
  - legend-page-template
---

## Import Notes
- Imported at: `2026-03-27T18:57:16.416394Z`
- This document is non-canonical and remains outside `canon/`.

## Original Content
# Legend Page Template Reference

Generated from Annie (Fury+Chaos) and Fiora (Body+Order) pages after standardization pass.

## File Structure

```
app/learn/legends/[champion]/page.tsx
```

## Required Imports
```tsx
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import StarterDeckDisplay from "@/components/StarterDeckDisplay";
import { getCardByExactName } from "@/lib/riftcodex";
```

## Data Sections (in order)

1. **Metadata** - OpenGraph, canonical URL, title, description
2. **DeckCard interface** - name, count, set, rarity, domain, type?, price?
3. **metaDeck** - Tournament result data (title, pilot, event, date, players, result, legend, runes, battlefields, units, spells, gear?, sideboard)
4. **budgetMetaDeck** - Budget version (same structure + swaps array)
5. **starterUpgrades** - Array of { out, inn, why } objects
6. **domainColor** map - Fury:red-400, Calm:green-400, Mind:blue-400, Body:orange-400, Chaos:purple-400, Order:yellow-200, Neutral:gray-400
7. **domainIcon** map - /images/domains/{domain}.png
8. **cardTypeIcon** map - Legend, Rune, Battlefield, Unit, Spell, Gear, Sideboard
9. **rarityColor** map - Common:gray-400, Uncommon:green-400, Rare:blue-400, Epic:purple-400, Legendary:yellow-400, Starter:gray-500
10. **CardLine** component - flex items-center, domain icon, domain color
11. **deckTotal** helper
12. **buildSegmentedDeckUrl** helper (supports gear param)
13. **URL builders** for both decks

## Page Component Structure

### API Card Image Fetch
```tsx
const res = await getCardByExactName("[Legend Card Name]");
const card = res.items?.find(c => !c.metadata?.overnumbered) ?? res.items?.[0];
```
Legend card names use title-only format: "Dark Child - Starter", "Grand Duelist"

### Layout Sections (in order)

1. **Breadcrumbs** - Home / Legends / [Name]
2. **Header** - Champion name (h1), tier badge, subtitle with domain icons
3. **Overview** - Card image + description text in gradient box
4. **3-Column Feature Grid** - 3 key attributes
5. **How to Play** - Early Game (Turns 1-3), Mid Game (Turns 4-6), Late Game (border-l-4 cards)
6. **Key Cards to Know** - 5 cards with colon separator (not -- or :)
   Format: `- **Card Name**: Description text`

### Starter Path (green border group)
7. **StarterDeckDisplay** component - `<StarterDeckDisplay championKey="CHAMPION" />`
8. **Starter Upgrade** - ~$10-20, commons/uncommons only, 5-6 swaps

### Competitive Path (yellow border group)
9. **Meta Deck** - Real tournament result with full decklist
   - Event info header with pilot, date, players
   - Section headers with card type icons
   - Rune lines with domain icons and "x" (not multiplication sign)
   - CardLine component for units/spells/gear/sideboard
   - Deck total + builder link
10. **Budget Meta** - Under $50, same gameplan
    - Key swaps table
    - Full decklist (emerald theme)
    - Deck total + builder link

### Footer Sections
11. **Where to Buy** - Riot Store, TCGPlayer, Cardmarket links
12. **What's Next?** - Deck Builder, Browse Other Legends, Learn the Game

## Styling Rules
- No emojis anywhere
- Use -- (double dash) for prose breaks, not em/en dashes
- Use : (colon) in key cards section
- Use x (letter) not x (multiplication sign) for card counts
- All section headers: flex items-center gap-1.5 with cardTypeIcon Image (12x12)
- All rune lines: flex items-center gap-2 with domainIcon Image (10x10)
- All CardLine: flex items-center gap-2 with domainIcon Image (10x10)
- Header subtitle: flex items-center gap-2 with domain Images (14x14)
- brightness-200 class on all domain/card type icons
- Gradient themes: red/orange for Fury, orange/yellow for Body, blue for Mind, green for Calm, purple for Chaos, yellow for Order

## Color Mapping by Champion
- Annie: text-red-500 (h1), red-400 (subtitle), from-red-900/30 to-orange-900/20 (overview)
- Fiora: text-orange-500 (h1), orange-400 (subtitle), from-orange-900/30 to-yellow-900/20 (overview)
- Match gradient to primary domain color

## Price Rules
- TCGPlayer market data
- Non-foil for commons/uncommons
- Standard foil for rares and above (foil IS standard rarity for Rare/Epic/Legendary)
- Pick lowest rarity printing
- Include "Prices from TCGPlayer, Feb 2026" disclaimer

## Data Integrity
- NEVER fabricate tournament results, player names, or placements
- NEVER make up prices
- All set codes verified via RiftCodex API
- All card names must match RiftCodex exactly
- Tournament data sourced from riftbound.gg, riftdecks.com, or official event pages
