#!/usr/bin/env python3.12
"""Sync canonical event placement decklist_id fields to existing canonical decklist files by event_id+legend+placement."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path('/Users/eric/Documents/Playground/riftbound-kb')
EVENTS = ROOT / 'events' / 'canonical'
DECKS = ROOT / 'decklists'


def load_json(path: Path):
    return json.loads(path.read_text())


def write_json(path: Path, payload):
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + '\n')


def norm_legend(text: str | None) -> str:
    return re.sub(r'[^a-z0-9]+', '-', (text or '').lower()).strip('-')


def norm_place(place):
    if isinstance(place, int):
        return place
    if isinstance(place, str):
        if place.lower() == 'winner':
            return 1
        m = re.search(r'\d+', place)
        return int(m.group()) if m else place
    return place


def main():
    index = {}
    for p in DECKS.glob('*.json'):
        d = load_json(p)
        key = (d.get('event_id'), norm_legend(d.get('legend')), norm_place(d.get('placement')))
        index[key] = d.get('decklist_id') or p.stem
    fixed = 0
    for p in EVENTS.glob('*.json'):
        e = load_json(p)
        eid = e.get('event_id')
        changed = False
        for placement in e.get('placements', []):
            key = (eid, norm_legend(placement.get('legend')), norm_place(placement.get('place')))
            did = index.get(key)
            if did and placement.get('decklist_id') != did:
                placement['decklist_id'] = did
                fixed += 1
                changed = True
        if changed:
            write_json(p, e)
            print(p)
    print(json.dumps({'fixed': fixed}, indent=2))


if __name__ == '__main__':
    main()
