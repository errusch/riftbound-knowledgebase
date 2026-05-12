#!/usr/bin/env python3
"""
Crawl RiftDecks primary-source events through a local Chrome DevTools endpoint.

The shell cannot fetch RiftDecks directly because of network/proxy restrictions,
but the user's browser session can. This script drives that browser via CDP:

1. Navigate to event_url + ?legend_id=<legend>
2. Pick the first /riftbound-metagame/deck-* link
3. Navigate to that deck page
4. Extract /decks/export/<uuid> from page HTML
5. Navigate to /decks/export/<uuid>/txt
6. Read textarea.value

Output is JSONL suitable for scripts/import-riftdecks-export-jsonl.mjs.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import random
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

import websockets


CDP = "http://127.0.0.1:18800"
ORIGIN = "https://riftdecks.com"


class SecurityBlock(RuntimeError):
    pass


def is_security_block_text(text: str | None) -> bool:
    if not text:
        return False
    lowered = text.lower()
    return any(
        needle in lowered
        for needle in [
            "sorry, you have been blocked",
            "sorry you have been blocked",
            "why have i been blocked",
            "cloudflare ray id",
            "performance & security by cloudflare",
            "this website is using a security service",
        ]
    )


def cdp_new_tab(url: str) -> str:
    req = urllib.request.Request(f"{CDP}/json/new?{urllib.parse.quote(url, safe=':/?&=%')}", method="PUT")
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return data["webSocketDebuggerUrl"]


class Page:
    def __init__(self, ws_url: str):
        self.ws_url = ws_url
        self.ws = None
        self.next_id = 1

    async def __aenter__(self):
        self.ws = await websockets.connect(self.ws_url, max_size=50_000_000)
        await self.send("Page.enable")
        await self.send("Runtime.enable")
        return self

    async def __aexit__(self, exc_type, exc, tb):
        await self.ws.close()

    async def send(self, method: str, params: dict | None = None) -> dict:
        msg_id = self.next_id
        self.next_id += 1
        await self.ws.send(json.dumps({"id": msg_id, "method": method, "params": params or {}}))
        while True:
            msg = json.loads(await self.ws.recv())
            if msg.get("id") == msg_id:
                if "error" in msg:
                    raise RuntimeError(f"{method}: {msg['error']}")
                return msg.get("result", {})

    async def navigate(self, url: str, timeout: float = 30.0):
        await self.send("Page.navigate", {"url": url})
        deadline = time.time() + timeout
        while time.time() < deadline:
            try:
                msg = json.loads(await asyncio.wait_for(self.ws.recv(), timeout=1.0))
            except asyncio.TimeoutError:
                continue
            if msg.get("method") == "Page.loadEventFired":
                await asyncio.sleep(0.6)
                return
        await asyncio.sleep(2.0)

    async def eval(self, expression: str):
        result = await self.send(
            "Runtime.evaluate",
            {"expression": expression, "returnByValue": True, "awaitPromise": True},
        )
        value = result.get("result", {})
        if "value" in value:
            return value["value"]
        return None

    async def wait_until_not_security_check(self, timeout: float = 90.0) -> bool:
        deadline = time.time() + timeout
        while time.time() < deadline:
            text = await self.eval("document.body?.innerText || ''")
            if is_security_block_text(text):
                raise SecurityBlock("riftdecks Cloudflare block page detected")
            if text and "Performing security verification" not in text:
                return True
            await asyncio.sleep(3.0)
        return False


def add_query(url: str, **params: str) -> str:
    parsed = urllib.parse.urlparse(url)
    query = dict(urllib.parse.parse_qsl(parsed.query))
    query.update(params)
    return urllib.parse.urlunparse(parsed._replace(query=urllib.parse.urlencode(query)))


def sleep_bounds(event: dict) -> tuple[float, float]:
    min_delay = float(event.get("_min_delay", 2.0))
    max_delay = float(event.get("_max_delay", 4.0))
    if max_delay < min_delay:
        max_delay = min_delay
    return min_delay, max_delay


async def polite_sleep(event: dict):
    min_delay, max_delay = sleep_bounds(event)
    await asyncio.sleep(random.uniform(min_delay, max_delay))


def load_queue(path: Path, metagame: str | None, limit_events: int | None):
    data = json.loads(path.read_text())
    items = data["items"]
    if metagame:
        items = [item for item in items if item["metagame"] == metagame]
    if limit_events:
        items = items[:limit_events]
    return items


async def crawl_target(page: Page, event: dict, legend: str) -> dict:
    event_url = event.get("event_url")
    if not event_url:
        return {
            "metagame": event["metagame"],
            "event_name": event["event_name"],
            "event_url": None,
            "legend": legend,
            "status": "blocked",
            "blocker": "missing event_url in crawl queue",
        }

    filtered_url = add_query(event_url, legend_id=legend)
    await polite_sleep(event)
    await page.navigate(filtered_url)
    if not await page.wait_until_not_security_check():
        return {
            "metagame": event["metagame"],
            "event_name": event["event_name"],
            "event_url": event_url,
            "legend": legend,
            "status": "blocked",
            "blocker": "riftdecks security verification did not clear",
        }

    deck = await page.eval(
        """
        (() => {
          const links = Array.from(document.querySelectorAll('a[href*="/riftbound-metagame/deck-"]'));
          const link = links.find(a => a.href && a.textContent.trim());
          return link ? {href: link.href, text: link.textContent.trim()} : null;
        })()
        """
    )
    page_text = await page.eval("document.body?.innerText || ''")
    if is_security_block_text(page_text):
        raise SecurityBlock("riftdecks Cloudflare block page detected")
    if not deck:
        return {
            "metagame": event["metagame"],
            "event_name": event["event_name"],
            "event_url": event_url,
            "legend": legend,
            "status": "blocked",
            "blocker": "no deck link found for legend filter",
        }

    await polite_sleep(event)
    await page.navigate(deck["href"])
    if not await page.wait_until_not_security_check():
        return {
            "metagame": event["metagame"],
            "event_name": event["event_name"],
            "event_url": event_url,
            "legend": legend,
            "deck_page_url": deck["href"],
            "status": "blocked",
            "blocker": "riftdecks security verification did not clear on deck page",
        }
    meta = await page.eval(
        """
        (() => {
          const html = document.documentElement.innerHTML;
          const exportMatch = html.match(/\\/decks\\/export\\/[0-9a-f-]+/);
          const title = document.querySelector('h1')?.textContent?.trim() || document.title;
          const subtitle = document.body.innerText.match(/(\\d+(?:st|nd|rd|th)|Top\\d+|Top\\s*\\d+)\\s+at[^\\n]+/i)?.[0] || null;
          return {exportPath: exportMatch ? exportMatch[0] : null, title, subtitle};
        })()
        """
    )
    if not meta or not meta.get("exportPath"):
        return {
            "metagame": event["metagame"],
            "event_name": event["event_name"],
            "event_url": event_url,
            "legend": legend,
            "deck_page_url": deck["href"],
            "status": "blocked",
            "blocker": "no export path found on deck page",
        }

    export_txt_url = ORIGIN + meta["exportPath"] + "/txt"
    await polite_sleep(event)
    await page.navigate(export_txt_url)
    if not await page.wait_until_not_security_check():
        return {
            "metagame": event["metagame"],
            "event_name": event["event_name"],
            "event_url": event_url,
            "legend": legend,
            "deck_page_url": deck["href"],
            "export_txt_url": export_txt_url,
            "status": "blocked",
            "blocker": "riftdecks security verification did not clear on export txt",
        }
    text = await page.eval("document.querySelector('textarea')?.value || ''")
    if not text or len(text) < 80:
        return {
            "metagame": event["metagame"],
            "event_name": event["event_name"],
            "event_url": event_url,
            "legend": legend,
            "deck_page_url": deck["href"],
            "export_txt_url": export_txt_url,
            "status": "blocked",
            "blocker": "export TXT textarea missing or too short",
        }

    title = meta.get("title") or ""
    player = None
    if " by " in title:
        player = title.split(" by ", 1)[1].replace("| riftDecks.com", "").strip()
    rank = None
    if meta.get("subtitle"):
        match = re.search(r"(\d+)(?:st|nd|rd|th)|Top\s*(\d+)", meta["subtitle"], re.I)
        if match:
            rank = match.group(1) or f"Top {match.group(2)}"

    return {
        "metagame": event["metagame"],
        "event_name": event["event_name"],
        "event_url": event_url,
        "legend": legend,
        "rank": rank,
        "player": player,
        "deck_page_url": deck["href"],
        "export_txt_url": export_txt_url,
        "export_text": text,
        "status": "ok",
        "blocker": None,
    }


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--queue", default="_work/riftdecks-crawl-queue.json")
    parser.add_argument("--metagame", choices=["unleashed", "spiritforged", "origins"])
    parser.add_argument("--out", required=True)
    parser.add_argument("--limit-events", type=int)
    parser.add_argument("--limit-legends", type=int)
    parser.add_argument("--min-delay", type=float, default=2.0, help="minimum seconds between RiftDecks page actions")
    parser.add_argument("--max-delay", type=float, default=4.0, help="maximum seconds between RiftDecks page actions")
    parser.add_argument("--continue-on-security-block", action="store_true", help="do not abort the whole crawl when Cloudflare block text is detected")
    args = parser.parse_args()

    events = load_queue(Path(args.queue), args.metagame, args.limit_events)
    for event in events:
        event["_min_delay"] = args.min_delay
        event["_max_delay"] = args.max_delay
    ws_url = cdp_new_tab("about:blank")
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    ok = blocked = 0
    async with Page(ws_url) as page:
        with out_path.open("a", encoding="utf-8") as out:
            for event in events:
                legends = event["legend_targets"]
                if args.limit_legends:
                    legends = legends[: args.limit_legends]
                for legend in legends:
                    try:
                        record = await crawl_target(page, event, legend)
                    except SecurityBlock as exc:
                        record = {
                            "metagame": event["metagame"],
                            "event_name": event["event_name"],
                            "event_url": event.get("event_url"),
                            "legend": legend,
                            "status": "blocked",
                            "blocker": f"security_block: {exc}",
                        }
                        blocked += 1
                        out.write(json.dumps(record, ensure_ascii=False) + "\n")
                        out.flush()
                        print(f"{record['status']:7} {event['metagame']} | {event['event_name']} | {legend} | {record['blocker']}")
                        if not args.continue_on_security_block:
                            print("aborting crawl: RiftDecks security block detected; change IP/cool down before retrying")
                            print(f"done ok={ok} blocked={blocked} out={out_path}")
                            return
                    except Exception as exc:
                        record = {
                            "metagame": event["metagame"],
                            "event_name": event["event_name"],
                            "event_url": event.get("event_url"),
                            "legend": legend,
                            "status": "blocked",
                            "blocker": f"exception: {exc}",
                        }
                    if record.get("status") == "ok":
                        ok += 1
                    else:
                        blocked += 1
                    out.write(json.dumps(record, ensure_ascii=False) + "\n")
                    out.flush()
                    print(f"{record['status']:7} {event['metagame']} | {event['event_name']} | {legend}")

    print(f"done ok={ok} blocked={blocked} out={out_path}")


if __name__ == "__main__":
    asyncio.run(main())
