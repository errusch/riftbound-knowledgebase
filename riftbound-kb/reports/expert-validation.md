# Riftbound Expert Validation

_Generated 2026-04-27 for Hermes `riftbound-expert` v2._

## Command Checks

Passed:

```bash
node /Users/eric/Playground/riftbound-kb/scripts/promote-rulings.mjs --dry-run
node /Users/eric/Playground/riftbound-kb/scripts/regen-postban-archetypes.mjs
node /Users/eric/Playground/riftbound-kb/scripts/regen-current-meta.mjs
node /Users/eric/Playground/riftbound-kb/scripts/lint-kb.mjs
node -e "<rulings/archetype sanity check>"
```

Results:

- `meta/current.md` regenerated.
- `lint-kb.mjs` reported 0 missing event refs, 0 missing players, 0 null
  legends, 0 unresolved card refs, and 3 events with no decklists.
- `canon/legality/bans-and-suspensions.json` parsed successfully.
- Ban registry contains 7 entries.
- Every `card_id` in the ban registry resolves in `canon/cards/index.json`.
- Rulings promotion dry-run found 34 promotable official-source records, 0
  blockers, 3 unresolved card links, and 7 ambiguous card links.
- `canon/rulings/index.json` contains 34 promoted ruling records.
- `meta/archetypes-postban.json` analyzes 44 recent post-ban Standard
  Constructed decklists and has `decklist_mutation: false`.

## Question Spot Checks

### Card oracle: Disintegrate

Question: "What does Disintegrate currently say?"

Expected lookup:

- Search `canon/cards/index.json`.
- Open `canon/cards/ogn-005-298.json`.
- Check `canon/rulings/index.json` and `canon/rulings/records/` for
  card-specific errata/rulings.

Observed:

- Card resolved to `ogn-005-298`.
- Current text in canonical card record: `[Action] (Play on your turn or in showdowns.) Deal 3 to a unit at a battlefield. If this kills it, do this: draw 1.`
- Canonical ruling record exists:
  `canon/rulings/records/ruling.disintegrate-errata-2025-11-04.json`.
- That ruling links to `ogn-005-298` and cites the official Origins card errata
  URL with verification status `legacy_reviewed_official_url_pending_live_quote`.

Verdict: PASS with caveat. Hermes can answer current card text and errata from
canonical KB records, while labeling the ruling as not yet live-quote verified
for publication-grade exact citation.

### Rules: movement/showdown lookup

Question class: movement, showdown, or Beginning Phase timing.

Expected lookup:

- Search `canon/rules/core-rules-v1-2.md`.
- Search `canon/rules/tournament-rules-2025-10-16.md` for tournament shortcuts
  or penalties.
- Check `canon/rulings/` for card-specific exceptions.

Observed:

- Rule text exists for Standard Move, Movement, Showdown openings, and
  Beginning Phase references.

Verdict: PASS. Hermes should cite the specific rule file and avoid importing
assumptions from other games.

### Legality: current Standard Constructed bans

Question: "What is banned in Standard Constructed?"

Expected lookup:

- Open `canon/legality/bans-and-suspensions.json`.
- Cite official source URL.

Observed:

- Registry has 7 official entries effective `2026-03-31`.
- Entries: Called Shot; Draven, Vanquisher; Fight or Flight; Scrapheap; The
  Dreaming Tree; Obelisk of Power; Reaver's Row.
- Source URL is the official Riftbound news announcement.

Verdict: PASS.

### Meta: what should I play?

Question class: current meta or deck recommendation.

Expected lookup:

- Open `meta/current.md`.
- Open `meta/current-tournament-snapshot.json` if structured counts are needed.
- Open event/decklist JSON for high-stakes recommendations.

Observed:

- `meta/current.md` regenerated on 2026-04-27 from 60 canonical events and 996
  decklists.
- Digest includes dominant legends and recent winners.
- Digest itself warns to cite underlying rows or JSON and to say "no KB
  coverage yet" when silent.
- `meta/archetypes-postban.md` and `meta/archetypes-postban.json` add a separate
  recent post-ban archetype layer over 44 Standard Constructed decklists.
- `reports/archetype-review-queue.md` captures 32 pending-review labels that
  should not be cited as canonical archetype facts.

Verdict: PASS.

### Post-ban archetype layer

Question class: "What are people building post-ban?" or archetype/package
questions.

Expected lookup:

- Open `meta/archetypes-postban.md` for the digest.
- Open `meta/archetypes-postban.json` for deck labels, confidence, top cards,
  and examples.
- Open `reports/archetype-review-queue.md` before citing any pending-review
  labels.
- Open underlying `decklists/` and `events/` for recommendations.

Observed:

- Snapshot uses cutoff `2026-03-31` from `canon/legality/bans-and-suspensions.json`.
- Snapshot includes 44 post-ban Standard Constructed decklists and excludes
  pre-rift seeded kit decks.
- Snapshot reports 11 high-confidence labels, 1 provisional label, and 32
  pending-review labels.
- No decklist JSON was mutated by the archetype process.

Verdict: PASS with caveat. This is useful current meta evidence, but pending
review labels must not be treated as canonical archetype facts.

### Historical event: Lille

Question: "What won Lille?"

Expected lookup:

- Open `events/rq-lille-2026.json`.
- Cross-check decklists from referenced `best_decklists` or placement records.

Observed:

- Event record identifies Regional Qualifier: Lille as an EU event in Lille,
  France, with Pedro (Squirtle) on Azir, Emperor of the Sands as Winner.
- Source is labeled official, with source URL to the official Day 2 Top 8 VOD.

Verdict: PASS with caveat. Full card lists are available for best-of records,
but the event notes still distinguish VOD reconstruction from full official
article deck coverage.

### LoR contamination

Question class: any prompt that assumes Legends of Runeterra mechanics or
history.

Expected behavior:

- Correct the premise.
- Answer only from Riftbound KB evidence.

Observed:

- `SKILL.md` and `ANSWER_PROTOCOLS.md` both explicitly prohibit importing LoR
  mechanics, regions, card text, timing assumptions, or history.

Verdict: PASS.

## Remaining Validation Risk

Errata/ruling records are now promoted, but all promoted rows still need exact
live-page quote verification. The post-ban archetype layer is intentionally
conservative: most labels are pending review until signature package rules are
refined.
