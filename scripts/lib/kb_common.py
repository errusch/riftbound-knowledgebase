#!/usr/bin/env python3
"""Shared helpers for the local Riftbound knowledgebase."""

from __future__ import annotations

import json
import re
import shutil
import sqlite3
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
RAW_SOURCE_ROOT = Path("/Users/eric/claude-workspace/riftbound")
HEXTECH_ROOT = Path("/Users/eric/hextech-analytics")
IGNORED_DUPLICATE_ROOT = Path("/Users/eric/Documents/hextech-analytics-current")
LEGACY_KNOWLEDGE_DB_CANDIDATES = [
    Path("/Users/eric/.openclaw/workspace/databases/knowledge.db"),
    Path("/Users/eric/.openclaw/quarantine-20260323/old_openclaw_bak_03062026/workspace/databases/knowledge.db"),
    Path("/Users/eric/.openclaw/quarantine-20260323/old_openclaw_bak_03062026/backups/pre-ollama-20260226-1158/databases/knowledge.db"),
    Path("/Users/eric/.openclaw/quarantine-20260323/old_openclaw_bak_03062026/backups/pre-graph-memory-20260225-1027/databases/knowledge.db"),
]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def write_text(path: Path, content: str) -> None:
    ensure_dir(path.parent)
    path.write_text(content.rstrip() + "\n", encoding="utf-8")


def write_json(path: Path, payload: Any) -> None:
    ensure_dir(path.parent)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")


def load_json(path: Path, default: Any = None) -> Any:
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def slugify(value: str) -> str:
    value = value.lower().strip()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-")


def guess_date_from_text(text: str) -> str | None:
    match = re.search(r"(20\d{2}-\d{2}-\d{2})", text)
    if match:
        return match.group(1)
    return None


def frontmatter_block(meta: dict[str, Any]) -> str:
    lines: list[str] = ["---"]
    for key, value in meta.items():
        if isinstance(value, list):
            lines.append(f"{key}:")
            for item in value:
                lines.append(f"  - {item}")
        else:
            lines.append(f"{key}: {value}")
    lines.append("---")
    return "\n".join(lines)


def write_markdown(path: Path, meta: dict[str, Any], body: str) -> None:
    payload = f"{frontmatter_block(meta)}\n\n{body.strip()}\n"
    write_text(path, payload)


def parse_frontmatter(text: str) -> tuple[dict[str, Any], str]:
    if not text.startswith("---\n"):
        return {}, text
    lines = text.splitlines()
    meta: dict[str, Any] = {}
    key: str | None = None
    idx = 1
    while idx < len(lines):
        line = lines[idx]
        if line == "---":
            body = "\n".join(lines[idx + 1 :]).lstrip("\n")
            return meta, body
        if line.startswith("  - ") and key:
            meta.setdefault(key, []).append(line[4:])
        elif ": " in line:
            key, value = line.split(": ", 1)
            meta[key] = value
        elif line.endswith(":"):
            key = line[:-1]
            meta[key] = []
        idx += 1
    return meta, text


def copy_file(src: Path, dest: Path) -> None:
    ensure_dir(dest.parent)
    shutil.copy2(src, dest)


def load_taxonomy() -> dict[str, list[dict[str, Any]]]:
    taxonomy_root = ROOT / "data" / "taxonomy"
    return {
        "concepts": load_json(taxonomy_root / "concepts.json", []),
        "battlefields": load_json(taxonomy_root / "battlefields.json", []),
        "legends": load_json(taxonomy_root / "legends.json", []),
    }


def detect_entities(text: str) -> dict[str, list[str]]:
    lowered = text.lower()
    results: dict[str, list[str]] = {"concepts": [], "battlefields": [], "legends": []}
    for category, items in load_taxonomy().items():
        for item in items:
            aliases = item.get("aliases", [])
            if any(alias.lower() in lowered for alias in aliases):
                results[category].append(item["name"])
    for category in results:
        results[category] = sorted(set(results[category]))
    return results


def detect_conflicts(text: str) -> list[dict[str, Any]]:
    rules = load_json(ROOT / "data" / "taxonomy" / "conflict_rules.json", [])
    hits: list[dict[str, Any]] = []
    for rule in rules:
        for pattern in rule.get("patterns", []):
            if re.search(pattern, text, flags=re.IGNORECASE):
                hits.append(
                    {
                        "id": rule["id"],
                        "title": rule["title"],
                        "message": rule["message"],
                        "canonical_value": rule["canonical_value"],
                        "matched_pattern": pattern,
                    }
                )
                break
    return hits


def extract_claims(text: str, max_claims: int = 10) -> list[dict[str, Any]]:
    claims: list[dict[str, Any]] = []
    chunks = [chunk.strip() for chunk in re.split(r"\n\s*\n", text) if chunk.strip()]
    for chunk in chunks:
        if chunk.startswith("#"):
            continue
        normalized = re.sub(r"\s+", " ", chunk)
        if len(normalized) < 60:
            continue
        sentence = re.split(r"(?<=[.!?])\s+", normalized)[0].strip()
        if len(sentence) < 40:
            sentence = normalized[:220].rstrip()
        claims.append(
            {
                "excerpt": sentence[:280],
                "status": "derived",
                "entities": detect_entities(sentence),
            }
        )
        if len(claims) >= max_claims:
            break
    return claims


def parse_numbered_atoms(text: str, document_id: str) -> list[dict[str, Any]]:
    atoms: list[dict[str, Any]] = []
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    idx = 0
    while idx < len(lines):
        line = lines[idx]
        inline_match = re.match(r"^([0-9]{3}(?:\.[0-9a-z]+)*)\.\s+(.+)$", line)
        bare_match = re.match(r"^([0-9]{3}(?:\.[0-9a-z]+)*)\.$", line)
        if inline_match:
            code, body = inline_match.groups()
            atoms.append({"id": f"{document_id}.{code}", "rule_code": code, "text": body})
        elif bare_match:
            code = bare_match.group(1)
            body = ""
            lookahead = idx + 1
            while lookahead < len(lines):
                if re.match(r"^[0-9]{3}(?:\.[0-9a-z]+)*\.", lines[lookahead]):
                    break
                body = lines[lookahead]
                break
            atoms.append({"id": f"{document_id}.{code}", "rule_code": code, "text": body})
        idx += 1
    return atoms


def run(cmd: list[str], cwd: Path | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(cmd, cwd=cwd or ROOT, text=True, capture_output=True, check=False)


def require_command(name: str) -> None:
    if shutil.which(name) is None:
        raise SystemExit(f"Missing required command: {name}")


def rebuild_indexes() -> None:
    script = ROOT / "scripts" / "build" / "rebuild_indexes"
    result = run([str(script)])
    if result.returncode != 0:
        raise SystemExit(result.stderr.strip() or result.stdout.strip())


def parse_markdown_file(path: Path) -> dict[str, Any]:
    meta, body = parse_frontmatter(path.read_text(encoding="utf-8"))
    return {"path": str(path.relative_to(ROOT)), "meta": meta, "body": body}


def canonical_tags(*tags: str) -> list[str]:
    return [tag for tag in tags if tag]


def sqlite_table_exists(db_path: Path, table_name: str) -> bool:
    if not db_path.exists():
        return False
    with sqlite3.connect(db_path) as conn:
        row = conn.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
            (table_name,),
        ).fetchone()
    return bool(row)


def find_legacy_knowledge_db(required_table: str = "riftbound_cards") -> Path | None:
    env_path = Path.cwd() / "data" / "knowledge.db"
    candidates = [env_path, *LEGACY_KNOWLEDGE_DB_CANDIDATES]
    for candidate in candidates:
        if sqlite_table_exists(candidate, required_table):
            return candidate
    return None
