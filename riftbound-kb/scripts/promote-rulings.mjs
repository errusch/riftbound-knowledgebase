#!/usr/bin/env node
/**
 * promote-rulings.mjs — Promote legacy reviewed ruling JSON into canon/rulings.
 *
 * The legacy source at ~/Playground/data/rulings contains reviewed rows that
 * point at official Riftbound rules/news URLs, but the legacy DB path is not
 * canonical provenance. This script rewrites those rows into KB-native records,
 * resolves card links, updates card errata/rulings links, and writes a report.
 *
 * Usage:
 *   node scripts/promote-rulings.mjs --dry-run
 *   node scripts/promote-rulings.mjs
 */

import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const KB_ROOT = path.resolve(HERE, "..");
const PLAYGROUND_ROOT = path.resolve(KB_ROOT, "..");
const LEGACY_RULINGS_DIR = path.join(PLAYGROUND_ROOT, "data", "rulings");
const CARD_INDEX = path.join(KB_ROOT, "canon", "cards", "index.json");
const CARD_DIR = path.join(KB_ROOT, "canon", "cards");
const RULINGS_DIR = path.join(KB_ROOT, "canon", "rulings");
const RECORDS_DIR = path.join(RULINGS_DIR, "records");
const INDEX_PATH = path.join(RULINGS_DIR, "index.json");
const REPORT_PATH = path.join(KB_ROOT, "reports", "rulings-promotion-report.md");

const argv = new Set(process.argv.slice(2));
const DRY_RUN = argv.has("--dry-run");

const OFFICIAL_URLS = new Set([
  "https://riftbound.leagueoflegends.com/en-us/news/rules-and-releases/riftbound-origins-card-errata/",
  "https://riftbound.leagueoflegends.com/en-us/news/rules-and-releases/riftbound-spiritforged-errata/",
  "https://riftbound.leagueoflegends.com/en-us/news/rules-and-releases/riftbound-spiritforged-faq/",
]);

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function writeJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n");
}

function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeUrl(u) {
  const s = String(u || "").trim();
  if (!s) return null;
  return s.endsWith("/") ? s : `${s}/`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function loadCardIndex() {
  const idx = readJson(CARD_INDEX);
  const byId = new Map();
  const byName = new Map();
  for (const item of idx.items ?? []) {
    byId.set(item.card_id, item);
    const key = String(item.name || "").toLowerCase();
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(item);
  }
  return { byId, byName };
}

function cardCandidates(cardName, cardIndex) {
  if (!cardName) return [];
  return cardIndex.byName.get(String(cardName).toLowerCase()) ?? [];
}

function chooseCardId(cardName, kind, cardIndex) {
  if (kind === "rules_change") return { card_id: null, candidates: [], ambiguous: false };
  const candidates = cardCandidates(cardName, cardIndex);
  if (candidates.length === 1) {
    return { card_id: candidates[0].card_id, candidates, ambiguous: false };
  }
  const nonShowcase = candidates.filter((c) => !/star|showcase/i.test(`${c.card_id} ${c.rarity ?? ""}`));
  if (nonShowcase.length === 1) {
    return { card_id: nonShowcase[0].card_id, candidates, ambiguous: false };
  }
  return { card_id: null, candidates, ambiguous: candidates.length > 1 };
}

function recordPath(rulingId) {
  return path.join(RECORDS_DIR, `${rulingId}.json`);
}

function internalUri(rulingId) {
  return `riftbound-kb://canon/rulings/records/${rulingId}.json`;
}

function sourceName(sourceDoc) {
  if (/origins/i.test(sourceDoc || "")) return "Riftbound Origins Card Errata";
  if (/spiritforged errata/i.test(sourceDoc || "")) return "Riftbound Spiritforged Errata";
  if (/spiritforged faq/i.test(sourceDoc || "")) return "Riftbound Spiritforged FAQ";
  return "Riftbound Official Rules and Releases";
}

function buildRecord(legacy, file, cardIndex) {
  const r = legacy.record ?? {};
  const kind = r.ruling_type;
  const sourceUrl = normalizeUrl(r.source_url);
  const idBase = `${slugify(r.card_name)}-${slugify(kind)}-${r.effective_date || legacy.record?.id || "undated"}`;
  const rulingId = `ruling.${idBase}`;
  const resolution = chooseCardId(r.card_name, kind, cardIndex);
  const official = sourceUrl && OFFICIAL_URLS.has(sourceUrl);
  const verificationStatus = official
    ? "legacy_reviewed_official_url_pending_live_quote"
    : "blocked_non_official_source_url";

  return {
    record: {
      ruling_id: rulingId,
      kind,
      title: legacy.title || `${r.card_name} (${kind})`,
      card_name: kind === "rules_change" ? null : (r.card_name ?? null),
      card_id: resolution.card_id,
      old_text: r.old_text ?? null,
      new_text: r.new_text ?? null,
      explanation: r.explanation ?? null,
      effective_date: r.effective_date ?? null,
      source_doc: r.source_doc ?? null,
      source: {
        source_type: "official",
        source_name: sourceName(r.source_doc),
        source_url: sourceUrl,
        source_date: r.effective_date ?? null,
        retrieved_at: today(),
        trust_tier: "official",
        notes: "Promoted from reviewed legacy ruling row; live-page quote verification still pending."
      },
      verification: {
        status: verificationStatus,
        verified_at: today(),
        method: "legacy_reviewed_row_with_official_source_url",
        notes: "Legacy row was reviewed and cites an official Riftbound rules/news URL. Text should be live-quote verified before treating this as machine-verified verbatim."
      },
      legacy: {
        source_file: `data/rulings/${file}`,
        legacy_id: legacy.id ?? null,
        legacy_record_id: r.id ?? null,
        legacy_status: legacy.status ?? null,
        legacy_trust_level: legacy.trust_level ?? null
      }
    },
    resolution,
    official,
  };
}

function validateRecord(rec, cardIndex) {
  const errors = [];
  if (!rec.ruling_id) errors.push("missing ruling_id");
  if (!["errata", "ruling", "rules_change"].includes(rec.kind)) errors.push("invalid kind");
  if (!rec.source?.source_url || !OFFICIAL_URLS.has(normalizeUrl(rec.source.source_url))) {
    errors.push("source_url is not allowlisted official rules/news URL");
  }
  if (rec.card_id && !cardIndex.byId.has(rec.card_id)) errors.push(`card_id does not resolve: ${rec.card_id}`);
  if (rec.kind === "errata" && !rec.old_text && !rec.new_text) errors.push("errata missing old_text/new_text");
  if (rec.kind === "ruling" && !rec.explanation && !rec.old_text && !rec.new_text) errors.push("ruling missing explanation/text");
  if (rec.kind === "rules_change" && rec.card_id !== null) errors.push("rules_change must not link to a card_id");
  return errors;
}

function appendUnique(arr, value) {
  const a = Array.isArray(arr) ? arr : [];
  if (!a.includes(value)) a.push(value);
  return a;
}

function updateCardLinks(records) {
  const touched = new Map();
  for (const rec of records) {
    if (!rec.card_id) continue;
    const cardPath = path.join(CARD_DIR, `${rec.card_id}.json`);
    if (!fs.existsSync(cardPath)) continue;
    const card = touched.get(cardPath) ?? readJson(cardPath);
    const uri = internalUri(rec.ruling_id);
    if (rec.kind === "errata") card.errata_links = appendUnique(card.errata_links, uri);
    else card.rulings_links = appendUnique(card.rulings_links, uri);
    touched.set(cardPath, card);
  }
  return touched;
}

function writeReport(stats, promoted, blocked, unresolved, ambiguous, dryRun) {
  const lines = [];
  lines.push("# Rulings Promotion Report");
  lines.push("");
  lines.push(`_Generated ${new Date().toISOString()}${dryRun ? " (dry run)" : ""}_`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- legacy files scanned: ${stats.scanned}`);
  lines.push(`- promoted records: ${promoted.length}`);
  lines.push(`- blocked records: ${blocked.length}`);
  lines.push(`- unresolved card links: ${unresolved.length}`);
  lines.push(`- ambiguous card links: ${ambiguous.length}`);
  lines.push(`- records needing live quote verification: ${promoted.filter((r) => r.verification.status.includes("pending_live_quote")).length}`);
  lines.push("");
  lines.push("## Promoted");
  lines.push("");
  for (const rec of promoted) {
    lines.push(`- \`${rec.ruling_id}\` — ${rec.title} (${rec.kind})${rec.card_id ? ` -> \`${rec.card_id}\`` : ""}`);
  }
  if (!promoted.length) lines.push("_none_");
  lines.push("");
  lines.push("## Unresolved Card Links");
  lines.push("");
  for (const row of unresolved) lines.push(`- ${row.file}: ${row.card_name}`);
  if (!unresolved.length) lines.push("_none_");
  lines.push("");
  lines.push("## Ambiguous Card Links");
  lines.push("");
  for (const row of ambiguous) lines.push(`- ${row.file}: ${row.card_name} -> ${row.candidates.join(", ")}`);
  if (!ambiguous.length) lines.push("_none_");
  lines.push("");
  lines.push("## Blocked");
  lines.push("");
  for (const row of blocked) lines.push(`- ${row.file}: ${row.errors.join("; ")}`);
  if (!blocked.length) lines.push("_none_");
  lines.push("");
  lines.push("## Verification Note");
  lines.push("");
  lines.push("Records are promoted from reviewed legacy rows that cite official Riftbound rules/news URLs. They remain marked `legacy_reviewed_official_url_pending_live_quote` until the exact text is matched against the live official page or official PDF.");
  lines.push("");
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, lines.join("\n"));
}

function main() {
  console.log(`→ promoting rulings${DRY_RUN ? " (dry-run)" : ""}`);
  const cardIndex = loadCardIndex();
  const files = fs.readdirSync(LEGACY_RULINGS_DIR).filter((n) => n.endsWith(".json")).sort();
  const stats = { scanned: files.length };
  const promoted = [];
  const blocked = [];
  const unresolved = [];
  const ambiguous = [];

  for (const file of files) {
    const legacy = readJson(path.join(LEGACY_RULINGS_DIR, file));
    const { record, resolution, official } = buildRecord(legacy, file, cardIndex);
    const errors = validateRecord(record, cardIndex);
    if (!official) errors.push("legacy record did not cite allowlisted official URL");
    if (record.kind !== "rules_change" && !record.card_id) {
      const row = { file, card_name: legacy.record?.card_name ?? null };
      if (resolution.ambiguous) ambiguous.push({ ...row, candidates: resolution.candidates.map((c) => c.card_id) });
      else unresolved.push(row);
    }
    if (errors.length) {
      blocked.push({ file, errors });
      continue;
    }
    promoted.push(record);
  }

  const index = {
    version: 1,
    generated_at: new Date().toISOString(),
    count: promoted.length,
    items: promoted.map((rec) => ({
      ruling_id: rec.ruling_id,
      kind: rec.kind,
      title: rec.title,
      card_name: rec.card_name,
      card_id: rec.card_id,
      effective_date: rec.effective_date,
      source_url: rec.source.source_url,
      path: `canon/rulings/records/${rec.ruling_id}.json`,
      verification_status: rec.verification.status
    })).sort((a, b) => String(a.ruling_id).localeCompare(String(b.ruling_id)))
  };

  if (!DRY_RUN) {
    fs.mkdirSync(RECORDS_DIR, { recursive: true });
    for (const rec of promoted) writeJson(recordPath(rec.ruling_id), rec);
    writeJson(INDEX_PATH, index);
    const touched = updateCardLinks(promoted);
    for (const [cardPath, card] of touched.entries()) writeJson(cardPath, card);
  }

  writeReport(stats, promoted, blocked, unresolved, ambiguous, DRY_RUN);
  console.log(`✓ promoted: ${promoted.length}, blocked: ${blocked.length}, unresolved links: ${unresolved.length}, ambiguous links: ${ambiguous.length}`);
  console.log(`report: ${path.relative(KB_ROOT, REPORT_PATH)}`);
}

main();
