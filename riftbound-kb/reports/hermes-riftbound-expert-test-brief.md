# Hermes Riftbound Expert Test Brief

Use this to test the Hermes `riftbound-expert` skill after the recent KB and
skill updates.

## Load first

Tell Hermes:

> Load the `riftbound-expert` skill. Read the canonical KB contract and current
> expert reports before answering:
>
> - `~/Playground/riftbound-kb/AGENTS.md`
> - `~/Playground/riftbound-kb/reference/retrieval-map.md`
> - `~/Playground/riftbound-kb/reports/expert-readiness.md`
> - `~/Playground/riftbound-kb/reports/expert-validation.md`
> - `~/.hermes/skills/riftbound-expert/SOURCE_MAP.md`
> - `~/.hermes/skills/riftbound-expert/ANSWER_PROTOCOLS.md`
> - `~/.hermes/skills/riftbound-expert/KNOWN_GAPS.md`

## What changed

- Card/rule answers must come from the KB, not model memory.
- Structured rulings now exist under:
  - `~/Playground/riftbound-kb/canon/rulings/index.json`
  - `~/Playground/riftbound-kb/canon/rulings/records/`
- Current bans are under:
  - `~/Playground/riftbound-kb/canon/legality/bans-and-suspensions.json`
- Post-ban archetype/meta evidence is under:
  - `~/Playground/riftbound-kb/meta/archetypes-postban.md`
  - `~/Playground/riftbound-kb/meta/archetypes-postban.json`
  - `~/Playground/riftbound-kb/reports/archetype-review-queue.md`

## Expected behavior

Hermes should:

- cite local KB paths or official Riftbound/Riot URLs
- say when a ruling is promoted but still `pending_live_quote`
- treat high-confidence archetype labels as usable evidence
- treat provisional archetype labels as directional
- avoid citing pending-review archetype labels as fact
- correct any Legends of Runeterra assumptions instead of accepting them
- say "the KB does not cover that yet" when evidence is missing

## Test prompts

Ask Hermes these, one at a time.

1. What does Disintegrate currently say, and was it errata'd?

Expected: should read `canon/cards/ogn-005-298.json` and
`canon/rulings/records/ruling.disintegrate-errata-2025-11-04.json`. It should
mention that the ruling is official-source backed but still pending live quote
verification.

2. What is currently banned in Standard Constructed?

Expected: should read `canon/legality/bans-and-suspensions.json` and list:
Called Shot, Draven, Vanquisher, Fight or Flight, Scrapheap, The Dreaming Tree,
Obelisk of Power, and Reaver's Row, effective 2026-03-31.

3. What won Lille, and what evidence do we have?

Expected: should read `events/rq-lille-2026.json`, cite Pedro/Squirtle on Azir,
and mention whether it is using official article/VOD/decklist evidence.

4. What are people building post-ban?

Expected: should start from `meta/archetypes-postban.md/json`, mention the small
post-ban sample, cite high-confidence/provisional status, and avoid treating
pending-review labels as final.

5. Is this like Legends of Runeterra regions?

Expected: should correct the premise. It should say Riftbound is not Legends of
Runeterra and answer only from Riftbound KB terminology.

6. What are the best matchups for Irelia right now?

Expected: should not invent matchup win rates. It should say the KB has
deck-performance and archetype/package evidence, not complete matchup records,
unless it finds specific matchup evidence.

## Atlanta RQ follow-up

Atlanta RQ just finished yesterday. When decks appear on RiftDecks, run the
RiftDecks update flow and then regenerate the expert layer:

1. Use the RiftDecks primary crawl/update workflow.
2. Skip entries already stored in `decklists/`.
3. Import only new successful exports.
4. Run:

```bash
cd ~/Playground/riftbound-kb
node scripts/regen-event-best-decklists.mjs
node scripts/regen-current-meta.mjs
node scripts/regen-postban-archetypes.mjs
node scripts/lint-kb.mjs
```

5. Re-check:
   - `reports/riftdecks-primary-crawl-report.md`
   - `meta/current.md`
   - `meta/archetypes-postban.md`
   - `reports/archetype-review-queue.md`
   - `reports/kb-lint.md`

If Atlanta has official coverage on the Riftbound news site, prefer official
event/decklist data first and use RiftDecks as trusted secondary backfill where
official coverage is incomplete.
