# Retrieval Map

Use this file when answering Riftbound questions from the KB.

Primary jobs

1. What should I play?
- start with `meta/`
- then check `events/index.json`
- then inspect `decklists/index.json`
- use `decklists/` for specific best-of-legend and player lists

2. How do archetypes match up?
- start with `meta/`
- then use event/decklist evidence from `events/` and `decklists/`
- if historical matchup notes are needed, consult legacy material only after checking canonical sources

3. What happened in official events?
- start with `events/index.normalized.json`
- then open the specific `events/canonical/<event-id>.json`
- use `decklists/` for attached deck evidence

4. What is true about a card / rule / errata?
- cards: `canon/cards/index.json` then `canon/cards/<card-id>.json`
- rules: `canon/rules/`
- rulings / errata: `canon/rulings/`

5. What does the market look like?
- use `market/` when populated
- trusted market sources are listed in `sources/source-registry.json`

Interpretation rules
- prefer official over all other sources
- if official decklists are missing, use trusted secondary decklists but say so
- treat archived material as historical context, not live truth
