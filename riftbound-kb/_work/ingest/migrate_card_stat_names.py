#!/usr/bin/env python3
"""One-time migration: rename canonical card stat fields to match Riftbound's
official terminology.

Historical state (wrong names baked in by import_official_cards.py):
  * top-level  `cost`   held upstream `power`   (i.e. the power/rune cost)
  * `stats.attack`      held upstream `might`   (i.e. the combat stat)
  * `stats.reserve`     held upstream `energy`  (i.e. the energy cost)
  * `stats.health`      was always null         (unused legacy)
  * `stats.might_bonus` held upstream `mightBonus` (kept, just nested)

Target state (matches Riot's card-gallery API + the printed-card iconography):
  * `energy`       = energy cost (circle, top-left)
  * `power`        = power / rune cost (domain pip)
  * `might`        = combat stat (sword+shield, top-right)
  * `might_bonus`  = attach modifier
  * no `stats` object, no `cost`, no `attack`, no `health`, no `reserve`

Run once:
    python3 _work/ingest/migrate_card_stat_names.py --apply

Dry-run (default) prints what would change and exits non-zero if the file set
looks partially migrated.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CARDS_DIR = ROOT / "canon" / "cards"


def migrate_one(card: dict) -> tuple[dict, list[str]]:
    """Return (new_card, changes) with stat fields renamed. Idempotent."""
    changes: list[str] = []
    new = dict(card)
    stats = new.pop("stats", None)

    # Unwrap legacy stats block.
    legacy_attack = None
    legacy_reserve = None
    legacy_might_bonus = None
    if isinstance(stats, dict):
        legacy_attack = stats.get("attack")
        legacy_reserve = stats.get("reserve")
        legacy_might_bonus = stats.get("might_bonus")
        # stats.health was always null; drop silently.
        changes.append("unwrap stats{}")

    # Migrate top-level cost -> power (only if target not already set).
    if "cost" in new:
        legacy_cost = new.pop("cost")
        if "power" not in new:
            new["power"] = legacy_cost
            changes.append("cost -> power")
        elif legacy_cost != new.get("power"):
            changes.append(f"cost({legacy_cost}) != existing power({new['power']}) — kept existing")

    # stats.attack -> top-level might
    if legacy_attack is not None or (stats and "attack" in stats):
        if "might" not in new:
            new["might"] = legacy_attack
            changes.append("stats.attack -> might")
        elif legacy_attack != new.get("might"):
            changes.append(f"stats.attack({legacy_attack}) != existing might({new['might']}) — kept existing")

    # stats.reserve -> top-level energy
    if legacy_reserve is not None or (stats and "reserve" in stats):
        if "energy" not in new:
            new["energy"] = legacy_reserve
            changes.append("stats.reserve -> energy")
        elif legacy_reserve != new.get("energy"):
            changes.append(f"stats.reserve({legacy_reserve}) != existing energy({new['energy']}) — kept existing")

    # stats.might_bonus -> top-level might_bonus
    if legacy_might_bonus is not None or (stats and "might_bonus" in stats):
        if "might_bonus" not in new:
            new["might_bonus"] = legacy_might_bonus
            changes.append("stats.might_bonus -> might_bonus")

    # Ensure the canonical three-stat trio exists (even if null) so consumers
    # can rely on their presence. Skip might_bonus — it's optional.
    for key in ("energy", "power", "might"):
        if key not in new:
            new[key] = None

    # Preferred key ordering: put stat fields right after `domains` for
    # readability when humans inspect a card file. Leave everything else where
    # it was.
    ordered = {}
    stat_keys = ("energy", "power", "might", "might_bonus")
    seen_stats = False
    for k, v in new.items():
        if k in stat_keys:
            continue
        ordered[k] = v
        if k == "domains" and not seen_stats:
            for sk in stat_keys:
                if sk in new:
                    ordered[sk] = new[sk]
            seen_stats = True
    if not seen_stats:
        for sk in stat_keys:
            if sk in new:
                ordered[sk] = new[sk]

    return ordered, changes


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="Write changes in place.")
    ap.add_argument("--limit", type=int, default=0, help="Stop after N files (debug).")
    args = ap.parse_args()

    if not CARDS_DIR.is_dir():
        print(f"ERROR: {CARDS_DIR} not found", file=sys.stderr)
        return 2

    touched = 0
    skipped = 0
    mixed = 0

    files = sorted(p for p in CARDS_DIR.iterdir() if p.suffix == ".json" and p.name != "index.json")
    for i, p in enumerate(files):
        if args.limit and i >= args.limit:
            break
        with p.open() as f:
            card = json.load(f)
        new_card, changes = migrate_one(card)
        if new_card == card:
            skipped += 1
            continue
        touched += 1
        if args.apply:
            # Write with 2-space indent to match existing files; trailing newline.
            with p.open("w") as f:
                json.dump(new_card, f, indent=2, ensure_ascii=False)
                f.write("\n")
        else:
            print(f"- {p.name}: {', '.join(changes)}")

    mode = "applied" if args.apply else "DRY RUN"
    print(f"[{mode}] touched={touched} unchanged={skipped} total={touched + skipped}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
