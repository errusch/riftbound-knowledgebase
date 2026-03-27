#!/usr/bin/env python3
"""CLI commands for the local Riftbound knowledgebase."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from scripts.lib.kb_common import ROOT, now_iso, rebuild_indexes, write_json, write_markdown
from scripts.lib.kb_graph import (
    build_meta_snapshot_payload,
    canonicalize_legend_name,
    load_object_index,
    object_text,
    provenance_label,
    score_object,
    search_objects,
    short_snippet,
    summary_claim_texts,
    token_set,
    verification_record,
    write_meta_snapshot,
)
from scripts.lib.kb_vod import refresh_video_artifacts


def load_index(name: str, default: Any) -> Any:
    path = ROOT / "data" / "indexes" / f"{name}.json"
    if not path.exists():
        rebuild_indexes()
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def ensure_graph_ready() -> None:
    if not (ROOT / "data" / "indexes" / "all_objects.json").exists():
        rebuild_indexes()


def normalize_legend(value: str) -> str:
    legend_lookup = load_index("legend_lookup", [])
    lookup = value.lower().strip()
    for item in legend_lookup:
        if item.get("lookup_key") == lookup:
            return item["legend"]
    return canonicalize_legend_name(value.strip()) or value.strip()


def resolve_card(query: str, object_map: dict[str, Any]) -> str | None:
    cards_lookup = load_index("cards_lookup", [])
    normalized = query.lower().strip()
    exact = next((item["card_id"] for item in cards_lookup if item.get("lookup_key") == normalized), None)
    if exact:
        return exact
    partial = [item["card_id"] for item in cards_lookup if normalized in item.get("lookup_key", "")]
    if partial:
        return partial[0]
    for object_id, obj in object_map.items():
        if obj.meta.get("type") == "card_record" and normalized in str(obj.meta.get("title", "")).lower():
            return object_id
    return None


def format_citation(obj: Any) -> str:
    badge = provenance_label(obj.meta)
    return f"{obj.meta.get('id')} [{badge}; {obj.path}]"


def supported_claim_texts(obj: Any) -> list[str]:
    return summary_claim_texts(obj.meta)


def best_supported_claim(obj: Any, query: str, *, allow_fallback: bool = True) -> str | None:
    claims = supported_claim_texts(obj)
    if not claims:
        return None
    query_terms = token_set(query)
    ranked: list[tuple[int, str]] = []
    for claim in claims:
        lowered = claim.lower()
        score = sum(1 for term in query_terms if term in lowered)
        ranked.append((score, claim))
    ranked.sort(key=lambda item: (-item[0], item[1]))
    if ranked and ranked[0][0] > 0:
        return ranked[0][1]
    return ranked[0][1] if ranked and allow_fallback else None


def display_text(obj: Any, query: str) -> str:
    claim = best_supported_claim(obj, query)
    if claim:
        return claim
    return obj.body


def official_decklist_lookup() -> dict[str, dict[str, Any]]:
    return {item["id"]: item for item in load_index("official_decklists", [])}


def deck_event_line(deck_id: str, object_map: dict[str, Any], official_lookup: dict[str, dict[str, Any]]) -> str:
    if deck_id.startswith("official_decklist."):
        item = official_lookup.get(deck_id, {})
        placement = item.get("placement", "unknown")
        return f"{item.get('title', deck_id)} (official list, placement {placement})"
    obj = object_map.get(deck_id)
    if obj is None:
        return deck_id
    payload = obj.payload or {}
    record = payload.get("record", {})
    placement = record.get("placementText") or record.get("placement") or "unknown"
    event_name = record.get("event", {}).get("name") if isinstance(record.get("event"), dict) else None
    event_name = event_name or payload.get("title")
    return f"{obj.meta.get('title')} ({event_name}, placement {placement})"


def latest_generated_meta() -> dict[str, Any] | None:
    items = load_index("meta_snapshots", [])
    if not items:
        return None
    latest = sorted(items, key=lambda item: item.get("source_date", ""), reverse=True)[0]
    path = ROOT / latest["path"]
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def quality_report() -> dict[str, Any]:
    return load_index("quality_report", {})


def legend_matches_text(legend: str, text: str, tags: list[str] | None = None) -> bool:
    lowered = text.lower()
    variants = {
        legend.lower(),
        legend.lower().replace("'", ""),
        legend.lower().replace("'", "").replace(" ", "-"),
        legend.lower().replace(" ", "-"),
    }
    tag_set = {tag.lower() for tag in (tags or [])}
    return any(variant and (variant in lowered or variant in tag_set) for variant in variants)


def collect_legend_sources(objects: list[Any], legend: str) -> dict[str, list[Any]]:
    query = legend
    def source_rank(obj: Any) -> tuple[int, int, str]:
        tags = set(obj.meta.get("tags", []) or [])
        verified_rank = 0 if "verified-guide" in tags else 1
        meta_rank = 0 if "legend-reference" in tags or "meta-reference" in tags else 1
        return (verified_rank, meta_rank, obj.meta.get("title", ""))

    guides = sorted(
        [
            obj
            for obj in search_objects(objects, query, scopes={"analysis"}, limit=20)
            if obj.path.startswith("analysis/guides/")
            and "non-authoritative" not in set(obj.meta.get("tags", []) or [])
            and legend_matches_text(legend, f"{obj.meta.get('title', '')}\n{obj.body}", obj.meta.get("tags", []))
        ],
        key=source_rank,
    )
    verified_guides = [obj for obj in guides if "verified-guide" in set(obj.meta.get("tags", []) or [])]
    unverified_guides = [obj for obj in guides if "verified-guide" not in set(obj.meta.get("tags", []) or [])]
    articles = [
        obj
        for obj in search_objects(objects, query, scopes={"analysis"}, limit=20)
        if obj.path.startswith(("analysis/articles/", "analysis/community/", "analysis/intel/"))
        and "non-authoritative" not in set(obj.meta.get("tags", []) or [])
        and legend_matches_text(legend, f"{obj.meta.get('title', '')}\n{obj.body}", obj.meta.get("tags", []))
    ]
    videos = [
        obj
        for obj in search_objects(objects, query, scopes={"analysis"}, limit=20)
        if obj.path.startswith("analysis/videos/")
        and obj.meta.get("status") in {"reviewed", "linked"}
        and "non-authoritative" not in set(obj.meta.get("tags", []) or [])
        and legend_matches_text(legend, f"{obj.meta.get('title', '')}\n{obj.body}", obj.meta.get("tags", []))
    ]
    return {
        "verified_guides": verified_guides[:8],
        "unverified_guides": unverified_guides[:8],
        "articles": articles[:8],
        "videos": videos[:8],
    }


def render_sections(title: str, objects: list[Any], query: str) -> list[str]:
    lines = [title]
    if not objects:
        lines.append("- none")
        return lines
    for obj in objects:
        lines.append(f"- {obj.meta.get('title')}: {short_snippet(display_text(obj, query), query)} [{format_citation(obj)}]")
    return lines


def bullet_list(items: list[str]) -> list[str]:
    return [f"- {item}" for item in items] if items else ["- none"]


def expand_rule_query(query: str) -> str:
    lowered = query.lower()
    expansions: list[str] = []
    if "time is called" in lowered or ("time" in lowered and "called" in lowered):
        expansions.append("round time ends additional turns active player finishes score")
    if "two point lead" in lowered or "2-point lead" in lowered or "win by two" in lowered:
        expansions.append("additional turns score highest score")
    return " ".join([query, *expansions]).strip()


def is_rule_query(query: str) -> bool:
    lowered = query.lower()
    return any(
        phrase in lowered
        for phrase in [
            "time is called",
            "tournament",
            "what happens",
            "how does",
            "win by two",
            "additional turns",
            "rule",
            "errata",
        ]
    )


def is_definition_query(query: str) -> bool:
    lowered = query.lower()
    return any(token in lowered for token in ["what does", "what is", "means", "mean in riftbound", "define", "keyword", "how does"]) and any(
        marker in lowered
        for marker in [
            "[m]",
            "[a]",
            "[c]",
            "might",
            "power",
            "energy",
            "hidden",
            "showdown",
            "banish",
            "recycle",
            "ganking",
            "movement",
        ]
    )


def query_profile(question: str, object_map: dict[str, Any]) -> str:
    if is_definition_query(question):
        return "definition"
    if is_rule_query(question):
        return "rule"
    if resolve_card(question, object_map):
        return "card"
    lowered = question.lower()
    if any(token in lowered for token in ["meta", "deck", "matchup", "vs", "opponent", "legend"]):
        return "legend"
    return "generic"


def policy_search(objects: list[Any], query: str, profile: str, section: str, limit: int) -> list[Any]:
    def authoritative(items: list[Any]) -> list[Any]:
        return [obj for obj in items if "non-authoritative" not in set(obj.meta.get("tags", []) or []) and "quarantined" not in set(obj.meta.get("tags", []) or [])]

    def rank_subset(items: list[Any]) -> list[Any]:
        ranked = []
        for obj in items:
            score = score_object(obj, query)
            tags = set(obj.meta.get("tags", []) or [])
            if "game-reference" in tags:
                score += 20
            if "verified-summary" in tags:
                score += 12
            if obj.path.startswith("analysis/guides/"):
                score -= 2
            ranked.append((score, obj))
        ranked = [item for item in ranked if item[0] > 0]
        ranked.sort(key=lambda item: (-item[0], item[1].meta.get("title", "")))
        return [obj for _, obj in ranked[:limit]]

    if profile == "rule":
        if section == "canon":
            return [
                *search_objects(objects, query, types={"rule_atom"}, limit=limit),
                *search_objects(objects, query, types={"canon_document"}, limit=max(2, limit // 2)),
            ][:limit]
        if section == "analysis":
            return authoritative([obj for obj in search_objects(objects, query, scopes={"analysis"}, limit=limit * 2) if obj.path.startswith("analysis/reference/")])[:limit]
        if section == "data":
            return search_objects(objects, query, types={"conflict_record"}, limit=limit)
    if profile == "definition":
        if section == "canon":
            return search_objects(objects, query, types={"rule_atom", "canon_document", "ruling_record"}, limit=limit)
        if section == "analysis":
            return rank_subset(
                authoritative(
                    [
                        obj
                        for obj in objects
                        if obj.scope == "analysis"
                        and (
                            "game-reference" in set(obj.meta.get("tags", []) or [])
                            or obj.path.startswith(("analysis/guides/", "analysis/videos/"))
                        )
                    ]
                )
            )
        if section == "data":
            return authoritative(search_objects(objects, query, types={"taxonomy_entity", "ruling_record", "card_record"}, limit=limit * 2))[:limit]
    if profile == "card":
        if section == "canon":
            return search_objects(objects, query, types={"ruling_record", "canon_document"}, limit=limit)
        if section == "analysis":
            return authoritative([obj for obj in search_objects(objects, query, scopes={"analysis"}, limit=limit * 2) if obj.path.startswith(("analysis/guides/", "analysis/videos/", "analysis/articles/"))])[:limit]
        if section == "data":
            return search_objects(objects, query, types={"card_record", "ruling_record"}, limit=limit)
    if profile == "legend":
        if section == "canon":
            return search_objects(objects, query, types={"rule_atom", "canon_document", "ruling_record"}, limit=limit)
        if section == "analysis":
            return authoritative([obj for obj in search_objects(objects, query, scopes={"analysis"}, limit=limit * 3) if obj.path.startswith(("analysis/guides/", "analysis/articles/", "analysis/community/", "analysis/videos/", "analysis/archetypes/", "analysis/matchups/"))])[:limit]
        if section == "data":
            return authoritative(search_objects(objects, query, types={"meta_snapshot", "competitive_record", "event_record", "taxonomy_entity", "player_record"}, limit=limit * 2))[:limit]
    if section == "canon":
        return search_objects(objects, query, types={"canon_document", "rule_atom", "ruling_record"}, limit=limit)
    if section == "analysis":
        return authoritative([obj for obj in search_objects(objects, query, scopes={"analysis"}, limit=limit * 2) if obj.meta.get("status") != "draft"])[:limit]
    return authoritative(search_objects(objects, query, types={"card_record", "competitive_record", "event_record", "meta_snapshot", "taxonomy_entity", "conflict_record", "player_record"}, limit=limit * 2))[:limit]


def definition_focus_query(question: str) -> str:
    lowered = question.lower()
    marker_map = {
        "[m]": "might",
        "[a]": "agility",
        "[c]": "cost",
    }
    for marker, replacement in marker_map.items():
        if marker in lowered:
            return replacement
    for keyword in ["ganking", "hidden", "showdown", "banish", "recycle", "movement", "might", "power", "energy"]:
        if keyword in lowered:
            return keyword
    return question


def provenance_heading(meta: dict[str, Any]) -> str:
    return f"{provenance_label(meta)}; {meta.get('trust_level', 'unknown')}; {meta.get('status', 'unknown')}"


def is_strategy_query(question: str) -> bool:
    lowered = question.lower()
    return any(
        token in lowered
        for token in [
            "mulligan",
            "opening hand",
            "game plan",
            "plan into",
            "plan against",
            "sideboard",
            "pilot",
            "matchup",
            "line of play",
            "lines of play",
            "sequencing",
            "curve",
        ]
    )


def has_strong_canon_support(objects: list[Any], query: str, profile: str) -> bool:
    query_terms = token_set(query)
    if not query_terms:
        return False
    threshold = 1 if len(query_terms) <= 2 else 2
    for obj in objects:
        object_type = str(obj.meta.get("type", ""))
        if profile not in {"rule", "definition", "card"} and object_type not in {"rule_atom", "ruling_record"}:
            continue
        if score_object(obj, query) < 16:
            continue
        score = len(query_terms & token_set(object_text(obj)))
        if score >= threshold:
            return True
    return False


def has_strong_analysis_support(objects: list[Any], query: str) -> bool:
    query_terms = token_set(query)
    if not query_terms:
        return False
    threshold = 1 if len(query_terms) <= 2 else 2
    for obj in objects:
        trust_level = obj.meta.get("trust_level")
        if trust_level not in {"derived_verified", "official"}:
            continue
        claims = supported_claim_texts(obj)
        if not claims:
            if score_object(obj, query) < 16:
                continue
            score = len(query_terms & token_set(object_text(obj)))
            if score >= threshold:
                return True
            continue
        for claim in claims:
            score = len(query_terms & token_set(claim))
            if score >= threshold:
                return True
    return False


def cmd_ask(args: argparse.Namespace) -> int:
    ensure_graph_ready()
    objects, object_map = load_object_index()
    profile = query_profile(args.question, object_map)
    if profile == "rule":
        query = expand_rule_query(args.question)
    elif profile == "definition":
        query = definition_focus_query(args.question)
    else:
        query = args.question
    canon_hits = policy_search(objects, query, profile, "canon", 5)
    analysis_hits = policy_search(objects, query, profile, "analysis", 5)
    data_hits = policy_search(objects, query, profile, "data", 5)
    if profile == "rule":
        conflicts = load_index("derived_conflicts", [])[:5]
    else:
        conflicts = [item for item in load_index("derived_conflicts", []) if query.lower() in json.dumps(item).lower()]

    lines = [f"Question: {args.question}", f"Profile: {profile}", ""]
    supported_by_canon = has_strong_canon_support(canon_hits, query, profile)
    supported_by_analysis = has_strong_analysis_support(analysis_hits, query)
    if (is_strategy_query(args.question) and not supported_by_analysis) or (
        not supported_by_canon and not supported_by_analysis
    ):
        lines.extend(
            [
                "Support Note",
                "- Local evidence is limited for a direct answer here. Treat the results below as attributed context, not a verified conclusion.",
                "",
            ]
        )
    lines.extend(render_sections("Canon", canon_hits, query))
    lines.append("")
    lines.extend(render_sections("Analysis", analysis_hits, query))
    lines.append("")
    lines.extend(render_sections("Data", data_hits, query))
    if conflicts:
        lines.extend(["", "Conflicts"])
        for conflict in conflicts[:5]:
            lines.append(f"- {conflict['id']}: {conflict['message']} [{conflict['object_id']}]")
    print("\n".join(lines))
    return 0


def cmd_rule(args: argparse.Namespace) -> int:
    ensure_graph_ready()
    objects, _ = load_object_index()
    expanded_query = expand_rule_query(args.query)
    official_hits = [
        *search_objects(objects, expanded_query, types={"rule_atom"}, limit=8),
        *search_objects(objects, expanded_query, types={"canon_document"}, limit=3),
    ][:8]
    conflict_hits = search_objects(objects, expanded_query, types={"conflict_record"}, limit=8)
    lines = [f"Rule Query: {args.query}", ""]
    lines.extend(render_sections("Official Rules", official_hits, expanded_query))
    lines.append("")
    lines.extend(render_sections("Derived Conflicts", conflict_hits, expanded_query))
    print("\n".join(lines))
    return 0


def cmd_card(args: argparse.Namespace) -> int:
    ensure_graph_ready()
    objects, object_map = load_object_index()
    card_id = resolve_card(args.query, object_map)
    if not card_id or card_id not in object_map:
        raise SystemExit(f"Unable to resolve card from local corpus: {args.query}")

    card = object_map[card_id]
    payload = card.payload or {}
    record = payload.get("record", {})
    card_to_rulings = load_index("card_to_rulings", {})
    card_to_guides = load_index("card_to_guides", {})
    vod_links = load_index("vod_links", [])
    lines = [
        f"Card: {card.meta.get('title')}",
        f"Provenance: {provenance_heading(card.meta)}",
        f"ID: {card.object_id}",
        f"Path: {card.path}",
        f"Set: {record.get('set', {}).get('label', 'unknown')}",
        f"Domains: {', '.join(record.get('classification', {}).get('domain', [])) or 'unknown'}",
        f"Type: {record.get('classification', {}).get('type', 'unknown')}",
        "",
        "Text",
        record.get("text", {}).get("plain") or record.get("text", {}).get("rich") or "none",
        "",
        "Related Rulings",
    ]
    related_rulings = card_to_rulings.get(card_id, [])
    if related_rulings:
        for ruling_id in related_rulings:
            ruling = object_map.get(ruling_id)
            if ruling:
                explanation = (ruling.payload or {}).get("record", {}).get("new_text") or (ruling.payload or {}).get("record", {}).get("explanation") or short_snippet(ruling.body, card.meta.get("title", ""))
                lines.append(f"- {ruling.meta.get('title')}: {explanation} [{format_citation(ruling)}]")
    else:
        lines.append("- none")

    lines.extend(["", "Guide Mentions"])
    guide_ids = card_to_guides.get(card_id, [])
    if guide_ids:
        for object_id in guide_ids[:8]:
            obj = object_map.get(object_id)
            if obj:
                lines.append(f"- {obj.meta.get('title')} [{format_citation(obj)}]")
    else:
        lines.append("- none")

    lines.extend(["", "VOD Mentions"])
    vod_count = 0
    for item in vod_links:
        if card_id in item.get("cards", []):
            vod_count += 1
            lines.append(f"- {item['object_id']} [{item['path']}]")
    if vod_count == 0:
        lines.append("- none")
    print("\n".join(lines))
    return 0


def cmd_meta(args: argparse.Namespace) -> int:
    ensure_graph_ready()
    objects, object_map = load_object_index()
    legend = normalize_legend(args.legend)
    legend_to_decks = load_index("legend_to_decks", {})
    related_decks = legend_to_decks.get(legend, [])
    official_lookup = official_decklist_lookup()
    sources = collect_legend_sources(objects, legend)
    latest_meta = latest_generated_meta()
    legend_meta = None
    if latest_meta:
        legend_meta = next((item for item in latest_meta.get("record", {}).get("legends", []) if item.get("legend") == legend), None)
    meta_tier_obj = next((obj for obj in objects if obj.path == f"data/meta-tiers/{args.legend.lower().replace(' ', '-')}.json"), None)
    if meta_tier_obj is None:
        for obj in objects:
            if obj.meta.get("type") == "meta_snapshot" and obj.meta.get("title") == legend and obj.path.startswith("data/meta-tiers/"):
                meta_tier_obj = obj
                break

    lines = [f"Meta: {legend}", ""]
    if legend_meta:
        lines.append(
            f"Generated snapshot: {legend_meta['competitive_decks']} competitive decks, {legend_meta['official_lists']} official lists, {legend_meta['event_count']} events, latest tier {legend_meta['latest_tier'] or 'unknown'}"
        )
    if meta_tier_obj is not None:
        snapshots = (meta_tier_obj.payload or {}).get("record", {}).get("snapshots", [])
        if snapshots:
            latest = snapshots[-1]
            lines.append(f"Legacy tier snapshot: tier {latest.get('tier')} on {latest.get('snapshot_date')} from {latest.get('source')}")
    if legend_meta is None and meta_tier_obj is None:
        lines.append("No local meta snapshot found.")

    lines.extend(["", "Recent Lists"])
    if related_decks:
        for deck_id in related_decks[:10]:
            lines.append(f"- {deck_event_line(deck_id, object_map, official_lookup)}")
    else:
        lines.append("- none")

    lines.extend(["", "Verified References"])
    verified_hits = sources["verified_guides"]
    if verified_hits:
        lines.append(f"- guides: {len(verified_hits)} local verified guides")
        for obj in verified_hits[:3]:
            claim = best_supported_claim(obj, legend) or obj.meta.get("title")
            lines.append(f"  {obj.meta.get('title')}: {claim} [{format_citation(obj)}]")
    else:
        lines.append("- guides: 0 local verified guides")

    lines.extend(["", "Unverified Support"])
    for label, hits in {
        "guides": sources["unverified_guides"],
        "articles": sources["articles"],
        "videos": sources["videos"],
    }.items():
        if not hits:
            lines.append(f"- {label}: 0 local sources")
            continue
        lines.append(f"- {label}: {len(hits)} local sources")
        for obj in hits[:3]:
            lines.append(f"  {obj.meta.get('title')} [{format_citation(obj)}]")
    print("\n".join(lines))
    return 0


def build_prep_brief_payload(legend: str, opponent: str | None, event: str | None) -> dict[str, Any]:
    ensure_graph_ready()
    objects, object_map = load_object_index()
    official_lookup = official_decklist_lookup()
    legend_to_decks = load_index("legend_to_decks", {})
    legend = normalize_legend(legend)
    opponent = normalize_legend(opponent) if opponent else None
    related_decks = legend_to_decks.get(legend, [])
    latest_meta = latest_generated_meta()
    meta_row = None
    if latest_meta:
        meta_row = next((item for item in latest_meta.get("record", {}).get("legends", []) if item.get("legend") == legend), None)

    sources = collect_legend_sources(objects, legend)
    verified_analysis = list(sources["verified_guides"])
    unverified_analysis = [*sources["unverified_guides"], *sources["articles"], *sources["videos"]]
    relevant_analysis = [*verified_analysis, *unverified_analysis]
    if opponent:
        opponent_hits = search_objects(objects, f"{legend} {opponent}", scopes={"analysis"}, limit=12)
        for hit in opponent_hits:
            if hit not in relevant_analysis:
                relevant_analysis.append(hit)
    else:
        opponent_hits = []

    def analysis_priority(obj: Any) -> tuple[int, str]:
        text = f"{obj.meta.get('title', '')} {obj.body}".lower()
        title = str(obj.meta.get("title", "")).lower()
        source_kind = str(obj.meta.get("source_kind", ""))
        tags = set(obj.meta.get("tags", []) or [])
        legend_hit = legend.lower() in text
        opponent_hit = opponent.lower() in text if opponent else False
        legend_reference = "legend-reference" in tags and legend.lower() in title
        opponent_reference = bool(opponent) and "legend-reference" in tags and opponent.lower() in title
        meta_reference = "meta-reference" in tags
        if legend_reference:
            bucket = 0
        elif opponent_reference:
            bucket = 1
        elif legend_hit and opponent_hit:
            bucket = 2
        elif meta_reference:
            bucket = 3
        elif opponent_hit:
            bucket = 4
        elif legend_hit:
            bucket = 5
        elif obj in opponent_hits:
            bucket = 6
        else:
            bucket = 7
        generated_penalty = 1 if source_kind == "generated_local_prep" else 0
        verified_penalty = 0 if "verified-guide" in tags else 1
        return (bucket, verified_penalty, generated_penalty, obj.meta.get("title", ""))

    relevant_analysis = sorted(relevant_analysis, key=analysis_priority)

    battlefields = set()
    concepts = set()
    for obj in relevant_analysis:
        text = obj.body
        detected = __import__("scripts.lib.kb_common", fromlist=["detect_entities"]).detect_entities(text)
        battlefields.update(detected.get("battlefields", []))
        concepts.update(detected.get("concepts", []))

    conflict_items = load_index("derived_conflicts", [])
    relevant_conflicts = []
    for conflict in conflict_items:
        conflict_blob = json.dumps(conflict).lower()
        if legend.lower() in conflict_blob or (opponent and opponent.lower() in conflict_blob):
            relevant_conflicts.append(conflict)

    card_to_rulings = load_index("card_to_rulings", {})
    top_ruling_items: list[dict[str, Any]] = []
    for deck_id in related_decks[:6]:
        obj = object_map.get(deck_id)
        if not obj or not obj.payload:
            continue
        mainboard = (obj.payload.get("record") or {}).get("mainboard", [])
        for entry in mainboard[:10]:
            resolved = entry.get("resolvedCard", {})
            code = str(resolved.get("id", "")).lower()
            if not code:
                continue
            card_id = resolve_card(code, object_map)
            if card_id:
                for ruling_id in card_to_rulings.get(card_id, []):
                    ruling = object_map.get(ruling_id)
                    if ruling and ruling not in top_ruling_items:
                        top_ruling_items.append(ruling)

    recent_lists = [deck_event_line(deck_id, object_map, official_lookup) for deck_id in related_decks[:8]]
    heuristics: list[str] = []
    attributed_unverified: list[str] = []
    open_questions: list[str] = []
    for obj in relevant_analysis:
        claims = supported_claim_texts(obj)
        if claims:
            for claim in claims:
                if claim not in heuristics:
                    heuristics.append(claim)
            record = verification_record(obj.meta) or {}
            for topic in record.get("unsupported_claim_topics", []):
                question = f"Verify: {topic}"
                if question not in open_questions:
                    open_questions.append(question)
        elif obj not in verified_analysis:
            citation = format_citation(obj)
            if citation not in attributed_unverified:
                attributed_unverified.append(citation)

    practice_questions = [
        f"Which battlefield orders matter most for {legend}?",
        f"What lines keep {legend} efficient without overcommitting?",
        f"Which local rulings or errata change common {legend} assumptions?",
    ]
    if opponent:
        practice_questions.append(f"What does {legend} need to respect first against {opponent}?")
        practice_questions.append(f"Which battlefields swing {legend} vs {opponent}?")

    legend_slug = legend.lower().replace(" ", "-").replace("'", "")
    opponent_slug = opponent.lower().replace(" ", "-").replace("'", "") if opponent else None
    brief_slug = "-vs-".join([slug for slug in [legend_slug, opponent_slug] if slug])
    payload = {
        "id": f"prep_brief.{brief_slug}",
        "type": "prep_brief",
        "title": f"{legend}{f' vs {opponent}' if opponent else ''} Prep Brief",
        "source_kind": "generated_local_prep",
        "source_path": "generated",
        "source_date": now_iso()[:10],
        "trust_level": "derived_unverified",
        "status": "linked",
        "tags": ["prep-brief", legend, *([opponent] if opponent else [])],
        "record": {
            "legend": legend,
            "opponent": opponent,
            "event": event,
            "meta": meta_row,
            "canon_ruling_issues": [
                {
                    "id": obj.meta.get("id"),
                    "title": obj.meta.get("title"),
                    "path": obj.path,
                }
                for obj in top_ruling_items[:8]
            ],
            "likely_opponents": sorted(
                item["legend"] for item in (latest_meta.get("record", {}).get("legends", []) if latest_meta else [])[:8] if item.get("legend") != legend
            ) if latest_meta else [],
            "recent_lists": recent_lists,
            "matchup_heuristics": heuristics[:8],
            "attributed_unverified": attributed_unverified[:8],
            "open_questions": open_questions[:8],
            "unresolved_claims": [item["id"] for item in relevant_conflicts],
            "battlefields": sorted(battlefields),
            "concepts": sorted(concepts),
            "practice_questions": practice_questions,
            "citations": [format_citation(obj) for obj in relevant_analysis[:12]],
        },
    }
    return payload


def write_prep_artifacts(payload: dict[str, Any]) -> tuple[Path, Path | None, Path]:
    legend = payload["record"]["legend"]
    opponent = payload["record"].get("opponent")
    legend_slug = legend.lower().replace(" ", "-").replace("'", "")
    archetype_path = ROOT / "analysis" / "archetypes" / f"{legend_slug}.md"
    archetype_meta = {
        "id": f"analysis.archetype.{legend_slug}",
        "type": "analysis_note",
        "title": f"{legend} Archetype Brief",
        "source_kind": "generated_local_prep",
        "source_path": str(archetype_path),
        "source_date": payload["source_date"],
        "trust_level": "derived_unverified",
        "status": "linked",
        "tags": ["archetype", legend],
    }
    archetype_body = "\n".join(
        [
            "## Summary",
            f"Generated prep surface for {legend}.",
            "",
            "## Supported Heuristics",
            *bullet_list(payload["record"]["matchup_heuristics"]),
            "",
            "## Recent Lists",
            *bullet_list(payload["record"]["recent_lists"]),
            "",
            "## Concepts",
            *bullet_list(payload["record"]["concepts"]),
            "",
            "## Attributed but Unverified",
            *bullet_list(payload["record"].get("attributed_unverified", [])),
            "",
            "## Citations",
            *bullet_list(payload["record"]["citations"]),
        ]
    )
    write_markdown(archetype_path, archetype_meta, archetype_body)

    matchup_path = None
    if opponent:
        opponent_slug = opponent.lower().replace(" ", "-").replace("'", "")
        matchup_path = ROOT / "analysis" / "matchups" / f"{legend_slug}-vs-{opponent_slug}.md"
        matchup_meta = {
            "id": f"analysis.matchup.{legend_slug}-vs-{opponent_slug}",
            "type": "analysis_note",
            "title": f"{legend} vs {opponent}",
            "source_kind": "generated_local_prep",
            "source_path": str(matchup_path),
            "source_date": payload["source_date"],
            "trust_level": "derived_unverified",
            "status": "linked",
            "tags": ["matchup", legend, opponent],
        }
        matchup_body = "\n".join(
            [
                "## Evidence Base",
                *bullet_list(payload["record"]["citations"]),
                "",
                "## Supported Heuristics",
                *bullet_list(payload["record"]["matchup_heuristics"]),
                "",
                "## Attributed but Unverified",
                *bullet_list(payload["record"].get("attributed_unverified", [])),
                "",
                "## Battlefield Considerations",
                *bullet_list(payload["record"]["battlefields"]),
                "",
                "## Open Questions",
                *bullet_list(payload["record"].get("open_questions", [])),
                "",
                "## Practice Questions",
                *bullet_list(payload["record"]["practice_questions"]),
            ]
        )
        write_markdown(matchup_path, matchup_meta, matchup_body)

    prep_root = ROOT / "data" / "indexes" / "prep_briefs"
    prep_root.mkdir(parents=True, exist_ok=True)
    prep_path = prep_root / f"{payload['id'].split('.', 1)[1]}.json"
    write_json(prep_path, payload)
    return archetype_path, matchup_path, prep_path


def cmd_prep(args: argparse.Namespace) -> int:
    payload = build_prep_brief_payload(args.legend, args.opponent, args.event)
    archetype_path = None
    matchup_path = None
    prep_path = None
    if not args.dry_run:
        archetype_path, matchup_path, prep_path = write_prep_artifacts(payload)
        rebuild_indexes()
    lines = [
        f"Prep Brief: {payload['title']}",
    ]
    if prep_path is not None and archetype_path is not None:
        lines.append(f"- brief: {prep_path.relative_to(ROOT)}")
        lines.append(f"- archetype: {archetype_path.relative_to(ROOT)}")
    if matchup_path is not None:
        lines.append(f"- matchup: {matchup_path.relative_to(ROOT)}")
    if args.dry_run:
        lines.append("- dry_run: true")
    lines.extend(
        [
            "",
            "Canon/Ruling Issues",
            *bullet_list([item["title"] for item in payload["record"]["canon_ruling_issues"]]),
            "",
            "Recent Lists",
            *bullet_list(payload["record"]["recent_lists"]),
            "",
            "Matchup Heuristics",
            *bullet_list(payload["record"]["matchup_heuristics"]),
            "",
            "Attributed but Unverified",
            *bullet_list(payload["record"].get("attributed_unverified", [])),
            "",
            "Open Questions",
            *bullet_list(payload["record"].get("open_questions", [])),
            "",
            "Battlefield Considerations",
            *bullet_list(payload["record"]["battlefields"]),
            "",
            "Unresolved Claims",
            *bullet_list(payload["record"]["unresolved_claims"]),
            "",
            "Practice Questions",
            *bullet_list(payload["record"]["practice_questions"]),
            "",
            "Citations",
            *bullet_list(payload["record"]["citations"]),
        ]
    )
    print("\n".join(lines))
    return 0


def cmd_source(args: argparse.Namespace) -> int:
    ensure_graph_ready()
    objects, object_map = load_object_index()
    obj = object_map.get(args.object_id)
    if obj is None:
        raise SystemExit(f"Unknown local object id: {args.object_id}")
    payload = {
        "meta": obj.index_entry(),
        "provenance": provenance_label(obj.meta),
        "verification": verification_record(obj.meta),
        "body": obj.body[:4000],
        "payload": obj.payload,
    }
    print(json.dumps(payload, indent=2, ensure_ascii=True))
    return 0


def cmd_report_quality(args: argparse.Namespace) -> int:
    ensure_graph_ready()
    report = quality_report()
    print(json.dumps(report, indent=2, ensure_ascii=True))
    return 0


def write_publish_outbox(target: str, payload: dict[str, Any]) -> Path:
    out_root = ROOT / "data" / "ops" / "outbox" / target
    out_root.mkdir(parents=True, exist_ok=True)
    out_path = out_root / f"{payload['artifact_id'].replace('/', '--')}.json"
    write_json(out_path, payload)
    return out_path


def cmd_publish(args: argparse.Namespace) -> int:
    ensure_graph_ready()
    objects, object_map = load_object_index()
    artifact_id = args.artifact_id
    artifact = object_map.get(artifact_id)
    if artifact is None:
        prep_root = ROOT / "data" / "indexes" / "prep_briefs"
        prep_payload = None
        prep_path = None
        direct_path = prep_root / f"{artifact_id}.json"
        if direct_path.exists():
            prep_path = direct_path
            prep_payload = json.loads(direct_path.read_text(encoding="utf-8"))
        else:
            for candidate in prep_root.glob("*.json"):
                payload = json.loads(candidate.read_text(encoding="utf-8"))
                if payload.get("id") == artifact_id or candidate.stem == artifact_id:
                    prep_payload = payload
                    prep_path = candidate
                    break
        if prep_payload is not None and prep_path is not None:
            artifact = type("PrepObject", (), {"meta": prep_payload, "body": json.dumps(prep_payload.get("record", {}), indent=2), "path": str(prep_path.relative_to(ROOT))})()
        else:
            raise SystemExit(f"Unknown publish artifact: {artifact_id}")

    payload = {
        "artifact_id": artifact.meta.get("id", artifact_id),
        "target": args.target,
        "generated_at": now_iso(),
        "title": artifact.meta.get("title"),
        "summary": short_snippet(artifact.body, artifact.meta.get("title", "")),
        "source_path": getattr(artifact, "path", ""),
        "labels": [
            label
            for label in [
                "canon-conflict" if artifact.meta.get("trust_level") == "conflicted" else None,
                "vod-review" if "video" in (artifact.meta.get("tags") or []) else None,
                "meta-update" if "meta-generated" in (artifact.meta.get("tags") or []) else None,
                "knowledge-gap" if artifact.meta.get("status") == "draft" else None,
            ]
            if label
        ],
        "body": artifact.body[:4000],
    }
    out_path = write_publish_outbox(args.target, payload)
    print(f"Prepared {args.target} publish payload at {out_path.relative_to(ROOT)}")
    return 0


def cmd_ops_meta_update(args: argparse.Namespace) -> int:
    ensure_graph_ready()
    objects, _ = load_object_index()
    payload = build_meta_snapshot_payload(objects, args.date)
    data_path, analysis_path = write_meta_snapshot(payload)
    rebuild_indexes()
    print(f"Wrote meta snapshot: {data_path.relative_to(ROOT)}")
    print(f"Wrote meta report: {analysis_path.relative_to(ROOT)}")
    return 0


def cmd_ops_vod_review(args: argparse.Namespace) -> int:
    video_root = ROOT / "analysis" / "videos" / args.video_id
    result = refresh_video_artifacts(video_root)
    rebuild_indexes()
    print(json.dumps(result, indent=2, ensure_ascii=True))
    return 0


def cmd_ops_daily(args: argparse.Namespace) -> int:
    ensure_graph_ready()
    objects, _ = load_object_index()
    payload = build_meta_snapshot_payload(objects, args.date)
    data_path, analysis_path = write_meta_snapshot(payload)
    conflicts = load_index("derived_conflicts", [])
    draft_videos = [
        item
        for item in load_index("videos", [])
        if item.get("status") == "draft"
    ]
    daily_payload = {
        "id": f"ops.daily.{payload['source_date']}",
        "type": "ops_summary",
        "title": f"Daily ops summary {payload['source_date']}",
        "source_kind": "generated_local_ops",
        "source_path": "generated",
        "source_date": payload["source_date"],
        "trust_level": "derived_unverified",
        "status": "reviewed",
        "tags": ["ops", "daily"],
        "record": {
            "meta_snapshot": str(data_path.relative_to(ROOT)),
            "analysis_report": str(analysis_path.relative_to(ROOT)),
            "conflict_count": len(conflicts),
            "draft_video_count": len(draft_videos),
            "draft_videos": [item.get("id") for item in draft_videos],
        },
    }
    out_path = ROOT / "data" / "ops" / "daily" / f"{payload['source_date']}.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    write_json(out_path, daily_payload)
    rebuild_indexes()
    print(f"Wrote daily ops summary: {out_path.relative_to(ROOT)}")
    return 0


def top_legend_pairs(limit: int = 5) -> list[tuple[str, str]]:
    snapshot = latest_generated_meta()
    legends = snapshot.get("record", {}).get("legends", []) if snapshot else []
    top = [item["legend"] for item in legends[: max(limit + 1, 6)]]
    pairs: list[tuple[str, str]] = []
    for index, legend in enumerate(top):
        if len(pairs) >= limit:
            break
        for opponent in top:
            if legend == opponent:
                continue
            candidate = (legend, opponent)
            if candidate not in pairs:
                pairs.append(candidate)
                break
    return pairs[:limit]


def cmd_ops_expand_prep(args: argparse.Namespace) -> int:
    pairs = top_legend_pairs(args.limit)
    written = []
    for legend, opponent in pairs:
        payload = build_prep_brief_payload(legend, opponent, None)
        _, _, prep_path = write_prep_artifacts(payload)
        written.append(str(prep_path.relative_to(ROOT)))
    rebuild_indexes()
    print(json.dumps({"generated": written, "count": len(written)}, indent=2, ensure_ascii=True))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="kb", description="Local Riftbound knowledgebase CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)

    ask_parser = subparsers.add_parser("ask", help="Search local knowledge and return grounded hits")
    ask_parser.add_argument("question")
    ask_parser.set_defaults(func=cmd_ask)

    rule_parser = subparsers.add_parser("rule", help="Search local official rules and conflicts")
    rule_parser.add_argument("query")
    rule_parser.set_defaults(func=cmd_rule)

    card_parser = subparsers.add_parser("card", help="Inspect a local card record")
    card_parser.add_argument("query")
    card_parser.set_defaults(func=cmd_card)

    meta_parser = subparsers.add_parser("meta", help="Summarize local meta data for a legend")
    meta_parser.add_argument("--legend", required=True)
    meta_parser.set_defaults(func=cmd_meta)

    prep_parser = subparsers.add_parser("prep", help="Generate a local prep brief and supporting pages")
    prep_parser.add_argument("--legend", required=True)
    prep_parser.add_argument("--opponent")
    prep_parser.add_argument("--event")
    prep_parser.add_argument("--dry-run", action="store_true")
    prep_parser.set_defaults(func=cmd_prep)

    source_parser = subparsers.add_parser("source", help="Dump a local object by id")
    source_parser.add_argument("object_id")
    source_parser.set_defaults(func=cmd_source)

    report_parser = subparsers.add_parser("report", help="Read local quality reports")
    report_subparsers = report_parser.add_subparsers(dest="report_command", required=True)
    quality_parser = report_subparsers.add_parser("quality", help="Show draft, derived-unverified, and conflicted object reports")
    quality_parser.set_defaults(func=cmd_report_quality)

    publish_parser = subparsers.add_parser("publish", help="Prepare a downstream publish payload for a target")
    publish_parser.add_argument("--target", choices=["github", "notion", "linear"], required=True)
    publish_parser.add_argument("artifact_id")
    publish_parser.set_defaults(func=cmd_publish)

    ops_parser = subparsers.add_parser("ops", help="Run local agent-ops workflows")
    ops_subparsers = ops_parser.add_subparsers(dest="ops_command", required=True)

    daily_parser = ops_subparsers.add_parser("daily", help="Run the daily local ops refresh")
    daily_parser.add_argument("--date")
    daily_parser.set_defaults(func=cmd_ops_daily)

    meta_update_parser = ops_subparsers.add_parser("meta-update", help="Generate a dated local meta snapshot")
    meta_update_parser.add_argument("--date")
    meta_update_parser.set_defaults(func=cmd_ops_meta_update)

    vod_parser = ops_subparsers.add_parser("vod-review", help="Refresh a local VOD review from stored captions")
    vod_parser.add_argument("video_id")
    vod_parser.set_defaults(func=cmd_ops_vod_review)

    expand_prep_parser = ops_subparsers.add_parser("expand-prep", help="Generate prep briefs for top local matchup pairs")
    expand_prep_parser.add_argument("--limit", type=int, default=5)
    expand_prep_parser.set_defaults(func=cmd_ops_expand_prep)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


def main_ops(argv: list[str] | None = None) -> int:
    forwarded = ["ops", *(argv or sys.argv[1:])]
    return main(forwarded)
