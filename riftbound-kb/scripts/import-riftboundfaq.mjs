#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  RIFTBOUNDFAQ_SOURCE,
  buildRiftboundFaqSnapshot,
} from "./lib/riftboundfaq-ingest.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KB_ROOT = path.resolve(HERE, "..");
const DEFAULT_SOURCE_DIR = "/tmp/riftboundfaq-source-20260714";
const DEFAULT_OFFICIAL_RULES_TEXT = "/tmp/riftbound-core-rules-1.3-pdfium.txt";
const EXPECTED_OFFICIAL_EXTRACT_SHA256 =
  "08b4cee6a27e8ee7c299d8073db2599816b48f6984ee39c7312dab867b758a49";
const OFFICIAL_RULES = Object.freeze({
  version: "1.3",
  sourceDate: "2026-03-30",
  sourcePage: "https://playriftbound.com/en-us/rules-hub/",
  sourcePdf:
    "https://cmsassets.rgpub.io/sanity/files/dsfx7636/news_live/861747d1d4d505b7c14d73aba9749d1c3a209a67.pdf",
  sourcePdfSha256: "3733eaffa8b412ce37458d62e7cd22aa93d59f0a6925241bce5b0b5fd5ed1878",
  sourcePdfPages: 98,
  sourcePdfTitle: "Riftbound Core Rules RUP3 Staging",
  publisher: "Riot Games",
});
const OUTPUT_DIR = path.join(KB_ROOT, "canon/community-rules/riftboundfaq");
const REVIEW_MANIFEST_PATH = path.join(KB_ROOT, "sources/riftboundfaq-review-manifest.json");
const CARD_MENTION_MANIFEST_PATH = path.join(
  KB_ROOT,
  "sources/riftboundfaq-card-mention-manifest.json",
);
const RULINGS_INDEX_PATH = path.join(KB_ROOT, "canon/rulings/index.json");
const OFFICIAL_SOURCE_ARTIFACT_PATHS = [
  "canon/rulings/sources/riftbound-unleashed-errata-2026-04-03.json",
  "canon/rulings/sources/riftbound-unleashed-rules-faq-2026-04-29.json",
];

function parseArguments(argv) {
  const options = {
    sourceDir: DEFAULT_SOURCE_DIR,
    officialRulesText: DEFAULT_OFFICIAL_RULES_TEXT,
    check: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--source-dir") options.sourceDir = path.resolve(argv[++index]);
    else if (argument === "--official-rules-text") {
      options.officialRulesText = path.resolve(argv[++index]);
    } else if (argument === "--check") options.check = true;
    else throw new Error(`Unknown argument: ${argument}`);
  }
  return options;
}

function git(sourceDir, args) {
  return execFileSync("git", ["-C", sourceDir, ...args], {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  }).trimEnd();
}

function gitRaw(sourceDir, args) {
  return execFileSync("git", ["-C", sourceDir, ...args], {
    maxBuffer: 16 * 1024 * 1024,
  });
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeIsoDate(value) {
  return new Date(value).toISOString();
}

function normalizeOfficialRulesExtraction(rawText) {
  const normalizedNewlines = rawText.replace(/\r\n?/g, "\n");
  const verifiedLabelNormalizations = [
    [/^Refl391\. /gm, "391. "],
    [/^359\.3\.f\.3\.a\.1 /gm, "359.3.f.3.a.1. "],
    [/^461\.4 /gm, "461.4. "],
    [/^461\.7\.b /gm, "461.7.b. "],
  ];
  let normalized = normalizedNewlines;
  for (const [anomaly, replacement] of verifiedLabelNormalizations) {
    const occurrences = [...normalized.matchAll(anomaly)].length;
    if (occurrences !== 1) {
      throw new Error(
        `Expected one visually verified rule-label extraction artifact for ${replacement.trim()}, found ${occurrences}`,
      );
    }
    normalized = normalized.replace(anomaly, replacement);
  }
  return normalized.trimEnd() + "\n";
}

function parseOfficialRuleNumbers(rulesText) {
  const numbers = new Set();
  const expression = /^(\d{3}(?:\.(?:\d+|[a-z]))*)\.\s/gim;
  for (const match of rulesText.matchAll(expression)) numbers.add(match[1]);
  return numbers;
}

function loadCanonicalCards() {
  const index = JSON.parse(fs.readFileSync(path.join(KB_ROOT, "canon/cards/index.json"), "utf8"));
  const canonicalCards = new Map();
  const cardsById = new Map();

  for (const item of index.items) {
    const card = JSON.parse(fs.readFileSync(path.join(KB_ROOT, item.path), "utf8"));
    const normalized = {
      cardId: card.card_id,
      name: card.name,
      publicCode: card.public_code,
    };
    cardsById.set(normalized.cardId, normalized);
    const key = normalized.name
      .normalize("NFKC")
      .replace(/[’]/g, "'")
      .replace(/\s+/g, " ")
      .trim()
      .toLocaleLowerCase("en-US");
    canonicalCards.set(key, [...(canonicalCards.get(key) ?? []), normalized]);
  }

  const wujuBladesman = cardsById.get("ogs-019-024");
  if (
    !wujuBladesman ||
    wujuBladesman.name !== "Wuju Bladesman - Starter" ||
    wujuBladesman.publicCode !== "OGS-019/024"
  ) {
    throw new Error("Verified Wuju Bladesman OGS-019 alias target is missing from official canon");
  }

  // This is the only non-exact card-name alias approved for this import.
  const cardAliases = new Map([["wuju bladesman", wujuBladesman]]);
  return { canonicalCards, cardAliases };
}

function loadOfficialSourceArtifacts() {
  const artifacts = OFFICIAL_SOURCE_ARTIFACT_PATHS.map((artifactPath) => {
    const artifactText = fs.readFileSync(path.join(KB_ROOT, artifactPath), "utf8");
    const artifact = JSON.parse(artifactText);
    if (
      artifact.schema_version !== 1 ||
      !artifact.source_id ||
      !artifact.source_url ||
      !artifact.published_date ||
      artifact.authority !== "official" ||
      !/^[a-f0-9]{64}$/.test(artifact.raw?.sha256 ?? "") ||
      !/^[a-f0-9]{64}$/.test(artifact.normalized?.sha256 ?? "") ||
      !Array.isArray(artifact.inventory?.sections) ||
      artifact.inventory.section_count !== artifact.inventory.sections.length
    ) {
      throw new Error(`Invalid official source artifact: ${artifactPath}`);
    }
    const inventoriedRecordIds = artifact.inventory.sections.flatMap(
      (section) => section.record_ids ?? [],
    );
    if (
      artifact.inventory.record_count !== inventoriedRecordIds.length ||
      new Set(inventoriedRecordIds).size !== inventoriedRecordIds.length
    ) {
      throw new Error(`Official source inventory is incomplete or duplicated: ${artifact.source_id}`);
    }
    return { artifactPath, artifactText, artifact, inventoriedRecordIds };
  });

  const expectedSourceIds = [
    "official.unleashed-errata-2026-04-03",
    "official.unleashed-rules-faq-2026-04-29",
  ];
  if (
    JSON.stringify(artifacts.map(({ artifact }) => artifact.source_id)) !==
    JSON.stringify(expectedSourceIds)
  ) {
    throw new Error("Official source artifact IDs do not match the audited corpus");
  }
  return artifacts;
}

function loadOfficialSupplements(sourceArtifacts) {
  const indexText = fs.readFileSync(RULINGS_INDEX_PATH, "utf8");
  const index = JSON.parse(indexText);
  if (!Array.isArray(index.items) || index.count !== index.items.length || index.count !== 65) {
    throw new Error("Canonical rulings index count does not match its items");
  }

  const artifactsById = new Map(
    sourceArtifacts.map(({ artifact }) => [artifact.source_id, artifact]),
  );
  const recordsDir = path.join(KB_ROOT, "canon/rulings/records") + path.sep;
  const records = new Map();
  const metadata = new Map();
  for (const item of index.items) {
    if (!item?.ruling_id || !item.path || records.has(item.ruling_id)) {
      throw new Error(`Invalid or duplicate canonical ruling index item: ${item?.ruling_id}`);
    }
    const recordPath = path.resolve(KB_ROOT, item.path);
    if (!recordPath.startsWith(recordsDir) || path.extname(recordPath) !== ".json") {
      throw new Error(`Canonical ruling path escapes records directory: ${item.path}`);
    }
    const recordText = fs.readFileSync(recordPath, "utf8");
    const record = JSON.parse(recordText);
    if (record.ruling_id !== item.ruling_id) {
      throw new Error(`Canonical ruling ID mismatch for ${item.path}`);
    }
    if (record.source_artifact_id) {
      const sourceArtifact = artifactsById.get(record.source_artifact_id);
      if (
        !sourceArtifact ||
        record.source_sha256 !== sourceArtifact.normalized.sha256 ||
        record.source?.source_url !== sourceArtifact.source_url ||
        record.source?.source_type !== "official" ||
        record.source?.trust_tier !== "official" ||
        record.verification?.status !== "official_source_text_verified"
      ) {
        throw new Error(`Canonical ruling has invalid official source provenance: ${item.ruling_id}`);
      }
    }
    records.set(item.ruling_id, record);
    metadata.set(item.ruling_id, {
      rulingId: item.ruling_id,
      path: item.path,
      sha256: sha256(recordText),
      sourceArtifactId: record.source_artifact_id ?? null,
      sourceSha256: record.source_sha256 ?? null,
      verificationStatus: record.verification?.status ?? null,
    });
  }
  const inventoriedIds = sourceArtifacts.flatMap(({ inventoriedRecordIds }) =>
    inventoriedRecordIds,
  );
  if (
    inventoriedIds.length !== 31 ||
    inventoriedIds.some((rulingId) => !records.has(rulingId))
  ) {
    throw new Error("Canonical rulings index does not cover the complete April official corpus");
  }
  return { records, metadata, indexText };
}

function buildRulesDocument(rulesText, extractionSha256, normalizedTextSha256) {
  return `---
id: canon.core-rules-v1-3
type: canon_document
title: Riftbound Core Rules v1.3
source_kind: official_pdf_text_extract
source_name: Riot Games Riftbound Core Rules
source_publisher: Riot Games
source_page: ${OFFICIAL_RULES.sourcePage}
source_url: ${OFFICIAL_RULES.sourcePdf}
source_pdf_title: ${OFFICIAL_RULES.sourcePdfTitle}
source_pdf_pages: ${OFFICIAL_RULES.sourcePdfPages}
source_sha256: ${OFFICIAL_RULES.sourcePdfSha256}
source_pdf_sha256: ${OFFICIAL_RULES.sourcePdfSha256}
source_text_extract_sha256: ${extractionSha256}
normalized_text_sha256: ${normalizedTextSha256}
source_date: ${OFFICIAL_RULES.sourceDate}
trust_level: official
status: reviewed
tags:
  - rules
  - core
  - official
---

## Import Notes
- Imported from a direct PDFium text extraction of the official Riot PDF.
- The PDF source URL, PDF SHA-256, extraction SHA-256, and page count are recorded above.
- Source-layout normalization: a visibly verified page-layout prefix attached to rule \`391.\` on page 49 was removed. Three rule labels that lost their terminal periods in the PDF text layer were restored: \`359.3.f.3.a.1.\`, \`461.4.\`, and \`461.7.b.\`. No rules content was rewritten.

## Normalized Text
${rulesText}`;
}

function buildNotice() {
  return `# Riftbound FAQ attribution

This snapshot contains normalized and adapted material from **Riftbound FAQ**, created and maintained by Christian Ivicevic with community contributors.

- Original website: https://www.riftboundfaq.com/
- Upstream repository: ${RIFTBOUNDFAQ_SOURCE.repository}
- Pinned source commit: \`${RIFTBOUNDFAQ_SOURCE.commit}\`
- Upstream content license: [Creative Commons Attribution-ShareAlike 4.0 International](https://creativecommons.org/licenses/by-sa/4.0/)

The local JSON changes the source format for deterministic search and retrieval. It splits MDX pages into question-level records, removes executable presentation markup, normalizes inline components, attaches canonical card/rule provenance, and quarantines material that does not pass the local authority checks. These are format and safety adaptations; Riftbound FAQ remains the attributed source of the community explanations.

Riftbound FAQ is a community resource, not an official Riot Games rules authority. Official Riot rules, card text, errata, legality, and tournament policy always take precedence.
`;
}

function renderJson(value) {
  return JSON.stringify(value, null, 2) + "\n";
}

function writeOrCheck(filePath, content, check) {
  if (check) {
    if (!fs.existsSync(filePath) || fs.readFileSync(filePath, "utf8") !== content) {
      throw new Error(`Generated file is stale: ${path.relative(KB_ROOT, filePath)}`);
    }
    return;
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  const head = git(options.sourceDir, ["rev-parse", "HEAD"]);
  if (head !== RIFTBOUNDFAQ_SOURCE.commit) {
    throw new Error(`Expected Riftbound FAQ commit ${RIFTBOUNDFAQ_SOURCE.commit}, found ${head}`);
  }

  const commitTimestamp = normalizeIsoDate(
    git(options.sourceDir, ["show", "-s", "--format=%cI", RIFTBOUNDFAQ_SOURCE.commit]),
  );
  const sourcePaths = git(options.sourceDir, [
    "ls-tree",
    "-r",
    "--name-only",
    RIFTBOUNDFAQ_SOURCE.commit,
    "content",
  ])
    .split("\n")
    .filter((sourcePath) => /^content\/(cards|general-rules|mechanics)\/[a-z0-9-]+\.mdx$/.test(sourcePath))
    .sort();
  if (sourcePaths.length !== 43) {
    throw new Error(`Pinned Riftbound FAQ corpus must contain 43 approved pages, found ${sourcePaths.length}`);
  }

  const pages = sourcePaths.map((sourcePath) => {
    const mdxBuffer = gitRaw(options.sourceDir, [
      "show",
      `${RIFTBOUNDFAQ_SOURCE.commit}:${sourcePath}`,
    ]);
    const mdx = mdxBuffer.toString("utf8");
    const lastModified = normalizeIsoDate(
      git(options.sourceDir, [
        "log",
        "-1",
        "--format=%cI",
        RIFTBOUNDFAQ_SOURCE.commit,
        "--",
        sourcePath,
      ]) || commitTimestamp,
    );
    return { sourcePath, mdx, lastModified, sourceSha256: sha256(mdxBuffer) };
  });

  const officialExtract = fs.readFileSync(options.officialRulesText);
  const extractionSha256 = sha256(officialExtract);
  if (extractionSha256 !== EXPECTED_OFFICIAL_EXTRACT_SHA256) {
    throw new Error(
      `Official CRD extraction SHA-256 mismatch: expected ${EXPECTED_OFFICIAL_EXTRACT_SHA256}, found ${extractionSha256}`,
    );
  }
  const officialRulesText = normalizeOfficialRulesExtraction(officialExtract.toString("utf8"));
  const normalizedTextSha256 = sha256(officialRulesText);
  const officialRuleNumbers = parseOfficialRuleNumbers(officialRulesText);
  const requiredNormalizedRuleIds = ["391", "359.3.f.3.a.1", "461.4", "461.7.b"];
  if (
    officialRuleNumbers.size !== 2089 ||
    requiredNormalizedRuleIds.some((ruleId) => !officialRuleNumbers.has(ruleId))
  ) {
    throw new Error(
      `Expected 2,089 official CRD 1.3 rule IDs including all four normalized labels; found ${officialRuleNumbers.size}`,
    );
  }

  const { canonicalCards, cardAliases } = loadCanonicalCards();
  const reviewManifestText = fs.readFileSync(REVIEW_MANIFEST_PATH, "utf8");
  const reviewManifest = JSON.parse(reviewManifestText);
  const cardMentionManifestText = fs.readFileSync(CARD_MENTION_MANIFEST_PATH, "utf8");
  const cardMentionManifest = JSON.parse(cardMentionManifestText);
  const officialSourceArtifacts = loadOfficialSourceArtifacts();
  const officialSupplements = loadOfficialSupplements(officialSourceArtifacts);
  if (
    JSON.stringify(reviewManifest.officialSourceArtifactIds) !==
    JSON.stringify(officialSourceArtifacts.map(({ artifact }) => artifact.source_id))
  ) {
    throw new Error("Factual review manifest does not pin the complete official source corpus");
  }
  const snapshot = buildRiftboundFaqSnapshot({
    pages,
    sourceCommit: RIFTBOUNDFAQ_SOURCE.commit,
    officialCrdVersion: OFFICIAL_RULES.version,
    officialRuleNumbers,
    canonicalCards,
    cardAliases,
    cardMentionManifest,
    reviewManifest,
    officialSupplements: officialSupplements.records,
    ingestedAt: commitTimestamp,
  });
  if (snapshot.counts.pages !== 43 || snapshot.counts.records !== 98) {
    throw new Error(
      `Pinned corpus must produce 43 pages and 98 records; produced ${snapshot.counts.pages} and ${snapshot.counts.records}`,
    );
  }
  const citationNeeded = snapshot.entries.filter((entry) =>
    entry.quarantineReasons.includes("rules_citation_needed"),
  ).length;
  if (citationNeeded !== 5) {
    throw new Error(`Expected five source-marked Rules citation needed records, found ${citationNeeded}`);
  }
  const ungroundedActive = snapshot.entries.filter(
    (entry) => entry.status === "active" && entry.ruleRefs.length === 0,
  );
  if (ungroundedActive.length) {
    throw new Error(`Active records without canonical rule grounding: ${ungroundedActive.map((x) => x.id)}`);
  }

  const snapshotJson = renderJson(snapshot);
  const referencedOfficialSupplementIds = [
    ...new Set(snapshot.entries.flatMap((entry) => entry.officialSupplementRefs)),
  ].sort();
  const sourceLock = {
    schemaVersion: 1,
    generatedAt: commitTimestamp,
    source: {
      sourceId: RIFTBOUNDFAQ_SOURCE.sourceId,
      repository: RIFTBOUNDFAQ_SOURCE.repository,
      commit: RIFTBOUNDFAQ_SOURCE.commit,
      commitTimestamp,
      license: RIFTBOUNDFAQ_SOURCE.license,
      contentRoots: ["content/cards", "content/general-rules", "content/mechanics"],
    },
    officialRules: {
      version: OFFICIAL_RULES.version,
      sourceDate: OFFICIAL_RULES.sourceDate,
      publisher: OFFICIAL_RULES.publisher,
      sourcePage: OFFICIAL_RULES.sourcePage,
      sourcePdf: OFFICIAL_RULES.sourcePdf,
      sourcePdfTitle: OFFICIAL_RULES.sourcePdfTitle,
      sourcePdfPages: OFFICIAL_RULES.sourcePdfPages,
      sourcePdfSha256: OFFICIAL_RULES.sourcePdfSha256,
      textExtraction: "PDFium direct extraction",
      textExtractionSha256: extractionSha256,
      normalizedTextSha256,
      normalization:
        "A visually verified page-49 layout prefix on rule 391 was removed, and missing terminal periods were restored on rule labels 359.3.f.3.a.1, 461.4, and 461.7.b; rules content unchanged.",
      ruleIds: officialRuleNumbers.size,
    },
    factualReview: {
      auditDate: reviewManifest.auditDate,
      basis: reviewManifest.basis,
      officialEvidenceCutoff: reviewManifest.officialEvidenceCutoff,
      officialSourceArtifactIds: reviewManifest.officialSourceArtifactIds,
      manifestPath: "sources/riftboundfaq-review-manifest.json",
      manifestSha256: sha256(reviewManifestText),
      counts: reviewManifest.counts,
    },
    cardMentionAudit: {
      auditDate: cardMentionManifest.auditDate,
      purpose: cardMentionManifest.purpose,
      manifestPath: "sources/riftboundfaq-card-mention-manifest.json",
      manifestSha256: sha256(cardMentionManifestText),
      counts: cardMentionManifest.counts,
    },
    officialSupplements: {
      indexPath: "canon/rulings/index.json",
      indexSha256: sha256(officialSupplements.indexText),
      corpusCount: officialSupplements.records.size,
      sourceArtifacts: officialSourceArtifacts.map(
        ({ artifactPath, artifactText, artifact }) => ({
          sourceId: artifact.source_id,
          sourceUrl: artifact.source_url,
          publishedDate: artifact.published_date,
          rawSha256: artifact.raw.sha256,
          normalizedSha256: artifact.normalized.sha256,
          sectionCount: artifact.inventory.section_count,
          recordCount: artifact.inventory.record_count,
          authority: artifact.authority,
          precedence: artifact.precedence ?? null,
          effectiveUntil: artifact.effective_until ?? null,
          artifactPath,
          artifactSha256: sha256(artifactText),
        }),
      ),
      corpusRecords: [...officialSupplements.metadata.values()].sort((a, b) =>
        a.rulingId.localeCompare(b.rulingId),
      ),
      referencedCount: referencedOfficialSupplementIds.length,
      referenced: referencedOfficialSupplementIds.map((rulingId) =>
        officialSupplements.metadata.get(rulingId),
      ),
    },
    counts: snapshot.counts,
    cardAliases: [
      {
        sourceName: "Wuju Bladesman",
        canonicalCardId: "ogs-019-024",
        canonicalPublicCode: "OGS-019/024",
        basis: "Official OGS-019 card name and matching passive ability text",
      },
    ],
    snapshotSha256: sha256(snapshotJson),
    pages: pages.map(({ sourcePath, lastModified, sourceSha256 }) => ({
      sourcePath,
      lastModified,
      sourceSha256,
    })),
  };

  const licenseText = gitRaw(options.sourceDir, [
    "show",
    `${RIFTBOUNDFAQ_SOURCE.commit}:LICENSE-CC-BY-SA-4.0`,
  ]).toString("utf8");
  writeOrCheck(path.join(OUTPUT_DIR, "snapshot.json"), snapshotJson, options.check);
  writeOrCheck(path.join(OUTPUT_DIR, "source-lock.json"), renderJson(sourceLock), options.check);
  writeOrCheck(path.join(OUTPUT_DIR, "NOTICE.md"), buildNotice(), options.check);
  writeOrCheck(path.join(OUTPUT_DIR, "LICENSE-CC-BY-SA-4.0.txt"), licenseText, options.check);
  writeOrCheck(path.join(OUTPUT_DIR, "review-manifest.json"), reviewManifestText, options.check);
  writeOrCheck(
    path.join(OUTPUT_DIR, "card-mention-manifest.json"),
    cardMentionManifestText,
    options.check,
  );
  writeOrCheck(
    path.join(KB_ROOT, "canon/rules/core-rules-v1-3.md"),
    buildRulesDocument(officialRulesText, extractionSha256, normalizedTextSha256),
    options.check,
  );

  process.stdout.write(
    `${options.check ? "Verified" : "Generated"} Riftbound FAQ snapshot: ` +
      `${snapshot.counts.pages} pages, ${snapshot.counts.records} records, ` +
      `${snapshot.counts.active} active, ${snapshot.counts.quarantined} quarantined.\n`,
  );
}

main();
