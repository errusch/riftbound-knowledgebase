#!/usr/bin/env node
/**
 * lint-expert-exam.mjs — Validate saved Hermes exam answers.
 *
 * Usage:
 *   node scripts/lint-expert-exam.mjs reports/hermes-riftbound-expert-test-results.md
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import url from "node:url";
import { spawnSync } from "node:child_process";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const KB_ROOT = path.resolve(HERE, "..");
const EXAM = path.join(KB_ROOT, "reports", "expert-exam-questions.json");
const OUTPUT_LINT = path.join(KB_ROOT, "scripts", "lint-expert-output.mjs");

const input = process.argv[2];
if (!input) {
  console.error("usage: node scripts/lint-expert-exam.mjs <answer-file.md>");
  process.exit(2);
}
const filePath = path.isAbsolute(input) ? input : path.join(KB_ROOT, input);
const text = fs.readFileSync(filePath, "utf8");
const exam = JSON.parse(fs.readFileSync(EXAM, "utf8"));
const findings = [];

function includesLoose(haystack, needle) {
  return haystack.toLowerCase().includes(String(needle).toLowerCase());
}

function answerSections(markdown) {
  const matches = [...markdown.matchAll(/^##\s+(.+)$/gm)];
  const sections = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index ?? 0;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? markdown.length) : markdown.length;
    sections.push({ heading: matches[i][1], text: markdown.slice(start, end) });
  }
  return sections;
}

const sections = answerSections(text);

function sectionFor(question, index) {
  const expectedQ = `Q${index + 1}`;
  return sections.find((s) => s.heading.toLowerCase().includes(question.id.toLowerCase()))
    ?? sections.find((s) => s.heading.toLowerCase().startsWith(expectedQ.toLowerCase()))
    ?? sections.find((s) => includesLoose(s.text, question.prompt));
}

function answerBody(sectionText) {
  const marker = sectionText.match(/\*\*Answer:\*\*/i);
  if (!marker) return sectionText;
  const start = (marker.index ?? 0) + marker[0].length;
  const rest = sectionText.slice(start);
  const stop = rest.search(/\n\*\*(Sources|Must-include check|Forbidden-claims check):\*\*/i);
  return stop >= 0 ? rest.slice(0, stop) : rest;
}

const answerOnlyParts = [];

for (const [index, q] of (exam.questions ?? []).entries()) {
  const section = sectionFor(q, index);
  if (!section) {
    findings.push({ id: q.id, severity: "warning", message: "no matching answer section found" });
    continue;
  }
  const body = answerBody(section.text);
  answerOnlyParts.push(`## Answer ${index + 1}\n${body.trim()}\n`);
  for (const must of q.must_include ?? []) {
    if (!includesLoose(body, must)) {
      findings.push({ id: q.id, severity: "warning", message: `missing expected phrase: ${must}` });
    }
  }
  for (const bad of q.forbidden_claims ?? []) {
    if (includesLoose(body, bad)) {
      findings.push({ id: q.id, severity: "error", message: `contains forbidden phrase: ${bad}` });
    }
  }
}

const tmpFile = path.join(os.tmpdir(), `riftbound-exam-answers-${process.pid}.md`);
fs.writeFileSync(tmpFile, answerOnlyParts.join("\n"));
const lint = spawnSync(process.execPath, [OUTPUT_LINT, tmpFile], { encoding: "utf8" });
try { fs.unlinkSync(tmpFile); } catch {}
const outputLintOk = lint.status === 0;

if (!outputLintOk || findings.length) {
  console.log("# Expert Exam Lint: FAILED");
  if (lint.stdout.trim()) console.log(lint.stdout.trim());
  if (lint.stderr.trim()) console.log(lint.stderr.trim());
  for (const f of findings) console.log(`- [${f.severity}] ${f.id}: ${f.message}`);
  process.exit(findings.some((f) => f.severity === "error") || !outputLintOk ? 1 : 0);
}

console.log("# Expert Exam Lint: OK");
