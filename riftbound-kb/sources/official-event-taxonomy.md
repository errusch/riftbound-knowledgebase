# Official Event Taxonomy (Phase 1)

Purpose
Define the official event vocabulary and coverage patterns the Riftbound KB should recognize when ingesting official event/news coverage.

Scope of this Phase 1 note
- grounded in initial inspection of the official news hub
- not yet a complete crawl of every official event article
- intended to guide canonical event ingestion in Phase 2

Primary official source
- https://riftbound.leagueoflegends.com/en-us/news/

Observed official terms from initial scan
1. Regional Qualifier
   - explicitly present on the official news hub
   - appears both in long form and abbreviated as `RQ`
   - examples observed from official news coverage:
     - `Eyes On Las Vegas - What to Know`
     - `Eyes On Bologna - What to Know`
     - `Vegas' Top Decks`
     - `The Best Decks out of Bologna`

2. Top Decks / Best-Of Decks coverage
   - official post type used after major events
   - appears to summarize successful archetypes / legends / decklists from an event
   - should be treated as an official downstream source for event-level meta signals

3. What to Know event preview coverage
   - official pre-event article type
   - useful for event identity, location, timing, and official framing
   - should support event metadata but not substitute for results/decklists

4. Organized Play
   - category label visible on event-result style posts
   - useful as a filtering signal for official tournament coverage

5. Tournament Rules updates
   - not an event type, but highly relevant adjacent official source for competitive legality / procedures
   - should be ingested into canon/rules rather than events/

Expected official terminology to verify in the deeper crawl
- National Open (China)
- any additional official event labels appearing in the official news archive or roadmap pages

Interim taxonomy recommendation
Use the following event_type values until the deeper crawl confirms more:
- `regional_qualifier`
- `national_open` (expected, pending direct confirmation in deeper official crawl)
- `convention_event` (for official convention/demo/event coverage when relevant)
- `other_official_event` (temporary fallback until event terminology is normalized)

Recommended event record fields
- `event_id`
- `event_type`
- `event_name`
- `region`
- `city`
- `country`
- `official_source_url`
- `official_source_title`
- `official_source_date`
- `coverage_kind` (`preview`, `results`, `top_decks`, `schedule`, `roadmap`)
- `decklist_source_tier`
- `notes`

Coverage rules
- official result / decklist coverage should always be preferred
- if official coverage lacks full decklists, trusted secondary decklists may be attached, but must be labeled separately
- `RQ` should normalize to `regional_qualifier`
- event previews and roadmaps should not be mistaken for result records

What still needs to happen in Phase 2
- crawl the official news archive more deeply
- confirm `National Open` terminology directly from official pages
- capture the full official event vocabulary set
- build a structured event index from official coverage
