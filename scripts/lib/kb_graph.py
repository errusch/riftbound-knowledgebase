#!/usr/bin/env python3
"""Graph builders and local query helpers for the Riftbound knowledgebase."""

from __future__ import annotations

import json
import re
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

from scripts.lib.kb_common import ROOT, detect_conflicts, detect_entities, load_json, now_iso, parse_frontmatter, slugify, write_json


OBJECT_META_FIELDS = [
    "id",
    "type",
    "title",
    "source_kind",
    "source_path",
    "source_date",
    "trust_level",
    "status",
    "tags",
]
JSON_RECORD_EXCLUDE = {"record", "rounds", "standings", "decklists", "history", "snapshots", "cards"}
TOKEN_RE = re.compile(r"[a-z0-9']+")
CARD_CODE_RE = re.compile(r"\b(?:OGN|OGS|SFD)-\d{3}\b", flags=re.IGNORECASE)
STOPWORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "called",
    "do",
    "does",
    "for",
    "from",
    "happens",
    "how",
    "if",
    "in",
    "is",
    "it",
    "of",
    "on",
    "or",
    "the",
    "to",
    "what",
    "when",
    "where",
    "which",
    "with",
}


@dataclass
class KBObject:
    meta: dict[str, Any]
    path: str
    scope: str
    body: str
    payload: dict[str, Any] | None = None

    def index_entry(self) -> dict[str, Any]:
        entry = {field: self.meta.get(field) for field in OBJECT_META_FIELDS}
        entry["path"] = self.path
        entry["scope"] = self.scope
        return entry

    @property
    def object_id(self) -> str:
        return str(self.meta.get("id", self.path))


def repository_paths() -> Iterable[Path]:
    for root_name in ("canon", "analysis", "data"):
        root = ROOT / root_name
        if root.exists():
            yield root


def normalize_space(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def flatten_strings(value: Any, depth: int = 0, limit: int = 600) -> list[str]:
    if depth > 4:
        return []
    if value is None:
        return []
    if isinstance(value, str):
        text = normalize_space(value)
        return [text[:limit]] if text else []
    if isinstance(value, (int, float, bool)):
        return [str(value)]
    if isinstance(value, list):
        chunks: list[str] = []
        for item in value[:50]:
            chunks.extend(flatten_strings(item, depth + 1, limit))
        return chunks
    if isinstance(value, dict):
        chunks = []
        for key, item in value.items():
            if key in {"image_url", "imageUrl"}:
                continue
            chunks.append(str(key))
            chunks.extend(flatten_strings(item, depth + 1, limit))
        return chunks
    return []


def markdown_objects() -> list[KBObject]:
    objects: list[KBObject] = []
    for scope in ("canon", "analysis"):
        root = ROOT / scope
        if not root.exists():
            continue
        for path in sorted(root.rglob("*.md")):
            raw = path.read_text(encoding="utf-8")
            meta, body = parse_frontmatter(raw)
            if not meta.get("id") or not meta.get("type") or not meta.get("title"):
                continue
            objects.append(
                KBObject(
                    meta=meta,
                    path=str(path.relative_to(ROOT)),
                    scope=scope,
                    body=body,
                )
            )
    return objects


def taxonomy_entities() -> list[KBObject]:
    taxonomy_root = ROOT / "data" / "taxonomy"
    objects: list[KBObject] = []
    if not taxonomy_root.exists():
        return objects
    for path in sorted(taxonomy_root.glob("*.json")):
        payload = load_json(path, [])
        if not isinstance(payload, list):
            continue
        category = path.stem.rstrip("s")
        source_date = path.stat().st_mtime
        for item in payload:
            if not isinstance(item, dict) or not item.get("name"):
                continue
            meta = {
                "id": f"taxonomy.{category}.{slugify(item['name'])}",
                "type": "taxonomy_entity",
                "title": item["name"],
                "source_kind": "local_taxonomy_file",
                "source_path": str(path),
                "source_date": source_date,
                "trust_level": "derived_verified",
                "status": "reviewed",
                "tags": ["taxonomy", category, *item.get("aliases", [])[:8]],
            }
            body = json.dumps(item, ensure_ascii=True, indent=2)
            objects.append(
                KBObject(
                    meta=meta,
                    path=str(path.relative_to(ROOT)),
                    scope="data",
                    body=body,
                    payload=item,
                )
            )
    return objects


def synthetic_index_objects() -> list[KBObject]:
    objects: list[KBObject] = []

    rules_atoms = load_json(ROOT / "data" / "indexes" / "rules_atoms.json", [])
    for atom in rules_atoms:
        if not isinstance(atom, dict) or not atom.get("id"):
            continue
        meta = {
            "id": atom["id"],
            "type": "rule_atom",
            "title": f"Rule {atom.get('rule_code', 'unknown')}",
            "source_kind": "generated_rules_atom_index",
            "source_path": atom.get("source_path", "data/indexes/rules_atoms.json"),
            "source_date": "generated",
            "trust_level": atom.get("trust_level", "official"),
            "status": "reviewed",
            "tags": ["rule-atom", atom.get("document", "unknown"), atom.get("rule_code", "unknown")],
        }
        objects.append(
            KBObject(
                meta=meta,
                path="data/indexes/rules_atoms.json",
                scope="data",
                body=atom.get("text", ""),
                payload=atom,
            )
        )

    conflicts = load_json(ROOT / "data" / "indexes" / "derived_conflicts.json", [])
    for conflict in conflicts:
        if not isinstance(conflict, dict) or not conflict.get("id"):
            continue
        conflict_key = slugify(f"{conflict.get('object_id', 'object')}-{conflict['id']}")
        meta = {
            "id": f"conflict.{conflict_key}",
            "type": "conflict_record",
            "title": conflict.get("title", conflict["id"]),
            "source_kind": "generated_conflict_index",
            "source_path": conflict.get("object_path", "data/indexes/derived_conflicts.json"),
            "source_date": "generated",
            "trust_level": "conflicted",
            "status": "reviewed",
            "tags": ["conflict", conflict["id"]],
        }
        objects.append(
            KBObject(
                meta=meta,
                path="data/indexes/derived_conflicts.json",
                scope="data",
                body=normalize_space(
                    f"{conflict.get('message', '')} canonical value {conflict.get('canonical_value', '')}"
                ),
                payload=conflict,
            )
        )

    return objects


def json_objects() -> list[KBObject]:
    objects: list[KBObject] = []
    for root in repository_paths():
        for path in sorted(root.rglob("*.json")):
            relative = path.relative_to(ROOT)
            rel_text = str(relative)
            if rel_text.startswith("data/indexes/"):
                continue
            if rel_text.startswith("data/taxonomy/"):
                continue
            if path.name.endswith(".claims.json"):
                continue
            payload = load_json(path)
            if not isinstance(payload, dict):
                continue
            if not payload.get("id") or not payload.get("type") or not payload.get("title"):
                continue
            body_parts = flatten_strings({k: v for k, v in payload.items() if k not in JSON_RECORD_EXCLUDE})
            if "record" in payload:
                body_parts.extend(flatten_strings(payload["record"]))
            meta = {field: payload.get(field) for field in OBJECT_META_FIELDS}
            scope = relative.parts[0]
            objects.append(
                KBObject(
                    meta=meta,
                    path=rel_text,
                    scope=scope,
                    body="\n".join(body_parts),
                    payload=payload,
                )
            )
    return objects


def load_objects() -> list[KBObject]:
    objects = markdown_objects()
    objects.extend(json_objects())
    objects.extend(taxonomy_entities())
    objects.extend(synthetic_index_objects())
    unique: dict[str, KBObject] = {}
    for obj in objects:
        unique[obj.object_id] = obj
    return sorted(unique.values(), key=lambda item: (item.scope, item.meta.get("type", ""), item.meta.get("title", "")))


def load_object_index() -> tuple[list[KBObject], dict[str, KBObject]]:
    objects = load_objects()
    return objects, {obj.object_id: obj for obj in objects}


def legend_alias_map() -> dict[str, str]:
    mapping: dict[str, str] = {}
    for item in load_json(ROOT / "data" / "taxonomy" / "legends.json", []):
        if not isinstance(item, dict) or not item.get("name"):
            continue
        canonical = str(item["name"]).strip()
        mapping[canonical.lower()] = canonical
        for alias in item.get("aliases", []):
            mapping[str(alias).strip().lower()] = canonical
    return mapping


def canonicalize_legend_name(value: str | None) -> str | None:
    if not value:
        return None
    cleaned = str(value).strip()
    if not cleaned:
        return None
    mapping = legend_alias_map()
    return mapping.get(cleaned.lower(), cleaned)


def provenance_label(meta: dict[str, Any]) -> str:
    source_kind = str(meta.get("source_kind", ""))
    trust_level = str(meta.get("trust_level", ""))
    if trust_level == "conflicted":
        return "conflicted"
    if source_kind == "official_local_file" or trust_level == "official":
        return "official local"
    if "legacy_local_knowledge_db" in source_kind or source_kind == "legacy_local_knowledge_db":
        return "legacy local"
    return "derived local"


def token_set(text: str) -> set[str]:
    return {token for token in TOKEN_RE.findall(text.lower()) if len(token) > 1 and token not in STOPWORDS}


def object_text(obj: KBObject) -> str:
    tags = " ".join(obj.meta.get("tags", []) or [])
    title = obj.meta.get("title", "")
    return normalize_space(f"{title}\n{tags}\n{obj.body}")


def score_object(obj: KBObject, query: str) -> int:
    haystack = object_text(obj).lower()
    title = str(obj.meta.get("title", "")).lower()
    tags = " ".join(obj.meta.get("tags", []) or []).lower()
    query_terms = token_set(query)
    if not query_terms:
        return 0
    score = 0
    for term in query_terms:
        if term in title:
            score += 10
        if term in tags:
            score += 6
        if term in haystack:
            score += 2
    normalized_query = normalize_space(query.lower())
    if normalized_query and normalized_query in haystack:
        score += 15
    return score


def search_objects(
    objects: list[KBObject],
    query: str,
    *,
    scopes: set[str] | None = None,
    types: set[str] | None = None,
    limit: int = 8,
) -> list[KBObject]:
    ranked: list[tuple[int, KBObject]] = []
    for obj in objects:
        if scopes and obj.scope not in scopes:
            continue
        if types and str(obj.meta.get("type")) not in types:
            continue
        score = score_object(obj, query)
        if score > 0:
            ranked.append((score, obj))
    ranked.sort(key=lambda item: (-item[0], item[1].meta.get("title", "")))
    return [obj for _, obj in ranked[:limit]]


def parse_card_aliases(card_payload: dict[str, Any]) -> list[str]:
    record = card_payload.get("record", {})
    aliases = {
        str(card_payload.get("title", "")).lower(),
        str(record.get("riftbound_id", "")).lower(),
        str(record.get("public_code", "")).lower(),
        str(record.get("metadata", {}).get("clean_name", "")).replace("-", " ").lower(),
    }
    for tag in record.get("tags", [])[:8]:
        aliases.add(str(tag).lower())
    return sorted(alias for alias in aliases if alias)


def find_card_objects(objects: list[KBObject]) -> list[KBObject]:
    return [obj for obj in objects if obj.meta.get("type") == "card_record"]


def find_ruling_objects(objects: list[KBObject]) -> list[KBObject]:
    return [obj for obj in objects if obj.meta.get("type") == "ruling_record"]


def card_lookup_entries(objects: list[KBObject]) -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []
    for obj in find_card_objects(objects):
        payload = obj.payload or {}
        record = payload.get("record", {})
        for alias in parse_card_aliases(payload):
            entries.append(
                {
                    "lookup_key": alias,
                    "card_id": obj.object_id,
                    "title": obj.meta.get("title"),
                    "path": obj.path,
                    "public_code": record.get("public_code"),
                    "riftbound_id": record.get("riftbound_id"),
                }
            )
    return sorted(entries, key=lambda item: (item["lookup_key"], item["card_id"]))


def legend_lookup_entries() -> list[dict[str, Any]]:
    payload = load_json(ROOT / "data" / "taxonomy" / "legends.json", [])
    entries: list[dict[str, Any]] = []
    for item in payload:
        if not isinstance(item, dict) or not item.get("name"):
            continue
        entries.append({"lookup_key": item["name"].lower(), "legend": item["name"]})
        for alias in item.get("aliases", []):
            entries.append(
                {
                    "lookup_key": alias.lower(),
                    "legend": item["name"],
                }
            )
    return sorted(entries, key=lambda item: (item["lookup_key"], item["legend"]))


def build_card_name_maps(cards: list[KBObject]) -> tuple[dict[str, str], dict[str, list[str]]]:
    name_to_id: dict[str, str] = {}
    id_to_aliases: dict[str, list[str]] = {}
    for card in cards:
        aliases = parse_card_aliases(card.payload or {})
        id_to_aliases[card.object_id] = aliases
        for alias in aliases:
            name_to_id.setdefault(alias, card.object_id)
    return name_to_id, id_to_aliases


def detect_card_mentions(text: str, name_to_id: dict[str, str]) -> list[str]:
    lowered = text.lower()
    mentions: set[str] = set()
    for code in CARD_CODE_RE.findall(text):
        code_key = code.lower()
        if code_key in name_to_id:
            mentions.add(name_to_id[code_key])
    for alias, card_id in name_to_id.items():
        if len(alias) < 5:
            continue
        if alias in lowered:
            mentions.add(card_id)
    return sorted(mentions)


def group_conflicts_by_topic(conflicts: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for conflict in conflicts:
        topic = str(conflict.get("id", "unknown")).split(".", 1)[0]
        grouped[topic].append(conflict)
    return [
        {
            "topic": topic,
            "count": len(items),
            "items": sorted(items, key=lambda item: (item.get("id", ""), item.get("object_id", ""))),
        }
        for topic, items in sorted(grouped.items())
    ]


def build_cross_references(objects: list[KBObject]) -> dict[str, Any]:
    cards = find_card_objects(objects)
    rulings = find_ruling_objects(objects)
    card_name_to_id, _ = build_card_name_maps(cards)
    card_to_rulings: dict[str, list[str]] = defaultdict(list)
    card_to_guides: dict[str, list[str]] = defaultdict(list)
    legend_to_decks: dict[str, list[str]] = defaultdict(list)
    legend_to_matchups: dict[str, list[str]] = defaultdict(list)
    event_to_top_lists: dict[str, list[str]] = defaultdict(list)
    battlefield_to_mentions: dict[str, list[str]] = defaultdict(list)
    concept_to_vods: dict[str, list[str]] = defaultdict(list)
    graph_edges: list[dict[str, str]] = []
    vod_links: list[dict[str, Any]] = []

    for ruling in rulings:
        record = (ruling.payload or {}).get("record", {})
        card_name = str(record.get("card_name", "")).lower()
        card_id = card_name_to_id.get(card_name)
        if card_id:
            card_to_rulings[card_id].append(ruling.object_id)
            graph_edges.append({"source": card_id, "target": ruling.object_id, "kind": "has_ruling"})

    official_decklists = load_json(ROOT / "data" / "indexes" / "official_decklists.json", [])
    for item in official_decklists:
        legend = canonicalize_legend_name(item.get("legend") or item.get("champion"))
        if legend:
            legend_to_decks[str(legend)].append(item["id"])
        event_id = item.get("event_id")
        if event_id:
            event_to_top_lists[str(event_id)].append(item["id"])

    for obj in objects:
        text = object_text(obj)
        entities = detect_entities(text)
        for battlefield in entities.get("battlefields", []):
            battlefield_to_mentions[battlefield].append(obj.object_id)
            graph_edges.append({"source": obj.object_id, "target": f"taxonomy.battlefield.{slugify(battlefield)}", "kind": "mentions_battlefield"})

        if obj.path.startswith("analysis/videos/"):
            for concept in entities.get("concepts", []):
                concept_to_vods[concept].append(obj.object_id)
                graph_edges.append({"source": obj.object_id, "target": f"taxonomy.concept.{slugify(concept)}", "kind": "mentions_concept"})

            mentioned_cards = detect_card_mentions(text, card_name_to_id)
            linked_rulings = sorted({rid for cid in mentioned_cards for rid in card_to_rulings.get(cid, [])})
            conflict_hits = detect_conflicts(text)
            vod_links.append(
                {
                    "object_id": obj.object_id,
                    "path": obj.path,
                    "cards": mentioned_cards,
                    "rulings": linked_rulings,
                    "concepts": entities.get("concepts", []),
                    "battlefields": entities.get("battlefields", []),
                    "legends": entities.get("legends", []),
                    "conflicts": [item["id"] for item in conflict_hits],
                }
            )
            for card_id in mentioned_cards:
                graph_edges.append({"source": obj.object_id, "target": card_id, "kind": "mentions_card"})
            for ruling_id in linked_rulings:
                graph_edges.append({"source": obj.object_id, "target": ruling_id, "kind": "references_ruling"})

        if obj.path.startswith("analysis/guides/") or obj.path.startswith("analysis/articles/") or obj.path.startswith("analysis/community/"):
            for card_id in detect_card_mentions(text, card_name_to_id):
                card_to_guides[card_id].append(obj.object_id)
                graph_edges.append({"source": obj.object_id, "target": card_id, "kind": "mentions_card"})

        if obj.meta.get("type") == "competitive_record" and obj.path.startswith("data/decks/"):
            record = (obj.payload or {}).get("record", {})
            legend = record.get("legend", {}).get("name") if isinstance(record.get("legend"), dict) else None
            legend = canonicalize_legend_name(legend or record.get("legend"))
            if legend:
                legend_to_decks[str(legend)].append(obj.object_id)
                graph_edges.append({"source": str(legend), "target": obj.object_id, "kind": "has_deck"})
            event_slug = record.get("event", {}).get("slug") if isinstance(record.get("event"), dict) else None
            if event_slug:
                event_to_top_lists[f"event.{event_slug}"].append(obj.object_id)
                graph_edges.append({"source": f"event.{event_slug}", "target": obj.object_id, "kind": "top_list"})

        if obj.path.startswith("analysis/matchups/"):
            for legend in entities.get("legends", []):
                canonical_legend = canonicalize_legend_name(legend) or legend
                legend_to_matchups[canonical_legend].append(obj.object_id)
                graph_edges.append({"source": canonical_legend, "target": obj.object_id, "kind": "has_matchup"})

    conflicts = load_json(ROOT / "data" / "indexes" / "derived_conflicts.json", [])
    conflicts_by_topic = group_conflicts_by_topic(conflicts)

    return {
        "card_to_rulings": {key: sorted(set(value)) for key, value in sorted(card_to_rulings.items())},
        "card_to_guides": {key: sorted(set(value)) for key, value in sorted(card_to_guides.items())},
        "legend_to_decks": {key: sorted(set(value)) for key, value in sorted(legend_to_decks.items())},
        "legend_to_matchups": {key: sorted(set(value)) for key, value in sorted(legend_to_matchups.items())},
        "event_to_top_lists": {key: sorted(set(value)) for key, value in sorted(event_to_top_lists.items())},
        "battlefield_to_mentions": {key: sorted(set(value)) for key, value in sorted(battlefield_to_mentions.items())},
        "concept_to_vods": {key: sorted(set(value)) for key, value in sorted(concept_to_vods.items())},
        "graph_edges": sorted(graph_edges, key=lambda item: (item["kind"], item["source"], item["target"])),
        "conflicts_by_topic": conflicts_by_topic,
        "vod_links": sorted(vod_links, key=lambda item: item["object_id"]),
    }


def build_core_object_indexes(objects: list[KBObject]) -> dict[str, list[dict[str, Any]]]:
    all_objects = [obj.index_entry() for obj in objects]
    canon_objects = [obj.index_entry() for obj in objects if obj.scope == "canon"]
    analysis_objects = [obj.index_entry() for obj in objects if obj.scope == "analysis"]
    data_objects = [obj.index_entry() for obj in objects if obj.scope == "data"]
    videos = [
        obj.index_entry()
        for obj in objects
        if obj.path.startswith("analysis/videos/") and obj.meta.get("type") in {"analysis_note", "vod_review"}
    ]
    return {
        "all_objects": all_objects,
        "canon_objects": canon_objects,
        "analysis_objects": analysis_objects,
        "data_objects": data_objects,
        "videos": videos,
    }


def build_meta_snapshot_payload(objects: list[KBObject], snapshot_date: str | None = None) -> dict[str, Any]:
    snapshot_date = snapshot_date or now_iso()[:10]
    legend_stats: dict[str, dict[str, Any]] = defaultdict(
        lambda: {
            "legend": "",
            "competitive_decks": 0,
            "official_lists": 0,
            "event_ids": set(),
            "best_finish": None,
            "latest_tier": None,
            "legacy_sources": set(),
        }
    )

    for obj in objects:
        if obj.meta.get("type") == "competitive_record" and obj.path.startswith("data/decks/"):
            record = (obj.payload or {}).get("record", {})
            legend = record.get("legend", {}).get("name") if isinstance(record.get("legend"), dict) else record.get("legend")
            legend = canonicalize_legend_name(legend)
            if not legend:
                continue
            stats = legend_stats[str(legend)]
            stats["legend"] = str(legend)
            stats["competitive_decks"] += 1
            event_slug = record.get("event", {}).get("slug") if isinstance(record.get("event"), dict) else None
            if event_slug:
                stats["event_ids"].add(f"event.{event_slug}")
            placement = record.get("placementText")
            if placement and stats["best_finish"] is None:
                stats["best_finish"] = placement

        if obj.meta.get("type") == "event_record" and obj.path.startswith("data/events/official/"):
            payload = obj.payload or {}
            for deck in payload.get("decklists", []):
                legend = canonicalize_legend_name(deck.get("legend"))
                if not legend:
                    continue
                stats = legend_stats[str(legend)]
                stats["legend"] = str(legend)
                stats["official_lists"] += 1
                stats["event_ids"].add(obj.object_id)
                placement = deck.get("placement")
                if placement is not None and stats["best_finish"] is None:
                    stats["best_finish"] = str(placement)

        if obj.meta.get("type") == "meta_snapshot" and obj.path.startswith("data/meta-tiers/"):
            record = (obj.payload or {}).get("record", {})
            legend = canonicalize_legend_name(record.get("legend"))
            snapshots = record.get("snapshots", [])
            if legend and snapshots:
                stats = legend_stats[str(legend)]
                stats["legend"] = str(legend)
                latest = snapshots[-1]
                stats["latest_tier"] = latest.get("tier")
                if latest.get("source"):
                    stats["legacy_sources"].add(str(latest.get("source")))

    legends = []
    for legend, stats in sorted(legend_stats.items()):
        legends.append(
            {
                "legend": legend,
                "competitive_decks": stats["competitive_decks"],
                "official_lists": stats["official_lists"],
                "event_count": len(stats["event_ids"]),
                "best_finish": stats["best_finish"],
                "latest_tier": stats["latest_tier"],
                "legacy_sources": sorted(stats["legacy_sources"]),
            }
        )

    legends.sort(key=lambda item: (-item["competitive_decks"], -item["official_lists"], item["legend"]))
    return {
        "id": f"meta.generated.{snapshot_date}",
        "type": "meta_snapshot",
        "title": f"Generated meta snapshot {snapshot_date}",
        "source_kind": "generated_local_meta_summary",
        "source_path": str(ROOT / "data" / "meta" / f"{snapshot_date}.json"),
        "source_date": snapshot_date,
        "trust_level": "derived_unverified",
        "status": "reviewed",
        "tags": ["meta-generated", snapshot_date],
        "record": {
            "snapshot_date": snapshot_date,
            "legends": legends,
        },
    }


def build_quality_report(objects: list[KBObject], conflicts_by_topic: list[dict[str, Any]]) -> dict[str, Any]:
    draft_objects = []
    derived_unverified_by_type: dict[str, list[dict[str, Any]]] = defaultdict(list)

    for obj in objects:
        entry = {
            "id": obj.object_id,
            "type": obj.meta.get("type"),
            "title": obj.meta.get("title"),
            "path": obj.path,
            "scope": obj.scope,
            "trust_level": obj.meta.get("trust_level"),
            "status": obj.meta.get("status"),
            "provenance": provenance_label(obj.meta),
        }
        if obj.meta.get("status") == "draft":
            draft_objects.append(entry)
        if obj.meta.get("trust_level") == "derived_unverified":
            derived_unverified_by_type[str(obj.meta.get("type", "unknown"))].append(entry)

    report = {
        "draft_objects": sorted(draft_objects, key=lambda item: (item["type"] or "", item["title"] or "")),
        "derived_unverified_by_type": {
            key: {
                "count": len(items),
                "objects": sorted(items, key=lambda item: item["title"] or "")[:50],
            }
            for key, items in sorted(derived_unverified_by_type.items())
        },
        "conflicted_by_topic": conflicts_by_topic,
    }
    return report


def write_meta_snapshot(snapshot_payload: dict[str, Any]) -> tuple[Path, Path]:
    snapshot_date = snapshot_payload["record"]["snapshot_date"]
    data_path = ROOT / "data" / "meta" / f"{snapshot_date}.json"
    analysis_path = ROOT / "analysis" / "meta" / f"{snapshot_date}.md"
    write_json(data_path, snapshot_payload)
    top_legends = snapshot_payload["record"]["legends"][:10]
    lines = [
        "## Summary",
        f"Generated local meta snapshot for {snapshot_date}.",
        "",
        "## Top Legends",
    ]
    if top_legends:
        for item in top_legends:
            lines.append(
                f"- {item['legend']}: {item['competitive_decks']} competitive decks, {item['official_lists']} official lists, tier {item['latest_tier'] or 'unknown'}"
            )
    else:
        lines.append("- No legend data available.")
    body = "\n".join(lines)
    meta = {field: snapshot_payload.get(field) for field in OBJECT_META_FIELDS}
    analysis_text = "---\n"
    for field, value in meta.items():
        if isinstance(value, list):
            analysis_text += f"{field}:\n"
            for item in value:
                analysis_text += f"  - {item}\n"
        else:
            analysis_text += f"{field}: {value}\n"
    analysis_text += f"---\n\n{body}\n"
    analysis_path.parent.mkdir(parents=True, exist_ok=True)
    analysis_path.write_text(analysis_text, encoding="utf-8")
    return data_path, analysis_path


def build_meta_snapshot_index() -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    meta_root = ROOT / "data" / "meta"
    if not meta_root.exists():
        return items
    for path in sorted(meta_root.glob("*.json")):
        payload = load_json(path, {})
        if not isinstance(payload, dict):
            continue
        items.append(
            {
                "id": payload.get("id"),
                "title": payload.get("title"),
                "source_date": payload.get("source_date"),
                "path": str(path.relative_to(ROOT)),
                "legend_count": len(payload.get("record", {}).get("legends", [])),
            }
        )
    return items


def build_graph_indexes() -> dict[str, Any]:
    objects = load_objects()
    object_indexes = build_core_object_indexes(objects)
    cross_refs = build_cross_references(objects)
    cards_lookup = card_lookup_entries(objects)
    legends_lookup = legend_lookup_entries()
    meta_snapshots = build_meta_snapshot_index()
    quality_report = build_quality_report(objects, cross_refs["conflicts_by_topic"])

    indexes = {
        **object_indexes,
        "graph_edges": cross_refs["graph_edges"],
        "card_to_rulings": cross_refs["card_to_rulings"],
        "card_to_guides": cross_refs["card_to_guides"],
        "legend_to_decks": cross_refs["legend_to_decks"],
        "legend_to_matchups": cross_refs["legend_to_matchups"],
        "event_to_top_lists": cross_refs["event_to_top_lists"],
        "battlefield_to_mentions": cross_refs["battlefield_to_mentions"],
        "concept_to_vods": cross_refs["concept_to_vods"],
        "conflicts_by_topic": cross_refs["conflicts_by_topic"],
        "cards_lookup": cards_lookup,
        "legend_lookup": legends_lookup,
        "meta_snapshots": meta_snapshots,
        "vod_links": cross_refs["vod_links"],
        "quality_report": quality_report,
    }

    index_root = ROOT / "data" / "indexes"
    for name, payload in indexes.items():
        write_json(index_root / f"{name}.json", payload)
    return indexes


def short_snippet(text: str, query: str, max_length: int = 240) -> str:
    normalized = normalize_space(text)
    if not normalized:
        return ""
    lowered = normalized.lower()
    query_terms = [term for term in TOKEN_RE.findall(query.lower()) if len(term) > 1]
    if not query_terms:
        return normalized[:max_length]
    positions = [lowered.find(term) for term in query_terms if lowered.find(term) >= 0]
    if not positions:
        return normalized[:max_length]
    start = max(0, min(positions) - 60)
    snippet = normalized[start : start + max_length].strip()
    if start > 0:
        snippet = "..." + snippet
    return snippet
