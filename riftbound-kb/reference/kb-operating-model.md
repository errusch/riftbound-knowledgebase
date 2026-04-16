# KB Operating Model

Purpose
Use a strict raw-to-canonical workflow so the Riftbound KB compounds over time instead of becoming another pile of notes.

Core model
1. Raw sources are collected first
   - official news pages
   - rules / errata / tournament docs
   - trusted secondary decklist/result pages
   - market pages
   - imported local documents / screenshots / scraped artifacts

2. Raw sources are not canonical truth
   - raw material can be incomplete, redundant, stale, or conflicting
   - raw material belongs in source registries, ingest workspaces, or archive-like areas

3. Canonical records are compiled from raw sources
   - cards
   - events
   - decklists
   - rulings
   - meta snapshots
   - reference pages

4. Every canonical record carries provenance
   - source_type
   - source_name
   - source_url
   - source_date
   - retrieved_at
   - trust_tier
   - notes

5. Health checks are mandatory
   - broken event -> decklist -> card links
   - missing source labels
   - stale dated snapshots
   - null legality / errata / rulings fields where stronger data should exist
   - contradictory event coverage
   - placeholder records incorrectly treated as complete

6. Outputs should compound back into the KB
   - event summaries
   - meta reports
   - matchup notes
   - archetype references
   - audit reports
   These should become new KB artifacts when they are grounded well enough.

Decision rules
- official beats secondary
- secondary beats inferred
- unsupported claims do not belong in canonical files
- partial extraction is not acceptable when fuller extraction is possible
- if evidence is blocked, label the gap explicitly instead of pretending completeness

Operational separation
- raw / ingest / audit work lives under `_work/` and source registries
- canonical truth lives under `canon/`, `events/`, `decklists/`, `meta/`, `reference/`
- stale or conflicting material moves to `archive/`, not deletion without approval

Practical implication for agents
An agent should not answer from legacy or raw material first.
It should:
1. check canonical records
2. inspect provenance/trust tier
3. only reach into secondary/raw material when the canonical layer is incomplete
4. write corrected or improved outputs back into the KB when sufficiently verified
