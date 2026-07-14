import { createHash } from "node:crypto";
import path from "node:path";

export const RIFTBOUNDFAQ_SOURCE = Object.freeze({
  sourceId: "riftbound-faq",
  name: "Riftbound FAQ",
  baseUrl: "https://www.riftboundfaq.com",
  repository: "https://github.com/ChristianIvicevic/riftboundfaq",
  commit: "59452b68a8ed57a60051702f681f6a5152e6616d",
  license: "CC-BY-SA-4.0",
  trustTier: "trusted_secondary",
  authority: "trusted_community_interpretation",
});

const APPROVED_CONTENT_PATH = /^content\/(cards|general-rules|mechanics)\/[a-z0-9-]+\.mdx$/;

// These two source sections explain consequences of the directly grounded
// Switcheroo section immediately above them. The pinned source does not include
// explicit Markdown links, so the dependency is declared here instead of
// guessing from prose at runtime.
const DECLARED_RELATED_RECORDS = Object.freeze({
  "riftboundfaq:cards/switcheroo#no-double-dipping": [
    "riftboundfaq:cards/switcheroo#how-it-works",
  ],
  "riftboundfaq:cards/switcheroo#modifiers-changing": [
    "riftboundfaq:cards/switcheroo#how-it-works",
  ],
});

const REVIEW_DISPOSITIONS = new Set([
  "pass",
  "factual_conflict",
  "insufficient_official_support",
  "baseline_quarantine",
]);

const ACCEPTED_OFFICIAL_SUPPLEMENT_VERIFICATION = new Set([
  "official_source_text_verified",
  "live_quote_verified",
  "live_webfetch_text_verified",
]);

const REVIEW_BASIS =
  "CRD 1.3 + 2026-04-03 official errata + controlling 2026-04-29 official FAQ/clarifications";
const REVIEW_OFFICIAL_SOURCE_ARTIFACT_IDS = [
  "official.unleashed-errata-2026-04-03",
  "official.unleashed-rules-faq-2026-04-29",
];

function unique(values) {
  return [...new Set(values)];
}

function normalizeCardName(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[’]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("en-US");
}

function normalizeCardRecord(card) {
  if (!card || typeof card !== "object") return null;
  const cardId = card.cardId ?? card.card_id ?? null;
  const name = card.name ?? null;
  const publicCode = card.publicCode ?? card.public_code ?? null;
  if (!cardId || !name) return null;
  return { cardId, name, publicCode };
}

function resolveCard(name, canonicalCards, cardAliases, preferredCardId = null) {
  const key = normalizeCardName(name);
  let value = canonicalCards?.get(key);

  if (value == null && cardAliases?.has(key)) {
    value = cardAliases.get(key);
    if (typeof value === "string") value = canonicalCards?.get(normalizeCardName(value));
  }

  const candidates = (Array.isArray(value) ? value : value ? [value] : [])
    .map(normalizeCardRecord)
    .filter(Boolean)
    .sort((a, b) => a.cardId.localeCompare(b.cardId));

  if (preferredCardId) {
    const preferred = candidates.find(
      (candidate) => candidate.cardId.toLocaleLowerCase("en-US") === preferredCardId,
    );
    if (preferred) return preferred;
  }

  return candidates[0] ?? null;
}

function parseScalar(value) {
  const trimmed = value.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed === "null") return null;
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseFrontMatter(mdx) {
  const normalized = String(mdx).replace(/\r\n?/g, "\n");
  if (!normalized.startsWith("---\n")) {
    throw new Error("Riftbound FAQ page is missing YAML front matter");
  }

  const end = normalized.indexOf("\n---\n", 4);
  if (end < 0) throw new Error("Riftbound FAQ page has unterminated YAML front matter");

  const frontMatter = {};
  let activeArray = null;
  for (const rawLine of normalized.slice(4, end).split("\n")) {
    const listItem = rawLine.match(/^\s*-\s+(.*)$/);
    if (listItem && activeArray) {
      frontMatter[activeArray].push(parseScalar(listItem[1]));
      continue;
    }

    const field = rawLine.match(/^([A-Za-z][A-Za-z0-9_-]*):(?:\s*(.*))?$/);
    if (!field) continue;
    const [, key, value = ""] = field;
    if (value.trim() === "") {
      frontMatter[key] = [];
      activeArray = key;
    } else {
      frontMatter[key] = parseScalar(value);
      activeArray = null;
    }
  }

  return { frontMatter, body: normalized.slice(end + 5) };
}

function attributeValue(attributes, name) {
  const match = attributes.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`));
  return match?.[1] ?? null;
}

function humanizeComponent(name) {
  return name.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function cleanMdxText(value) {
  return String(value)
    .replace(/<Card\s+[^>]*name="([^"]+)"[^>]*\/>/g, "$1")
    .replace(/<Rule\s+[^>]*number="([^"]+)"[^>]*\/>/g, " [CR $1]")
    .replace(/<Energy\s+[^>]*value=\{([^}]+)\}[^>]*\/>/g, "$1 energy")
    .replace(/<([A-Z][A-Za-z0-9]*)\s+[^>]*value=\{([^}]+)\}[^>]*\/>/g, (_, name, value) =>
      `${humanizeComponent(name)} ${value}`,
    )
    .replace(/<([A-Z][A-Za-z0-9]*)\s*\/>/g, (_, name) => humanizeComponent(name))
    .replace(/<\/?[A-Za-z][^>]*>/g, "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\[#[a-z0-9-]+\]/gi, "")
    .replace(/[*_`~]/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .split("\n")
    .map((line) => line.replace(/[\t ]+/g, " ").trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractCallouts(sectionBody) {
  const callouts = [];
  const withoutCallouts = sectionBody.replace(
    /<Callout\b([^>]*)>([\s\S]*?)<\/Callout>/g,
    (_, attributes, body) => {
      callouts.push({
        type: attributeValue(attributes, "type"),
        title: attributeValue(attributes, "title"),
        text: cleanMdxText(body),
      });
      return "";
    },
  );
  return { callouts, withoutCallouts };
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function addQuarantineReason(record, reason) {
  if (!record.quarantineReasons.includes(reason)) record.quarantineReasons.push(reason);
  record.status = "quarantined";
}

function recordHash(record) {
  return sha256(
    JSON.stringify({
      question: record.question,
      text: record.text,
      callouts: record.callouts,
      crdVersion: record.crdVersion,
      ruleRefs: record.ruleRefs,
      upstreamRuleRefs: record.upstreamRuleRefs,
      inheritedRuleRefs: record.inheritedRuleRefs,
      supplementalRuleRefs: record.supplementalRuleRefs ?? [],
      cardRefs: record.cardRefs,
      upstreamCardRefs: record.upstreamCardRefs,
      manualCardRefs: record.manualCardRefs ?? [],
      ambiguousCardMentions: record.ambiguousCardMentions ?? [],
      officialSupplementRefs: record.officialSupplementRefs ?? [],
      relatedRecordIds: record.relatedRecordIds,
      review: record.review ?? null,
    }),
  );
}

function findCanonicalCardById(canonicalCards, cardId) {
  for (const value of canonicalCards?.values?.() ?? []) {
    for (const candidate of Array.isArray(value) ? value : [value]) {
      const normalized = normalizeCardRecord(candidate);
      if (normalized?.cardId === cardId) return normalized;
    }
  }
  return null;
}

function applyCardMentionManifest(
  entries,
  mentionManifest,
  sourceCommit,
  canonicalCards,
  cardAliases,
) {
  if (
    mentionManifest?.schemaVersion !== 1 ||
    mentionManifest.sourceCommit !== sourceCommit ||
    mentionManifest.auditDate !== "2026-07-14" ||
    !Array.isArray(mentionManifest.records)
  ) {
    throw new Error("Riftbound FAQ card-mention manifest metadata is invalid");
  }

  const manifestById = new Map();
  for (const entry of mentionManifest.records) {
    if (
      !entry?.id ||
      !Array.isArray(entry.manualCardRefs) ||
      !Array.isArray(entry.ambiguousCardMentions) ||
      manifestById.has(entry.id)
    ) {
      throw new Error(`Invalid Riftbound FAQ card-mention entry: ${entry?.id ?? "unknown"}`);
    }
    manifestById.set(entry.id, entry);
  }

  const recordIds = new Set(entries.map((entry) => entry.id));
  const missing = entries.filter((entry) => !manifestById.has(entry.id)).map((entry) => entry.id);
  const extras = [...manifestById.keys()].filter((id) => !recordIds.has(id));
  if (missing.length || extras.length) {
    throw new Error(
      `Riftbound FAQ card-mention coverage mismatch; missing=${missing.join(",")}; extras=${extras.join(",")}`,
    );
  }

  let manualCardRefs = 0;
  let ambiguousCardMentions = 0;
  for (const record of entries) {
    const manifestEntry = manifestById.get(record.id);
    const haystack = normalizeCardName(
      [record.question, record.text, ...record.callouts.map((callout) => callout.text)].join(" "),
    );

    record.manualCardRefs = manifestEntry.manualCardRefs.map((manualRef) => {
      const resolved = resolveCard(
        manualRef.sourceName,
        canonicalCards,
        cardAliases,
        manualRef.cardId,
      );
      if (
        !resolved ||
        resolved.cardId !== manualRef.cardId ||
        resolved.name !== manualRef.canonicalName ||
        resolved.publicCode !== manualRef.publicCode ||
        !haystack.includes(normalizeCardName(manualRef.sourceName))
      ) {
        throw new Error(
          `Reviewed manual card reference does not resolve exactly in ${record.id}: ${manualRef.sourceName}`,
        );
      }
      return {
        sourceName: manualRef.sourceName,
        canonicalName: resolved.name,
        cardId: resolved.cardId,
        publicCode: resolved.publicCode,
      };
    });
    manualCardRefs += record.manualCardRefs.length;

    record.ambiguousCardMentions = manifestEntry.ambiguousCardMentions.map((ambiguity) => {
      if (
        !ambiguity?.sourceName ||
        !Array.isArray(ambiguity.candidateCardIds) ||
        ambiguity.candidateCardIds.length < 2 ||
        !ambiguity.note ||
        !haystack.includes(normalizeCardName(ambiguity.sourceName)) ||
        ambiguity.candidateCardIds.some((cardId) => !findCanonicalCardById(canonicalCards, cardId))
      ) {
        throw new Error(`Invalid ambiguous card mention in ${record.id}: ${ambiguity?.sourceName}`);
      }
      return {
        sourceName: ambiguity.sourceName,
        candidateCardIds: unique(ambiguity.candidateCardIds),
        note: ambiguity.note,
      };
    });
    ambiguousCardMentions += record.ambiguousCardMentions.length;

    const mergedRefs = [...record.upstreamCardRefs, ...record.manualCardRefs];
    record.cardRefs = mergedRefs.filter(
      (cardRef, index) =>
        mergedRefs.findIndex(
          (candidate) =>
            candidate.sourceName === cardRef.sourceName && candidate.cardId === cardRef.cardId,
        ) === index,
    );
    if (record.ambiguousCardMentions.length) addQuarantineReason(record, "ambiguous_card_reference");
    record.bodyHash = recordHash(record);
  }

  const calculatedCounts = {
    records: entries.length,
    manualCardRefs,
    ambiguousCardMentions,
  };
  if (JSON.stringify(calculatedCounts) !== JSON.stringify(mentionManifest.counts)) {
    throw new Error("Riftbound FAQ card-mention manifest counts do not match its records");
  }
  return {
    auditDate: mentionManifest.auditDate,
    purpose: mentionManifest.purpose,
    counts: calculatedCounts,
  };
}

function applyReviewManifest(
  entries,
  reviewManifest,
  sourceCommit,
  officialRuleNumbers,
  officialSupplements,
) {
  if (!reviewManifest || typeof reviewManifest !== "object") {
    throw new Error("Riftbound FAQ snapshot requires an explicit factual review manifest");
  }
  if (
    reviewManifest.schemaVersion !== 1 ||
    reviewManifest.sourceCommit !== sourceCommit ||
    reviewManifest.auditDate !== "2026-07-14" ||
    reviewManifest.basis !== REVIEW_BASIS ||
    reviewManifest.officialEvidenceCutoff !== "2026-04-29" ||
    JSON.stringify(reviewManifest.officialSourceArtifactIds) !==
      JSON.stringify(REVIEW_OFFICIAL_SOURCE_ARTIFACT_IDS) ||
    !Array.isArray(reviewManifest.records)
  ) {
    throw new Error("Riftbound FAQ factual review manifest metadata is invalid");
  }

  const manifestById = new Map();
  for (const review of reviewManifest.records) {
    if (
      !review?.id ||
      !REVIEW_DISPOSITIONS.has(review.disposition) ||
      typeof review.evidence !== "string" ||
      !review.evidence.trim() ||
      (review.supplementalRuleRefs != null && !Array.isArray(review.supplementalRuleRefs)) ||
      (review.officialSupplementRefs != null && !Array.isArray(review.officialSupplementRefs))
    ) {
      throw new Error(`Invalid Riftbound FAQ review entry: ${review?.id ?? "unknown"}`);
    }
    if (manifestById.has(review.id)) {
      throw new Error(`Duplicate Riftbound FAQ review entry: ${review.id}`);
    }
    manifestById.set(review.id, review);
  }

  const entryIds = new Set(entries.map((entry) => entry.id));
  const missing = entries.filter((entry) => !manifestById.has(entry.id)).map((entry) => entry.id);
  const extras = [...manifestById.keys()].filter((id) => !entryIds.has(id));
  if (missing.length || extras.length) {
    throw new Error(
      `Riftbound FAQ review manifest coverage mismatch; missing=${missing.join(",")}; extras=${extras.join(",")}`,
    );
  }

  const calculatedCounts = {
    pass: 0,
    factual_conflict: 0,
    insufficient_official_support: 0,
    baseline_quarantine: 0,
  };
  for (const review of manifestById.values()) calculatedCounts[review.disposition] += 1;
  if (JSON.stringify(calculatedCounts) !== JSON.stringify(reviewManifest.counts)) {
    throw new Error("Riftbound FAQ factual review manifest counts do not match its records");
  }

  // The manifest is the semantic-review gate. Resolving a cited rule or card
  // is necessary but never sufficient to make a community interpretation active.
  for (const record of entries) {
    const review = manifestById.get(record.id);
    const supplementalRuleEvidence = (review.supplementalRuleRefs ?? []).map((supplement) => {
      if (
        !supplement?.ruleId ||
        !officialRuleNumbers?.has(supplement.ruleId) ||
        typeof supplement.evidence !== "string" ||
        !supplement.evidence.trim()
      ) {
        throw new Error(`Invalid supplemental official rule evidence in ${record.id}`);
      }
      return { ruleId: supplement.ruleId, evidence: supplement.evidence };
    });
    record.supplementalRuleEvidence = supplementalRuleEvidence;
    record.supplementalRuleRefs = unique(
      supplementalRuleEvidence.map((supplement) => supplement.ruleId),
    );
    record.ruleRefs = unique([...record.ruleRefs, ...record.supplementalRuleRefs]);
    const officialSupplementRefs = review.officialSupplementRefs ?? [];
    if (unique(officialSupplementRefs).length !== officialSupplementRefs.length) {
      throw new Error(`Duplicate official supplement reference in ${record.id}`);
    }
    for (const supplementId of officialSupplementRefs) {
      const supplement = officialSupplements?.get(supplementId);
      if (
        !supplement ||
        supplement.ruling_id !== supplementId ||
        supplement.source?.source_type !== "official" ||
        supplement.source?.trust_tier !== "official" ||
        !REVIEW_OFFICIAL_SOURCE_ARTIFACT_IDS.includes(supplement.source_artifact_id) ||
        !/^[a-f0-9]{64}$/.test(supplement.source_sha256 ?? "") ||
        !ACCEPTED_OFFICIAL_SUPPLEMENT_VERIFICATION.has(supplement.verification?.status)
      ) {
        throw new Error(
          `Official supplement is missing or not exact-source verified in ${record.id}: ${supplementId}`,
        );
      }
    }
    record.officialSupplementRefs = [...officialSupplementRefs];
    record.review = {
      status: review.disposition,
      auditedAt: reviewManifest.auditDate,
      basis: reviewManifest.basis,
      officialEvidenceCutoff: reviewManifest.officialEvidenceCutoff,
      evidence: review.evidence,
    };

    if (review.disposition === "pass") {
      if (record.quarantineReasons.length) {
        throw new Error(
          `Review manifest marks ineligible record as pass: ${record.id} (${record.quarantineReasons.join(",")})`,
        );
      }
      record.status = "active";
    } else if (review.disposition === "baseline_quarantine") {
      if (!record.quarantineReasons.length) {
        throw new Error(`Review manifest baseline quarantine lacks an ingest reason: ${record.id}`);
      }
      record.status = "quarantined";
    } else {
      addQuarantineReason(record, review.disposition);
    }
    record.bodyHash = recordHash(record);
  }

  return {
    auditDate: reviewManifest.auditDate,
    basis: reviewManifest.basis,
    officialEvidenceCutoff: reviewManifest.officialEvidenceCutoff,
    officialSourceArtifactIds: [...reviewManifest.officialSourceArtifactIds],
    counts: calculatedCounts,
    officialSupplementRefs: {
      records: entries.filter((entry) => entry.officialSupplementRefs.length > 0).length,
      references: entries.reduce(
        (total, entry) => total + entry.officialSupplementRefs.length,
        0,
      ),
      uniqueSupplements: new Set(
        entries.flatMap((entry) => entry.officialSupplementRefs),
      ).size,
    },
  };
}

function assertApprovedSourcePath(sourcePath) {
  const normalized = path.posix.normalize(String(sourcePath));
  if (normalized !== sourcePath || !APPROVED_CONTENT_PATH.test(normalized)) {
    throw new Error(`Not an approved Riftbound FAQ content path: ${sourcePath}`);
  }
}

export function parseRiftboundFaqPage(mdx, context) {
  const {
    sourcePath,
    sourceCommit,
    lastModified,
    officialCrdVersion,
    officialRuleNumbers,
    canonicalCards,
    cardAliases,
  } = context;
  assertApprovedSourcePath(sourcePath);

  const { frontMatter, body } = parseFrontMatter(mdx);
  if (!frontMatter.title || !frontMatter.crdVersion || !Array.isArray(frontMatter.authors)) {
    throw new Error(`Incomplete Riftbound FAQ front matter: ${sourcePath}`);
  }

  const pageSlug = sourcePath.slice("content/".length, -".mdx".length);
  const category = pageSlug.split("/")[0];
  const preferredCardId = String(frontMatter.galleryLink ?? "")
    .match(/--([a-z0-9-]+)(?:$|[?#])/i)?.[1]
    ?.toLocaleLowerCase("en-US");
  const primaryCard =
    category === "cards"
      ? resolveCard(frontMatter.title, canonicalCards, cardAliases, preferredCardId)
      : null;

  const headings = [...body.matchAll(/^##\s+(.+?)\s+\[#([a-z0-9-]+)\]\s*$/gim)];
  return headings.map((heading, index) => {
    const question = cleanMdxText(heading[1]);
    const anchor = heading[2];
    const sectionBody = body.slice(
      heading.index + heading[0].length,
      headings[index + 1]?.index ?? body.length,
    );
    const { callouts, withoutCallouts } = extractCallouts(sectionBody);
    const ruleRefs = unique(
      [...sectionBody.matchAll(/<Rule\s+[^>]*number="([^"]+)"[^>]*\/>/g)].map(
        (match) => match[1],
      ),
    );
    const cardRefNames = unique(
      [...sectionBody.matchAll(/<Card\s+[^>]*name="([^"]+)"[^>]*\/>/g)].map(
        (match) => match[1],
      ),
    );
    const cardRefs = cardRefNames.map((sourceName) => {
      const canonical = resolveCard(sourceName, canonicalCards, cardAliases);
      return {
        sourceName,
        canonicalName: canonical?.name ?? null,
        cardId: canonical?.cardId ?? null,
        publicCode: canonical?.publicCode ?? null,
      };
    });
    const id = `riftboundfaq:${pageSlug}#${anchor}`;
    const relatedRecordIds = unique([
      ...[...sectionBody.matchAll(/\]\(#([a-z0-9-]+)\)/gi)].map(
        (match) => `riftboundfaq:${pageSlug}#${match[1]}`,
      ),
      ...(DECLARED_RELATED_RECORDS[id] ?? []),
    ]).filter((relatedId) => relatedId !== id);
    const quarantineReasons = [];

    if (callouts.some((callout) => callout.title?.toLocaleLowerCase("en-US") === "rules citation needed")) {
      quarantineReasons.push("rules_citation_needed");
    }
    if (String(frontMatter.crdVersion) !== String(officialCrdVersion)) {
      quarantineReasons.push("crd_version_mismatch");
    }
    if (ruleRefs.some((rule) => !officialRuleNumbers?.has(rule))) {
      quarantineReasons.push("unresolved_rule");
    }

    const unresolvedCardRef = cardRefs.some((card) => !card.cardId);
    if ((category === "cards" && !primaryCard) || unresolvedCardRef) {
      quarantineReasons.push("unresolved_card");
    }

    const record = {
      id,
      category,
      pageSlug,
      slug: pageSlug,
      pageTitle: String(frontMatter.title),
      anchor,
      question,
      primaryCardName: category === "cards" ? String(frontMatter.title) : null,
      primaryCardId: primaryCard?.cardId ?? null,
      primaryCardCode: primaryCard?.publicCode ?? null,
      text: cleanMdxText(withoutCallouts),
      callouts,
      crdVersion: String(frontMatter.crdVersion),
      status: quarantineReasons.length ? "quarantined" : "active",
      quarantineReasons,
      authors: frontMatter.authors.map(String),
      ruleRefs,
      upstreamRuleRefs: [...ruleRefs],
      inheritedRuleRefs: [],
      supplementalRuleRefs: [],
      supplementalRuleEvidence: [],
      cardRefs,
      upstreamCardRefs: cardRefs,
      manualCardRefs: [],
      ambiguousCardMentions: [],
      officialSupplementRefs: [],
      relatedRecordIds,
      groundingMode: ruleRefs.length ? "direct" : null,
      trustTier: RIFTBOUNDFAQ_SOURCE.trustTier,
      authority: RIFTBOUNDFAQ_SOURCE.authority,
      sourceCommit,
      sourcePath,
      sourceUrl: `${RIFTBOUNDFAQ_SOURCE.baseUrl}/${pageSlug}#${anchor}`,
      lastModified: lastModified || null,
      license: RIFTBOUNDFAQ_SOURCE.license,
    };
    record.bodyHash = recordHash(record);
    return record;
  });
}

export function buildRiftboundFaqSnapshot({
  pages,
  sourceCommit,
  officialCrdVersion,
  officialRuleNumbers,
  canonicalCards,
  cardAliases,
  cardMentionManifest,
  reviewManifest,
  officialSupplements = new Map(),
  ingestedAt,
}) {
  if (sourceCommit !== RIFTBOUNDFAQ_SOURCE.commit) {
    throw new Error(`Riftbound FAQ import must use pinned commit ${RIFTBOUNDFAQ_SOURCE.commit}`);
  }

  const sortedPages = [...pages].sort((a, b) => a.sourcePath.localeCompare(b.sourcePath));
  for (const page of sortedPages) assertApprovedSourcePath(page.sourcePath);

  const entries = sortedPages.flatMap((page) =>
    parseRiftboundFaqPage(page.mdx, {
      sourcePath: page.sourcePath,
      sourceCommit,
      lastModified: page.lastModified,
      officialCrdVersion,
      officialRuleNumbers,
      canonicalCards,
      cardAliases,
    }),
  );
  const recordsById = new Map();
  for (const record of entries) {
    if (recordsById.has(record.id)) throw new Error(`Duplicate Riftbound FAQ record: ${record.id}`);
    recordsById.set(record.id, record);
  }

  // A section with no direct CRD references may only remain active when it has
  // an explicit dependency on a grounded sibling. This keeps retrieval closed
  // by default and makes inherited support inspectable.
  for (const record of entries) {
    if (record.ruleRefs.length) continue;
    const inherited = unique(
      record.relatedRecordIds.flatMap((relatedId) => recordsById.get(relatedId)?.ruleRefs ?? []),
    );
    if (inherited.length) {
      record.inheritedRuleRefs = inherited;
      record.ruleRefs = inherited;
      record.groundingMode = "inherited";
      if (inherited.some((rule) => !officialRuleNumbers?.has(rule))) {
        addQuarantineReason(record, "unresolved_rule");
      }
    } else if (!record.quarantineReasons.includes("rules_citation_needed")) {
      addQuarantineReason(record, "unresolved_rule");
    }
    record.bodyHash = recordHash(record);
  }

  const cardMentionAudit = applyCardMentionManifest(
    entries,
    cardMentionManifest,
    sourceCommit,
    canonicalCards,
    cardAliases,
  );
  const reviewAudit = applyReviewManifest(
    entries,
    reviewManifest,
    sourceCommit,
    officialRuleNumbers,
    officialSupplements,
  );

  entries.sort((a, b) => a.id.localeCompare(b.id));
  const active = entries.filter((record) => record.status === "active").length;
  const quarantined = entries.length - active;

  return {
    schemaVersion: 1,
    generatedAt: ingestedAt,
    source: {
      sourceId: RIFTBOUNDFAQ_SOURCE.sourceId,
      name: RIFTBOUNDFAQ_SOURCE.name,
      baseUrl: RIFTBOUNDFAQ_SOURCE.baseUrl,
      repository: RIFTBOUNDFAQ_SOURCE.repository,
      commit: sourceCommit,
      license: RIFTBOUNDFAQ_SOURCE.license,
      trustTier: RIFTBOUNDFAQ_SOURCE.trustTier,
      authority: RIFTBOUNDFAQ_SOURCE.authority,
      officialCrdVersion: String(officialCrdVersion),
    },
    counts: {
      pages: new Set(sortedPages.map((page) => page.sourcePath)).size,
      records: entries.length,
      active,
      quarantined,
    },
    reviewAudit,
    cardMentionAudit,
    entries,
  };
}
