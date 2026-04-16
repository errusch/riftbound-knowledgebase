# Card Promotion Notes

Current source of truth candidates
- `data/cards/full/*.json`
- supporting set/taxonomy data under `data/sets/` and `data/taxonomy/`
- supporting local canon / errata under `canon/`

Observed characteristics from sampled card record
- card records already contain many of the fields needed for the canonical schema:
  - name
  - set code / public code
  - collector number
  - type / rarity / domain
  - stats / cost-like attributes
  - card text
  - image URL / artist
- current source metadata reflects legacy migration provenance (`legacy_local_knowledge_db`)
- trust labels like `derived_verified` are useful, but should be translated into the new source/trust model

Recommended promotion strategy
1. Do not rewrite all 975 card files manually.
2. Build a normalization transform from `data/cards/full/*.json` into `riftbound-kb/canon/cards/*.json`.
3. Preserve upstream provenance fields so canonical records can still trace back to local origin.
4. Enrich with legality / errata / rulings links from official docs where possible.
5. Keep canonical card records JSON-first.

Suggested next implementation step
- build one small normalization script that converts 5-10 sample cards first
- verify schema fit
- only then run the wider card promotion batch

Main risk
- promoting legacy-migrated fields into canon without explicit provenance mapping
- mitigation: every promoted card record must include source metadata + promotion timestamp
