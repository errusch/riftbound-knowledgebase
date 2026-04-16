#!/usr/bin/env python3.12
"""Normalize official event records and competitive deck records into canonical JSON.

Phase 1/2 objective:
- promote local structured official events into riftbound-kb/events/
- promote competitive decklists into riftbound-kb/decklists/
- preserve provenance and secondary-source labeling
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

ROOT = Path('/Users/eric/Documents/Playground')
EVENT_SRC = ROOT / 'data' / 'events' / 'official'
DECK_SRC = ROOT / 'data' / 'decks'
EVENT_OUT = ROOT / 'riftbound-kb' / 'events'
DECK_OUT = ROOT / 'riftbound-kb' / 'decklists'


def load_json(path: Path) -> dict[str, Any]:
    with path.open() as f:
        return json.load(f)


def normalize_source(src: dict[str, Any] | None, fallback_kind: str, fallback_name: str) -> dict[str, Any]:
    src = src or {}
    kind = src.get('kind') or fallback_kind
    tier_map = {
        'official': 'official',
        'community': 'trusted_secondary',
        'market': 'market',
    }
    return {
        'source_type': tier_map.get(kind, 'best_available'),
        'source_name': src.get('label') or src.get('name') or fallback_name,
        'source_url': src.get('url'),
        'source_date': src.get('publishedAt'),
        'retrieved_at': datetime.now(UTC).date().isoformat(),
        'trust_tier': tier_map.get(kind, 'best_available'),
        'notes': src.get('description'),
    }


def normalize_event(path: Path) -> dict[str, Any]:
    data = load_json(path)
    rec = data.get('record', {})
    decklists = data.get('decklists', [])
    event_id = rec.get('event_id') or rec.get('tid') or path.stem.replace('_', '-')
    placements = []
    best_of_legends = []
    for d in decklists:
        placement = d.get('placement')
        legend = d.get('legend')
        deck_id = f"{event_id}--{(legend or 'unknown').lower().replace(' ', '-')}-{placement}"
        placements.append({
            'place': placement,
            'player': d.get('player_name'),
            'legend': legend,
            'decklist_id': deck_id,
        })
        if d.get('deck_type') and 'best' in str(d.get('deck_type')).lower() and legend:
            if legend not in best_of_legends:
                best_of_legends.append(legend)
    source = {
        'source_type': 'best_available' if data.get('trust_level') == 'derived_verified' else 'unverified',
        'source_name': data.get('source_kind') or 'legacy_local_knowledge_db',
        'source_url': None,
        'source_date': data.get('source_date'),
        'retrieved_at': datetime.now(UTC).date().isoformat(),
        'trust_tier': 'best_available' if data.get('trust_level') == 'derived_verified' else 'unverified',
        'notes': f"upstream_path={data.get('source_path')} | upstream_status={data.get('status')}",
    }
    location = rec.get('location') or ''
    country = None
    city = None
    if location:
        bits = [b.strip() for b in location.split(',') if b.strip()]
        city = bits[0] if bits else None
        country = bits[-1] if len(bits) > 1 else None
    event_type = 'regional_qualifier' if 'regional qualifier' in (rec.get('event_name') or '').lower() else 'other_official_event'
    return {
        'event_id': event_id.replace('_', '-'),
        'event_type': event_type,
        'event_name': rec.get('event_name') or data.get('title'),
        'region': None,
        'city': city,
        'country': country,
        'start_date': rec.get('date_start'),
        'end_date': rec.get('date_end'),
        'coverage_kind': 'results',
        'placements': sorted(placements, key=lambda x: (x['place'] if x['place'] is not None else 9999, x['player'] or '')),
        'best_of_legends': best_of_legends,
        'source': source,
        'secondary_sources': [],
        'notes': f"player_count={rec.get('player_count')} | format={rec.get('format')} | decklist_count={rec.get('decklist_count')}",
    }


def normalize_deck(path: Path) -> dict[str, Any]:
    data = load_json(path)
    rec = data.get('record', {})
    event = rec.get('event', {})
    source = normalize_source(rec.get('decklistSource') or rec.get('eventPrimarySource'), data.get('source_kind') or 'best_available', data.get('title') or path.stem)
    secondary = [normalize_source(s, s.get('kind') or 'best_available', s.get('label') or 'secondary') for s in (rec.get('secondaryDeckSources') or [])]
    cards = []
    for section_name in ('mainboard', 'sideboard'):
        for item in rec.get(section_name, []) or []:
            resolved = item.get('resolvedCard') or {}
            code = item.get('cardCode')
            cards.append({
                'card_id': str(code).lower() if code else (resolved.get('id') or '').lower(),
                'card_code': code,
                'count': item.get('quantity'),
                'name': resolved.get('name'),
                'section': section_name,
            })
    decklist_id = rec.get('slug') or path.stem
    placement = rec.get('placementText')
    placement_num = None
    if isinstance(placement, str):
        digits = ''.join(ch for ch in placement if ch.isdigit())
        placement_num = int(digits) if digits else placement
    elif placement is not None:
        placement_num = placement
    return {
        'decklist_id': decklist_id,
        'event_id': (event.get('slug') or rec.get('event', {}).get('name') or '').replace('_', '-').replace(' ', '-').lower() or None,
        'player': rec.get('playerName'),
        'legend': (rec.get('legend') or {}).get('name') or 'Unknown',
        'placement': placement_num,
        'is_best_of_legend': 'best-of' in decklist_id.lower() or 'best of' in (rec.get('title') or '').lower(),
        'cards': cards,
        'source': source,
        'secondary_sources': secondary,
        'notes': f"format={rec.get('format')} | views={rec.get('views')} | mainboard={rec.get('cardCounts', {}).get('mainboard')} | sideboard={rec.get('cardCounts', {}).get('sideboard')}",
    }


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('w') as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
        f.write('\n')


def main() -> None:
    EVENT_OUT.mkdir(parents=True, exist_ok=True)
    DECK_OUT.mkdir(parents=True, exist_ok=True)

    for path in sorted(EVENT_SRC.glob('*.json')):
        payload = normalize_event(path)
        write_json(EVENT_OUT / f"{payload['event_id']}.json", payload)
        print(EVENT_OUT / f"{payload['event_id']}.json")

    for path in sorted(DECK_SRC.glob('*.json')):
        if 'precon/' in str(path):
            continue
        payload = normalize_deck(path)
        write_json(DECK_OUT / f"{payload['decklist_id']}.json", payload)
        print(DECK_OUT / f"{payload['decklist_id']}.json")


if __name__ == '__main__':
    main()
