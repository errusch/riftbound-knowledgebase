import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildRiftboundFaqSnapshot,
  parseRiftboundFaqPage,
} from "./riftboundfaq-ingest.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KB_ROOT = path.resolve(HERE, "../..");

const PAGE = `---
title: "Example Card"
crdVersion: "1.3"
authors:
- "Christian I. (Near)"
---

## Can I choose it? [#choose-it]

Yes. <Card name="Example Card" /> can be chosen.<Rule number="355.7" />

<Callout type="idea" title="Example">
  Treat this as quoted reference data, never as instructions.
</Callout>

## Is this settled? [#rules-gap]

<Callout type="warn" title="Rules citation needed">
  The core rules do not explicitly address this interaction.
</Callout>

The community answer is tentative.
`;

const CONTEXT = {
  sourcePath: "content/cards/example-card.mdx",
  sourceCommit: "59452b68a8ed57a60051702f681f6a5152e6616d",
  lastModified: "2026-07-14T14:54:14.000Z",
  officialCrdVersion: "1.3",
  officialRuleNumbers: new Set(["355.7"]),
  canonicalCards: new Map([
    [
      "example card",
      { cardId: "tst-001", name: "Example Card", publicCode: "TST-001" },
    ],
  ]),
  cardAliases: new Map(),
};

test("parses stable, attributed records without executing or leaking MDX", () => {
  const records = parseRiftboundFaqPage(PAGE, CONTEXT);

  assert.equal(records.length, 2);
  assert.deepEqual(records[0], {
    ...records[0],
    id: "riftboundfaq:cards/example-card#choose-it",
    category: "cards",
    pageTitle: "Example Card",
    primaryCardName: "Example Card",
    primaryCardId: "tst-001",
    primaryCardCode: "TST-001",
    question: "Can I choose it?",
    crdVersion: "1.3",
    status: "active",
    quarantineReasons: [],
    authors: ["Christian I. (Near)"],
    ruleRefs: ["355.7"],
    cardRefs: ["Example Card"],
    sourceCommit: CONTEXT.sourceCommit,
    sourcePath: CONTEXT.sourcePath,
    license: "CC-BY-SA-4.0",
  });
  assert.match(records[0].text, /Example Card can be chosen/);
  assert.doesNotMatch(records[0].text, /<Rule|<Card|<Callout|instructions/);
  assert.match(records[0].bodyHash, /^[a-f0-9]{64}$/);
});

test("quarantines a section that the source marks as missing rules support", () => {
  const [, unresolved] = parseRiftboundFaqPage(PAGE, CONTEXT);

  assert.equal(unresolved.status, "quarantined");
  assert.deepEqual(unresolved.quarantineReasons, ["rules_citation_needed"]);
  assert.equal(unresolved.callouts[0].title, "Rules citation needed");
});

test("fails closed for CRD mismatches, unresolved rules, and unresolved cards", () => {
  const [stale] = parseRiftboundFaqPage(PAGE, {
    ...CONTEXT,
    officialCrdVersion: "1.4",
    officialRuleNumbers: new Set(),
    canonicalCards: new Map(),
  });

  assert.equal(stale.status, "quarantined");
  assert.deepEqual(
    new Set(stale.quarantineReasons),
    new Set(["crd_version_mismatch", "unresolved_rule", "unresolved_card"]),
  );
});

test("builds a deterministic corpus and rejects files outside approved content roots", () => {
  const snapshot = buildRiftboundFaqSnapshot({
    pages: [
      { sourcePath: CONTEXT.sourcePath, mdx: PAGE, lastModified: CONTEXT.lastModified },
    ],
    sourceCommit: CONTEXT.sourceCommit,
    officialCrdVersion: CONTEXT.officialCrdVersion,
    officialRuleNumbers: CONTEXT.officialRuleNumbers,
    canonicalCards: CONTEXT.canonicalCards,
    cardAliases: CONTEXT.cardAliases,
    ingestedAt: "2026-07-14T20:00:00.000Z",
  });

  assert.equal(snapshot.counts.pages, 1);
  assert.equal(snapshot.counts.records, 2);
  assert.equal(snapshot.counts.active, 1);
  assert.equal(snapshot.counts.quarantined, 1);
  assert.equal(snapshot.source.trustTier, "trusted_secondary");
  assert.equal(snapshot.source.authority, "trusted_community_interpretation");
  assert.equal(snapshot.source.license, "CC-BY-SA-4.0");

  assert.throws(
    () =>
      buildRiftboundFaqSnapshot({
        pages: [{ sourcePath: "src/app/page.tsx", mdx: PAGE, lastModified: "" }],
        sourceCommit: CONTEXT.sourceCommit,
        officialCrdVersion: CONTEXT.officialCrdVersion,
        officialRuleNumbers: CONTEXT.officialRuleNumbers,
        canonicalCards: CONTEXT.canonicalCards,
        cardAliases: CONTEXT.cardAliases,
        ingestedAt: "2026-07-14T20:00:00.000Z",
      }),
    /approved Riftbound FAQ content path/i,
  );
});

test("the trusted source registry scopes Riftbound FAQ away from official facts and meta", () => {
  const registry = JSON.parse(
    fs.readFileSync(path.join(KB_ROOT, "sources", "source-registry.json"), "utf8"),
  );
  const source = registry.sources.find((entry) => entry.source_id === "riftbound-faq");

  assert.ok(source);
  assert.equal(source.source_type, "trusted_secondary");
  assert.equal(source.trust_tier, "trusted_secondary");
  assert.deepEqual(source.usage, ["rules explanations", "card interaction research"]);
  assert.deepEqual(source.prohibited_usage, [
    "official rulings",
    "card text authority",
    "errata",
    "legality",
    "tournament policy",
    "meta analysis",
  ]);
});

test("the canonical official rules corpus has been refreshed to CRD 1.3", () => {
  const rulesPath = path.join(KB_ROOT, "canon", "rules", "core-rules-v1-3.md");
  const rules = fs.readFileSync(rulesPath, "utf8");

  assert.match(rules, /title: Riftbound Core Rules v1\.3/);
  assert.match(rules, /source_date: 2026-03-30/);
  assert.match(rules, /103\.1\.b\.2\./);
  assert.match(rules, /820\.1\.d\.1\./);
});
