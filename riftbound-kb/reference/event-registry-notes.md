# Event Registry Notes

Current issue
The event layer currently mixes multiple coverage records for the same real-world event:
- preview coverage
- top-decks coverage
- results coverage

This is useful for provenance, but not ideal for a simple event list.

Normalization rule to apply in the next cleanup pass
- one canonical event record per real-world event
- attach multiple coverage sources to that one event record instead of listing separate event rows for preview / top-decks / results

User correction captured
- Most recent major event: Shenzhen National Open
- Date: 2026-03-22
- Trusted secondary source provided by user: RiftDecks tournament page

Immediate implication
- the major-event registry should include Shenzhen National Open as newer than Vegas/Bologna in the current competitive timeline
- duplicate Bologna/Vegas preview/top-decks records should be collapsed into single event records with richer source arrays
- the remaining official Regional Qualifiers on the 2026 roadmap should exist as forward-looking placeholders until result/decklist coverage arrives
