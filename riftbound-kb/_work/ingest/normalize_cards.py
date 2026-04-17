#!/usr/bin/env python3.12
"""Promote sample Riftbound card records into canonical JSON.

This is intentionally conservative for Phase 1:
- reads legacy card records from data/cards/full/
- reads set metadata from data/sets/
- writes canonical records into riftbound-kb/canon/cards/
- preserves upstream provenance

Usage:
  python3.12 riftbound-kb/_work/ingest/normalize_cards.py \
    --card sfd-110a-221 --card sfd-039-221

  python3.12 riftbound-kb/_work/ingest/normalize_cards.py --all
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, UTC
from pathlib import Path
from typing import Any

ROOT = Path('/Users/eric/Documents/Playground')
SOURCE_DIR = ROOT / 'data' / 'cards' / 'full'
SET_DIR = ROOT / 'data' / 'sets'
OUT_DIR = ROOT / 'riftbound-kb' / 'canon' / 'cards'


def load_json(path: Path) -> dict[str, Any]:
    with path.open() as f:
        return json.load(f)


def load_set_map() -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for path in sorted(SET_DIR.glob('*.json')):
        data = load_json(path)
        record = data.get('record', {})
        set_id = record.get('set_id') or path.stem
        out[set_id] = record
    return out


def card_path(card_id: str) -> Path:
    return SOURCE_DIR / f'{card_id}.json'


def normalize_card(data: dict[str, Any], set_map: dict[str, dict[str, Any]]) -> dict[str, Any]:
    record = data.get('record', {})
    classification = record.get('classification', {})
    attrs = record.get('attributes', {})
    media = record.get('media', {})
    metadata = record.get('metadata', {})
    text = record.get('text', {})
    set_id = (record.get('set', {}) or {}).get('set_id')
    set_record = set_map.get(set_id or '', {})

    # Map upstream attribute names straight through. Riftbound names its stats
    # `energy`, `power`, `might`, `might_bonus`. See canon/rules/core-rules-v1-2.md.
    energy = attrs.get('energy')
    power = attrs.get('power')
    might = attrs.get('might')
    might_bonus = attrs.get('might_bonus')

    notes = []
    if classification.get('supertype'):
        notes.append(f"supertype={classification.get('supertype')}")
    if metadata.get('alternate_art'):
        notes.append('alternate_art=true')
    if metadata.get('signature'):
        notes.append('signature=true')

    source = {
        'source_type': 'best_available' if data.get('source_kind') == 'legacy_local_knowledge_db' else 'unverified',
        'source_name': data.get('source_kind') or 'unknown',
        'source_url': None,
        'source_date': data.get('source_date'),
        'retrieved_at': datetime.now(UTC).date().isoformat(),
        'trust_tier': 'best_available' if data.get('trust_level') == 'derived_verified' else 'unverified',
        'notes': f"upstream_path={data.get('source_path')} | upstream_trust={data.get('trust_level')} | upstream_status={data.get('status')}",
    }

    return {
        'card_id': record.get('riftbound_id') or data.get('id', '').removeprefix('card.'),
        'name': record.get('name') or data.get('title'),
        'set_code': set_id,
        'set_name': set_record.get('name') or (record.get('set', {}) or {}).get('label'),
        'collector_number': str(record.get('collector_number')) if record.get('collector_number') is not None else None,
        'public_code': record.get('public_code'),
        'card_type': classification.get('type'),
        'subtypes': [classification.get('supertype')] if classification.get('supertype') else [],
        'domains': classification.get('domain') or [],
        'energy': energy,
        'power': power,
        'might': might,
        'might_bonus': might_bonus,
        'text': text.get('plain') or text.get('rich') or '',
        'text_rich': text.get('rich'),
        'rarity': classification.get('rarity'),
        'image': {
            'path': None,
            'url': media.get('image_url'),
        },
        'artist': media.get('artist'),
        'accessibility_text': media.get('accessibility_text'),
        'legality': {
            'constructed': None,
            'limited': None,
            'notes': set_record.get('notes'),
        },
        'errata_links': [],
        'rulings_links': [],
        'source': source,
        'upstream': {
            'raw_id': data.get('id'),
            'record_id': record.get('id'),
            'tcgplayer_id': record.get('tcgplayer_id'),
            'tags': record.get('tags') or data.get('tags') or [],
            'orientation': record.get('orientation'),
            'metadata': metadata,
        },
        'notes': ' | '.join(notes) if notes else None,
    }


def write_card(card: dict[str, Any]) -> Path:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUT_DIR / f"{card['card_id']}.json"
    with path.open('w') as f:
        json.dump(card, f, indent=2, ensure_ascii=False)
        f.write('\n')
    return path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--card', action='append', help='Riftbound card id, e.g. sfd-110a-221')
    parser.add_argument('--all', action='store_true', help='Normalize all source card files')
    args = parser.parse_args()

    if not args.all and not args.card:
        raise SystemExit('Provide --card ... or --all')

    if args.all:
        card_ids = sorted(p.stem for p in SOURCE_DIR.glob('*.json'))
    else:
        card_ids = args.card or []

    set_map = load_set_map()
    for card_id in card_ids:
        src = card_path(card_id)
        if not src.exists():
            raise SystemExit(f'Missing source card file: {src}')
        normalized = normalize_card(load_json(src), set_map)
        out = write_card(normalized)
        print(out)


if __name__ == '__main__':
    main()
