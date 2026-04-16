#!/usr/bin/env python3.12
"""Repair core Riftbound KB referential integrity.

Repairs performed:
- normalize decklist event_id values to canonical event ids
- normalize decklist card_id values from short card codes to canonical card ids
- add top-level trust_tier to canonical event records from primary source
- emit validation report
"""

from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path('/Users/eric/Documents/Playground/riftbound-kb')
CARDS_DIR = ROOT / 'canon' / 'cards'
DECKS_DIR = ROOT / 'decklists'
EVENTS_DIR = ROOT / 'events' / 'canonical'
REPORT = ROOT / '_work' / 'inventory' / 'integrity-report.json'


def load_json(path: Path):
    return json.loads(path.read_text())


def write_json(path: Path, payload):
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + '\n')


def build_card_maps():
    short_to_full = {}
    name_to_full = {}
    full_ids = set()
    for p in CARDS_DIR.glob('*.json'):
        card = load_json(p)
        cid = (card.get('card_id') or '').lower()
        if not cid:
            continue
        full_ids.add(cid)
        m = re.match(r'^([a-z]+-\d+)', cid)
        if m:
            short = m.group(1)
            short_to_full.setdefault(short, cid)
        name = (card.get('name') or '').strip().lower()
        if name:
            name_to_full.setdefault(name, cid)
    return short_to_full, name_to_full, full_ids


def canonical_event_id(raw: str | None) -> str | None:
    if not raw:
        return None
    s = raw.lower().strip()
    direct = {
        'bologna-regional-qualifier': 'rq-bologna',
        'vegas-regional-qualifier': 'rq-vegas',
        'houston-regional-qualifier': 'rq-houston',
        'shanghai-national-open': 'shenzhen-national-open-2026-03-22',
        'rq-bologna': 'rq-bologna',
        'rq-vegas': 'rq-vegas',
        'rq-houston': 'rq-houston',
    }
    if s in direct:
        return direct[s]
    if 'bologna' in s:
        return 'rq-bologna'
    if 'vegas' in s:
        return 'rq-vegas'
    if 'houston' in s:
        return 'rq-houston'
    if 'shenzhen' in s or 'shanghai-national-open' in s:
        return 'shenzhen-national-open-2026-03-22'
    return s


def normalize_decklists():
    short_to_full, name_to_full, full_ids = build_card_maps()
    fixed_event_ids = 0
    fixed_card_ids = 0
    unresolved_card_refs = []
    unresolved_event_refs = []

    for p in DECKS_DIR.glob('*.json'):
        deck = load_json(p)
        old_eid = deck.get('event_id')
        new_eid = canonical_event_id(old_eid)
        if new_eid != old_eid:
            deck['event_id'] = new_eid
            fixed_event_ids += 1

        for card in deck.get('cards', []):
            old_cid = (card.get('card_id') or '').lower()
            new_cid = old_cid
            if old_cid not in full_ids:
                if old_cid in short_to_full:
                    new_cid = short_to_full[old_cid]
                else:
                    nm = (card.get('name') or '').strip().lower()
                    if nm in name_to_full:
                        new_cid = name_to_full[nm]
            if new_cid != old_cid and new_cid:
                card['card_id'] = new_cid
                fixed_card_ids += 1
            if (card.get('card_id') or '').lower() not in full_ids:
                unresolved_card_refs.append({
                    'decklist_id': deck.get('decklist_id'),
                    'card_id': card.get('card_id'),
                    'name': card.get('name'),
                })
        write_json(p, deck)
        if deck.get('event_id') is None:
            unresolved_event_refs.append(deck.get('decklist_id'))
    return {
        'fixed_event_ids': fixed_event_ids,
        'fixed_card_ids': fixed_card_ids,
        'unresolved_card_refs': unresolved_card_refs,
        'unresolved_event_refs': unresolved_event_refs,
    }


def harden_events():
    event_ids = {p.stem for p in EVENTS_DIR.glob('*.json')}
    fixed = 0
    for p in EVENTS_DIR.glob('*.json'):
        event = load_json(p)
        if 'trust_tier' not in event:
            event['trust_tier'] = (event.get('source') or {}).get('trust_tier')
            fixed += 1
            write_json(p, event)
    return {'event_ids': sorted(event_ids), 'fixed_event_trust_tier': fixed, 'fixed_event_decklist_refs': 0}


def validate():
    full_card_ids = {p.stem.lower() for p in CARDS_DIR.glob('*.json')}
    canonical_event_ids = {p.stem for p in EVENTS_DIR.glob('*.json')}
    broken_event_refs = []
    broken_card_refs = []
    deck_counts = 0
    for p in DECKS_DIR.glob('*.json'):
        deck = load_json(p)
        deck_counts += 1
        eid = deck.get('event_id')
        if eid and eid not in canonical_event_ids:
            broken_event_refs.append({'decklist_id': deck.get('decklist_id'), 'event_id': eid})
        for card in deck.get('cards', []):
            cid = (card.get('card_id') or '').lower()
            if cid and cid not in full_card_ids:
                broken_card_refs.append({'decklist_id': deck.get('decklist_id'), 'card_id': cid, 'name': card.get('name')})
    event_broken_refs = []
    for p in EVENTS_DIR.glob('*.json'):
        event = load_json(p)
        for placement in event.get('placements', []):
            did = placement.get('decklist_id')
            if did and not (DECKS_DIR / f'{did}.json').exists():
                event_broken_refs.append({'event_id': event.get('event_id'), 'decklist_id': did})
    return {
        'decklist_count': deck_counts,
        'broken_deck_to_event_refs': broken_event_refs,
        'broken_deck_to_card_refs': broken_card_refs,
        'broken_event_to_deck_refs': event_broken_refs,
    }


def main():
    repair = normalize_decklists()
    events = harden_events()
    validation = validate()
    report = {
        'repair': {
            'fixed_event_ids': repair['fixed_event_ids'],
            'fixed_card_ids': repair['fixed_card_ids'],
            'fixed_event_trust_tier': events['fixed_event_trust_tier'],
            'fixed_event_decklist_refs': events['fixed_event_decklist_refs'],
        },
        'validation': {
            'decklist_count': validation['decklist_count'],
            'broken_deck_to_event_refs': len(validation['broken_deck_to_event_refs']),
            'broken_deck_to_card_refs': len(validation['broken_deck_to_card_refs']),
            'broken_event_to_deck_refs': len(validation['broken_event_to_deck_refs']),
            'sample_broken_deck_to_event_refs': validation['broken_deck_to_event_refs'][:20],
            'sample_broken_deck_to_card_refs': validation['broken_deck_to_card_refs'][:20],
            'sample_broken_event_to_deck_refs': validation['broken_event_to_deck_refs'][:20],
        },
    }
    write_json(REPORT, report)
    print(json.dumps(report, indent=2, ensure_ascii=False))


if __name__ == '__main__':
    main()
