#!/usr/bin/env python3.12
"""Import Shenzhen National Open top 8 decklists from the locally accessible RiftDecks page via browser CDP."""

from __future__ import annotations

import asyncio
import json
import re
from datetime import UTC, datetime
from pathlib import Path

from playwright.async_api import async_playwright

ROOT = Path('/Users/eric/Documents/Playground/riftbound-kb')
CARDS = ROOT / 'canon' / 'cards'
EVENT_PATH = ROOT / 'events' / 'canonical' / 'shenzhen-national-open-2026-03-22.json'
DECKS = ROOT / 'decklists'
TOURNAMENT_URL = 'https://riftdecks.com/riftbound-tournaments/s2-shenzhen-national-open-tournament-decks-6619'


def load_json(path: Path):
    return json.loads(path.read_text())


def write_json(path: Path, payload):
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + '\n')


def norm_legend(text: str | None) -> str:
    return re.sub(r'[^a-z0-9]+', '-', (text or '').lower()).strip('-')


def build_name_map():
    out = {}
    for p in CARDS.glob('*.json'):
        if p.name == 'index.json':
            continue
        d = load_json(p)
        out[(d.get('name') or '').strip().lower()] = d.get('card_id')
    return out


def parse_card_line(line: str, section: str, name_map: dict[str, str]):
    m = re.match(r'^(\d+)\s+(.*?)(?:\$.*)?$', line.strip())
    if not m:
        return None
    count = int(m.group(1))
    name = m.group(2).strip()
    cid = name_map.get(name.lower())
    return {'card_id': cid, 'count': count, 'name': name, 'section': section}


def extract_deck(text: str, name_map: dict[str, str]):
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    legend = None
    player = None
    placement = None
    for idx, line in enumerate(lines[:20]):
        if legend is None and line.lower() in name_map:
            legend = line
        if legend is None and idx == 4:
            legend = line
        if player is None:
            m_player = re.search(r'decklist by\s+(.+?)\.\s+\d+(?:st|nd|rd|th) at s2 shenzhen national open', line, re.I)
            if m_player:
                player = m_player.group(1).strip()
        if placement is None:
            m = re.search(r'(\d+)(?:st|nd|rd|th) at S2 Shenzhen National Open', line, re.I)
            if m:
                placement = int(m.group(1))
    cards = []
    current_section = None
    valid_sections = {'LEGEND':'legend','CHAMPION':'champion','UNIT':'unit','GEAR':'gear','SPELL':'spell','BATTLEFIELDS':'battlefields','RUNES':'runes','SIDEBOARD':'sideboard'}
    for line in lines:
        if line in valid_sections:
            current_section = valid_sections[line]
            continue
        if current_section:
            item = parse_card_line(line, current_section, name_map)
            if item:
                cards.append(item)
    return {'player': player, 'legend': legend, 'placement': placement, 'cards': cards}


async def get_top8_urls(page):
    hrefs = await page.evaluate("""
() => Array.from(document.querySelectorAll('a[href]')).map(a => a.href).filter(Boolean)
""")
    seen = []
    for u in hrefs:
        if '/riftbound-metagame/' in u and u not in seen:
            seen.append(u)
    return seen[:8]


async def fetch_page_text(context, url):
    page = await context.new_page()
    await page.goto(url, wait_until='domcontentloaded', timeout=60000)
    await page.wait_for_timeout(3000)
    text = await page.locator('body').inner_text()
    await page.close()
    return text


async def main_async():
    name_map = build_name_map()
    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp('http://127.0.0.1:18800')
        context = browser.contexts[0] if browser.contexts else await browser.new_context()
        page = await context.new_page()
        await page.goto(TOURNAMENT_URL, wait_until='domcontentloaded', timeout=60000)
        await page.wait_for_timeout(5000)
        top8_urls = await get_top8_urls(page)
        await page.close()

        placements = []
        for url in top8_urls:
            text = await fetch_page_text(context, url)
            deck = extract_deck(text, name_map)
            placement = deck['placement']
            legend = deck['legend']
            player = deck['player']
            did = f"shenzhen-national-open-2026-03-22--{norm_legend(legend)}-{placement}"
            payload = {
                'decklist_id': did,
                'event_id': 'shenzhen-national-open-2026-03-22',
                'player': player,
                'legend': legend,
                'placement': placement,
                'is_best_of_legend': False,
                'cards': deck['cards'],
                'source': {
                    'source_type': 'trusted_secondary',
                    'source_name': 'RiftDecks tournament deck page',
                    'source_url': url,
                    'source_date': '2026-03-22',
                    'retrieved_at': datetime.now(UTC).date().isoformat(),
                    'trust_tier': 'trusted_secondary',
                    'notes': 'Imported through locally accessible browser session after direct fetch was blocked by Cloudflare.',
                },
                'secondary_sources': [],
                'notes': 'Shenzhen National Open top 8 deck imported from trusted secondary coverage.',
            }
            write_json(DECKS / f'{did}.json', payload)
            placements.append({'place': placement, 'player': player, 'legend': legend, 'decklist_id': did})

        event = load_json(EVENT_PATH)
        event['placements'] = sorted(placements, key=lambda x: x['place'])
        event['status'] = 'completed'
        event['coverage_kind'] = 'results'
        event['notes'] = 'Top 8 decklists imported from trusted secondary coverage via local browser session after direct fetch block.'
        event.setdefault('sources', [])
        event['sources'].append({
            'source_type': 'trusted_secondary',
            'source_name': 'RiftDecks tournament deck page',
            'source_url': TOURNAMENT_URL,
            'source_date': '2026-03-22',
            'retrieved_at': datetime.now(UTC).date().isoformat(),
            'trust_tier': 'trusted_secondary',
            'notes': 'Top 8 imported via local browser session.',
        })
        write_json(EVENT_PATH, event)
        await browser.close()
        print(json.dumps({'top8_urls': top8_urls, 'placements': placements}, indent=2, ensure_ascii=False))


if __name__ == '__main__':
    asyncio.run(main_async())
