# Riftbound Knowledgebase

Official-first local knowledgebase for Riftbound rules, strategy analysis, competitive records, and VOD reviews.

## Policy

- `canon/` is the only place that answers rules questions.
- `analysis/` stores attributed strategy guidance, articles, and VOD reviews.
- `data/` stores normalized records, indexes, taxonomies, and local card snapshots.
- `assets/` stores imported official and supporting visual assets.
- No derived source is promoted into `canon/` without explicit verification against local official documents.

## Source Inputs

- Raw-source vault: `/Users/eric/claude-workspace/riftbound`
- Derived site repo: `/Users/eric/hextech-analytics`
- Duplicate repo intentionally ignored: `/Users/eric/Documents/hextech-analytics-current`

## Commands

```bash
scripts/import/import_official_sources
scripts/import/import_hextech_docs
scripts/import/import_competitive_data
scripts/import/import_vod https://youtu.be/m2IjrsUzXgU
scripts/build/rebuild_indexes
scripts/validate/validate_repo
```

## Layout

- `canon/rules/`
- `canon/errata/`
- `canon/tournament/`
- `analysis/videos/`
- `analysis/articles/`
- `analysis/reference/`
- `analysis/matchups/`
- `analysis/archetypes/`
- `data/events/`
- `data/decks/`
- `data/cards/`
- `data/taxonomy/`
- `data/indexes/`
- `assets/official/`
- `scripts/import/`
- `scripts/build/`
- `scripts/validate/`

## Current Gaps

- Full local card canon is not implemented yet; only prefetched card snapshots are stored locally.
- YouTube intake currently depends on `yt-dlp` plus browser cookies.
- Taxonomy is intentionally seeded, not complete.

