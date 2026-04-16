#!/usr/bin/env python3.12
"""Materialize missing canonical decklist files from structured official event data."""

from __future__ import annotations

import json
import re
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path('/Users/eric/Documents/Playground')
KB = ROOT / 'riftbound-kb'
CARDS = KB / 'canon' / 'cards'
DECKS = KB / 'decklists'
RAW_EVENTS = ROOT / 'data' / 'events' / 'official'


def load_json(path: Path):
    return json.loads(path.read_text())


def write_json(path: Path, payload):
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + '\n')


def build_card_maps():
    short_to_full = {}
    name_to_full = {}
    for p in CARDS.glob('*.json'):
        c = load_json(p)
        cid = (c.get('card_id') or '').lower()
        m = re.match(r'^([a-z]+-\d+)', cid)
        if m:
            short_to_full.setdefault(m.group(1), cid)
        name = (c.get('name') or '').strip().lower()
        if name:
            name_to_full.setdefault(name, cid)
    return short_to_full, name_to_full


def canon_event_id(raw_id: str) -> str:
    s = raw_id.lower()
    if 'bologna' in s:
        return 'rq-bologna'
    if 'houston' in s:
        return 'rq-houston'
    if 'chengdu' in s:
        return 's2-reg-chengdu-2026'
    if 'dalian' in s:
        return 's2-reg-dalian-2026'
    if 'fuzhou' in s:
        return 's2-reg-fuzhou-2026'
    if 'nanjing' in s:
        return 's2-reg-nanjing-2026'
    return s.replace('_','-')


def make_decklist_id(event_id: str, legend: str, placement) -> str:
    leg = (legend or 'unknown').lower()
    leg = re.sub(r'[^a-z0-9]+', '-', leg).strip('-')
    return f'{event_id}--{leg}-{placement}'


def parse_entry(entry: str, short_to_full: dict[str, str], name_to_full: dict[str, str]):
    entry = entry.strip()
    m = re.match(r'^(\d+)\s+(.+)$', entry)
    if m:
        count = int(m.group(1))
        name = m.group(2).strip()
    else:
        count = 1
        name = entry
    cid = name_to_full.get(name.lower())
    return {'card_id': cid, 'count': count, 'name': name}


def section_items(prefix_entries, section, short_to_full, name_to_full):
    out = []
    for entry in prefix_entries:
        item = parse_entry(entry, short_to_full, name_to_full)
        item['section'] = section
        out.append(item)
    return out


def normalize_source(data, deck):
    return {
        'source_type': 'official' if data.get('trust_level') == 'derived_verified' else 'best_available',
        'source_name': data.get('title') or 'official event record',
        'source_url': None,
        'source_date': data.get('source_date'),
        'retrieved_at': datetime.now(UTC).date().isoformat(),
        'trust_tier': 'official' if data.get('trust_level') == 'derived_verified' else 'best_available',
        'notes': f"materialized from structured official event dataset | upstream_path={data.get('source_path')} | player={deck.get('player_name')}",
    }


def main():
    short_to_full, name_to_full = build_card_maps()
    created = 0
    for p in RAW_EVENTS.glob('*.json'):
        data = load_json(p)
        rec = data.get('record', {})
        event_id = canon_event_id(rec.get('event_id') or '')
        for deck in data.get('decklists', []):
            decklist_id = make_decklist_id(event_id, deck.get('legend'), deck.get('placement'))
            out_path = DECKS / f'{decklist_id}.json'
            if out_path.exists():
                continue
            cards = []
            cards.extend(section_items(deck.get('main_deck_cards', []), 'mainboard', short_to_full, name_to_full))
            cards.extend(section_items(deck.get('sideboard_cards', []), 'sideboard', short_to_full, name_to_full))
            cards.extend(section_items(deck.get('battlefield_cards', []), 'battlefields', short_to_full, name_to_full))
            cards.extend(section_items(deck.get('rune_cards', []), 'runes', short_to_full, name_to_full))
            payload = {
                'decklist_id': decklist_id,
                'event_id': event_id,
                'player': deck.get('player_name'),
                'legend': deck.get('legend'),
                'placement': deck.get('placement'),
                'is_best_of_legend': 'best' in str(deck.get('deck_type','')).lower(),
                'cards': cards,
                'source': normalize_source(data, deck),
                'secondary_sources': [],
                'notes': f"champion={deck.get('champion')} | deck_type={deck.get('deck_type')}",
            }
            write_json(out_path, payload)
            created += 1
            print(out_path)
    print(json.dumps({'created': created}, indent=2))


if __name__ == '__main__':
    main()
