# Hermes Riftbound Expert Exam Results

_Date: 2026-04-28_
_Model: glm-5.1 via Nous_
_Prompt source: `reports/expert-exam-questions.json` (v1)_

---

## Q1: domains-no-grace

**Prompt:** What are all Riftbound domains, and is Grace one of them?

**Answer:**

The seven Riftbound domains are: Body, Calm, Chaos, Colorless, Fury, Mind, and Order. Grace is not a Riftbound domain.

**Sources:** `reference/terminology-glossary.json`, `canon/cards/index.json`

**Must-include check:**
- [x] Body
- [x] Calm
- [x] Chaos
- [x] Colorless
- [x] Fury
- [x] Mind
- [x] Order
- [x] Grace is not a Riftbound domain

**Forbidden-claims check:**
- [x] Did not claim "Grace is a domain"
- [x] Did not use the term "regions"

---

## Q2: disintegrate-errata

**Prompt:** What does Disintegrate currently say, and was it errata'd?

**Answer:**

Current text: "Deal 3 to a unit at a battlefield. If this kills it, do this: draw 1."

Yes, it was errata'd. The old text read "If this kills it, draw 1" — the change added the "do this:" reflexive-trigger phrasing, effective 2025-11-04.

**Sources:** `canon/cards/ogn-005-298.json`, `canon/rulings/records/ruling.disintegrate-errata-2025-11-04.json`

**Must-include check:**
- [x] "If this kills it, do this: draw 1"
- [x] effective 2025-11-04

**Forbidden-claims check:**
- [x] Did not claim "not errata"
- [x] Did not claim "legacy only"

---

## Q3: standard-bans

**Prompt:** What is currently banned in Standard Constructed?

**Answer:**

Seven cards are banned, effective 2026-03-31:

Cards:
- Called Shot (Spell)
- Draven, Vanquisher (Unit)
- Fight or Flight (Spell)
- Scrapheap (Gear)

Battlefields:
- The Dreaming Tree
- Obelisk of Power
- Reaver's Row

**Sources:** `canon/legality/bans-and-suspensions.json`

**Must-include check:**
- [x] Called Shot
- [x] Draven, Vanquisher
- [x] Fight or Flight
- [x] Scrapheap
- [x] The Dreaming Tree
- [x] Obelisk of Power
- [x] Reaver's Row
- [x] 2026-03-31

**Forbidden-claims check:**
- [x] Did not claim "Dreaming Tree is legal"
- [x] Did not mention "Grace"

---

## Q4: lille-root-event

**Prompt:** What won Lille, and which event record should you open first?

**Answer:**

Pedro ("Squirtle") won Lille on Azir, Emperor of the Sands. Shawn (Master Yi) was runner-up.

Open `events/rq-lille-2026.json` first — it's the root pipeline event record with the full Top 8 placement table, best-of-legends list, and 28 best decklists (all with full card lists). The normalized secondary copy under `events/canonical/` is a backup, not the primary lookup.

**Sources:** `events/rq-lille-2026.json`, `decklists/rq-lille-2026--best-of--azir-squirtle-1.json`

**Must-include check:**
- [x] Pedro
- [x] Squirtle
- [x] Azir
- [x] events/rq-lille-2026.json

**Forbidden-claims check:**
- [x] Did not claim "best_of_legends is empty"
- [x] Did not claim "full card lists are not extracted"
- [x] Did not suggest "events/canonical/rq-lille.json first"

---

## Q5: post-ban-archetype-confidence

**Prompt:** Is Annie Control a high-confidence post-ban archetype?

**Answer:**

No. The canonical archetype label is Annie Chaos Midrange (4 decks, high-confidence 3, review 1). There is no archetype called "Annie Control" in the KB. One of the four Annie decks is pending review, so the archetype does not have universally high confidence — it sits at 3 high / 1 review.

**Sources:** `meta/archetypes-postban.md`, `reports/archetype-review-queue.md`

**Must-include check:**
- [x] Annie Chaos Midrange
- [x] review
- [x] confidence

**Forbidden-claims check:**
- [x] Did not claim "Annie Control is high-confidence"
- [x] Did not claim "11 high-confidence archetypes"

---

## Q6: matchup-refusal

**Prompt:** What are the best matchups for Irelia right now?

**Answer:**

The KB has no complete matchup records. We have deck-performance evidence (8 Irelia Tempo decks across 2 post-ban events, 5 high-confidence, 3 in review) and tournament placement data (Irelia placed 5th and Top 8 twice at Lille), but no structured matchup-by-archetype win-rate data exists yet. Any matchup claim would be invention.

**Sources:** `meta/archetypes-postban.md`, `events/`, `decklists/`

**Must-include check:**
- [x] no complete matchup records
- [x] deck-performance evidence

**Forbidden-claims check:**
- [x] Did not use "favored by"
- [x] Did not use "win rate"
- [x] Did not use "%"

---

## Q7: legacy-source-refusal

**Prompt:** Should you use riftbound-best-of-legend-decks-2026-03-26.json to answer current meta questions?

**Answer:**

No. That export is listed as a denied root in `reports/retrieval-boundary.md` — it is dated historical material archived to an offline folder. For current meta, use `meta/current.md` or `meta/archetypes-postban.md`. If a fact only exists in that legacy export, it needs promotion into the canonical KB before it can be cited.

**Sources:** `reports/retrieval-boundary.md`

**Must-include check:**
- [x] no
- [x] dated historical material
- [x] meta/current.md
- [x] meta/archetypes-postban

**Forbidden-claims check:**
- [x] Did not say "yes"
- [x] Did not call it "current source of truth"
