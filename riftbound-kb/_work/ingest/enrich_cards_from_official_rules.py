#!/usr/bin/env python3.12
"""Enrich canonical cards with official constructed-ban and errata/FAQ links."""

from __future__ import annotations

import json
import re
from datetime import UTC, datetime
from pathlib import Path

import requests
from bs4 import BeautifulSoup

ROOT = Path('/Users/eric/Documents/Playground/riftbound-kb')
CARDS = ROOT / 'canon' / 'cards'

BANS_URL = 'https://riftbound.leagueoflegends.com/en-us/news/announcements/announcing-riftbounds-first-bans'
ERRATA_URL = 'https://riftbound.leagueoflegends.com/en-us/news/rules-and-releases/riftbound-spiritforged-errata'
FAQ_URL = 'https://riftbound.leagueoflegends.com/en-us/news/rules-and-releases/riftbound-spiritforged-faq'


def page_text(url: str) -> str:
    html = requests.get(url, timeout=30).text
    return ' '.join(BeautifulSoup(html, 'html.parser').get_text('\n', strip=True).split())


def extract_bans(text: str):
    m = re.search(r'The following are banned from Riftbound Standard Constructed: Cards (.*?) Battlefields (.*?) —', text)
    cards, battlefields = set(), set()
    if m:
        card_segment = m.group(1)
        bf_segment = m.group(2)
        # known from official page phrasing
        for name in ['Called Shot', 'Draven, Vanquisher', 'Fight or Flight', 'Scrapheap']:
            if name.lower() in card_segment.lower():
                cards.add(name)
        for name in ['Dreaming Tree', 'Obelisk of Power', 'Reaver’s Row', "Reaver's Row"]:
            if name.lower() in bf_segment.lower():
                battlefields.add(name.replace('’', "'"))
    return cards, battlefields


def extract_errata_names(text: str):
    names = set()
    for m in re.finditer(r'([A-Z][A-Za-z\'\- ,]+?) \[NEW TEXT\]', text):
        raw = m.group(1).strip()
        raw = re.sub(r'^(Origins Cards|Spiritforged Cards)\s+', '', raw).strip()
        names.add(raw)
    return names


def mentioned_in_faq(name: str, faq_text: str) -> bool:
    return name.lower() in faq_text.lower()


def main():
    bans_text = page_text(BANS_URL)
    errata_text = page_text(ERRATA_URL)
    faq_text = page_text(FAQ_URL)

    banned_cards, banned_battlefields = extract_bans(bans_text)
    errata_names = extract_errata_names(errata_text)
    updated = 0
    errata_hits = 0
    faq_hits = 0
    banned_hits = 0

    for p in CARDS.glob('*.json'):
        if p.name == 'index.json':
            continue
        card = json.loads(p.read_text())
        name = (card.get('name') or '').replace('’', "'")
        ctype = (card.get('card_type') or '').lower()

        constructed = 'legal'
        legality_note = 'No specific Standard Constructed ban found in official first-bans announcement as of 2026-03-30.'
        if name in banned_cards:
            constructed = 'banned'
            legality_note = 'Banned in Riftbound Standard Constructed effective 2026-03-31 per official first-bans announcement.'
            banned_hits += 1
        if ctype == 'battlefield' and name in banned_battlefields:
            constructed = 'banned'
            legality_note = 'Banned battlefield in Riftbound Standard Constructed effective 2026-03-31 per official first-bans announcement.'
            banned_hits += 1

        card['legality'] = {
            'constructed': constructed,
            'limited': 'unknown_pending_official_limited_policy_pass',
            'notes': legality_note,
            'verified_at': datetime.now(UTC).date().isoformat(),
        }

        errata_links = set(card.get('errata_links') or [])
        rulings_links = set(card.get('rulings_links') or [])
        if name in errata_names:
            errata_links.add(ERRATA_URL)
            errata_hits += 1
        if mentioned_in_faq(name, faq_text):
            rulings_links.add(FAQ_URL)
            faq_hits += 1
        card['errata_links'] = sorted(errata_links)
        card['rulings_links'] = sorted(rulings_links)

        notes = card.get('notes') or ''
        if 'official_card_gallery_api' not in notes.lower():
            pass
        p.write_text(json.dumps(card, indent=2, ensure_ascii=False) + '\n')
        updated += 1

    print(json.dumps({
        'updated_cards': updated,
        'banned_hits': banned_hits,
        'errata_hits': errata_hits,
        'faq_hits': faq_hits,
        'banned_cards': sorted(banned_cards),
        'banned_battlefields': sorted(banned_battlefields),
        'errata_names': sorted(errata_names),
    }, indent=2, ensure_ascii=False))


if __name__ == '__main__':
    main()
