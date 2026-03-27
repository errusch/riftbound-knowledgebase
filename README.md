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
scripts/import/import_local_cards
scripts/import/import_legacy_knowledge
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
- `analysis/guides/`
- `analysis/creators/`
- `analysis/community/`
- `analysis/intel/`
- `analysis/reference/`
- `analysis/matchups/`
- `analysis/archetypes/`
- `data/events/`
- `data/decks/`
- `data/cards/`
- `data/sets/`
- `data/rulings/`
- `data/tournaments/`
- `data/prices/`
- `data/keywords/`
- `data/meta-tiers/`
- `data/schedule/`
- `data/players/`
- `data/taxonomy/`
- `data/indexes/`
- `assets/official/`
- `scripts/import/`
- `scripts/build/`
- `scripts/validate/`

## Current Gaps

- Full local card canon is now imported from the legacy local `knowledge.db`, but it still needs provenance/version refresh if you want a stricter official-source chain.
- The legacy DB includes rich derived datasets, but some fields are curator-generated or scraped summaries rather than direct official exports.
- `rb_competitive_players` has at least some suspect field mapping, so those player records are preserved locally but marked as less trustworthy than cards, sets, rulings, or event bundles.
- YouTube intake currently depends on `yt-dlp` plus browser cookies.
- Taxonomy is intentionally seeded, not complete.
