#!/usr/bin/env node
/**
 * regen-postban-archetypes.mjs — Generate recent post-ban archetype evidence.
 *
 * This is a separate meta layer. It does not mutate decklist JSON. Labels are
 * either high_confidence, provisional, or pending_review based on transparent
 * signature-package rules and card-vector evidence.
 *
 * Usage:
 *   node scripts/regen-postban-archetypes.mjs
 */

import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const KB_ROOT = path.resolve(HERE, "..");
const EVENTS_DIR = path.join(KB_ROOT, "events");
const DECKS_DIR = path.join(KB_ROOT, "decklists");
const CARD_INDEX = path.join(KB_ROOT, "canon", "cards", "index.json");
const LEGALITY = path.join(KB_ROOT, "canon", "legality", "bans-and-suspensions.json");
const RULES = path.join(KB_ROOT, "meta", "archetype-label-rules.json");
const OUT_JSON = path.join(KB_ROOT, "meta", "archetypes-postban.json");
const OUT_MD = path.join(KB_ROOT, "meta", "archetypes-postban.md");
const REVIEW_MD = path.join(KB_ROOT, "reports", "archetype-review-queue.md");

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function writeJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n");
}

function writeText(p, text) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text);
}

function loadEvents() {
  const events = {};
  for (const name of fs.readdirSync(EVENTS_DIR)) {
    if (!name.endsWith(".json")) continue;
    if (name === "index.json" || name === "index.normalized.json") continue;
    const full = path.join(EVENTS_DIR, name);
    if (fs.statSync(full).isDirectory()) continue;
    try {
      const ev = readJson(full);
      if (ev.event_id) events[ev.event_id] = { ...ev, _file: name };
    } catch {}
  }
  return events;
}

function loadDecks() {
  const decks = [];
  for (const name of fs.readdirSync(DECKS_DIR)) {
    if (!name.endsWith(".json")) continue;
    if (name === "index.json" || name === "index.normalized.json") continue;
    try {
      const d = readJson(path.join(DECKS_DIR, name));
      decks.push({ ...d, _file: name });
    } catch {}
  }
  return decks;
}

function eventAliasMap(events) {
  const m = new Map();
  const ids = Object.keys(events);
  for (const id of ids) m.set(id, id);

  function score(id) {
    const ev = events[id];
    let s = id.length;
    if (/-preview/i.test(id)) s += 100;
    else if (/preview/i.test(id)) s += 50;
    const ck = ev?.coverage_kind;
    if (ck === "preview") s += 100;
    if (ck === "results" || ck === "top_decks") s -= 10;
    return s;
  }

  const buckets = new Map();
  for (const id of ids) {
    const parts = id.split("-");
    for (let i = parts.length - 1; i >= 2; i--) {
      const alias = parts.slice(0, i).join("-");
      if (events[alias]) continue;
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

function shortLegend(legend) {
  return String(legend || "").split(",")[0].trim();
}

function placementRank(placement) {
  const p = String(placement ?? "").trim().toLowerCase();
  if (/^(winner|1(st)?( place)?|1)$/i.test(p)) return 1;
  if (p === "runner-up" || p === "runner up" || /^2(nd)?( place)?$/i.test(p)) return 2;
  const n = p.match(/^[^\d]*(\d+)(st|nd|rd|th)?( place)?$/i);
  if (n) return Number(n[1]);
  if (p === "top 4") return 4.5;
  if (p === "top 8" || p.startsWith("t8") || p.includes("top-8")) return 8.5;
  return 99;
}

function postBanCutoff(legality, rules) {
  const dates = (legality.entries ?? [])
    .filter((e) => e.format === rules.post_ban_window?.format && e.status === "banned" && e.effective_date)
    .map((e) => e.effective_date)
    .sort();
  return dates[0] ?? rules.post_ban_window?.fallback_effective_date ?? "2026-03-31";
}

function cardIndexMaps() {
  const idx = readJson(CARD_INDEX);
  const byId = new Map();
  for (const item of idx.items ?? []) byId.set(item.card_id, item);
  return byId;
}

function deckCardNames(deck, sections = new Set(["mainboard", "sideboard", "battlefields"])) {
  const names = new Map();
  for (const c of deck.cards ?? []) {
    if (!sections.has(c.section)) continue;
    const key = c.name;
    names.set(key, (names.get(key) ?? 0) + Number(c.count ?? 0));
  }
  return names;
}

function deckCardIds(deck) {
  const ids = new Set();
  for (const c of deck.cards ?? []) if (c.card_id) ids.add(c.card_id);
  return ids;
}

function bannedCardIds(legality) {
  const ids = new Set();
  for (const e of legality.entries ?? []) {
    if (e.status !== "banned") continue;
    for (const id of e.card_ids ?? []) ids.add(id);
  }
  return ids;
}

function classify(deck, rules) {
  const legend = shortLegend(deck.legend);
  const names = deckCardNames(deck);
  const candidates = [];
  for (const pkg of rules.signature_packages ?? []) {
    if (pkg.legend && pkg.legend !== legend) continue;
    const matched = [];
    for (const name of pkg.signature_cards ?? []) {
      if (names.has(name)) matched.push(name);
    }
    const score = matched.length * 2 + matched.reduce((n, name) => n + Math.min(3, names.get(name) ?? 0), 0);
    candidates.push({
      archetype: pkg.archetype,
      score,
      signature_cards_matched: matched,
      signature_cards_total: (pkg.signature_cards ?? []).length
    });
  }
  candidates.sort((a, b) => b.score - a.score);

  const thresholds = rules.thresholds ?? {};
  const best = candidates[0] ?? null;
  const second = candidates[1] ?? null;
  const generic = rules.generic_labels?.[legend] ?? `${legend || "Unknown"} Unknown`;
  const reasons = [];
  let label = generic;
  let status = "pending_review";
  let confidence = 0;

  if (best && best.score >= (thresholds.high_confidence_min_score ?? 8)) {
    label = best.archetype;
    confidence = Math.min(0.95, 0.55 + best.score / 30);
    status = "high_confidence";
    reasons.push(`matched ${best.signature_cards_matched.length}/${best.signature_cards_total} signature cards`);
  } else if (best && best.score >= (thresholds.provisional_min_score ?? 4)) {
    label = best.archetype;
    confidence = Math.min(0.75, 0.4 + best.score / 30);
    status = "provisional";
    reasons.push(`partial signature match: ${best.signature_cards_matched.join(", ")}`);
  } else if (legend) {
    confidence = 0.35;
    status = "pending_review";
    reasons.push("no strong signature package match; using generic legend label");
  } else {
    reasons.push("missing legend");
  }

  if (best && second && best.score - second.score <= (thresholds.ambiguous_delta ?? 2)) {
    status = "pending_review";
    reasons.push(`ambiguous candidates: ${best.archetype} (${best.score}) vs ${second.archetype} (${second.score})`);
  }

  return {
    label,
    status,
    confidence: Number(confidence.toFixed(2)),
    reasons,
    candidates: candidates.slice(0, 3)
  };
}

function groupBy(rows, keyFn) {
  const m = new Map();
  for (const row of rows) {
    const k = keyFn(row);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(row);
  }
  return m;
}

function topCards(rows, limit = 10) {
  const freq = new Map();
  for (const row of rows) {
    const names = deckCardNames(row.deck, new Set(["mainboard", "battlefields"]));
    for (const [name, count] of names.entries()) freq.set(name, (freq.get(name) ?? 0) + count);
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}

function renderSnapshot(snapshot) {
  const lines = [];
  lines.push("# Riftbound Post-Ban Archetypes");
  lines.push("");
  lines.push(`_Generated ${snapshot.generated_at.slice(0, 10)} from ${snapshot.counts.decks_analyzed} post-ban decklists. Archetype labels are separate meta evidence and are not written onto decklists._`);
  lines.push("");
  lines.push("## Scope");
  lines.push("");
  lines.push(`- Format: ${snapshot.scope.format}`);
  lines.push(`- Post-ban cutoff: ${snapshot.scope.post_ban_cutoff}`);
  lines.push(`- Events included: ${snapshot.counts.events_included}`);
  lines.push(`- Decks with banned cards flagged: ${snapshot.counts.decks_with_banned_cards}`);
  lines.push(`- Pending review: ${snapshot.counts.pending_review}`);
  lines.push("");
  lines.push("## Archetype Summary");
  lines.push("");
  for (const row of snapshot.archetypes) {
    lines.push(`### ${row.archetype}`);
    lines.push(`- decks: ${row.deck_count}`);
    lines.push(`- status mix: high ${row.status_counts.high_confidence ?? 0}, provisional ${row.status_counts.provisional ?? 0}, review ${row.status_counts.pending_review ?? 0}`);
    lines.push(`- legends: ${row.legends.map((x) => `${x.legend} (${x.count})`).join(", ") || "unknown"}`);
    lines.push(`- top cards: ${row.top_cards.slice(0, 6).map((x) => `${x.name} (${x.count})`).join(", ") || "n/a"}`);
    lines.push("");
  }
  lines.push("## How To Use");
  lines.push("");
  lines.push("- Use high-confidence labels as current KB-backed archetype evidence.");
  lines.push("- Treat provisional labels as directional and cite confidence.");
  lines.push("- Do not cite pending-review labels as fact; check `reports/archetype-review-queue.md`.");
  lines.push("- For deck advice, open the referenced decklist and event JSON before making a recommendation.");
  lines.push("");
  return lines.join("\n");
}

function renderReview(rows, scope) {
  const lines = [];
  lines.push("# Archetype Review Queue");
  lines.push("");
  lines.push(`_Generated ${new Date().toISOString()} for post-ban cutoff ${scope.post_ban_cutoff}._`);
  lines.push("");
  lines.push("Rows here are not canonical archetype facts. Review them before promoting labels.");
  lines.push("");
  if (!rows.length) {
    lines.push("_none_");
    return lines.join("\n");
  }
  for (const row of rows) {
    lines.push(`- \`${row.decklist_id}\` — ${row.player || "?"} on ${row.legend || "?"} (${row.event_name || row.event_id || "unknown event"})`);
    lines.push(`  - proposed: ${row.archetype.label} (${row.archetype.status}, confidence ${row.archetype.confidence})`);
    lines.push(`  - reasons: ${row.archetype.reasons.join("; ") || "none"}`);
    if (row.banned_card_names.length) lines.push(`  - banned cards present: ${row.banned_card_names.join(", ")}`);
  }
  lines.push("");
  return lines.join("\n");
}

function main() {
  console.log("→ regenerating post-ban archetype snapshot");
  const events = loadEvents();
  const aliases = eventAliasMap(events);
  const decks = loadDecks();
  const legality = readJson(LEGALITY);
  const rules = readJson(RULES);
  const cardsById = cardIndexMaps();
  const bannedIds = bannedCardIds(legality);
  const cutoff = postBanCutoff(legality, rules);

  const rows = [];
  const includedEvents = new Map();
  for (const deck of decks) {
    const eventId = aliases.get(deck.event_id) ?? deck.event_id;
    const ev = events[eventId];
    if (!ev?.start_date || ev.start_date < cutoff) continue;
    if (!["results", "top_decks"].includes(ev.coverage_kind)) continue;
    if (/pre-rift/i.test(`${ev.event_type ?? ""} ${ev.event_name ?? ""} ${eventId}`)) continue;
    if (/seeded|pre-rift/i.test(`${deck.decklist_id ?? ""} ${deck.source?.source_name ?? ""} ${deck.notes ?? ""}`)) continue;
    includedEvents.set(eventId, ev);
    const ids = deckCardIds(deck);
    const banned = [...ids].filter((id) => bannedIds.has(id));
    const archetype = classify(deck, rules);
    if (banned.length) {
      archetype.status = "pending_review";
      archetype.reasons.push("post-ban deck contains banned card ids");
    }
    rows.push({
      decklist_id: deck.decklist_id,
      deck_file: `decklists/${deck._file}`,
      event_id: eventId,
      event_name: ev.event_name,
      event_date: ev.start_date,
      player: deck.player,
      legend: deck.legend,
      placement: deck.placement ?? null,
      is_best_of_legend: Boolean(deck.is_best_of_legend),
      source_tier: deck.source?.trust_tier ?? ev.source?.trust_tier ?? null,
      archetype,
      banned_card_ids: banned,
      banned_card_names: banned.map((id) => cardsById.get(id)?.name ?? id),
      deck
    });
  }

  const groups = groupBy(rows, (r) => r.archetype.label);
  const archetypes = [...groups.entries()].map(([archetype, group]) => {
    const legends = [...groupBy(group, (r) => shortLegend(r.legend)).entries()]
      .map(([legend, rs]) => ({ legend, count: rs.length }))
      .sort((a, b) => b.count - a.count);
    const statusCounts = {};
    for (const r of group) statusCounts[r.archetype.status] = (statusCounts[r.archetype.status] ?? 0) + 1;
    const examples = group
      .slice()
      .sort((a, b) => placementRank(a.placement) - placementRank(b.placement))
      .slice(0, 5)
      .map((r) => ({
        decklist_id: r.decklist_id,
        deck_file: r.deck_file,
        event_name: r.event_name,
        event_date: r.event_date,
        player: r.player,
        legend: r.legend,
        placement: r.placement,
        status: r.archetype.status,
        confidence: r.archetype.confidence
      }));
    return {
      archetype,
      deck_count: group.length,
      status_counts: statusCounts,
      legends,
      top_cards: topCards(group),
      examples
    };
  }).sort((a, b) => b.deck_count - a.deck_count);

  const pending = rows
    .filter((r) => r.archetype.status === "pending_review" || r.banned_card_ids.length)
    .sort((a, b) => String(b.event_date).localeCompare(String(a.event_date)) || placementRank(a.placement) - placementRank(b.placement));

  const snapshot = {
    version: 1,
    generated_at: new Date().toISOString(),
    scope: {
      format: rules.post_ban_window?.format ?? "Standard Constructed",
      post_ban_cutoff: cutoff,
      source: "canon/legality/bans-and-suspensions.json",
      label_rules: "meta/archetype-label-rules.json",
      decklist_mutation: false
    },
    counts: {
      events_included: includedEvents.size,
      decks_analyzed: rows.length,
      decks_with_banned_cards: rows.filter((r) => r.banned_card_ids.length).length,
      high_confidence: rows.filter((r) => r.archetype.status === "high_confidence").length,
      provisional: rows.filter((r) => r.archetype.status === "provisional").length,
      pending_review: rows.filter((r) => r.archetype.status === "pending_review").length
    },
    archetypes,
    deck_labels: rows.map(({ deck, ...rest }) => rest),
    review_queue: pending.map(({ deck, ...rest }) => rest)
  };

  writeJson(OUT_JSON, snapshot);
  writeText(OUT_MD, renderSnapshot(snapshot));
  writeText(REVIEW_MD, renderReview(pending, snapshot.scope));
  console.log(`✓ wrote ${path.relative(KB_ROOT, OUT_JSON)}`);
  console.log(`✓ wrote ${path.relative(KB_ROOT, OUT_MD)}`);
  console.log(`✓ wrote ${path.relative(KB_ROOT, REVIEW_MD)}`);
  console.log(`  decks: ${rows.length}, review queue: ${pending.length}`);
}

main();
