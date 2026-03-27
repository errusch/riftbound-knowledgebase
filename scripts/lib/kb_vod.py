#!/usr/bin/env python3
"""Helpers for local VOD review artifacts."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from scripts.lib.kb_common import detect_conflicts, detect_entities, extract_claims, write_json, write_markdown
from scripts.lib.kb_graph import build_graph_indexes


def _merge_fragment_pair(previous: str, current: str) -> str | None:
    prev_words = previous.split()
    curr_words = current.split()
    max_overlap = min(len(prev_words), len(curr_words), 12)
    for size in range(max_overlap, 2, -1):
        if [word.lower() for word in prev_words[-size:]] == [word.lower() for word in curr_words[:size]]:
            return " ".join(prev_words + curr_words[size:])
    return None


def merge_transcript_fragments(fragments: list[tuple[str, str]]) -> list[tuple[str, str]]:
    merged: list[tuple[str, str]] = []
    for timestamp, text in fragments:
        normalized = re.sub(r"\s+", " ", text).strip()
        if not normalized:
            continue
        if not merged:
            merged.append((timestamp, normalized))
            continue
        prev_timestamp, prev_text = merged[-1]
        if normalized == prev_text or normalized in prev_text:
            continue
        if prev_text in normalized:
            merged[-1] = (timestamp, normalized)
            continue
        stitched = _merge_fragment_pair(prev_text, normalized)
        if stitched:
            merged[-1] = (prev_timestamp, stitched)
            continue
        merged.append((timestamp, normalized))
    return merged


def clean_vtt_with_timestamps(text: str) -> str:
    lines = text.splitlines()
    fragments: list[tuple[str, str]] = []
    current_timestamp = ""
    current_text: list[str] = []

    def flush() -> None:
        nonlocal current_text
        if not current_text:
            return
        normalized = re.sub(r"\s+", " ", " ".join(current_text)).strip()
        if normalized:
            fragments.append((current_timestamp, normalized))
        current_text = []

    for raw_line in lines:
        line = raw_line.strip()
        if not line or line.startswith(("WEBVTT", "Kind:", "Language:")):
            continue
        if "-->" in line:
            flush()
            current_timestamp = line.split("-->", 1)[0].strip().split(".")[0]
            continue
        if line.isdigit():
            continue
        line = re.sub(r"<\d{2}:\d{2}:\d{2}\.\d{3}>", "", line)
        line = re.sub(r"</?c>", "", line)
        line = re.sub(r"<[^>]+>", "", line)
        cleaned = line.strip()
        if cleaned:
            if not current_text or cleaned != current_text[-1]:
                current_text.append(cleaned)
    flush()
    chunks = []
    for timestamp, fragment in merge_transcript_fragments(fragments):
        prefix = f"[{timestamp}] " if timestamp else ""
        chunks.append(f"{prefix}{fragment}")
    return "\n\n".join(chunks).strip()


def transcript_quality_flags(cleaned: str) -> list[str]:
    flags = [
        "Transcript source is YouTube auto-captions (`en-orig`).",
        "Import depends on `yt-dlp` plus browser cookies from Brave.",
    ]
    lowered = cleaned.lower()
    if "riff founders" in lowered:
        flags.append("Auto-caption noise detected in opening lines.")
    if len(cleaned) < 400:
        flags.append("Transcript output is short and may be incomplete.")
    return flags


def review_body(metadata: dict[str, Any], cleaned: str, claims: list[dict[str, Any]], entities: dict[str, list[str]], quality_flags: list[str], conflicts: list[dict[str, Any]]) -> str:
    summary_lines = [line for line in cleaned.splitlines() if line.strip()][:3]
    summary = "\n\n".join(summary_lines) if summary_lines else "_Transcript cleaning did not produce readable prose._"
    body = [
        "## Summary",
        summary,
        "",
        "## Key Claims",
    ]
    if claims:
        body.extend(f"- {claim['excerpt']}" for claim in claims[:10])
    else:
        body.append("- _No high-signal claims were extracted automatically._")
    body.extend(
        [
            "",
            "## Detected Entities",
            f"- Concepts: {', '.join(entities['concepts']) or 'none detected'}",
            f"- Battlefields: {', '.join(entities['battlefields']) or 'none detected'}",
            f"- Legends: {', '.join(entities['legends']) or 'none detected'}",
            "",
            "## Transcript Quality",
        ]
    )
    body.extend(f"- {item}" for item in quality_flags)
    if conflicts:
        body.extend(["", "## Conflict Flags"])
        body.extend(f"- `{item['id']}`: {item['message']}" for item in conflicts)
    body.extend(
        [
            "",
            "## Source Metadata",
            f"- Title: {metadata.get('title', 'unknown')}",
            f"- Channel: {metadata.get('channel', 'unknown')}",
            f"- Published: {metadata.get('source_date') or metadata.get('upload_date', 'unknown')}",
            f"- Duration: {metadata.get('duration_string', 'unknown')}",
            f"- URL: {metadata.get('webpage_url') or metadata.get('source_path')}",
        ]
    )
    return "\n".join(body)


def refresh_video_artifacts(video_root: Path) -> dict[str, Any]:
    metadata_path = video_root / "metadata.json"
    raw_caption_path = video_root / "captions.raw.vtt"
    if not metadata_path.exists() or not raw_caption_path.exists():
        raise SystemExit(f"Missing video artifacts in {video_root}")

    metadata = writeable_metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    raw_vtt = raw_caption_path.read_text(encoding="utf-8")
    cleaned = clean_vtt_with_timestamps(raw_vtt)
    entities = detect_entities(cleaned)
    claims = extract_claims(cleaned)
    conflicts = detect_conflicts(cleaned)
    quality_flags = transcript_quality_flags(cleaned)
    has_links = bool(entities.get("concepts") or entities.get("battlefields") or entities.get("legends"))
    transcript_status = "linked" if has_links else "reviewed"
    review_status = "linked" if has_links else "reviewed"

    transcript_meta = {
        "id": f"analysis.video_transcript.{metadata['video_id']}",
        "type": "analysis_note",
        "title": f"{metadata.get('title', metadata['video_id'])} Transcript",
        "source_kind": metadata.get("source_kind", "youtube_vod_auto_caption"),
        "source_path": metadata.get("source_path"),
        "source_date": metadata.get("source_date"),
        "trust_level": "conflicted" if conflicts else metadata.get("trust_level", "derived_unverified"),
        "status": transcript_status,
        "tags": ["video", "transcript", metadata["video_id"]],
    }
    write_markdown(video_root / "transcript.cleaned.md", transcript_meta, cleaned or "_Transcript cleaning produced no output._")
    write_json(video_root / "claims.json", claims)

    review_meta = {
        "id": f"analysis.video_review.{metadata['video_id']}",
        "type": "vod_review",
        "title": f"{metadata.get('title', metadata['video_id'])} Review",
        "source_kind": "youtube_vod_review",
        "source_path": metadata.get("source_path"),
        "source_date": metadata.get("source_date"),
        "trust_level": "conflicted" if conflicts else metadata.get("trust_level", "derived_unverified"),
        "status": review_status,
        "tags": ["video", "review", metadata["video_id"]],
    }
    write_markdown(video_root / "review.md", review_meta, review_body(metadata, cleaned, claims, entities, quality_flags, conflicts))

    writeable_metadata["trust_level"] = "conflicted" if conflicts else metadata.get("trust_level", "derived_unverified")
    writeable_metadata["status"] = review_status
    metadata_path.write_text(json.dumps(writeable_metadata, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")
    build_graph_indexes()
    return {
        "video_id": metadata["video_id"],
        "entities": entities,
        "conflicts": [item["id"] for item in conflicts],
        "claim_count": len(claims),
    }
