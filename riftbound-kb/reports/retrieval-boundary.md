# Riftbound Retrieval Boundary

_Generated 2026-04-28 after moving legacy material to offline archive._

## Archive Folder

Legacy material was moved to:

`/Users/eric/Playground/riftbound-legacy-offline-archive-2026-04-28/`

You can move that folder to an external drive.

## Canonical Answer Allowlist

Hermes may answer Riftbound facts only from:

- `~/Playground/riftbound-kb/canon/`
- `~/Playground/riftbound-kb/events/`
- `~/Playground/riftbound-kb/decklists/`
- `~/Playground/riftbound-kb/meta/`
- `~/Playground/riftbound-kb/sources/`
- `~/Playground/riftbound-kb/reports/`
- `~/Playground/riftbound-kb/reference/`
- active Hermes protocol files under `~/.hermes/skills/riftbound-expert/`

## Denied Roots

Do not use these for current Riftbound answers:

- `~/Playground/data`
- `~/Playground/canon`
- `~/.openclaw/workspace/tmp/riftbound-events`
- dated `riftbound-best-of-legend-decks-2026-03-26` exports
- `~/.hermes/skills/riftbound-expert/SKILL.backup-2026-04-27.md`
- skill-adjacent scrape artifacts under `riftdecks-tournament-scrape/scripts/`
- old duplicate app clones such as `~/hextech-analytics-github-main` and
  `~/Playground/hextech-analytics`

If a fact only exists in a denied root, say it needs promotion into the canonical
KB before it can be used.

## Required Output Lint

Run this against saved Hermes test answers:

```bash
cd ~/Playground/riftbound-kb
node scripts/lint-expert-output.mjs reports/hermes-riftbound-expert-test-results.md
```

The lint checks for fake domains like `Grace`, legacy-path citations,
Power/Might misuse, and archetype-confidence misreads.
