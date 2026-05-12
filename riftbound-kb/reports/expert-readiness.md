# Riftbound Expert Readiness

_Generated 2026-04-27 for Hermes `riftbound-expert` v2._

## Summary

Status: usable with source-grounded answers, with strict refusal required for
uncovered rules, stale official announcements, and current market data.

The KB is strong for card lookup, rules retrieval, event/decklist retrieval,
current meta snapshots, and the first official Standard Constructed ban list.
It is weaker for market data, matchup-specific evidence, and any newly published
official article not yet promoted into the KB.

## Current Local Coverage

- Card index entries: 954 (`canon/cards/index.json`)
- Canonical card JSON files: 954 plus index (`canon/cards/`)
- Rules documents: 2 (`canon/rules/`)
- Canonical rulings/errata documents: 1 (`canon/rulings/`)
- Legality registries: 1 (`canon/legality/bans-and-suspensions.json`)
- Latest lint report: `reports/kb-lint.md`, generated `2026-04-27T15:40:32.248Z`
- Lint baseline: 60 events, 996 decklists, 954 card index entries
- Lint clean areas: 0 bad event refs, 0 missing players, 0 null legends, 0 unresolved card refs
- Known lint warning: 3 events have no decklists attached
- Current meta digest: `meta/current.md`, generated `2026-04-27`

## Strict Fact Readiness

| Area | Status | Evidence |
|---|---|---|
| Card text/stats | Ready | `canon/cards/index.json` plus per-card JSON |
| Rules | Ready with normal caveats | `canon/rules/core-rules-v1-2.md`, `canon/rules/tournament-rules-2025-10-16.md` |
| Errata/rulings | Partial | `canon/rulings/card-errata-set-1-origins.md`; some richer legacy JSON may still need promotion |
| Bans/legality | Ready for first official Standard Constructed bans | `canon/legality/bans-and-suspensions.json` |
| Exact event/decklist facts | Ready when source records exist | `events/`, `decklists/`, `reports/kb-lint.md` |
| Market | Not ready locally | `market/` is not a reliable current snapshot |

## Official Ban Registry

The current canonical legality source is
`canon/legality/bans-and-suspensions.json`, sourced from the official Riftbound
announcement:

`https://riftbound.leagueoflegends.com/en-us/news/announcements/announcing-riftbounds-first-bans/`

It records seven Standard Constructed bans effective `2026-03-31`:

- Called Shot
- Draven, Vanquisher
- Fight or Flight
- Scrapheap
- The Dreaming Tree
- Obelisk of Power
- Reaver's Row

The card record for `ogn-292-298` was aligned to this registry because the
official article bans Dreaming Tree and the canonical card name is The Dreaming
Tree.

## Meta And Decklist Readiness

`meta/current.md` is a generated digest from 60 canonical events and 996
decklists. Use it as an entry point, then open underlying event/decklist JSON for
high-stakes claims.

RiftDecks primary crawl coverage is summarized in
`reports/riftdecks-primary-crawl-report.md`:

- 676 ok exports imported/available
- 724 blocked legend filters

Blocked means RiftDecks exposed no deck link for that event+legend filter at
crawl time. It is not a parser failure.

## Answer Caveats

Hermes should refuse or qualify answers when:

- a rules interaction is not covered by `canon/rules/` or `canon/rulings/`
- a ban/legality question asks beyond the registered Standard Constructed bans
- an event/decklist claim has no source record
- a matchup claim lacks actual matchup evidence and only has deck-performance data
- a market question needs current prices or availability
- the premise appears imported from Legends of Runeterra or another game

## Maintenance Checks

After KB edits:

```bash
node scripts/regen-current-meta.mjs
node scripts/lint-kb.mjs
```

After site sync:

```bash
cd ~/hextech-analytics-current
npm run sync-kb
npm run verify-cards
```

Before claiming global completeness, check the live official Riftbound news and
rules hub for newly published rules, errata, bans, or official event coverage.
