#!/usr/bin/env node
/**
 * ingest-event.mjs — Validate and land structured tournament data.
 *
 * Takes a single JSON file describing ONE event and its decklists, validates
 * it against the KB schemas, normalizes ids/slugs, enriches card references
 * against the canonical card index, and writes the files into
 *   events/<event_id>.json
 *   decklists/<decklist_id>.json
 *
 * The extraction half of the ingest loop is done by the agent (see the
 * riftbound-ingest skill) — that's where the LLM reads a tournament URL
 * and produces the structured JSON. This script is the deterministic
 * filesystem + validation side of that loop.
 *
 * Usage:
 *   node scripts/ingest-event.mjs --input path/to/ingest.json
 *   node scripts/ingest-event.mjs --input -            # stdin
 *   node scripts/ingest-event.mjs --input foo.json --dry-run
 *   node scripts/ingest-event.mjs --input foo.json --force   # overwrite
 *
 * Expected input shape:
 *   {
 *     "event": { ...event_record fields... },
 *     "decklists": [ { ...decklist_record fields... }, ... ]
 *   }
 *
 * Missing fields get reasonable defaults:
 *   - event.event_id       → slugify(event_name + start_date)
 *   - decklist.decklist_id → "<event_id>--<legend-slug>-<player-slug>-N"
 *   - decklist.event_id    → event.event_id (unless explicitly set)
 *   - decklist.source      → event.source (unless explicitly set)
 *   - card.card_id         → looked up from canon/cards/index.json by name
 *
 * Exits non-zero on validation failure or missing required input.
 */

import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const KB_ROOT = path.resolve(HERE, "..");
const EVENTS_DIR = path.join(KB_ROOT, "events");
const DECKS_DIR = path.join(KB_ROOT, "decklists");
const CARD_INDEX = path.join(KB_ROOT, "canon", "cards", "index.json");

// ---------------- arg parsing ----------------
function parseArgs(argv) {
  const out = { input: null, dryRun: false, force: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--input" || a === "-i") out.input = argv[++i];
    else if (a === "--dry-run") out.dryRun = true;
    else if (a === "--force") out.force = true;
    else if (a === "--help" || a === "-h") {
      printHelp();
      process.exit(0);
    } else {
      console.error(`unknown arg: ${a}`);
      process.exit(2);
    }
  }
  if (!out.input) {
    printHelp();
    process.exit(2);
  }
  return out;
}

function printHelp() {
  console.error(`usage: ingest-event.mjs --input <file|->  [--dry-run] [--force]`);
}

// ---------------- utils ----------------
function slugify(s) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function readJsonFile(p) {
  const raw = p === "-" ? fs.readFileSync(0, "utf8") : fs.readFileSync(p, "utf8");
  return JSON.parse(raw);
}

function warn(...a) { console.log("  ! " + a.join(" ")); }
function ok(...a)   { console.log("  ✓ " + a.join(" ")); }
function info(...a) { console.log("  · " + a.join(" ")); }

// ---------------- validation (lightweight, no deps) ----------------
const EVENT_TYPES = new Set([
  "regional_qualifier", "national_open", "convention_event", "other_official_event",
]);
const COVERAGE_KINDS = new Set([
  "preview", "results", "top_decks", "schedule", "roadmap", "rules_policy", "other",
]);
const TRUST_TIERS = new Set([
  "official", "trusted_secondary", "market", "best_available", "unverified",
]);

function validateSource(src, pathLabel) {
  const errors = [];
  if (!src || typeof src !== "object") {
    errors.push(`${pathLabel}: source missing`);
    return errors;
  }
  if (!src.source_name) errors.push(`${pathLabel}: source.source_name required`);
  if (!src.source_type) errors.push(`${pathLabel}: source.source_type required`);
  if (src.source_type && !TRUST_TIERS.has(src.source_type)) {
    errors.push(`${pathLabel}: source.source_type "${src.source_type}" not allowed`);
  }
  if (!src.trust_tier) errors.push(`${pathLabel}: source.trust_tier required`);
  if (src.trust_tier && !TRUST_TIERS.has(src.trust_tier)) {
    errors.push(`${pathLabel}: source.trust_tier "${src.trust_tier}" not allowed`);
  }
  return errors;
}

function validateEvent(ev) {
  const errors = [];
  if (!ev.event_name) errors.push("event: event_name required");
  if (!ev.event_type) errors.push("event: event_type required");
  if (ev.event_type && !EVENT_TYPES.has(ev.event_type)) {
    errors.push(`event: event_type "${ev.event_type}" not allowed`);
  }
  if (ev.coverage_kind && !COVERAGE_KINDS.has(ev.coverage_kind)) {
    errors.push(`event: coverage_kind "${ev.coverage_kind}" not allowed`);
  }
  errors.push(...validateSource(ev.source, "event"));
  return errors;
}

function validateDecklist(d, idx) {
  const errors = [];
  if (!d.legend) errors.push(`decklist[${idx}]: legend required`);
  if (!Array.isArray(d.cards) || d.cards.length === 0) {
    errors.push(`decklist[${idx}]: cards[] required, non-empty`);
  } else {
    d.cards.forEach((c, ci) => {
      if (!c.card_id && !c.name) {
        errors.push(`decklist[${idx}].cards[${ci}]: need card_id or name`);
      }
      if (c.count == null) {
        errors.push(`decklist[${idx}].cards[${ci}]: count required`);
      }
    });
  }
  errors.push(...validateSource(d.source, `decklist[${idx}]`));
  return errors;
}

// ---------------- enrichment ----------------
let _cardIndex = null;
function cardIndex() {
  if (_cardIndex) return _cardIndex;
  if (!fs.existsSync(CARD_INDEX)) {
    _cardIndex = { byId: new Map(), byName: new Map() };
    return _cardIndex;
  }
  const idx = JSON.parse(fs.readFileSync(CARD_INDEX, "utf8"));
  const byId = new Map();
  const byName = new Map();
  for (const item of idx.items ?? []) {
    byId.set(item.card_id, item);
    const key = (item.name || "").toLowerCase().trim();
    if (key) byName.set(key, item);
  }
  _cardIndex = { byId, byName };
  return _cardIndex;
}

function resolveCardRef(c) {
  const { byId, byName } = cardIndex();
  if (c.card_id && byId.has(c.card_id)) {
    const m = byId.get(c.card_id);
    return { ...c, card_id: m.card_id, name: c.name || m.name, _resolved: true };
  }
  if (!c.card_id && c.name) {
    const hit = byName.get(c.name.toLowerCase().trim());
    if (hit) return { ...c, card_id: hit.card_id, _resolved: true };
  }
  return { ...c, _resolved: false };
}

function deriveEventId(ev) {
  if (ev.event_id) return ev.event_id;
  const base = slugify(ev.event_name);
  const date = ev.start_date ? ev.start_date.slice(0, 7) : "";
  return date ? `${base}-${date}` : base;
}

function deriveDecklistId(d, eventId, used) {
  if (d.decklist_id) return d.decklist_id;
  const legend = slugify((d.legend || "unknown").split(",")[0]);
  const who = slugify(d.player || "anon");
  const base = `${eventId}--${legend}-${who}`;
  let id = base, n = 1;
  while (used.has(id)) id = `${base}-${++n}`;
  return id;
}

// ---------------- main ----------------
function main() {
  const args = parseArgs(process.argv.slice(2));
  console.log(`→ ingesting from ${args.input}${args.dryRun ? " (dry-run)" : ""}`);

  const payload = readJsonFile(args.input);
  if (!payload.event || !Array.isArray(payload.decklists)) {
    console.error("! input must have { event, decklists: [...] }");
    process.exit(2);
  }

  // Validate event
  const event = { ...payload.event };
  event.event_id = deriveEventId(event);

  const evErrors = validateEvent(event);
  if (evErrors.length) {
    console.error("event validation failed:");
    evErrors.forEach((e) => console.error("  - " + e));
    process.exit(1);
  }
  ok(`event_id: ${event.event_id}`);
  if (!payload.event.event_id) info(`(derived from event_name + start_date)`);

  // Enrich + validate decklists
  const usedIds = new Set();
  const decks = [];
  const allErrors = [];
  let unresolvedCards = 0;

  payload.decklists.forEach((rawDeck, idx) => {
    const d = { ...rawDeck };
    if (!d.event_id) d.event_id = event.event_id;
    if (!d.source) d.source = event.source;
    d.decklist_id = deriveDecklistId(d, event.event_id, usedIds);
    usedIds.add(d.decklist_id);

    d.cards = (d.cards ?? []).map((c) => {
      const out = resolveCardRef(c);
      if (!out._resolved) unresolvedCards += 1;
      delete out._resolved;
      return out;
    });

    const errs = validateDecklist(d, idx);
    if (errs.length) allErrors.push(...errs);
    decks.push(d);
  });

  if (allErrors.length) {
    console.error("decklist validation failed:");
    allErrors.forEach((e) => console.error("  - " + e));
    process.exit(1);
  }

  ok(`decklists: ${decks.length} records, ${unresolvedCards} unresolved card refs`);
  if (unresolvedCards) warn(`unresolved card refs will land in files with the name-only stub — fix before publishing`);

  // Conflict detection
  const evPath = path.join(EVENTS_DIR, `${event.event_id}.json`);
  const conflicts = [];
  if (fs.existsSync(evPath) && !args.force) conflicts.push(evPath);
  const deckPaths = decks.map((d) => ({
    deck: d,
    path: path.join(DECKS_DIR, `${d.decklist_id}.json`),
  }));
  for (const dp of deckPaths) {
    if (fs.existsSync(dp.path) && !args.force) conflicts.push(dp.path);
  }
  if (conflicts.length) {
    console.error("! refusing to overwrite existing files (use --force to replace):");
    conflicts.forEach((c) => console.error("  - " + path.relative(KB_ROOT, c)));
    process.exit(1);
  }

  if (args.dryRun) {
    info("would write:");
    info("  " + path.relative(KB_ROOT, evPath));
    for (const dp of deckPaths) info("  " + path.relative(KB_ROOT, dp.path));
    info("dry-run: no files written");
    return;
  }

  fs.mkdirSync(EVENTS_DIR, { recursive: true });
  fs.mkdirSync(DECKS_DIR, { recursive: true });
  fs.writeFileSync(evPath, JSON.stringify(event, null, 2) + "\n");
  for (const dp of deckPaths) {
    fs.writeFileSync(dp.path, JSON.stringify(dp.deck, null, 2) + "\n");
  }

  ok(`wrote ${path.relative(KB_ROOT, evPath)}`);
  ok(`wrote ${decks.length} decklists to ${path.relative(KB_ROOT, DECKS_DIR)}/`);

  console.log("");
  console.log("next steps:");
  console.log("  1. node scripts/regen-current-meta.mjs           # refresh meta digest");
  console.log("  2. cd ~/hextech-analytics-current && npm run sync-kb");
  console.log("  3. npm run verify-cards                          # ratchet");
  console.log("  4. git add + commit in both repos");
}

main();
