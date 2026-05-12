# Card Interactions — Riot-Verified Rulings

Structured interaction records for Riftbound card combos, synergies, counterplays,
and official rulings. Each file covers one card pairing or mechanic.

## Format

```json
{
  "cards": ["Card A Name", "Card B Name"],
  "question": "What happens when X meets Y?",
  "ruling": "The official answer.",
  "rules_context": ["461.3.d", "FAQ Results of Combat"],
  "source": "PopCon Indy May 2026 Judge FAQ",
  "source_url": "https://docs.google.com/document/u/1/d/13djxqHYEIuqPRxZ0vd6gSjCwPoHAdJpoxduUUoXI-JM/mobilebasic",
  "verified_by": "Riot Games",
  "date": "2026-05-06",
  "tags": ["combat", "replacement", "trigger"]
}
```

## Directory

- `combat/` — Combat cleanup, damage, showdown interactions
- `replacement/` — Replacement effects, "as you play" interactions
- `targeting/` — Mistargeting, spell fizzle, redirect
- `triggers/` — Trigger chains, HOT FEPR, optional vs mandatory
- `tokens/` — Reflection tokens, copy effects
- `costs/` — Additional costs, forced play costs
