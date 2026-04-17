import json, glob, os

os.chdir('/Users/eric/Documents/Playground/riftbound-kb')

# Cards audit
cards = glob.glob('canon/cards/*.json')
null_legality = 0
null_errata = 0
null_energy = 0
null_power = 0
null_might = 0
has_source = 0
no_source = 0
for c in cards:
    with open(c) as f:
        d = json.load(f)
    if d.get('legality') is None:
        null_legality += 1
    if d.get('errata') is None:
        null_errata += 1
    if d.get('energy') is None:
        null_energy += 1
    if d.get('power') is None:
        null_power += 1
    if d.get('might') is None:
        null_might += 1
    if d.get('source') or d.get('provenance'):
        has_source += 1
    else:
        no_source += 1
print("=== CARDS ===")
print(f"total: {len(cards)}")
print(f"null legality: {null_legality}")
print(f"null errata: {null_errata}")
print(f"null energy: {null_energy}")
print(f"null power: {null_power}")
print(f"null might: {null_might}")
print(f"has provenance: {has_source}")
print(f"no provenance: {no_source}")

# Decklists audit
decks = glob.glob('decklists/*.json')
has_src = 0; no_src = 0; has_event = 0; no_event = 0
for d in decks:
    if 'index.json' in d:
        continue
    with open(d) as f:
        data = json.load(f)
    if data.get('source') or data.get('provenance'):
        has_src += 1
    else:
        no_src += 1
    if data.get('event_id'):
        has_event += 1
    else:
        no_event += 1
print("\n=== DECKLISTS ===")
print(f"total: {has_src + no_src}")
print(f"has provenance: {has_src}")
print(f"no provenance: {no_src}")
print(f"has event_id: {has_event}")
print(f"no event_id: {no_event}")

# Events audit
events = glob.glob('events/canonical/*.json')
print("\n=== EVENTS ===")
print(f"total canonical: {len(events)}")
for e in sorted(events):
    with open(e) as f:
        data = json.load(f)
    src = data.get('source', data.get('provenance', {}))
    trust = src.get('trust_tier', 'MISSING') if isinstance(src, dict) else 'MISSING'
    decks_count = len(data.get('placements', []))
    eid = data.get('event_id', '?')
    print(f"  {eid:35s} trust={trust:20s} placements={decks_count}")

# Check events with no decklists linked
print("\n=== EVENTS WITH 0 PLACEMENTS ===")
for e in sorted(events):
    with open(e) as f:
        data = json.load(f)
    if len(data.get('placements', [])) == 0:
        print(f"  {data.get('event_id', '?')}")
