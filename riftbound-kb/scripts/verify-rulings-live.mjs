#!/usr/bin/env node
/**
 * verify-rulings-live.mjs — Verify promoted ruling text against official pages.
 *
 * Usage:
 *   node scripts/verify-rulings-live.mjs
 */

import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const KB_ROOT = path.resolve(HERE, "..");
const RECORDS_DIR = path.join(KB_ROOT, "canon", "rulings", "records");
const INDEX_PATH = path.join(KB_ROOT, "canon", "rulings", "index.json");
const REPORT_PATH = path.join(KB_ROOT, "reports", "rulings-live-verification-report.md");

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function writeJson(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n");
}

function normalizeText(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/rek’sai/g, "rek'sai")
    .replace(/\s+/g, " ")
    .trim();
}

function snippetsFor(record) {
  const snippets = [];
  if (record.old_text) snippets.push({ field: "old_text", text: record.old_text });
  if (record.new_text) snippets.push({ field: "new_text", text: record.new_text });
  if (!record.old_text && !record.new_text && record.explanation) {
    snippets.push({ field: "explanation", text: record.explanation });
  }
  return snippets;
}

async function fetchPage(sourceUrl, cache) {
  if (cache.has(sourceUrl)) return cache.get(sourceUrl);
  const res = await fetch(sourceUrl, {
    headers: {
      "accept": "text/html,application/xhtml+xml,text/plain,*/*",
      "user-agent": "riftbound-kb-ruling-verifier/1.0"
    }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${sourceUrl}`);
  const text = await res.text();
  const normalized = normalizeText(text.replace(/<[^>]+>/g, " "));
  cache.set(sourceUrl, normalized);
  return normalized;
}

function statusFor(snippets, pageText) {
  if (!snippets.length) return { status: "live_source_found_no_text_fields", matches: [] };
  const matches = snippets.map((snippet) => ({
    field: snippet.field,
    matched: pageText.includes(normalizeText(snippet.text)),
  }));
  const matchedCount = matches.filter((m) => m.matched).length;
  if (matchedCount === snippets.length) return { status: "live_quote_verified", matches };
  if (matchedCount > 0) return { status: "live_source_partially_verified", matches };
  return { status: "live_source_found_text_not_matched", matches };
}

function renderReport(rows) {
  const counts = rows.reduce((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1;
    return acc;
  }, {});
  const lines = [];
  lines.push("# Rulings Live Verification Report");
  lines.push("");
  lines.push(`_Generated ${new Date().toISOString()}_`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  for (const [status, count] of Object.entries(counts).sort()) {
    lines.push(`- ${status}: ${count}`);
  }
  lines.push("");
  lines.push("## Details");
  lines.push("");
  for (const row of rows) {
    lines.push(`- \`${row.ruling_id}\` — ${row.title}: **${row.status}**`);
    if (row.error) lines.push(`  - error: ${row.error}`);
    for (const match of row.matches ?? []) {
      lines.push(`  - ${match.field}: ${match.matched ? "matched" : "not matched"}`);
    }
  }
  lines.push("");
  return lines.join("\n");
}

async function main() {
  console.log("→ live-verifying promoted rulings");
  const files = fs.readdirSync(RECORDS_DIR).filter((n) => n.endsWith(".json")).sort();
  const cache = new Map();
  const rows = [];
  const today = new Date().toISOString().slice(0, 10);

  for (const file of files) {
    const full = path.join(RECORDS_DIR, file);
    const record = readJson(full);
    const sourceUrl = record.source?.source_url;
    let status = "missing_source_url";
    let matches = [];
    let error = null;
    try {
      if (!sourceUrl) throw new Error("missing source.source_url");
      const pageText = await fetchPage(sourceUrl, cache);
      const result = statusFor(snippetsFor(record), pageText);
      status = result.status;
      matches = result.matches;
    } catch (err) {
      status = "live_fetch_failed";
      error = err.message;
    }

    record.verification = {
      ...(record.verification ?? {}),
      status,
      verified_at: today,
      method: "official_page_normalized_substring_match",
      live_matches: matches,
      notes: status === "live_quote_verified"
        ? "All available ruling text snippets matched the current official source page."
        : "Official source was checked, but one or more snippets were not fully matched. Use with caveat."
    };
    writeJson(full, record);
    rows.push({ ruling_id: record.ruling_id, title: record.title, status, matches, error });
  }

  if (fs.existsSync(INDEX_PATH)) {
    const index = readJson(INDEX_PATH);
    index.generated_at = new Date().toISOString();
    const byId = new Map(rows.map((row) => [row.ruling_id, row]));
    for (const item of index.items ?? []) {
      const row = byId.get(item.ruling_id);
      if (row) item.verification_status = row.status;
    }
    writeJson(INDEX_PATH, index);
  }

  fs.writeFileSync(REPORT_PATH, renderReport(rows));
  console.log(`✓ wrote ${path.relative(KB_ROOT, REPORT_PATH)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
