#!/usr/bin/env node
/**
 * lint-expert-output.mjs — Scan Hermes Riftbound answers for terminology and
 * source-boundary mistakes.
 *
 * Usage:
 *   node scripts/lint-expert-output.mjs reports/hermes-riftbound-expert-test-results.md
 */

import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const KB_ROOT = path.resolve(HERE, "..");
const GLOSSARY = path.join(KB_ROOT, "reference", "terminology-glossary.json");

const input = process.argv[2];
if (!input) {
  console.error("usage: node scripts/lint-expert-output.mjs <answer-file.md>");
  process.exit(2);
}

const filePath = path.isAbsolute(input) ? input : path.join(KB_ROOT, input);
const text = fs.readFileSync(filePath, "utf8");
const glossary = JSON.parse(fs.readFileSync(GLOSSARY, "utf8"));
const findings = [];

function add(severity, message, evidence) {
  findings.push({ severity, message, evidence });
}

function lineFor(index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

function lineTextFor(index) {
  const lines = text.split(/\r?\n/);
  return lines[lineFor(index) - 1] ?? "";
}

function isCorrectiveMention(term, line) {
  const lower = line.toLowerCase();
  return lower.includes("not ")
    || lower.includes("don't apply")
    || lower.includes("doesn't apply")
    || lower.includes("do not apply")
    || lower.includes("did not")
    || lower.includes("legends of runeterra")
    || lower.includes("lor");
}

for (const item of glossary.forbidden_terms ?? []) {
  const term = item.term;
  const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
  for (const match of text.matchAll(re)) {
    const line = lineTextFor(match.index ?? 0);
    if (isCorrectiveMention(term, line)) continue;
    add("error", `Forbidden/suspicious term: ${term}. ${item.reason}`, `line ${lineFor(match.index ?? 0)}`);
  }
}

const legacyPatterns = [
  "~/Playground/data",
  "/Users/eric/Playground/data",
  "~/Playground/canon",
  "/Users/eric/Playground/canon",
  ".openclaw/workspace/tmp/riftbound-events",
  "riftbound-best-of-legend-decks-2026-03-26",
  "SKILL.backup-2026-04-27",
  "events/canonical/rq-lille.json"
];

for (const pat of legacyPatterns) {
  const idx = text.indexOf(pat);
  if (idx !== -1) {
    const severity = pat === "events/canonical/rq-lille.json" ? "warning" : "error";
    add(severity, `Legacy or secondary path referenced: ${pat}`, `line ${lineFor(idx)}`);
  }
}

const powerMisusePatterns = [
  /\bpower\/might\b/i,
  /\bpower\s+or\s+might\b/i,
  /\bpower\s+and\s+might\b/i,
  /\bdeal(?:s|ing)?\s+damage\s+via\s+power\b/i,
  /\bcombat\s+stat[s]?\s+\([^)]*power/i
];

for (const re of powerMisusePatterns) {
  const m = re.exec(text);
  if (m) add("error", "Potential Power/Might misuse. Power is rune/domain cost; Might is the combat stat.", `line ${lineFor(m.index)}`);
}

const highConfidenceArchetypeMisread = /High-confidence archetypes\s*\([^)]*11/i.exec(text);
if (highConfidenceArchetypeMisread) {
  add("warning", "Potential archetype confidence misread: snapshot has 11 high-confidence deck labels, not 11 high-confidence archetypes.", `line ${lineFor(highConfidenceArchetypeMisread.index)}`);
}

const annieHigh = /High-confidence[\s\S]{0,500}Annie Control/i.exec(text);
if (
  annieHigh
  && !/no archetype called ["“]?Annie Control/i.test(text)
  && !/Annie Control[\s\S]{0,120}not high-confidence/i.test(text)
) {
  add("error", "Annie Control is not high-confidence in the current post-ban snapshot; it has 3 pending-review labels.", `line ${lineFor(annieHigh.index)}`);
}

const result = {
  file: path.relative(KB_ROOT, filePath),
  findings,
  ok: !findings.some((f) => f.severity === "error")
};

if (findings.length) {
  console.log(`# Expert Output Lint: ${result.ok ? "WARNINGS" : "FAILED"}`);
  for (const f of findings) {
    console.log(`- [${f.severity}] ${f.message} (${f.evidence})`);
  }
} else {
  console.log("# Expert Output Lint: OK");
}

process.exit(result.ok ? 0 : 1);
