---
id: analysis.reference.price-movers-component
type: analysis_note
title: Price Movers Component - Design Spec
source_kind: local_derived_doc
source_path: /Users/eric/hextech-analytics/docs/PRICE-MOVERS-COMPONENT.md
source_date: unknown
trust_level: derived_unverified
status: reviewed
tags:
  - hextech-doc
  - derived
  - price-movers-component
---

## Import Notes
- Imported at: `2026-03-27T18:57:16.426330Z`
- This document is non-canonical and remains outside `canon/`.

## Original Content
# Price Movers Component - Design Spec

## Overview

A real-time market tracker showing the biggest price movements in the Riftbound card market. Displays top gainers and losers with clear visual indicators and links to detailed card pages.

## Component Structure

### Layout

```
┌─────────────────────────────────────────────────────┐
│  🔥 Market Movers                    Last updated: X│
├─────────────────────────────────────────────────────┤
│                                                     │
│  📈 Top Gainers                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │ 1. Card Name                         +45.2%  │ │
│  │    Set Name • Rarity                         │ │
│  │    $12.50 → $18.15 (+$5.65)                  │ │
│  ├───────────────────────────────────────────────┤ │
│  │ 2. Card Name                         +32.8%  │ │
│  │ ...                                          │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  📉 Top Losers                                      │
│  ┌───────────────────────────────────────────────┐ │
│  │ 1. Card Name                         -28.3%  │ │
│  │    Set Name • Rarity                         │ │
│  │    $25.00 → $17.93 (-$7.07)                  │ │
│  ├───────────────────────────────────────────────┤ │
│  │ 2. Card Name                         -19.5%  │ │
│  │ ...                                          │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## Data Source

**Endpoint:** `/data/price-alerts.json`

**Structure:**
```json
{
  "generated": "2024-02-10T12:00:00Z",
  "alerts": {
    "topGainers": [
      {
        "name": "Arcane Bolt",
        "set": "foundations",
        "rarity": "rare",
        "tcgplayerId": "123456",
        "previousPrice": 12.50,
        "currentPrice": 18.15,
        "percentChange": 45.2,
        "priceDiff": 5.65
      }
    ],
    "topLosers": [...]
  },
  "stats": {
    "totalCardsTracked": 500,
    "notableChanges": 45
  }
}
```

## Visual Design

### Color Coding

- **Gainers:** Green gradient (light to dark based on % change)
  - `+10-25%`: `#10b981` (emerald-500)
  - `+25-50%`: `#059669` (emerald-600)
  - `+50%+`: `#047857` (emerald-700)

- **Losers:** Red gradient (light to dark based on % change)
  - `-10-25%`: `#ef4444` (red-500)
  - `-25-50%`: `#dc2626` (red-600)
  - `-50%+`: `#b91c1c` (red-700)

### Typography

- **Card Name:** Font size 18px, weight 600 (semibold)
- **Set/Rarity:** Font size 14px, weight 400, muted color
- **Prices:** Font size 14px, weight 500, monospace
- **Percentage:** Font size 20px, weight 700 (bold), colored

### Interaction

- **Hover:** Card row highlights with subtle background color + shadow
- **Click:** Navigate to `/cards/{tcgplayerId}`
- **Mobile:** Tap to navigate, swipe to scroll within lists

## Component Props

```typescript
interface PriceMoversProps {
  maxGainers?: number;      // Default: 5
  maxLosers?: number;       // Default: 5
  showPriceDiff?: boolean;  // Default: true
  showLastUpdated?: boolean; // Default: true
  compact?: boolean;        // Compact mode for dashboard widgets
}
```

## Usage Examples

### Full Page Component
```jsx
<PriceMovers 
  maxGainers={10} 
  maxLosers={10}
  showPriceDiff={true}
  showLastUpdated={true}
/>
```

### Dashboard Widget (Compact)
```jsx
<PriceMovers 
  maxGainers={3} 
  maxLosers={3}
  compact={true}
  showPriceDiff={false}
/>
```

## Responsive Behavior

### Desktop (≥1024px)
- Side-by-side layout (gainers left, losers right)
- 50/50 split width
- Show 5-10 cards per list

### Tablet (768-1023px)
- Stacked layout (gainers top, losers bottom)
- Full width lists
- Show 5 cards per list

### Mobile (≤767px)
- Stacked layout with tabs (Gainers | Losers)
- Show 3-5 cards per list
- Compact price display (hide price diff, show only final price + %)

## Empty States

### No Data Available
```
⚠️ No price alert data available yet
Price tracking requires at least two data snapshots.
Check back after the next price update.
```

### No Significant Changes
```
✅ Market is stable
No cards have moved more than 10% since last update.
```

## Future Enhancements

1. **Filters**
   - Filter by set
   - Filter by rarity
   - Filter by price range

2. **Time Range Selector**
   - Last 24 hours
   - Last 7 days
   - Last 30 days

3. **Alerts**
   - Watchlist: track specific cards
   - Email/push notifications for major moves
   - Custom alert thresholds

4. **Charts**
   - Sparkline price history for each card
   - Overall market trend indicator

5. **Export**
   - CSV export of all movers
   - Share link for specific alert snapshot

## Implementation Notes

- Component should fetch `/data/price-alerts.json` on mount
- Refresh every 5 minutes (or when user navigates back to page)
- Show loading skeleton while fetching
- Cache data with SWR or React Query
- Use Next.js Link for navigation (client-side routing)

## Testing Considerations

- Test with empty data
- Test with no significant changes
- Test with extreme values (>100% change)
- Test loading states
- Test error states (failed to load data)
- Test responsive breakpoints
- Test accessibility (keyboard navigation, screen readers)
