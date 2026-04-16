#!/usr/bin/env node
/**
 * regen-current-meta.mjs — Regenerate meta/current.md from the canonical KB.
 *
 * meta/current.md is the concise, agent-readable digest of "what the
 * current Riftbound tournament meta looks like right now". It's shorter
 * and more opinionated than meta/current-tournament-snapshot.md (which is
 * the raw ledger) — the agent consults current.md first when writing
 * articles or answering meta questions.
 *
 * Run this whenever events or decklists change:
 *   node scripts/regen-current-meta.mjs
 */

import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const KB_ROOT = path.resolve(HERE, "..");
const DECKS_DIR = path.join(KB_ROOT, "decklists");
const EVENTS_DIR = path.join(KB_ROOT, "events");
const META_SNAP = path.join(KB_ROOT, "meta", "current-tournament-snapshot.json");
const OUT_PATH = path.join(KB_ROOT, "meta", "current.md");

function readJson(p) { return JSON.parse(fs.readFileSync(p, "utf8")); }

function loadEvents() {
  const events = {};
  for (const name of fs.readdirSync(EVENTS_DIR)) {
    if (!name.endsWith(".json")) continue;
    if (name === "index.json" || name === "index.normalized.json") continue;
    const full = path.join(EVENTS_DIR, name);
    if (fs.statSync(full).isDirectory()) continue;
    try {
      const ev = readJson(full);
      if (ev.event_id) events[ev.event_id] = ev;
    } catch {}
  }
  return events;
}

function loadDecks() {
  const decks = [];
  for (const name of fs.readdirSync(DECKS_DIR)) {
    if (!name.endsWith(".json")) continue;
    try {
      const d = readJson(path.join(DECKS_DIR, name));
      decks.push({ ...d, _file: name });
    } catch {}
  }
  return decks;
}

function eventAliasMap(events) {
  const m = new Map();
  for (const id of Object.keys(events)) m.set(id, id);
  for (const id of Object.keys(events)) {
    const parts = id.split("-");
    for (let i = parts.length - 1; i >= 2; i--) {
      const alias = parts.slice(0, i).join("-");
      if (!m.has(alias)) m.set(alias, id);
    }
  }
  return m;
}

function topN(map, n) {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

function isWinner(placement) {
  return /^(winner|1(st)?( place)?|1)$/i.test(String(placement ?? "").trim());
}

function isTop8(placement) {
  const p = String(placement ?? "").trim().toLowerCase();
  return isWinner(placement)
    || /(^|[^\d])[1-8](st|nd|rd|th)?( place)?$/i.test(p)
    || p === "top 8"
    || p.startsWith("t8")
    || p.includes("top-8");
}

function shortLegend(legend) {
  return (legend || "").split(",")[0].trim();
}

function main() {
  const events = loadEvents();
  const aliases = eventAliasMap(events);
  const decks = loadDecks();
  const snapshot = fs.existsSync(META_SNAP) ? readJson(META_SNAP) : null;

  // Resolve event_id for every deck so we can group.
  for (const d of decks) {
    d._event_id = aliases.get(d.event_id) ?? d.event_id;
    d._event = events[d._event_id];
  }

  // Winners per event
  const winners = [];
  for (const ev of Object.values(events)) {
    const ws = decks.filter((d) => d._event_id === ev.event_id && isWinner(d.placement));
    for (const w of ws) winners.push({ ev, deck: w });
  }
  winners.sort((a, b) => String(b.ev.start_date ?? "").localeCompare(String(a.ev.start_date ?? "")));

  // Legend frequency (short form) across top 8s
  const freq = new Map();
  for (const d of decks) {
    if (!isTop8(d.placement)) continue;
    const s = shortLegend(d.legend);
    if (!s) continue;
    freq.set(s, (freq.get(s) ?? 0) + 1);
  }
  const total = [...freq.values()].reduce((n, v) => n + v, 0) || 1;

  function tierFor(share) {
    if (share >= 0.15) return "S";
    if (share >= 0.08) return "A";
    if (share >= 0.04) return "B";
    return "C";
  }

  const tiers = { S: [], A: [], B: [], C: [] };
  for (const [legend, n] of topN(freq, 15)) {
    const share = n / total;
    tiers[tierFor(share)].push({ legend, n, share });
  }

  // Recent top 8 decks (last 3 events by date)
  const eventsByDate = Object.values(events)
    .filter((e) => e.start_date)
    .sort((a, b) => String(b.start_date).localeCompare(String(a.start_date)))
    .slice(0, 3);
  const recentTop8 = [];
  for (const ev of eventsByDate) {
    const ds = decks
      .filter((d) => d._event_id === ev.event_id && isTop8(d.placement))
      .slice(0, 8);
    recentTop8.push({ ev, decks: ds });
  }

  // Coverage gaps — events with no decklists attached
  const gaps = Object.values(events)
    .filter((ev) => !decks.some((d) => d._event_id === ev.event_id))
    .map((ev) => ev.event_name || ev.event_id);

  const today = new Date().toISOString().slice(0, 10);
  const lines = [];
  lines.push(`# Riftbound — Current Meta Digest`);
  lines.push("");
  lines.push(`_Generated ${today} from ${Object.keys(events).length} canonical events and ${decks.length} decklists. Source of truth is this KB; do not cite outside it without flagging._`);
  lines.push("");

  lines.push("## TL;DR");
  lines.push("");
  const tl = tiers.S.concat(tiers.A).slice(0, 4).map((t) => `${t.legend} (${(t.share * 100).toFixed(1)}%)`).join(", ");
  lines.push(`- Dominant legends: ${tl || "insufficient data"}`);
  lines.push(`- Latest winners: ${winners.slice(0, 3).map((w) => `${w.ev.event_name} — ${w.deck.player || "?"} on ${w.deck.legend}`).join(" · ") || "insufficient data"}`);
  lines.push(`- Events covered: ${Object.keys(events).length} canonical, ${eventsByDate.length} with dates`);
  lines.push("");

  lines.push("## Tier list (frequency of top-8 placements in tracked events)");
  lines.push("");
  for (const t of ["S", "A", "B", "C"]) {
    if (!tiers[t].length) continue;
    lines.push(`### ${t} tier`);
    for (const row of tiers[t]) {
      lines.push(`- **${row.legend}** — ${row.n} top-8 placements (${(row.share * 100).toFixed(1)}% of tracked top 8s)`);
    }
    lines.push("");
  }

  lines.push("## Recent event winners (most recent first)");
  lines.push("");
  for (const w of winners.slice(0, 10)) {
    const date = w.ev.start_date ? ` (${w.ev.start_date})` : "";
    lines.push(`- **${w.ev.event_name}**${date} — ${w.deck.player || "?"} on ${w.deck.legend}`);
    lines.push(`  - decklist: \`decklists/${w.deck._file}\``);
  }
  lines.push("");

  lines.push("## Recent top-8 snapshots");
  lines.push("");
  for (const blk of recentTop8) {
    lines.push(`### ${blk.ev.event_name}${blk.ev.start_date ? ` — ${blk.ev.start_date}` : ""}`);
    if (!blk.decks.length) {
      lines.push(`- _no decklists recorded yet_`);
    } else {
      for (const d of blk.decks) {
        lines.push(`- ${d.placement || "?"}: ${d.player || "?"} on ${d.legend}  \`decklists/${d._file}\``);
      }
    }
    lines.push("");
  }

  if (gaps.length) {
    lines.push("## Coverage gaps");
    lines.push("");
    lines.push(`Events with no decklists in this KB — articles referencing these events must be flagged as light on data:`);
    for (const g of gaps) lines.push(`- ${g}`);
    lines.push("");
  }

  if (snapshot?.cards_by_set) {
    lines.push("## Card pool");
    lines.push("");
    for (const [set, n] of Object.entries(snapshot.cards_by_set)) {
      lines.push(`- ${set}: ${n} cards`);
    }
    lines.push(`- total: ${snapshot.cards_total ?? "?"} cards`);
    lines.push("");
  }

  lines.push("## How to use this digest");
  lines.push("");
  lines.push(`- Cite any tournament claim against a specific row in this file or the underlying decklist/event JSON.`);
  lines.push(`- When claims here conflict with an article draft, the KB wins; update the article.`);
  lines.push(`- When the KB is silent on something, say "no KB coverage yet" instead of inventing it.`);
  lines.push(`- Regenerate with \`node scripts/regen-current-meta.mjs\` after editing events/decklists.`);
  lines.push("");

  fs.writeFileSync(OUT_PATH, lines.join("\n"));
  console.log(`✓ wrote ${path.relative(KB_ROOT, OUT_PATH)}`);
  console.log(`  events covered: ${Object.keys(events).length}, decks: ${decks.length}, winners recorded: ${winners.length}`);
}

main();
