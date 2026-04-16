# Riftbound Expert KB Implementation Plan

Goal
Build a new canonical private knowledge base inside `/Users/eric/Documents/Playground/riftbound-kb` so any agent can act like a Riftbound expert with strong factual grounding, current official tournament awareness, and clean retrieval paths.

Why this exists
The existing Playground Riftbound corpus is substantial, but it mixes canonical material, derived guides, bookmark intel, secondary sources, and historical artifacts in ways that can confuse agents. This plan creates a clean trust-first subtree instead of editing the old structure in place.

User intent this plan is optimizing for
- private source of truth first
- neutral/reference-grade KB, not opinionated writing
- factual accuracy first
- current official tournament meta second
- retrieval/structure third
- future content reuse later, but not the current optimization target

Primary retrieval jobs
1. what should I play?
2. how do archetypes match up?
3. what happened in official events?
4. what is true about a card / rule / errata?
5. what does the market look like?

Canonical subtree
- `riftbound-kb/canon/cards/`
- `riftbound-kb/canon/rules/`
- `riftbound-kb/canon/rulings/`
- `riftbound-kb/events/`
- `riftbound-kb/decklists/`
- `riftbound-kb/meta/`
- `riftbound-kb/market/`
- `riftbound-kb/reference/`
- `riftbound-kb/sources/`
- `riftbound-kb/archive/`
- `riftbound-kb/_work/`

Required content classes
1. Rules + errata
   - official rules
   - tournament policy
   - clarifications / rulings

2. Cards
   Each canonical card record should eventually include:
   - name
   - set
   - collector number
   - type
   - domains
   - stats
   - card text
   - rarity
   - image/art path or URL
   - rulings / errata links
   - legality / set status

3. Events
   Cover official major events, especially:
   - regional qualifiers (US/EU)
   - national opens (China)
   - any other official event terminology found on the official news site

4. Decklists
   - event-linked decklists
   - best-of-legend decklists where available
   - if official decklists are missing, trusted secondary decklists may be used but must be labeled

5. Meta
   - current tournament meta snapshots
   - archetype standing tied to real event evidence
   - matchup references supported by sourced evidence where possible

6. Market
   Trusted sources for now:
   - TCGPlayer US
   - Cardmarket EU
   - magicalmeta.ink trends

Source policy
Use best available evidence, but label it clearly.
Follow the raw-to-canonical operating model captured in `reference/kb-operating-model.md`:
- raw sources are collected first
- canonical records are compiled from them
- provenance is mandatory
- health checks are mandatory
- outputs should compound back into the KB

Suggested trust tiers
- `official`
- `trusted_secondary`
- `market`
- `best_available`
- `unverified`

Suggested provenance fields on canonical records
- `source_type`
- `source_name`
- `source_url`
- `source_date`
- `retrieved_at`
- `trust_tier`
- `notes`

Archive policy
- old/stale/conflicting files should be archived out of the main path
- do not delete without approval
- archived files remain useful as history, but not as live truth

## Phase 1 — Inventory and scaffold

Objective
Understand what already exists, what deserves promotion, and what should be archived.

Deliverables
- inventory report under `_work/inventory/`
- migration/promote/archive mapping under `_work/mappings/`
- canonical source/trust policy under `sources/`
- official event vocabulary list under `sources/`

Key tasks
1. inventory current Riftbound-relevant material under Playground
2. bucket files into:
   - promote candidate
   - review needed
   - archive candidate
3. identify official docs already present locally
4. inspect official news/event coverage to define event taxonomy
5. define canonical schemas and source-labeling rules

Stop condition for Phase 1
- we know where canonical truth will live
- we know what existing material is promotable
- we know what should move to archive later
- we have a source policy strong enough for agents

## Phase 2 — Canonical truth layer

Objective
Populate the trust-first core before broader synthesis.

Deliverables
- canonical rules/rulings set
- initial canonical card records
- official event records
- initial decklist records with explicit provenance

Key tasks
1. promote / normalize official rules and errata
2. normalize card records into canonical schema
3. collect official major-event records from official news coverage
4. attach player, legend, placements, and decklists
5. where official decklists are incomplete, add trusted secondary evidence with labels

Stop condition for Phase 2
- an agent can answer card/rule/event questions from canonical files alone

## Phase 3 — Tournament-meta expert layer

Objective
Make the KB useful for competitive decision-making and archetype retrieval.

Deliverables
- current official tournament meta snapshot
- archetype reference pages
- matchup reference pages
- retrieval indexes pointing agents to the right files first

Key tasks
1. build a dated official-event-driven meta snapshot
2. map archetype performance across recent official events
3. assemble matchup references from strongest available evidence
4. add retrieval indexes for the top user questions

Stop condition for Phase 3
- an agent can answer “what should I play?” and “how do archetypes match up?” from the new subtree without rummaging through legacy folders

## Immediate next action

Start with a formal inventory and migration map.

Specific first outputs to create next:
- `_work/inventory/current-corpus-inventory.md`
- `_work/mappings/promote-review-archive.csv`
- `sources/trust-policy.md`
- `sources/official-event-taxonomy.md`

## Not in scope for this pass
- public website polish
- SEO optimization
- broad content production workflows
- deleting old material
- opinionated recommendations as canonical truth

## Success criteria for this pass
- private source of truth is materially more trustworthy
- agents can find the right knowledge faster
- unsupported claims are separated from canonical truth
- official event/meta coverage is more current and useful
