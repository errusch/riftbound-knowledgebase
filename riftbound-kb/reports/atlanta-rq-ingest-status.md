# Atlanta RQ Ingest Status

_Generated 2026-04-28._

## Status

Imported after VPN/IP change.

RiftDecks final standings appear to exist at:

`https://riftdecks.com/riftbound-tournaments/riftbound-regional-qualifier-atlanta-final-standings-tournament-decks-7872`

The first attempted CDP crawl wrote:

`sources/atlanta-final-riftdecks-resolved.jsonl`

That first attempt produced:

- ok exports: 0
- blocked rows: 40
- blocker recorded by the old crawler: `no deck link found for legend filter`

The user then observed the browser block page:

> sorry you have been blocked from riftdecks.com

That means the 40 blocked rows should not be interpreted as real per-legend
deck unavailability. They are a failed blocked-IP crawl attempt.

After the VPN/router IP was changed, a smoke crawl succeeded and the final
standings crawl was retried with 2-4s randomized delays.

Successful retry output:

`sources/atlanta-final-riftdecks-resolved-v3.jsonl`

Retry results:

- ok exports: 24
- blocked rows: 16
- security blocks: 0
- imported decklists: 24
- event created: `events/riftdecks-riftbound-regional-qualifier-atlanta-final-standings.json`

Post-import validation:

- `regen-event-best-decklists.mjs` passed
- `regen-current-meta.mjs` passed
- `regen-postban-archetypes.mjs` passed
- `lint-kb.mjs` passed with 0 bad event refs, 0 unresolved card refs, 0 null legends, and 0 missing players

## Safeguard Added

`scripts/crawl-riftdecks-primary-exports.py` now detects Cloudflare/security
block text and aborts the entire crawl immediately by default.

New defaults:

- `--min-delay 2`
- `--max-delay 4`
- abort on first security block

Only use `--continue-on-security-block` for diagnostics, not production crawls.

## Safe Retry Protocol

After changing VPN/IP and confirming the site loads manually:

1. Open the Atlanta final standings URL in the browser.
2. Confirm it does **not** show a Cloudflare block page.
3. Run a very small smoke crawl first:

```bash
cd ~/Playground/riftbound-kb
python3 scripts/crawl-riftdecks-primary-exports.py \
  --queue sources/atlanta-final-riftdecks-crawl-queue.json \
  --out sources/atlanta-final-riftdecks-smoke.jsonl \
  --limit-legends 2 \
  --min-delay 2 \
  --max-delay 4
```

4. If the smoke crawl gets any `security_block`, stop immediately and wait or
   change IP again.
5. If the smoke crawl succeeds, run the full crawl in small batches, not all 40
   legends at once.
6. Import only successful `status="ok"` records.
7. Regenerate:

```bash
node scripts/regen-event-best-decklists.mjs
node scripts/regen-current-meta.mjs
node scripts/regen-postban-archetypes.mjs
node scripts/lint-kb.mjs
```

## Do Not

- Do not repeatedly retry from the same blocked IP.
- Do not crawl all 40 legends in one shot immediately after getting unblocked.
- Do not treat the current `atlanta-final-riftdecks-resolved.jsonl` blocked rows
  as evidence that those legend filters had no deck links.
