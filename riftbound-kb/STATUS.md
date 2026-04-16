# Riftbound KB Status

Generated after initial build-out.

## What is complete
- Canonical subtree scaffold created
- Agent contract and implementation plan written
- Trust policy and source registry created
- Phase 1 inventory and promote/review/archive mapping generated
- Official event coverage index created
- Canonical schemas for cards, events, decklists, and source metadata created
- Canonical rules/rulings seed docs promoted
- Canonical card corpus promoted from local structured card data
- Canonical raw event corpus promoted from local official event data
- Canonical decklist corpus promoted from local competitive deck data
- Normalized real-world event registry created to collapse duplicate preview/top-decks/results coverage rows
- Retrieval indexes and retrieval-map docs created

## Current canonical counts
- cards: 954 official canonical card records
- raw event records: 10
- normalized real-world events: 17
- decklists: 176
- unique legends in decklists: 28

## Important caveats
- Card corpus is now imported from the official card-gallery API, and a first official legality/errata/FAQ enrichment pass has been applied; deeper rulings enrichment may still uncover more links
- Event/decklist records preserve provenance, but some decklists still rely on trusted secondary support where official coverage is incomplete
- Shenzhen National Open top 8 was imported through a trusted secondary source via the local browser because direct fetch was blocked by Cloudflare; this is stronger than before but still not official-first
- Current tournament snapshot is now populated from canonical event/decklist data, but still needs further normalization and source hardening
- Legacy material has been fenced out of the main trust path, but not yet bulk-moved into archive/

## Highest-value next upgrades
1. strengthen official event coverage and connect all event/decklist ids cleanly
2. derive a real dated tournament meta report from canonical event/decklist data
3. add legality / errata / rulings link enrichment to canonical card records
4. archive stale/conflicting legacy files out of the main trust path
