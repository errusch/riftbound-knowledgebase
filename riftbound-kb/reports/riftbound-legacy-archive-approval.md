# Riftbound Legacy Archive Approval

_Generated 2026-04-28. No files have been moved yet._

## Goal

Remove old/outdated Riftbound material from the agent's reachable search surface
so Hermes answers from the canonical KB only.

Canonical answer roots should remain:

- `~/Playground/riftbound-kb/canon/`
- `~/Playground/riftbound-kb/events/`
- `~/Playground/riftbound-kb/decklists/`
- `~/Playground/riftbound-kb/meta/`
- `~/Playground/riftbound-kb/sources/`
- `~/Playground/riftbound-kb/reports/`
- `~/Playground/riftbound-kb/reference/`
- Hermes protocol files under `~/.hermes/skills/riftbound-expert/`

## Proposed Archive Destination

If approved, move archive candidates into:

`/Users/eric/Playground/riftbound-legacy-offline-archive-2026-04-28/`

After I move them there, you can move that entire folder to an external drive.

## Archive Candidates

These are historical, duplicate, generated, stale, or skill-adjacent data files
that can contaminate Riftbound answers if an agent searches broadly.

### High Priority

- `/Users/eric/Playground/data/`
  - Legacy cards, rulings, tournaments, decks, prices, indexes, meta-tier data.
  - Important ruling rows have already been promoted into `riftbound-kb/canon/rulings/`.
  - This is the biggest contamination risk because it contains plausible-looking structured facts outside the canonical KB.

- `/Users/eric/Playground/canon/`
  - Duplicate rules/errata/tournament markdown outside the KB.
  - Risk: stale or drifted official-doc copies.

- `/Users/eric/.openclaw/workspace/tmp/riftbound-events/`
  - Old scrape HTML/JSON/cache material.
  - Risk: dated event/deck snapshots overriding canonical `events/` and `decklists/`.

- `/Users/eric/.openclaw/workspace/data/hextech/riftbound-best-of-legend-decks-2026-03-26.json`
- `/Users/eric/.openclaw/workspace/data/hextech/riftbound-best-of-legend-decks-safe-2026-03-26.json`
- `/Users/eric/.openclaw/workspace/deliverables/hextech/riftbound-best-of-legend-decks-2026-03-26.json`
- `/Users/eric/.openclaw/workspace/deliverables/hextech/riftbound-best-of-legend-decks-safe-2026-03-26.json`
  - Dated best-of-legend exports.
  - Risk: pre-current-meta deck advice.

- `/Users/eric/.hermes/skills/riftbound-expert/SKILL.backup-2026-04-27.md`
  - Old skill backup next to the active skill.
  - Risk: if indexed, it can conflict with the current KB-first protocol.

- `/Users/eric/.hermes/skills/riftbound-expert/riftdecks-tournament-scrape/scripts/lille_decklists.json`
- `/Users/eric/.hermes/skills/riftbound-expert/riftdecks-tournament-scrape/scripts/lille-rq-decklist-urls.txt`
  - Skill-adjacent scrape artifacts.
  - Risk: models treat skill folder data as current truth.

### Medium Priority

- `/Users/eric/Playground/analysis/guides/`
- `/Users/eric/Playground/analysis/creators/`
  - Historical guides, extracted claims, creator/source notes.
  - Risk: old meta and editorial claims.

- `/Users/eric/Playground/knowledge-vault/10-riftbound/`
  - Human note layer with summaries and audits.
  - Risk: stale dashboard/path references. If you still use the vault manually, keep it; otherwise archive.

- `/Users/eric/Playground/riftbound-kb/_work/`
  - Scratch inventories, mappings, JSONL crawl outputs, one-off ingest artifacts.
  - Risk: raw artifacts can look like source of truth. Caveat: keep if you expect to debug import history soon.

- `/Users/eric/Playground/_archived_projects/hermes-agent-self-evolution/datasets/skills/playground-riftbound-kb/`
- `/Users/eric/Playground/_archived_projects/hermes-agent-self-evolution/datasets/skills/riftbound-card-image-lookup/`
- `/Users/eric/Playground/_archived_projects/hermes-agent-self-evolution/output/playground-riftbound-kb/`
- `/Users/eric/Playground/_archived_projects/hermes-agent-self-evolution/output/riftbound-card-image-lookup/`
  - Failed/old skill evolution artifacts.

- `/Users/eric/Playground/.brv/context-tree/riftbound/`
  - Browser research context tree.

### App/Repo Duplicates

- `/Users/eric/hextech-analytics-github-main/`
  - Duplicate checkout of Hextech Analytics.
  - Keep only if you need it for comparing against GitHub main.

- `/Users/eric/Playground/hextech-analytics/`
  - Older/incomplete sandbox copy.
  - Risk: legacy `riftcodex` API client and stale app content.

- In active app repos, do not use generated snapshots as primary fact sources:
  - `/Users/eric/hextech-analytics-current/lib/platform/kb-snapshot.json`
  - `/Users/eric/hextech-analytics-current/public/data/prices.json`
  - `/Users/eric/hextech-analytics-current/public/data/prices-previous.json`

I recommend keeping `hextech-analytics-current` itself because it is the active app and contains sync/verification scripts.

### Imported Official Doc Duplicates

- `/Users/eric/Playground/assets/imported/hextech-docs/`
- `/Users/eric/Playground/assets/official/rule-documents/`
- `/Users/eric/Playground/hextech-analytics/docs/riftbound-card-errata-official.pdf`
- `/Users/eric/Playground/hextech-analytics/docs/riftbound-core-rules-official.pdf`
- `/Users/eric/Playground/hextech-analytics/docs/riftbound-tournament-rules-official.docx`

These should not be automatic answer sources. Keep one copy only if you want raw official docs available for re-extraction.

## Keep In Place

- `/Users/eric/Playground/riftbound-kb/README.md`
- `/Users/eric/Playground/riftbound-kb/AGENTS.md`
- `/Users/eric/Playground/riftbound-kb/PLAN.md`
- `/Users/eric/Playground/riftbound-kb/STATUS.md`
- `/Users/eric/Playground/riftbound-kb/scripts/`
- `/Users/eric/Playground/riftbound-kb/media/youtube/riftbound-channel/`
- `/Users/eric/.hermes/skills/riftbound-expert/SKILL.md`
- `/Users/eric/.hermes/skills/riftbound-expert/SOURCE_MAP.md`
- `/Users/eric/.hermes/skills/riftbound-expert/ANSWER_PROTOCOLS.md`
- `/Users/eric/.hermes/skills/riftbound-expert/KNOWN_GAPS.md`
- `/Users/eric/.hermes/skills/riftbound-ingest/SKILL.md`
- `/Users/eric/.hermes/skills/riftbound-source-policy/SKILL.md`
- `/Users/eric/.hermes/skills/software-development/playground-riftbound-kb/SKILL.md`
- `/Users/eric/.cursor/skills/riftbound-riftdecks-primary-crawl/SKILL.md`
- `/Users/eric/.cursor/skills/riftbound-youtube-caster-kb/SKILL.md`
- `/Users/eric/hextech-analytics-current/`

## Promote Or Repair Instead Of Archiving

- `/Users/eric/.hermes/scripts/hindsight_bulk_import.py`
  - It references `/Users/eric/Documents/Playground/riftbound-kb`.
  - Fix or disable before using Hindsight for Riftbound; otherwise it may bulk-import stale paths.

- `/Users/eric/Playground/knowledge-vault/10-riftbound/`
  - If you still want this human note layer, update stale `Documents/Playground` references to `~/Playground` and make it clear it is not canonical.

- `~/Playground/riftbound-kb/media/youtube/riftbound-channel/`
  - Keep for now because the caster KB workflow depends on it. It is secondary qualitative evidence, not rules authority.

## Proposed Move Strategy

If approved, I will:

1. Create `/Users/eric/Playground/riftbound-legacy-offline-archive-2026-04-28/`.
2. Move only approved archive candidates into mirrored subfolders, preserving paths.
3. Write a manifest:
   - `MANIFEST.md`
   - `moved-files.txt`
   - `not-moved.md`
4. Update Hermes `SOURCE_MAP.md` / `KNOWN_GAPS.md` to explicitly forbid archived paths.
5. Run sanity checks:
   - `node scripts/regen-current-meta.mjs`
   - `node scripts/regen-postban-archetypes.mjs`
   - `node scripts/lint-kb.mjs`

## Five New Hermes Test Questions

Use these after archiving to check whether Hermes is still pulling from stale material.

1. **Domain trap:** What are all Riftbound domains, and is Grace one of them?
   - Expected: Body, Calm, Chaos, Colorless, Fury, Mind, Order. Grace is not a domain.

2. **Source priority trap:** If `~/Playground/data/rulings/` disagrees with `~/Playground/riftbound-kb/canon/rulings/`, which one do you trust?
   - Expected: canonical KB wins; legacy data needs promotion/review.

3. **Lille path trap:** What won Lille, and which event record should you open first?
   - Expected: open `events/rq-lille-2026.json` first; Pedro/Squirtle on Azir won; compare canonical copy only as secondary.

4. **Archetype confidence trap:** Is Annie Control a high-confidence post-ban archetype?
   - Expected: no. `meta/archetypes-postban.md` has Annie Control with 3 decks, all pending review.

5. **Old snapshot trap:** Should you use `riftbound-best-of-legend-decks-2026-03-26.json` to answer current meta questions?
   - Expected: no. It is dated historical material; use `meta/current.md`, `meta/archetypes-postban.*`, and underlying canonical events/decklists.
