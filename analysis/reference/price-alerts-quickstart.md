---
id: analysis.reference.price-alerts-quickstart
type: analysis_note
title: Price Alerts Quick Start
source_kind: local_derived_doc
source_path: /Users/eric/hextech-analytics/docs/PRICE-ALERTS-QUICKSTART.md
source_date: unknown
trust_level: derived_unverified
status: reviewed
tags:
  - hextech-doc
  - derived
  - price-alerts-quickstart
---

## Import Notes
- Imported at: `2026-03-27T18:57:16.421623Z`
- This document is non-canonical and remains outside `canon/`.

## Original Content
# Price Alerts Quick Start

## TL;DR

Price monitoring system is **ready to deploy**. No push needed — commit is local only (2/3 pushes used today).

## What Was Built

✅ **Scripts**
- `scripts/price-alerts.mjs` — compares prices, generates alerts
- `scripts/fetch-prices.mjs` — updated to rotate prices before fetch

✅ **Data Pipeline**
1. `fetch-prices.mjs` copies `prices.json` → `prices-previous.json`
2. Fetches new prices → `prices.json`
3. `price-alerts.mjs` compares current vs previous
4. Generates `price-alerts.json` with movers

✅ **Documentation**
- `docs/PRICE-MONITORING-SYSTEM.md` — full architecture guide
- `docs/PRICE-MOVERS-COMPONENT.md` — React component design spec
- `docs/PRICE-ALERTS-QUICKSTART.md` — this file

✅ **Output Files**
- `public/data/price-alerts.json` — empty state (no baseline yet)
- `public/data/prices-previous.json` — rotated from test run

## Test It Now

```bash
cd /Users/eric/.openclaw/workspace/hextech-analytics

# Step 1: Fetch prices (includes rotation)
node scripts/fetch-prices.mjs

# Step 2: Generate alerts (will compare current vs previous)
node scripts/price-alerts.mjs

# Step 3: View top movers
cat public/data/price-alerts.json | jq '.alerts.topGainers[:5]'
```

## Set Up Cron (Optional)

```bash
# Edit crontab
crontab -e

# Add daily price monitoring at 6 AM
0 6 * * * cd /Users/eric/.openclaw/workspace/hextech-analytics && node scripts/fetch-prices.mjs >> logs/price-fetch.log 2>&1
5 6 * * * cd /Users/eric/.openclaw/workspace/hextech-analytics && node scripts/price-alerts.mjs >> logs/price-alerts.log 2>&1

# Create logs directory
mkdir -p logs
```

## API Endpoints (Auto-Generated)

Once deployed to Vercel, these files will be publicly accessible:

- `/data/price-alerts.json` — market movers summary
- `/data/prices.json` — current price snapshot
- `/data/prices-previous.json` — previous snapshot (optional to expose)

## Next Steps

### Immediate (No Code Needed)
1. **Test the system:** Run scripts manually to verify output
2. **Push to deploy:** When ready, push commit to trigger Vercel build
3. **Verify JSON endpoints:** Check `/data/price-alerts.json` is accessible

### Short-Term (Frontend Work)
4. **Build PriceMovers component:** Follow design spec in `PRICE-MOVERS-COMPONENT.md`
5. **Create market page:** `/market` or `/movers` route
6. **Add to homepage:** Widget showing top 3 gainers/losers

### Long-Term (Enhancements)
7. **Historical tracking:** Store snapshots in database for trend charts
8. **Discord webhooks:** Post extreme movers to Discord channel
9. **Watchlists:** User-specific card tracking
10. **Email digests:** Daily market summary

## Alert Thresholds

- **Notable:** ≥10% change (appears in alerts)
- **Major:** ≥25% change (separate category)
- **Extreme:** ≥50% change (highest priority)

## Data Structure

### price-alerts.json
```json
{
  "generated": "2024-02-10T12:05:00Z",
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
    "topLosers": [...],
    "extremeMovers": [...],  // ≥50%
    "majorMovers": [...]     // ≥25%
  },
  "stats": {
    "totalCardsTracked": 500,
    "notableChanges": 45
  }
}
```

## Troubleshooting

### "No previous price data found"
**Normal on first run.** System needs two snapshots to compare. Run `fetch-prices.mjs` twice.

### Empty alerts
Check thresholds — only cards with ≥10% change appear in alerts.

### Stale data
Check `lastUpdated` timestamp in `prices.json`. Run fetch script to refresh.

## Git Status

✅ **Committed to main** (local only)
- Commit: `3f72591` - "feat: price monitoring system with alert generation"
- Branch: `main`
- Push status: **NOT pushed** (2/3 daily limit)

Push when ready:
```bash
git push origin main
```

## Questions?

See full documentation:
- Architecture: `docs/PRICE-MONITORING-SYSTEM.md`
- Component design: `docs/PRICE-MOVERS-COMPONENT.md`
- Shipping log: `SHIPPING.md`
