# RiftDecks Primary Event Source Policy

## Rule
For current and future meta deck coverage, the primary event discovery source is the first page of three-star RiftDecks tournament results sorted by player count descending for each metagame.

## Primary URLs
- Unleashed: `https://riftdecks.com/riftbound-tournaments?metagame_id=3&relevance=3&sort=attendee&direction=desc`
- Spiritforged: `https://riftdecks.com/riftbound-tournaments?metagame_id=2&relevance=3&sort=attendee&direction=desc`
- Origins: `https://riftdecks.com/riftbound-tournaments?metagame_id=1&relevance=3&sort=attendee&direction=desc`

## Ingestion Rule
For each event on those first pages:
1. Open the event page.
2. For each legal legend in that metagame, filter by legend.
3. Open the highest-ranked deck with a decklist.
4. Use `Export this Deck` -> `Export TXT`.
5. Save the full decklist into `decklists/` with canonical card IDs.
6. Add/update the event's `best_decklists` pointer for that legend.

## Trust Model
RiftDecks is `trusted_secondary`. Official Riot/Riftbound pages still outrank it when they provide full decklists, but RiftDecks is the default source for broad event discovery and best-of-legend backfills.

## Future Refresh
When new results are entered, compare the first-page event list for each metagame against `sources/official-event-registry.json`. Any new event should be queued for best-of-legend extraction.
