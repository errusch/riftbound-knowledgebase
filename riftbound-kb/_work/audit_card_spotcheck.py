#!/usr/bin/env python3.12
import json, random, requests
from pathlib import Path

ROOT = Path('/Users/eric/Documents/Playground/riftbound-kb')
CARDS_DIR = ROOT / 'canon' / 'cards'
API = 'https://content.publishing.riotgames.com/publishing-content/v2.0/public/channel/riftbound_website/list/riftbound_gallery_cards?locale=en_US&from={offset}&limit=200'
REPORT = ROOT / '_work' / 'inventory' / 'card-spotcheck-report.json'

# fetch official source map once
items = []
for off in range(0, 5000, 200):
    data = requests.get(API.format(offset=off), timeout=30).json()['data']
    if not data:
        break
    items.extend(data)
official = {item['id']: item for item in items}

cards = [p for p in CARDS_DIR.glob('*.json') if p.name != 'index.json']
random.seed(42)
sample_paths = random.sample(cards, min(20, len(cards)))
results = []
for p in sample_paths:
    card = json.loads(p.read_text())
    src = official.get(card['card_id'])
    if not src:
        results.append({'card_id': card['card_id'], 'status': 'missing_from_official_feed'})
        continue
    checks = {
        'name': card.get('name') == src.get('name'),
        'public_code': card.get('public_code') == src.get('publicCode'),
        'set_code': card.get('set_code') == src.get('set', {}).get('value', {}).get('id'),
        'collector_number': str(card.get('collector_number')) == str(src.get('collectorNumber')),
    }
    results.append({'card_id': card['card_id'], 'checks': checks, 'all_pass': all(checks.values())})
summary = {
    'sample_size': len(results),
    'all_pass_count': sum(1 for r in results if r.get('all_pass')),
    'fail_count': sum(1 for r in results if not r.get('all_pass')),
    'results': results,
}
REPORT.write_text(json.dumps(summary, indent=2, ensure_ascii=False) + '\n')
print(json.dumps(summary, indent=2, ensure_ascii=False))
