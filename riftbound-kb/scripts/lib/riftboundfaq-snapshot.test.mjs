import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KB_ROOT = path.resolve(HERE, "../..");
const SNAPSHOT_PATH = path.join(
  KB_ROOT,
  "canon/community-rules/riftboundfaq/snapshot.json",
);
const LOCK_PATH = path.join(KB_ROOT, "canon/community-rules/riftboundfaq/source-lock.json");
const REVIEW_MANIFEST_PATH = path.join(
  KB_ROOT,
  "canon/community-rules/riftboundfaq/review-manifest.json",
);
const CARD_MENTION_MANIFEST_PATH = path.join(
  KB_ROOT,
  "canon/community-rules/riftboundfaq/card-mention-manifest.json",
);

const FACTUAL_CONFLICT_IDS = [
  "riftboundfaq:cards/alpha-strike#split-distribution",
  "riftboundfaq:cards/baron-nashor#baron-pit-showdown",
  "riftboundfaq:cards/bone-skewer#stun-targeting",
  "riftboundfaq:cards/heedless-resurrection#no-refunds",
  "riftboundfaq:cards/irresistible-faefolk#who-attacks",
  "riftboundfaq:cards/sacrifice#counter",
  "riftboundfaq:cards/sacrifice#deathknell",
  "riftboundfaq:general-rules/abilities#costs-within-instructions",
  "riftboundfaq:general-rules/abilities#triggered-ability-if-conditions",
  "riftboundfaq:general-rules/abilities#triggered-ability-timing",
  "riftboundfaq:general-rules/targeting#may-targets-at-resolution",
  "riftboundfaq:mechanics/ambush#ambush-base",
];

const INSUFFICIENT_SUPPORT_IDS = [
  "riftboundfaq:cards/alpha-strike#might-reduction",
  "riftboundfaq:cards/bone-skewer#optional-additional-costs",
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

test("the pinned full-site snapshot is complete, attributed, and retrieval-safe", () => {
  const snapshot = readJson(SNAPSHOT_PATH);

  assert.deepEqual(snapshot.counts, {
    pages: 43,
    records: 98,
    active: 67,
    quarantined: 31,
  });
  assert.equal(snapshot.entries.length, 98);
  assert.equal(new Set(snapshot.entries.map((entry) => entry.id)).size, 98);
  assert.equal(new Set(snapshot.entries.map((entry) => entry.sourcePath)).size, 43);
  assert.equal(snapshot.source.commit, "59452b68a8ed57a60051702f681f6a5152e6616d");
  assert.equal(snapshot.source.license, "CC-BY-SA-4.0");
  assert.equal(snapshot.source.trustTier, "trusted_secondary");
  assert.equal(snapshot.source.authority, "trusted_community_interpretation");

  for (const entry of snapshot.entries) {
    assert.equal(entry.sourceCommit, snapshot.source.commit);
    assert.equal(entry.license, "CC-BY-SA-4.0");
    assert.equal(entry.crdVersion, "1.3");
    assert.equal(entry.review.auditedAt, "2026-07-14");
    assert.equal(
      entry.review.basis,
      "CRD 1.3 + 2026-04-03 official errata + controlling 2026-04-29 official FAQ/clarifications",
    );
    assert.ok(entry.review.evidence);
    assert.equal(entry.review.officialEvidenceCutoff, "2026-04-29");
    assert.ok(Array.isArray(entry.officialSupplementRefs));
    assert.match(entry.bodyHash, /^[a-f0-9]{64}$/);
    assert.doesNotMatch(entry.text, /<(?:Rule|Card|Callout)\b/);
    for (const cardRef of entry.cardRefs) {
      assert.ok(cardRef.sourceName);
      if (entry.status === "active") {
        assert.ok(cardRef.canonicalName, `${entry.id} must resolve ${cardRef.sourceName}`);
        assert.ok(cardRef.cardId, `${entry.id} must resolve ${cardRef.sourceName}`);
        assert.ok(cardRef.publicCode, `${entry.id} must resolve ${cardRef.sourceName}`);
      }
    }
    for (const callout of entry.callouts) {
      assert.doesNotMatch(callout.text, /<(?:Rule|Card|Callout)\b/);
    }
    if (entry.status === "active") {
      assert.equal(entry.review.status, "pass");
      assert.deepEqual(entry.quarantineReasons, []);
      assert.ok(entry.ruleRefs.length > 0, `${entry.id} must have CRD grounding`);
    } else {
      assert.ok(entry.quarantineReasons.length > 0);
    }
  }

  const reasons = snapshot.entries.flatMap((entry) => entry.quarantineReasons);
  assert.equal(reasons.filter((reason) => reason === "rules_citation_needed").length, 5);
  assert.equal(reasons.filter((reason) => reason === "unresolved_card").length, 12);
  assert.equal(reasons.filter((reason) => reason === "unresolved_rule").length, 0);
  assert.equal(reasons.filter((reason) => reason === "factual_conflict").length, 12);
  assert.equal(reasons.filter((reason) => reason === "insufficient_official_support").length, 2);
  assert.equal(reasons.filter((reason) => reason === "ambiguous_card_reference").length, 1);

  assert.deepEqual(
    snapshot.entries
      .filter((entry) => entry.quarantineReasons.includes("factual_conflict"))
      .map((entry) => entry.id)
      .sort(),
    [...FACTUAL_CONFLICT_IDS].sort(),
  );
  assert.deepEqual(
    snapshot.entries
      .filter((entry) => entry.quarantineReasons.includes("insufficient_official_support"))
      .map((entry) => entry.id)
      .sort(),
    [...INSUFFICIENT_SUPPORT_IDS].sort(),
  );
});

test("reviewed prose card mentions resolve exactly without guessing ambiguous cards", () => {
  const snapshot = readJson(SNAPSHOT_PATH);
  const entries = new Map(snapshot.entries.map((entry) => [entry.id, entry]));
  const expectedManualRefs = new Map([
    [
      "riftboundfaq:cards/baron-nashor#baron-pit-victory",
      [{ sourceName: "Baron Pit", canonicalName: "Baron Pit", cardId: "unl-t01", publicCode: "UNL-T01" }],
    ],
    [
      "riftboundfaq:cards/emperors-dais#ability",
      [{ sourceName: "Sand Soldier", canonicalName: "Sand Soldier", cardId: "sfd-t02", publicCode: "SFD-T02" }],
    ],
    [
      "riftboundfaq:cards/ruined-rex#ferrous-forerunner-mechs",
      [{ sourceName: "Mech", canonicalName: "Mech", cardId: "sfd-t01", publicCode: "SFD-T01" }],
    ],
    [
      "riftboundfaq:cards/shady-spectacles#temporary",
      [{ sourceName: "Reflection", canonicalName: "Reflection", cardId: "unl-t06", publicCode: "UNL-T06" }],
    ],
    [
      "riftboundfaq:cards/smite#death-saving-replacement-effects",
      [
        { sourceName: "Zhonya's Hourglass", canonicalName: "Zhonya's Hourglass", cardId: "ogn-077-298", publicCode: "OGN-077/298" },
        { sourceName: "Tactical Retreat", canonicalName: "Tactical Retreat", cardId: "unl-175-219", publicCode: "UNL-175/219" },
        { sourceName: "Guardian Angel", canonicalName: "Guardian Angel", cardId: "sfd-051-221", publicCode: "SFD-051/221" },
      ],
    ],
    [
      "riftboundfaq:mechanics/ambush#ambush-no-reaction-window",
      [{ sourceName: "Kha'Zix, Mutating Horror", canonicalName: "Kha'Zix, Mutating Horror", cardId: "unl-143-219", publicCode: "UNL-143/219" }],
    ],
  ]);

  for (const [id, expected] of expectedManualRefs) {
    const entry = entries.get(id);
    assert.ok(entry, id);
    assert.deepEqual(entry.manualCardRefs, expected);
    for (const manualRef of expected) {
      assert.ok(
        entry.cardRefs.some(
          (cardRef) =>
            cardRef.sourceName === manualRef.sourceName && cardRef.cardId === manualRef.cardId,
        ),
        `${id} must expose ${manualRef.cardId} through effective cardRefs`,
      );
    }
  }

  for (const entry of snapshot.entries.filter((candidate) => candidate.status === "active")) {
    for (const manualRef of entry.manualCardRefs) {
      assert.ok(manualRef.canonicalName);
      assert.ok(manualRef.cardId);
      assert.ok(manualRef.publicCode);
    }
  }

  const alphaStrike = entries.get("riftboundfaq:cards/alpha-strike#might-reduction");
  assert.deepEqual(alphaStrike.ambiguousCardMentions, [
    {
      sourceName: "Recruit",
      candidateCardIds: ["ogn-271-298", "ogn-272-298", "ogn-273-298"],
      note: "The generic Recruit/Recruits example does not identify a domain printing; no canonical card is inferred.",
    },
  ]);
  assert.ok(alphaStrike.quarantineReasons.includes("ambiguous_card_reference"));
  assert.equal(
    alphaStrike.cardRefs.some((cardRef) => cardRef.sourceName === "Recruit"),
    false,
  );
});

test("review supplements extend effective CRD grounding without altering upstream citations", () => {
  const snapshot = readJson(SNAPSHOT_PATH);
  const entries = new Map(snapshot.entries.map((entry) => [entry.id, entry]));
  const expectations = [
    {
      id: "riftboundfaq:cards/akshan-mischievous#dual-akshan-control",
      upstreamRuleRefs: ["472.1", "472.1.a", "473", "475", "475.3"],
      supplementalRule: "323.7",
    },
    {
      id: "riftboundfaq:cards/smite#death-saving-replacement-effects",
      upstreamRuleRefs: ["369.1", "372", "370.2", "427.2.a"],
      supplementalRule: "373.2",
    },
    {
      id: "riftboundfaq:mechanics/equipment#take-control-with-equipment",
      upstreamRuleRefs: ["718.5.f", "719.5", "435.4.b", "435.4.a", "107.1.c", "718.5.b", "821.1.c"],
      supplementalRule: "323.7",
    },
  ];

  for (const expectation of expectations) {
    const entry = entries.get(expectation.id);
    assert.deepEqual(entry.upstreamRuleRefs, expectation.upstreamRuleRefs);
    assert.deepEqual(entry.supplementalRuleRefs, [expectation.supplementalRule]);
    assert.ok(entry.ruleRefs.includes(expectation.supplementalRule));
    assert.deepEqual(
      entry.supplementalRuleEvidence.map((evidence) => evidence.ruleId),
      [expectation.supplementalRule],
    );
    assert.ok(entry.supplementalRuleEvidence[0].evidence);
  }
});

test("derived Switcheroo explanations inherit inspectable CRD grounding", () => {
  const snapshot = readJson(SNAPSHOT_PATH);
  for (const anchor of ["no-double-dipping", "modifiers-changing"]) {
    const entry = snapshot.entries.find(
      (candidate) => candidate.id === `riftboundfaq:cards/switcheroo#${anchor}`,
    );
    assert.ok(entry);
    assert.equal(entry.status, "active");
    assert.equal(entry.groundingMode, "inherited");
    assert.deepEqual(entry.ruleRefs, ["433"]);
    assert.deepEqual(entry.inheritedRuleRefs, ["433"]);
    assert.deepEqual(entry.relatedRecordIds, [
      "riftboundfaq:cards/switcheroo#how-it-works",
    ]);
  }

  const modifiers = snapshot.entries.find(
    (candidate) => candidate.id === "riftboundfaq:cards/switcheroo#modifiers-changing",
  );
  assert.deepEqual(
    modifiers.cardRefs.find((card) => card.sourceName === "Wuju Bladesman"),
    {
      sourceName: "Wuju Bladesman",
      canonicalName: "Wuju Bladesman - Starter",
      cardId: "ogs-019-024",
      publicCode: "OGS-019/024",
    },
  );
});

test("the source lock authenticates the snapshot and the sole approved card alias", () => {
  const snapshotBytes = fs.readFileSync(SNAPSHOT_PATH);
  const lock = readJson(LOCK_PATH);

  assert.equal(lock.pages.length, 43);
  assert.equal(
    lock.snapshotSha256,
    createHash("sha256").update(snapshotBytes).digest("hex"),
  );
  assert.deepEqual(lock.cardAliases, [
    {
      sourceName: "Wuju Bladesman",
      canonicalCardId: "ogs-019-024",
      canonicalPublicCode: "OGS-019/024",
      basis: "Official OGS-019 card name and matching passive ability text",
    },
  ]);
  assert.equal(lock.officialRules.version, "1.3");
  assert.equal(lock.officialRules.ruleIds, 2089);
  assert.deepEqual(lock.factualReview.counts, {
    pass: 67,
    factual_conflict: 12,
    insufficient_official_support: 2,
    baseline_quarantine: 17,
  });
  assert.deepEqual(lock.cardMentionAudit.counts, {
    records: 98,
    manualCardRefs: 8,
    ambiguousCardMentions: 1,
  });
  assert.deepEqual(lock.officialSupplements.sourceArtifacts, [
    {
      sourceId: "official.unleashed-errata-2026-04-03",
      sourceUrl: "https://playriftbound.com/en-us/news/rules-and-releases/unleashed-errata-updates/",
      publishedDate: "2026-04-03",
      rawSha256: "c8971b31589c00af75a34fe7ed5dd9dac8e1dde7f05a39fc5cde3af5adabf9da",
      normalizedSha256: "e909789cb081496b9969bec195f428db465ff0afc389274cc70423c8be2cfd24",
      sectionCount: 8,
      recordCount: 8,
      authority: "official",
      precedence: null,
      effectiveUntil: null,
      artifactPath: "canon/rulings/sources/riftbound-unleashed-errata-2026-04-03.json",
      artifactSha256: "5ac2967d28264c03ff1d63346a7366573a2836bac68d177c5dec89f4a0531ba0",
    },
    {
      sourceId: "official.unleashed-rules-faq-2026-04-29",
      sourceUrl: "https://playriftbound.com/en-us/news/rules-and-releases/unleashed-rules-faq-and-clarifications/",
      publishedDate: "2026-04-29",
      rawSha256: "2ac07aa740df91f3eff14b45006b1b1f68e1e3ca4604af4ffa979bf5bf138840",
      normalizedSha256: "555a37682b52dad9221f877fce3ac73530cd2a6d8007645d8ec56fd617ae7776",
      sectionCount: 21,
      recordCount: 23,
      authority: "official",
      precedence: "supersedes_crd_1_3_until_next_crd",
      effectiveUntil: "next_core_rules_document",
      artifactPath: "canon/rulings/sources/riftbound-unleashed-rules-faq-2026-04-29.json",
      artifactSha256: "17ee0d174e6cd6159a9153dc3d51da9786d6ab7f0ab8a3768320415674805512",
    },
  ]);
  assert.equal(lock.officialSupplements.corpusCount, 65);
  assert.equal(lock.officialSupplements.corpusRecords.length, 65);
  assert.equal(
    new Set(lock.officialSupplements.corpusRecords.map((record) => record.rulingId)).size,
    65,
  );
  for (const record of lock.officialSupplements.corpusRecords) {
    const recordBytes = fs.readFileSync(path.join(KB_ROOT, record.path));
    assert.equal(
      record.sha256,
      createHash("sha256").update(recordBytes).digest("hex"),
      `${record.rulingId} digest drifted`,
    );
  }
  assert.equal(lock.officialSupplements.referencedCount, 16);
  assert.equal(lock.officialSupplements.referenced.length, 16);
  assert.deepEqual(lock.factualReview.officialSourceArtifactIds, [
    "official.unleashed-errata-2026-04-03",
    "official.unleashed-rules-faq-2026-04-29",
  ]);
  assert.equal(lock.factualReview.officialEvidenceCutoff, "2026-04-29");
  assert.equal(
    lock.officialRules.sourcePdfSha256,
    "3733eaffa8b412ce37458d62e7cd22aa93d59f0a6925241bce5b0b5fd5ed1878",
  );

  const reviewManifestBytes = fs.readFileSync(REVIEW_MANIFEST_PATH);
  const reviewManifest = JSON.parse(reviewManifestBytes);
  assert.equal(reviewManifest.records.length, 98);
  assert.equal(new Set(reviewManifest.records.map((record) => record.id)).size, 98);
  assert.equal(
    lock.factualReview.manifestSha256,
    createHash("sha256").update(reviewManifestBytes).digest("hex"),
  );

  const cardMentionManifestBytes = fs.readFileSync(CARD_MENTION_MANIFEST_PATH);
  const cardMentionManifest = JSON.parse(cardMentionManifestBytes);
  assert.equal(cardMentionManifest.records.length, 98);
  assert.equal(new Set(cardMentionManifest.records.map((record) => record.id)).size, 98);
  assert.equal(
    lock.cardMentionAudit.manifestSha256,
    createHash("sha256").update(cardMentionManifestBytes).digest("hex"),
  );

  const snapshot = readJson(SNAPSHOT_PATH);
  const lockedRulings = new Set(
    lock.officialSupplements.referenced.map((record) => record.rulingId),
  );
  assert.deepEqual(snapshot.reviewAudit.officialSupplementRefs, {
    records: 28,
    references: 38,
    uniqueSupplements: 16,
  });
  for (const entry of snapshot.entries) {
    for (const rulingId of entry.officialSupplementRefs) {
      assert.ok(lockedRulings.has(rulingId), `${entry.id} has an unlocked supplement ${rulingId}`);
    }
  }
});
