#!/usr/bin/env node
/**
 * regen-event-best-decklists.mjs — Materialize event-level best deck pointers.
 *
 * For every root `events/*.json` record, this script groups full-card
 * decklists by legend and selects the highest-placing deck for each legend.
 * The resulting pointers are written to `event.best_decklists`.
 *
 * This is intentionally distinct from `is_best_of_legend`: Riot articles use
 * "Best-Of" as an editorial label, while event-best here simply means "best
 * available full-card decklist for this legend at this event."
 */

import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const KB_ROOT = path.resolve(HERE, "..");
const EVENTS_DIR = path.join(KB_ROOT, "events");
const DECKS_DIR = path.join(KB_ROOT, "decklists");

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function writeJson(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n");
}

function isEventFile(name) {
  return name.endsWith(".json") && name !== "index.json" && name !== "index.normalized.json";
}

function placementRank(placement) {
  const p = String(placement ?? "").trim().toLowerCase();

  if (p === "winner" || p === "1" || p === "1st" || p === "1st place") return 1;
  if (p === "runner-up" || p === "runner up" || p === "2" || p === "2nd" || p === "2nd place") return 2;
  if (p.includes("top 4")) return 4.5;
  if (p.includes("top 8") || p.includes("top-8") || p.startsWith("t8")) return 8.5;

  const match = p.match(/\d+/);
  return match ? Number(match[0]) : 999;
}

function shortLegend(legend) {
  return String(legend || "").split(",")[0].trim();
}

function loadDecksByEvent() {
  const byEvent = new Map();

  for (const name of fs.readdirSync(DECKS_DIR)) {
    if (!name.endsWith(".json") || name === "index.json" || name === "index.normalized.json") continue;

    const deck = readJson(path.join(DECKS_DIR, name));
    if (!deck.event_id || !deck.legend || !Array.isArray(deck.cards) || deck.cards.length === 0) continue;

    if (!byEvent.has(deck.event_id)) byEvent.set(deck.event_id, []);
    byEvent.get(deck.event_id).push({ ...deck, _file: name });
  }

  return byEvent;
}

function bestDecklistsForEvent(decks) {
  const byLegend = new Map();

  for (const deck of decks) {
    const key = shortLegend(deck.legend);
    if (!key) continue;
    if (!byLegend.has(key)) byLegend.set(key, []);
    byLegend.get(key).push(deck);
  }

  return [...byLegend.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, candidates]) => {
      candidates.sort((a, b) => {
        const byPlacement = placementRank(a.placement) - placementRank(b.placement);
        if (byPlacement !== 0) return byPlacement;
        return String(a.decklist_id).localeCompare(String(b.decklist_id));
      });

      const deck = candidates[0];
      return {
        legend: deck.legend,
        decklist_id: deck.decklist_id,
        player: deck.player,
        placement: deck.placement,
        selection: "best_available_by_event_placement",
        has_full_card_list: true,
      };
    });
}

function main() {
  const byEvent = loadDecksByEvent();
  let updated = 0;

  for (const name of fs.readdirSync(EVENTS_DIR)) {
    if (!isEventFile(name)) continue;

    const eventPath = path.join(EVENTS_DIR, name);
    const event = readJson(eventPath);
    const decks = byEvent.get(event.event_id) || [];
    const best = bestDecklistsForEvent(decks);

    const before = JSON.stringify(event.best_decklists || []);
    const after = JSON.stringify(best);
    event.best_decklists = best;

    if (best.length > 0) {
      event.best_of_legends = best.map((entry) => entry.legend);
    }

    if (before !== after) {
      updated += 1;
      writeJson(eventPath, event);
    }
  }

  console.log(`✓ wrote event best_decklists (${updated} events changed)`);
}

main();
