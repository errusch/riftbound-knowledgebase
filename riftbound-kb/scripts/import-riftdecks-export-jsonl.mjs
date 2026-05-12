#!/usr/bin/env node
/**
 * import-riftdecks-export-jsonl.mjs — Import RiftDecks Export TXT records.
 *
 * Input JSONL records are produced by the RiftDecks primary-source crawl:
 * {
 *   metagame,event_name,event_url,legend,rank,player,
 *   deck_page_url,export_txt_url,export_text,status,blocker
 * }
 *
 * Only records with status="ok" and a full export_text are imported.
 */

import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const KB_ROOT = path.resolve(HERE, "..");
const CARD_INDEX = path.join(KB_ROOT, "canon", "cards", "index.json");
const DECKS_DIR = path.join(KB_ROOT, "decklists");
const EVENTS_DIR = path.join(KB_ROOT, "events");
const REGISTRY = path.join(KB_ROOT, "sources", "official-event-registry.json");

const input = process.argv[2];
if (!input) {
  console.error("usage: node scripts/import-riftdecks-export-jsonl.mjs <exports.jsonl>");
  process.exit(2);
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function writeJson(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n");
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function normalizeName(value) {
  return String(value || "")
    .replace(/\([^)]*\)/g, "")
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[–-]/g, ",")
    .replace(/\s+/g, " ")
    .trim();
}

const cardIndex = readJson(CARD_INDEX).items || [];
const byName = new Map();
for (const card of cardIndex) {
  const key = normalizeName(card.name);
  if (!byName.has(key) || !String(card.card_id).includes("a-")) byName.set(key, card);
}

const aliases = new Map([
  [normalizeName("Ahri, Nine-Tailed Fox"), normalizeName("Nine-Tailed Fox")],
  [normalizeName("Annie, Dark Child"), normalizeName("Dark Child - Starter")],
  [normalizeName("Azir, Emperor of the Sands"), normalizeName("Emperor of the Sands")],
  [normalizeName("Darius, Hand of Noxus"), normalizeName("Hand of Noxus")],
  [normalizeName("Diana, Scorn of the Moon"), normalizeName("Scorn of the Moon")],
  [normalizeName("Draven, Glorious Executioner"), normalizeName("Glorious Executioner")],
  [normalizeName("Ezreal, Prodigal Explorer"), normalizeName("Prodigal Explorer")],
  [normalizeName("Fiora, Grand Duelist"), normalizeName("Grand Duelist")],
  [normalizeName("Garen, Might of Demacia"), normalizeName("Might of Demacia - Starter")],
  [normalizeName("Irelia, Blade Dancer"), normalizeName("Blade Dancer")],
  [normalizeName("Ivern, Green Father"), normalizeName("Green Father")],
  [normalizeName("Jax, Grandmaster at Arms"), normalizeName("Grandmaster at Arms")],
  [normalizeName("Jhin, Virtuoso"), normalizeName("Virtuoso")],
  [normalizeName("Jinx, Loose Cannon"), normalizeName("Loose Cannon")],
  [normalizeName("Kai'sa, Daughter of the Void"), normalizeName("Kai'Sa, Daughter of the Void")],
  [normalizeName("Kai'Sa, Daughter of the Void"), normalizeName("Daughter of the Void")],
  [normalizeName("Kha'Zix, Voidreaver"), normalizeName("Voidreaver")],
  [normalizeName("LeBlanc, Deceiver"), normalizeName("Deceiver")],
  [normalizeName("Lee Sin, Blind Monk"), normalizeName("Blind Monk")],
  [normalizeName("Leona, Radiant Dawn"), normalizeName("Radiant Dawn")],
  [normalizeName("Lillia, Bashful Bloom"), normalizeName("Bashful Bloom")],
  [normalizeName("Lucian, Purifier"), normalizeName("Purifier")],
  [normalizeName("Lux, Lady of Luminosity"), normalizeName("Lady of Luminosity - Starter")],
  [normalizeName("Master Yi, Wuju Bladesman"), normalizeName("Wuju Bladesman - Starter")],
  [normalizeName("Master Yi, Honed"), normalizeName("Yi, Honed")],
  [normalizeName("Master Yi, Wuju Master"), normalizeName("Wuju Master")],
  [normalizeName("Miss Fortune, Bounty Hunter"), normalizeName("Bounty Hunter")],
  [normalizeName("Ornn, Fire Below the Mountain"), normalizeName("Ornn, the Fire Below the Mountain")],
  [normalizeName("Ornn, Fire Below the Mountain"), normalizeName("Fire Below the Mountain")],
  [normalizeName("Ornn, the Fire Below the Mountain"), normalizeName("Fire Below the Mountain")],
  [normalizeName("Poppy, Keeper of the Hammer"), normalizeName("Keeper of the Hammer")],
  [normalizeName("Pyke, Bloodharbor Ripper"), normalizeName("Bloodharbor Ripper")],
  [normalizeName("Reksai, Void Burrower"), normalizeName("Rek'Sai, Void Burrower")],
  [normalizeName("Rek'Sai, Void Burrower"), normalizeName("Void Burrower")],
  [normalizeName("Renata, Chem-Baroness"), normalizeName("Renata Glasc, Chem-Baroness")],
  [normalizeName("Renata Glasc, Chem-Baroness"), normalizeName("Chem-Baroness")],
  [normalizeName("Rengar, Pridestalker"), normalizeName("Pridestalker")],
  [normalizeName("Rumble, Mechanized Menace"), normalizeName("Mechanized Menace")],
  [normalizeName("Sett, The Boss"), normalizeName("The Boss")],
  [normalizeName("Sivir, Battle Mistress"), normalizeName("Battle Mistress")],
  [normalizeName("Si vir, Mercenary"), normalizeName("Sivir, Mercenary")],
  [normalizeName("Teemo, Swift Scout"), normalizeName("Swift Scout")],
  [normalizeName("Viktor, Herald of the Arcane"), normalizeName("Herald of the Arcane")],
  [normalizeName("Vex, Gloomist"), normalizeName("Gloomist")],
  [normalizeName("Vi, Piltover Enforcer"), normalizeName("Piltover Enforcer")],
  [normalizeName("Volibear, Relentless Storm"), normalizeName("Relentless Storm")],
  [normalizeName("Yasuo, Unforgiven"), normalizeName("Unforgiven")],
]);

function resolveCard(name) {
  const key = normalizeName(name);
  const aliased = aliases.get(key);
  const hit = byName.get(key) || (aliased ? byName.get(aliased) : null);
  if (!hit) throw new Error(`unresolved card: ${name}`);
  return hit;
}

function parseSection(text, label, nextLabels) {
  const start = text.indexOf(`${label}:`);
  if (start < 0) return [];

  let end = text.length;
  for (const next of nextLabels) {
    const idx = text.indexOf(`${next}:`, start + label.length + 1);
    if (idx >= 0 && idx < end) end = idx;
  }

  const block = text.slice(start + label.length + 1, end).trim();
  return block
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(\d+)\s+(.+)$/);
      if (!match) throw new Error(`bad deck line in ${label}: ${line}`);
      return { count: Number(match[1]), name: match[2].trim() };
    });
}

function parseExport(text) {
  const labels = ["Legend", "Champion", "MainDeck", "Battlefields", "Rune Pool", "Sideboard"];
  return {
    legend: parseSection(text, "Legend", labels.filter((x) => x !== "Legend")),
    champion: parseSection(text, "Champion", labels.filter((x) => x !== "Champion")),
    mainboard: parseSection(text, "MainDeck", labels.filter((x) => x !== "MainDeck")),
    battlefields: parseSection(text, "Battlefields", labels.filter((x) => x !== "Battlefields")),
    runes: parseSection(text, "Rune Pool", labels.filter((x) => x !== "Rune Pool")),
    sideboard: parseSection(text, "Sideboard", []),
  };
}

function cardEntry(section, parsed) {
  const card = resolveCard(parsed.name);
  return {
    card_id: card.card_id,
    card_code: `${card.set_code}-${String(card.card_id).split("-")[1]}`.toUpperCase(),
    count: parsed.count,
    name: card.name,
    section,
  };
}

function eventIdForName(name) {
  const registry = readJson(REGISTRY);
  const hit = registry.items.find((item) => item.event_name === name || item.event_id === name);
  if (hit?.root_event_path) return hit.event_id;
  if (hit?.event_id) return hit.event_id;
  return `riftdecks-${slugify(name)}`;
}

function importRecord(record) {
  if (record.status !== "ok") return { skipped: true, reason: record.blocker || "status not ok" };
  if (!record.export_text) return { skipped: true, reason: "missing export_text" };

  const event_id = record.event_id || eventIdForName(record.event_name);
  const parsed = parseExport(record.export_text);
  const legend = record.legend || parsed.legend[0]?.name;
  if (!legend) throw new Error("missing legend");

  const decklist_id = `${event_id}--best-of--${slugify(legend.split(",")[0])}`;
  const cards = [
    ...parsed.legend.map((card) => cardEntry("mainboard", card)),
    ...parsed.champion.map((card) => cardEntry("mainboard", card)),
    ...parsed.mainboard.map((card) => cardEntry("mainboard", card)),
    ...parsed.battlefields.map((card) => cardEntry("battlefields", card)),
    ...parsed.runes.map((card) => cardEntry("runes", card)),
    ...parsed.sideboard.map((card) => cardEntry("sideboard", card)),
  ];

  const deck = {
    decklist_id,
    event_id,
    player: record.player || null,
    legend,
    placement: record.rank || record.placement || null,
    is_best_of_legend: true,
    cards,
    source: {
      source_type: "trusted_secondary",
      source_name: "RiftDecks Export TXT",
      source_url: record.export_txt_url || record.deck_page_url || record.event_url,
      source_date: null,
      retrieved_at: new Date().toISOString().slice(0, 10),
      trust_tier: "trusted_secondary",
      notes: "Imported from RiftDecks Export TXT as primary meta deck source.",
    },
    secondary_sources: record.deck_page_url
      ? [
          {
            source_type: "trusted_secondary",
            source_name: "RiftDecks deck page",
            source_url: record.deck_page_url,
            source_date: null,
            retrieved_at: new Date().toISOString().slice(0, 10),
            trust_tier: "trusted_secondary",
          },
        ]
      : [],
    notes: `Best-of-legend import for ${record.event_name || event_id}.`,
  };

  writeJson(path.join(DECKS_DIR, `${decklist_id}.json`), deck);
  return { imported: true, decklist_id };
}

let imported = 0;
let skipped = 0;
let failed = 0;

for (const line of fs.readFileSync(input, "utf8").split(/\n/).filter(Boolean)) {
  try {
    const result = importRecord(JSON.parse(line));
    if (result.imported) imported += 1;
    else skipped += 1;
  } catch (error) {
    failed += 1;
    console.error(`! import failed: ${error.message}`);
  }
}

console.log(`✓ imported=${imported} skipped=${skipped} failed=${failed}`);
if (failed > 0) process.exit(1);
