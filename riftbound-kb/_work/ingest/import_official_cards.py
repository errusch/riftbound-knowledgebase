#!/usr/bin/env python3.12
"""Import canonical card records from the official Riftbound card-gallery API."""

from __future__ import annotations

import json
import re
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import requests

ROOT = Path('/Users/eric/Documents/Playground/riftbound-kb')
OUT_DIR = ROOT / 'canon' / 'cards'
INDEX_PATH = OUT_DIR / 'index.json'
API = 'https://content.publishing.riotgames.com/publishing-content/v2.0/public/channel/riftbound_website/list/riftbound_gallery_cards?locale=en_US&from={offset}&limit=200'


def fetch_all_cards() -> list[dict[str, Any]]:
    all_items = []
    for offset in range(0, 5000, 200):
        r = requests.get(API.format(offset=offset), timeout=30)
        r.raise_for_status()
        data = r.json().get('data', [])
        if not data:
            break
        all_items.extend(data)
    return all_items


def norm_text(item: dict[str, Any]) -> tuple[str | None, str | None]:
    text = item.get('text') or {}
    rich = ((text.get('richText') or {}).get('body')) if isinstance(text, dict) else None
    plain = None
    if rich:
        plain = re.sub(r'<br\s*/?>', '\n', rich)
        plain = re.sub(r'<[^>]+>', '', plain)
        plain = plain.strip()
    elif isinstance(item.get('effect'), str):
        plain = item.get('effect')
    return plain, rich


def get_value(obj, path, default=None):
    cur = obj
    for key in path:
        if cur is None:
            return default
        cur = cur.get(key)
    return cur if cur is not None else default


def normalize_card(item: dict[str, Any]) -> dict[str, Any]:
    plain, rich = norm_text(item)
    domains = [v.get('label') for v in get_value(item, ['domain', 'values'], []) if v.get('label')]
    raw_tags = get_value(item, ['tags'], []) or []
    subtypes = []
    for t in raw_tags:
        if isinstance(t, dict) and t.get('label'):
            subtypes.append(t.get('label'))
        elif isinstance(t, str) and t.strip():
            subtypes.append(t.strip())
    card_types = [t.get('label') for t in get_value(item, ['cardType', 'type'], []) if t.get('label')]
    card_type = card_types[0] if card_types else None
    set_code = get_value(item, ['set', 'value', 'id'])
    set_name = get_value(item, ['set', 'value', 'label'])
    energy = get_value(item, ['energy', 'value', 'label'])
    might = get_value(item, ['might', 'value', 'label'])
    power = get_value(item, ['power', 'value', 'label'])
    rarity = get_value(item, ['rarity', 'value', 'label'])
    artist_values = get_value(item, ['illustrator', 'values'], []) or []
    artist = artist_values[0].get('label') if artist_values else None
    return {
        'card_id': item.get('id'),
        'name': item.get('name'),
        'set_code': set_code,
        'set_name': set_name,
        'collector_number': str(item.get('collectorNumber')) if item.get('collectorNumber') is not None else None,
        'public_code': item.get('publicCode'),
        'card_type': card_type,
        'subtypes': subtypes,
        'domains': domains,
        # Riftbound stat trio, matching printed-card iconography:
        #   energy = top-left circle (energy cost)
        #   power  = domain-pip cost (rune cost in the Rune Pool)
        #   might  = top-right combat stat (sword + shield)
        'energy': int(energy) if isinstance(energy, str) and energy.isdigit() else energy,
        'power': int(power) if isinstance(power, str) and power.isdigit() else power,
        'might': int(might) if isinstance(might, str) and might.isdigit() else might,
        'might_bonus': get_value(item, ['mightBonus', 'value', 'label']),
        'text': plain or '',
        'text_rich': rich,
        'rarity': rarity,
        'image': {
            'path': None,
            'url': get_value(item, ['cardImage', 'url']),
        },
        'artist': artist,
        'accessibility_text': get_value(item, ['cardImage', 'accessibilityText']),
        'legality': {
            'constructed': 'unknown_pending_official_legality_pass',
            'limited': 'unknown_pending_official_legality_pass',
            'notes': None,
        },
        'errata_links': [],
        'rulings_links': [],
        'source': {
            'source_type': 'official',
            'source_name': 'Riftbound Official Card Gallery API',
            'source_url': API.format(offset=0),
            'source_date': None,
            'retrieved_at': datetime.now(UTC).date().isoformat(),
            'trust_tier': 'official',
            'notes': 'Imported from official card-gallery API feed.',
        },
        'upstream': {
            'orientation': item.get('orientation'),
            'raw_fields': sorted(item.keys()),
        },
        'notes': None,
    }


def main() -> None:
    items = fetch_all_cards()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for p in OUT_DIR.glob('*.json'):
        if p.name == 'index.json':
            continue
        p.unlink()
    normalized = []
    for item in items:
        card = normalize_card(item)
        path = OUT_DIR / f"{card['card_id']}.json"
        path.write_text(json.dumps(card, indent=2, ensure_ascii=False) + '\n')
        normalized.append({
            'card_id': card['card_id'],
            'name': card['name'],
            'set_code': card['set_code'],
            'card_type': card['card_type'],
            'domains': card['domains'],
            'path': str(path.relative_to(ROOT)),
            'trust_tier': card['source']['trust_tier'],
        })
    INDEX_PATH.write_text(json.dumps({'count': len(normalized), 'items': normalized}, indent=2, ensure_ascii=False) + '\n')
    print(json.dumps({'imported': len(normalized)}, indent=2))


if __name__ == '__main__':
    main()
