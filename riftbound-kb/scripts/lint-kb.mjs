#!/usr/bin/env node
/**
 * lint-kb.mjs — Integrity report + safe auto-normalization for the KB.
 *
 * Checks:
 *   1. decklist.event_id resolves to a real events/<id>.json (via aliases)
 *   2. decklist.legend is non-null, non-empty, and matches a canonical form
 *   3. decklist.player is non-null / non-empty / non-"?"
 *   4. card refs in decklists resolve in canon/cards/index.json by card_id
 *   5. events/decklists follow their schema's required-field contract
 *   6. events have at least one matching decklist (stub events with zero
 *      decklists are flagged, not errors)
 *
 * Modes:
 *   node scripts/lint-kb.mjs                  # report only, exit 0 or 1
 *   node scripts/lint-kb.mjs --fix            # apply SAFE normalizations:
 *                                              - rewrite decklist.event_id
 *                                                from short alias to full
 *                                                canonical id
 *                                              - normalize decklist.legend
 *                                                to the canonical full form
 *                                                when it's unambiguous
 *   node scripts/lint-kb.mjs --fix --dry-run  # preview the --fix changes
 *
 * Writes a summary to `reports/kb-lint.md`.
 */

import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const KB_ROOT = path.resolve(HERE, "..");
const EVENTS_DIR = path.join(KB_ROOT, "events");
const DECKS_DIR = path.join(KB_ROOT, "decklists");
const CARD_INDEX = path.join(KB_ROOT, "canon", "cards", "index.json");
const REPORTS_DIR = path.join(KB_ROOT, "reports");
const REPORT_PATH = path.join(REPORTS_DIR, "kb-lint.md");

const argv = new Set(process.argv.slice(2));
const FIX = argv.has("--fix");
const DRY_RUN = argv.has("--dry-run");

function readJson(p) { return JSON.parse(fs.readFileSync(p, "utf8")); }
function writeJson(p, data) { fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n"); }

function loadEvents() {
  const events = new Map();
  for (const name of fs.readdirSync(EVENTS_DIR)) {
    if (!name.endsWith(".json")) continue;
    if (name === "index.json" || name === "index.normalized.json") continue;
    const full = path.join(EVENTS_DIR, name);
    if (fs.statSync(full).isDirectory()) continue;
    try {
      const ev = readJson(full);
      if (ev.event_id) events.set(ev.event_id, { ev, file: name });
    } catch (err) {
      console.warn(`  ! skipping ${name}: ${err.message}`);
    }
  }
  return events;
}

function buildEventAliasMap(events) {
  // For each short prefix (e.g. "rq-bologna"), there may be multiple full
  // event_ids that match ("rq-bologna-2026-02", "rq-bologna-2026-02-preview",
  // "rq-bologna-2026"). A decklist that says event_id="rq-bologna" almost
  // always meant the canonical event, not the preview/announcement.
  //
  // Scoring rule (lower score = more canonical, wins):
  //   - id contains "-preview"   → +100
  //   - id contains "preview"    → +50
  //   - event.coverage_kind === "preview"   → +100
  //   - event.coverage_kind in (results, top_decks) → -10
  //   - length of id             → raw length (shorter wins on ties)
  const m = new Map();
  for (const id of events.keys()) m.set(id, id);

  function score(id) {
    const entry = events.get(id);
    const ev = entry?.ev ?? entry;          // handle both shapes
    let s = id.length;
    if (/-preview/i.test(id)) s += 100;
    else if (/preview/i.test(id)) s += 50;
    const ck = ev?.coverage_kind;
    if (ck === "preview") s += 100;
    if (ck === "results" || ck === "top_decks") s -= 10;
    return s;
  }

  // Build: short-prefix → [candidate full ids]
  const buckets = new Map();
  for (const id of events.keys()) {
    const parts = id.split("-");
    for (let i = parts.length - 1; i >= 2; i--) {
      const alias = parts.slice(0, i).join("-");
      if (events.has(alias)) continue;      // alias IS a real event; leave it
      if (!buckets.has(alias)) buckets.set(alias, []);
      buckets.get(alias).push(id);
    }
  }
  for (const [alias, candidates] of buckets.entries()) {
    candidates.sort((a, b) => score(a) - score(b));
    m.set(alias, candidates[0]);
  }
  return m;
}

function loadDecks() {
  const decks = [];
  for (const name of fs.readdirSync(DECKS_DIR)) {
    if (!name.endsWith(".json")) continue;
    if (name === "index.json" || name === "index.normalized.json") continue;
    try {
      decks.push({ file: name, data: readJson(path.join(DECKS_DIR, name)) });
    } catch (err) {
      console.warn(`  ! skipping ${name}: ${err.message}`);
    }
  }
  return decks;
}

function loadCardIndex() {
  if (!fs.existsSync(CARD_INDEX)) return new Set();
  const idx = readJson(CARD_INDEX);
  return new Set((idx.items ?? []).map((x) => x.card_id));
}

function shortLegend(legend) {
  return String(legend || "").split(",")[0].trim();
}

// Build canonical legend vocabulary by picking the longest form seen for each
// short name. If "Draven, Glorious Executioner" and "Draven" both appear, the
// full form wins.
function buildCanonicalLegends(decks) {
  const bestByShort = new Map();
  for (const { data } of decks) {
    const full = String(data.legend || "").trim();
    if (!full) continue;
    const s = shortLegend(full);
    if (!s) continue;
    const prev = bestByShort.get(s);
    if (!prev || full.length > prev.length) bestByShort.set(s, full);
  }
  return bestByShort;
}

function main() {
  console.log(`→ linting KB at ${KB_ROOT}${FIX ? (DRY_RUN ? " (fix, dry-run)" : " (fix)") : ""}`);

  const events = loadEvents();
  const aliases = buildEventAliasMap(events);
  const decks = loadDecks();
  const cardIds = loadCardIndex();
  const canonicalLegends = buildCanonicalLegends(decks);

  // ------------- report accumulators -------------
  const findings = {
    decksWithoutEvent: [],       // no event_id field at all
    decksWithBadEvent: [],       // event_id doesn't resolve, even via alias
    decksWithAliasableEvent: [], // { file, from, to } — auto-fixable
    decksWithNullLegend: [],
    decksWithNormalizableLegend: [], // { file, from, to }
    decksWithMissingPlayer: [],
    decksWithUnresolvedCards: [], // { file, count }
    eventsWithoutDecks: [],
    eventsMissingSchema: [],     // events failing required fields
  };

  // ------------- analyze decks -------------
  for (const d of decks) {
    const { file, data } = d;
    const rel = `decklists/${file}`;

    // legend
    if (!data.legend || String(data.legend).trim() === "" || data.legend === null) {
      findings.decksWithNullLegend.push(rel);
    } else {
      const shortName = shortLegend(data.legend);
      const canonical = canonicalLegends.get(shortName);
      if (canonical && canonical !== String(data.legend).trim()) {
        findings.decksWithNormalizableLegend.push({
          file: rel, from: data.legend, to: canonical,
        });
      }
    }

    // event_id
    if (!data.event_id) {
      findings.decksWithoutEvent.push(rel);
    } else if (!aliases.has(data.event_id)) {
      findings.decksWithBadEvent.push({ file: rel, event_id: data.event_id });
    } else if (aliases.get(data.event_id) !== data.event_id) {
      findings.decksWithAliasableEvent.push({
        file: rel, from: data.event_id, to: aliases.get(data.event_id),
      });
    }

    // player
    if (!data.player || String(data.player).trim() === "" || data.player === "?") {
      findings.decksWithMissingPlayer.push(rel);
    }

    // card refs
    let unresolved = 0;
    for (const c of data.cards ?? []) {
      if (!c.card_id || !cardIds.has(c.card_id)) unresolved += 1;
    }
    if (unresolved > 0) {
      findings.decksWithUnresolvedCards.push({ file: rel, count: unresolved });
    }
  }

  // ------------- analyze events -------------
  for (const [id, { ev, file }] of events.entries()) {
    const rel = `events/${file}`;
    // Schema: required fields from event-record.schema.json
    const missing = [];
    if (!ev.event_id) missing.push("event_id");
    if (!ev.event_type) missing.push("event_type");
    if (!ev.event_name) missing.push("event_name");
    if (!ev.source) missing.push("source");
    if (missing.length) findings.eventsMissingSchema.push({ file: rel, missing });

    // any decklists?
    const hits = decks.some((d) => aliases.get(d.data.event_id) === id);
    if (!hits) findings.eventsWithoutDecks.push(rel);
  }

  // ------------- apply --fix changes -------------
  const fixes = { eventIds: 0, legends: 0 };
  if (FIX) {
    // 1. Rewrite aliasable event_ids on decks
    for (const { file } of findings.decksWithAliasableEvent) {
      const fullPath = path.join(KB_ROOT, file);
      const data = readJson(fullPath);
      const resolved = aliases.get(data.event_id);
      if (resolved && resolved !== data.event_id) {
        data.event_id = resolved;
        if (!DRY_RUN) writeJson(fullPath, data);
        fixes.eventIds += 1;
      }
    }
    // 2. Normalize legend to canonical full form
    for (const { file, to } of findings.decksWithNormalizableLegend) {
      const fullPath = path.join(KB_ROOT, file);
      const data = readJson(fullPath);
      data.legend = to;
      if (!DRY_RUN) writeJson(fullPath, data);
      fixes.legends += 1;
    }
  }

  // ------------- emit report -------------
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const now = new Date().toISOString();
  const lines = [];
  lines.push(`# KB lint report`);
  lines.push("");
  lines.push(`_Generated ${now}_`);
  lines.push("");
  lines.push(`- events: ${events.size}`);
  lines.push(`- decklists: ${decks.length}`);
  lines.push(`- card index entries: ${cardIds.size}`);
  lines.push("");

  function section(title, items, renderItem) {
    lines.push(`## ${title} (${items.length})`);
    lines.push("");
    if (items.length === 0) { lines.push("_none_"); lines.push(""); return; }
    for (const it of items.slice(0, 50)) lines.push(`- ${renderItem(it)}`);
    if (items.length > 50) lines.push(`- _… ${items.length - 50} more_`);
    lines.push("");
  }

  section("Decks missing event_id", findings.decksWithoutEvent, (x) => x);
  section("Decks with unresolvable event_id", findings.decksWithBadEvent,
    (x) => `${x.file} — event_id: \`${x.event_id}\``);
  section("Decks with short event_id (auto-fixable → full id)",
    findings.decksWithAliasableEvent,
    (x) => `${x.file} — \`${x.from}\` → \`${x.to}\``);
  section("Decks with null / empty legend", findings.decksWithNullLegend, (x) => x);
  section("Decks with non-canonical legend form (auto-fixable)",
    findings.decksWithNormalizableLegend,
    (x) => `${x.file} — \`${x.from}\` → \`${x.to}\``);
  section("Decks with missing player", findings.decksWithMissingPlayer, (x) => x);
  section("Decks with unresolved card refs",
    findings.decksWithUnresolvedCards,
    (x) => `${x.file} — ${x.count} unresolved`);
  section("Events missing schema-required fields",
    findings.eventsMissingSchema,
    (x) => `${x.file} — missing: ${x.missing.join(", ")}`);
  section("Events with no decklists attached",
    findings.eventsWithoutDecks, (x) => x);

  if (FIX) {
    lines.push(`## Auto-fixes applied${DRY_RUN ? " (dry-run)" : ""}`);
    lines.push("");
    lines.push(`- event_id short → full: ${fixes.eventIds}`);
    lines.push(`- legend → canonical form: ${fixes.legends}`);
    lines.push("");
  }

  fs.writeFileSync(REPORT_PATH, lines.join("\n"));

  // ------------- console summary -------------
  const totalIssues = Object.values(findings).reduce((n, arr) => n + arr.length, 0);
  console.log("");
  console.log("findings:");
  console.log(`  decks missing event_id:            ${findings.decksWithoutEvent.length}`);
  console.log(`  decks w/ bad event_id:             ${findings.decksWithBadEvent.length}`);
  console.log(`  decks w/ aliasable event_id:       ${findings.decksWithAliasableEvent.length}  (--fix normalizes)`);
  console.log(`  decks w/ null legend:              ${findings.decksWithNullLegend.length}`);
  console.log(`  decks w/ normalizable legend:      ${findings.decksWithNormalizableLegend.length}  (--fix normalizes)`);
  console.log(`  decks w/ missing player:           ${findings.decksWithMissingPlayer.length}`);
  console.log(`  decks w/ unresolved card refs:     ${findings.decksWithUnresolvedCards.length}`);
  console.log(`  events missing schema fields:      ${findings.eventsMissingSchema.length}`);
  console.log(`  events with no decklists:          ${findings.eventsWithoutDecks.length}`);
  console.log("");
  if (FIX) {
    console.log(`fixes: event_id: ${fixes.eventIds}, legend: ${fixes.legends}${DRY_RUN ? " (dry-run, nothing written)" : ""}`);
    console.log("");
  }
  console.log(`report: ${path.relative(KB_ROOT, REPORT_PATH)}`);

  // Exit non-zero only for things that actually block ingest:
  //   - bad event_ids, null legends, schema-missing events.
  const blockers =
    findings.decksWithBadEvent.length +
    findings.decksWithNullLegend.length +
    findings.eventsMissingSchema.length;
  process.exit(blockers > 0 ? 1 : 0);
}

main();
