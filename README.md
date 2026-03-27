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
scripts/query/kb ask "What happens when time is called?"
scripts/query/kb card "Ava Achiever"
scripts/query/kb meta --legend Draven
scripts/query/kb prep --legend Draven --opponent "Kai'Sa"
scripts/query/kb publish --target github prep_brief.draven-vs-kaisa
scripts/ops/kb_ops daily
scripts/ops/kb_ops meta-update --date 2026-03-27
scripts/ops/kb_ops vod-review m2IjrsUzXgU
scripts/build/rebuild_indexes
scripts/build/rebuild_graph_indexes
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
- `data/meta/`
- `data/taxonomy/`
- `data/indexes/`
- `data/ops/`
- `assets/official/`
- `scripts/import/`
- `scripts/query/`
- `scripts/ops/`
- `scripts/build/`
- `scripts/validate/`

## Query Model

- `scripts/query/kb` is the main local interface.
- `kb ask` returns grounded local hits split by `canon`, `analysis`, and `data`.
- `kb rule` searches official rules first and keeps derived conflicts separate.
- `kb card` joins the full card corpus with local rulings and mentions.
- `kb prep` writes machine-generated local prep artifacts under `analysis/` and `data/indexes/prep_briefs/`.
- `kb publish` writes downstream outbox payloads for GitHub, Notion, or Linear without changing the repo's source-of-truth policy.

## Agent Ops

- `scripts/ops/kb_ops daily` refreshes generated local artifacts and emits an ops summary.
- `scripts/ops/kb_ops meta-update` writes dated meta snapshots to `data/meta/` and `analysis/meta/`.
- `scripts/ops/kb_ops vod-review` rebuilds local VOD review artifacts from stored captions without needing YouTube access again.

## Current Gaps

- Full local card canon is now imported from the legacy local `knowledge.db`, but it still needs provenance/version refresh if you want a stricter official-source chain.
- The legacy DB includes rich derived datasets, but some fields are curator-generated or scraped summaries rather than direct official exports.
- `rb_competitive_players` has at least some suspect field mapping, so those player records are preserved locally but marked as less trustworthy than cards, sets, rulings, or event bundles.
- YouTube intake currently depends on `yt-dlp` plus browser cookies.
- Taxonomy is intentionally seeded, not complete.
- `kb publish` currently writes connector-ready outbox payloads locally; actual connector-side posting still happens through Codex tools rather than from the script itself.
