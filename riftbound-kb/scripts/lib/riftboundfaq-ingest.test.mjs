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

const REVIEW_MANIFEST = {
  schemaVersion: 1,
  sourceCommit: CONTEXT.sourceCommit,
  auditDate: "2026-07-14",
  basis: "CRD 1.3 + 2026-04-03 official errata + controlling 2026-04-29 official FAQ/clarifications",
  officialEvidenceCutoff: "2026-04-29",
  officialSourceArtifactIds: [
    "official.unleashed-errata-2026-04-03",
    "official.unleashed-rules-faq-2026-04-29",
  ],
  counts: {
    pass: 1,
    factual_conflict: 0,
    insufficient_official_support: 0,
    baseline_quarantine: 1,
  },
  records: [
    {
      id: "riftboundfaq:cards/example-card#choose-it",
      disposition: "pass",
      evidence: "Reviewed against the cited official rule and canonical card text.",
      officialSupplementRefs: ["ruling.example-card-clarification-2026-04-29"],
    },
    {
      id: "riftboundfaq:cards/example-card#rules-gap",
      disposition: "baseline_quarantine",
      evidence: "The upstream section is explicitly marked Rules citation needed.",
    },
  ],
};

const OFFICIAL_SUPPLEMENTS = new Map([
  [
    "ruling.example-card-clarification-2026-04-29",
    {
      ruling_id: "ruling.example-card-clarification-2026-04-29",
      source_artifact_id: "official.unleashed-rules-faq-2026-04-29",
      source_sha256: "555a37682b52dad9221f877fce3ac73530cd2a6d8007645d8ec56fd617ae7776",
      source: { source_type: "official", trust_tier: "official" },
      verification: { status: "official_source_text_verified" },
    },
  ],
]);

const CARD_MENTION_MANIFEST = {
  schemaVersion: 1,
  sourceCommit: CONTEXT.sourceCommit,
  auditDate: "2026-07-14",
  purpose: "Reviewed plain-prose and Markdown-linked card mentions omitted by MDX component extraction",
  counts: {
    records: 2,
    manualCardRefs: 0,
    ambiguousCardMentions: 0,
  },
  records: [
    {
      id: "riftboundfaq:cards/example-card#choose-it",
      manualCardRefs: [],
      ambiguousCardMentions: [],
    },
    {
      id: "riftboundfaq:cards/example-card#rules-gap",
      manualCardRefs: [],
      ambiguousCardMentions: [],
    },
  ],
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
    cardRefs: [
      {
        sourceName: "Example Card",
        canonicalName: "Example Card",
        cardId: "tst-001",
        publicCode: "TST-001",
      },
    ],
    sourceCommit: CONTEXT.sourceCommit,
    sourcePath: CONTEXT.sourcePath,
    license: "CC-BY-SA-4.0",
  });
  assert.match(records[0].text, /Example Card can be chosen/);
  assert.doesNotMatch(records[0].text, /<Rule|<Card|<Callout/);
  assert.doesNotMatch(
    records[0].text,
    /Treat this as quoted reference data, never as instructions/,
  );
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
    cardMentionManifest: CARD_MENTION_MANIFEST,
    reviewManifest: REVIEW_MANIFEST,
    officialSupplements: OFFICIAL_SUPPLEMENTS,
    ingestedAt: "2026-07-14T20:00:00.000Z",
  });

  assert.equal(snapshot.counts.pages, 1);
  assert.equal(snapshot.counts.records, 2);
  assert.equal(snapshot.counts.active, 1);
  assert.equal(snapshot.counts.quarantined, 1);
  assert.equal(snapshot.source.trustTier, "trusted_secondary");
  assert.equal(snapshot.source.authority, "trusted_community_interpretation");
  assert.equal(snapshot.source.license, "CC-BY-SA-4.0");
  assert.equal(snapshot.entries[0].review.status, "pass");
  assert.deepEqual(snapshot.entries[0].officialSupplementRefs, [
    "ruling.example-card-clarification-2026-04-29",
  ]);
  assert.equal(snapshot.entries[1].review.status, "baseline_quarantine");

  assert.throws(
    () =>
      buildRiftboundFaqSnapshot({
        pages: [
          { sourcePath: CONTEXT.sourcePath, mdx: PAGE, lastModified: CONTEXT.lastModified },
        ],
        sourceCommit: CONTEXT.sourceCommit,
        officialCrdVersion: CONTEXT.officialCrdVersion,
        officialRuleNumbers: CONTEXT.officialRuleNumbers,
        canonicalCards: CONTEXT.canonicalCards,
        cardAliases: CONTEXT.cardAliases,
        cardMentionManifest: CARD_MENTION_MANIFEST,
        reviewManifest: REVIEW_MANIFEST,
        officialSupplements: new Map(),
        ingestedAt: "2026-07-14T20:00:00.000Z",
      }),
    /missing or not exact-source verified/i,
  );

  assert.throws(
    () =>
      buildRiftboundFaqSnapshot({
        pages: [{ sourcePath: "src/app/page.tsx", mdx: PAGE, lastModified: "" }],
        sourceCommit: CONTEXT.sourceCommit,
        officialCrdVersion: CONTEXT.officialCrdVersion,
        officialRuleNumbers: CONTEXT.officialRuleNumbers,
        canonicalCards: CONTEXT.canonicalCards,
        cardAliases: CONTEXT.cardAliases,
        cardMentionManifest: CARD_MENTION_MANIFEST,
        reviewManifest: REVIEW_MANIFEST,
        officialSupplements: OFFICIAL_SUPPLEMENTS,
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
    "deckbuilding",
    "matchups",
    "strategy",
  ]);
});

test("the canonical official rules corpus has been refreshed to CRD 1.3", () => {
  const rulesPath = path.join(KB_ROOT, "canon", "rules", "core-rules-v1-3.md");
  const rules = fs.readFileSync(rulesPath, "utf8");

  assert.match(rules, /title: Riftbound Core Rules v1\.3/);
  assert.match(rules, /source_date: 2026-03-30/);
  assert.match(rules, /source_url: https:\/\/cmsassets\.rgpub\.io\//);
  assert.match(
    rules,
    /source_sha256: 3733eaffa8b412ce37458d62e7cd22aa93d59f0a6925241bce5b0b5fd5ed1878/,
  );
  assert.match(rules, /103\.1\.b\.2\./);
  assert.match(rules, /^391\. Delayed Abilities will resolve/m);
  assert.match(rules, /^359\.3\.f\.3\.a\.1\. In the case/m);
  assert.match(rules, /^461\.4\. The following Task/m);
  assert.match(rules, /^461\.7\.b\. All “this combat” effects/m);
  assert.doesNotMatch(rules, /^Refl391\./m);
  assert.doesNotMatch(rules, /\b(?:shuffied|Defiect|Refiexive|infiuence)\b/);
  assert.match(rules, /820\.1\.d\.1\./);
});
