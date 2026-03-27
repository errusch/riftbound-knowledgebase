---
id: analysis.reference.batch-fetch-usage
type: analysis_note
title: Split-Batch Price Fetch - Usage Guide
source_kind: local_derived_doc
source_path: /Users/eric/hextech-analytics/docs/BATCH-FETCH-USAGE.md
source_date: unknown
trust_level: derived_unverified
status: reviewed
tags:
  - hextech-doc
  - derived
  - batch-fetch-usage
---

## Import Notes
- Imported at: `2026-03-27T18:57:16.410488Z`
- This document is non-canonical and remains outside `canon/`.

## Original Content
# Split-Batch Price Fetch - Usage Guide

## Overview

The price fetch system now supports split-batch mode to avoid TCGPlayer API rate limits. Instead of fetching all 655 cards at once (which hits rate limits), you can split the work into 2 batches with a 30-minute gap.

## Basic Usage

### Full Run (Backward Compatible)
```bash
node scripts/fetch-prices.mjs
```
Fetches all cards in one run. May hit rate limits (~50% success rate).

### Split-Batch Mode
```bash
# Batch 1: First 330 cards
node scripts/fetch-prices.mjs --batch 1 --batch-size 330

# Wait 30 minutes (rate limit cooldown)

# Batch 2: Remaining 325 cards  
node scripts/fetch-prices.mjs --batch 2 --batch-size 330

# Merge results into final prices.json
node scripts/merge-price-batches.mjs
```

## CLI Arguments

### `--batch <1|2>`
Which batch to fetch:
- `--batch 1`: Cards 1-330 (indices 0-329)
- `--batch 2`: Cards 331-655 (indices 330-654)

### `--batch-size <N>`
Number of cards per batch (default: 330)
- Used to calculate the card range for each batch
- Example: `--batch-size 200` would split into 4 batches

## Output Files

### Batch Mode
- **Batch 1**: `public/data/prices-batch1.json`
- **Batch 2**: `public/data/prices-batch2.json`
- **Merged**: `public/data/prices.json` (created by merge script)

### Full Run Mode
- `public/data/prices.json` (direct output)

## Price Rotation

The system automatically rotates `prices.json` → `prices-previous.json` for price comparison:

- **Batch 1**: ✅ Rotates (creates backup)
- **Batch 2**: ❌ Skips rotation (batch 1 already did it)
- **Full run**: ✅ Rotates

## Merge Script

`merge-price-batches.mjs` combines batch results:

1. Reads `prices-batch1.json` and `prices-batch2.json`
2. Merges card data (batch 2 overwrites batch 1 if overlap)
3. Uses the latest timestamp
4. Recalculates statistics for the merged dataset
5. Writes to `prices.json`
6. Deletes batch files (cleanup)

**Requirements:**
- Both batch files must exist
- Will exit with error if either is missing

## Cron Schedule (Recommended)

```bash
# Batch 1 at 6:00 AM CT
0 6 * * * cd /path/to/hextech-analytics && node scripts/fetch-prices.mjs --batch 1

# Batch 2 at 6:30 AM CT (30 min later)
30 6 * * * cd /path/to/hextech-analytics && node scripts/fetch-prices.mjs --batch 2

# Merge at 7:00 AM CT
0 7 * * * cd /path/to/hextech-analytics && node scripts/merge-price-batches.mjs

# Generate alerts at 7:05 AM CT
5 7 * * * cd /path/to/hextech-analytics && node scripts/price-alerts.mjs

# Post Discord summary at 7:10 AM CT
10 7 * * * /path/to/post-price-summary.sh
```

## Test Mode

Use `TEST_MODE=true` to limit to first 20 cards:

```bash
# Test batch 1 (first 10 cards in TEST_MODE)
TEST_MODE=true node scripts/fetch-prices.mjs --batch 1 --batch-size 10

# Test batch 2 (next 10 cards in TEST_MODE)
TEST_MODE=true node scripts/fetch-prices.mjs --batch 2 --batch-size 10

# Merge test results
node scripts/merge-price-batches.mjs
```

## Failure Logging

Batch mode creates separate failure logs:
- `price-fetch-failures-batch1.json` (batch 1 failures)
- `price-fetch-failures-batch2.json` (batch 2 failures)
- `price-fetch-failures.json` (full run failures)

Each log includes:
- Timestamp
- Batch number (if applicable)
- Total failed count
- Array of failed cards with error messages

## Example: Complete Test Run

```bash
# Clean up old test data
rm -f public/data/prices-batch*.json

# Run batch 1
TEST_MODE=true node scripts/fetch-prices.mjs --batch 1 --batch-size 10
# Output: prices-batch1.json (10 cards)

# Run batch 2
TEST_MODE=true node scripts/fetch-prices.mjs --batch 2 --batch-size 10  
# Output: prices-batch2.json (10 cards)

# Merge
node scripts/merge-price-batches.mjs
# Output: prices.json (20 cards)
# Cleanup: Deletes batch1 and batch2 files

# Generate alerts
node scripts/price-alerts.mjs
# Output: price-alerts.json
```

## Benefits

### Rate Limit Avoidance
- 30-minute gap between batches allows rate limit to reset
- Each batch processes ~330 cards (within tested success rate)
- Higher overall success rate (~90-95% vs ~50%)

### Reliability
- Smaller batches = more retries per card
- Failures isolated to specific batch
- Easy to re-run just the failed batch

### Monitoring
- Separate logs for each batch
- Clear success metrics per batch
- Easy to identify which batch is problematic

## Backward Compatibility

Running without `--batch` argument works exactly as before:
```bash
node scripts/fetch-prices.mjs
```

This maintains compatibility with existing scripts and workflows.

## Troubleshooting

### "Batch files not found" error during merge
- Ensure both batch 1 and batch 2 have completed successfully
- Check `public/data/` directory for `prices-batch1.json` and `prices-batch2.json`
- Re-run the failed batch

### Overlapping cards in merge
- Shouldn't happen with proper batch ranges
- If it does, batch 2 data overwrites batch 1 data
- Check batch logs for the overlap count

### Low success rate even with batching
- Increase the delay between batches (60 min instead of 30 min)
- Reduce batch size further (--batch-size 200 = 4 batches)
- Check TCGPlayer API status

---

**Implementation Details:**
- Date: 2026-02-10
- Commit: fe64130
- Spec: /Users/eric/.openclaw/workspace/memory/price-fetch-cron-spec.md
