import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KB_ROOT = path.resolve(HERE, "../..");
const RULINGS_ROOT = path.join(KB_ROOT, "canon", "rulings");

const readJson = (relativePath) =>
  JSON.parse(fs.readFileSync(path.join(KB_ROOT, relativePath), "utf8"));

const ERRATA_SOURCE_PATH =
  "canon/rulings/sources/riftbound-unleashed-errata-2026-04-03.json";
const FAQ_SOURCE_PATH =
  "canon/rulings/sources/riftbound-unleashed-rules-faq-2026-04-29.json";

const OFFICIAL_ERRATA_URL =
  "https://playriftbound.com/en-us/news/rules-and-releases/unleashed-errata-updates/";
const OFFICIAL_FAQ_URL =
  "https://playriftbound.com/en-us/news/rules-and-releases/unleashed-rules-faq-and-clarifications/";

function readRuling(rulingId) {
  return readJson(`canon/rulings/records/${rulingId}.json`);
}

test("pins every section in the April 3 official errata article", () => {
  const source = readJson(ERRATA_SOURCE_PATH);

  assert.equal(source.source_id, "official.unleashed-errata-2026-04-03");
  assert.equal(source.source_url, OFFICIAL_ERRATA_URL);
  assert.equal(source.published_date, "2026-04-03");
  assert.equal(source.retrieved_at, "2026-07-14");
  assert.equal(source.authority, "official");
  assert.equal(source.raw.sha256, "c8971b31589c00af75a34fe7ed5dd9dac8e1dde7f05a39fc5cde3af5adabf9da");
  assert.equal(source.normalized.sha256, "e909789cb081496b9969bec195f428db465ff0afc389274cc70423c8be2cfd24");
  assert.deepEqual(source.inventory.group_counts, {
    spiritforged: 2,
    unleashed: 6,
  });
  assert.equal(source.inventory.section_count, 8);
  assert.equal(source.inventory.record_count, 8);
  assert.equal(source.inventory.sections.length, 8);
  assert.equal(
    new Set(source.inventory.sections.flatMap((section) => section.record_ids)).size,
    8,
  );
});

test("pins every section in the controlling April 29 clarification article", () => {
  const source = readJson(FAQ_SOURCE_PATH);

  assert.equal(source.source_id, "official.unleashed-rules-faq-2026-04-29");
  assert.equal(source.source_url, OFFICIAL_FAQ_URL);
  assert.equal(source.published_date, "2026-04-29");
  assert.equal(source.retrieved_at, "2026-07-14");
  assert.equal(source.authority, "official");
  assert.equal(source.raw.sha256, "2ac07aa740df91f3eff14b45006b1b1f68e1e3ca4604af4ffa979bf5bf138840");
  assert.equal(source.normalized.sha256, "555a37682b52dad9221f877fce3ac73530cd2a6d8007645d8ec56fd617ae7776");
  assert.deepEqual(source.inventory.group_counts, {
    revised_and_clarified_rulings: 7,
    frequently_asked_questions: 14,
  });
  assert.equal(source.inventory.section_count, 21);
  assert.equal(source.inventory.record_count, 23);
  assert.equal(source.inventory.sections.length, 21);
  assert.equal(
    new Set(source.inventory.sections.flatMap((section) => section.record_ids)).size,
    23,
  );
  assert.equal(source.precedence, "supersedes_crd_1_3_until_next_crd");
  assert.equal(source.effective_until, "next_core_rules_document");
});

test("all inventoried official records resolve and retain source provenance", () => {
  const sources = [readJson(ERRATA_SOURCE_PATH), readJson(FAQ_SOURCE_PATH)];

  for (const source of sources) {
    for (const section of source.inventory.sections) {
      assert.ok(section.heading);
      assert.ok(section.record_ids.length > 0);

      for (const rulingId of section.record_ids) {
        const ruling = readRuling(rulingId);
        assert.equal(ruling.ruling_id, rulingId);
        assert.equal(ruling.source.source_type, "official");
        assert.equal(ruling.source.source_url, source.source_url);
        assert.equal(ruling.source.trust_tier, "official");
        assert.equal(ruling.source_artifact_id, source.source_id);
        assert.equal(ruling.source_sha256, source.normalized.sha256);
        assert.equal(ruling.verification.status, "official_source_text_verified");
        assert.equal(ruling.verification.verified_at, "2026-07-14");
      }
    }
  }
});

test("CRD-superseding April 29 records carry explicit precedence and affected rules", () => {
  const source = readJson(FAQ_SOURCE_PATH);
  const records = source.inventory.sections
    .flatMap((section) => section.record_ids)
    .map(readRuling);
  const superseding = records.filter(
    (record) => record.precedence === "supersedes_crd_1_3_until_next_crd",
  );

  assert.ok(superseding.length >= 5);
  for (const record of superseding) {
    assert.equal(record.effective_until, "next_core_rules_document");
    assert.ok(
      record.affected_rule_ids.length > 0 || record.pending_rule_number === true,
      `${record.ruling_id} needs either affected rules or an explicit pending rule number`,
    );
  }

  const triggers = readRuling(
    "ruling.triggered-ability-structure-clarification-2026-04-29",
  );
  assert.match(triggers.explanation, /placed on the chain/i);
  assert.match(triggers.explanation, /Disarming Rake/i);

  const combat = readRuling(
    "ruling.combat-no-result-recall-rules-change-2026-04-29",
  );
  assert.deepEqual(combat.affected_rule_ids, ["461.3.d"]);
  assert.match(combat.new_text, /units were recalled during the Combat Cleanup/i);
});

test("April 3 errata remain linked from every affected printing without replacing printed text", () => {
  const expectedLinks = new Map([
    ["sfd-154-221", "ruling.guards-errata-2026-04-03"],
    ["sfd-184-221", "ruling.relentless-pursuit-errata-2026-04-03"],
    ["unl-186-219", "ruling.death-from-below-errata-2026-04-03"],
    ["unl-139-219", "ruling.bone-skewer-errata-2026-04-03"],
    ["unl-199-219", "ruling.deceiver-errata-2026-04-03"],
    ["unl-235-219", "ruling.deceiver-errata-2026-04-03"],
    ["unl-235-star-219", "ruling.deceiver-errata-2026-04-03"],
    ["unl-200-219", "ruling.mirror-image-errata-2026-04-03"],
    ["unl-081-219", "ruling.keeper-of-masks-errata-2026-04-03"],
    ["unl-120-219", "ruling.rengar-trophy-hunter-errata-2026-04-03"],
    ["unl-120a-219", "ruling.rengar-trophy-hunter-errata-2026-04-03"],
  ]);

  for (const [cardId, rulingId] of expectedLinks) {
    const card = readJson(`canon/cards/${cardId}.json`);
    const uri = `riftbound-kb://canon/rulings/records/${rulingId}.json`;
    assert.ok(card.errata_links.includes(uri), `${cardId} is missing ${rulingId}`);
  }

  const boneSkewer = readRuling("ruling.bone-skewer-errata-2026-04-03");
  assert.match(boneSkewer.old_text, /When they do/);
  assert.match(boneSkewer.new_text, /If they do, then do this/);
  assert.match(readJson("canon/cards/unl-139-219.json").text, /When they do/);
});

test("the ruling index covers the complete official source inventory exactly once", () => {
  const index = readJson("canon/rulings/index.json");
  const indexedIds = index.items.map((item) => item.ruling_id);
  const sourceIds = [readJson(ERRATA_SOURCE_PATH), readJson(FAQ_SOURCE_PATH)]
    .flatMap((source) => source.inventory.sections)
    .flatMap((section) => section.record_ids);

  assert.equal(index.count, index.items.length);
  assert.equal(index.count, 65);
  assert.equal(new Set(indexedIds).size, indexedIds.length);
  for (const rulingId of sourceIds) {
    assert.equal(indexedIds.filter((id) => id === rulingId).length, 1);
    assert.ok(fs.existsSync(path.join(RULINGS_ROOT, "records", `${rulingId}.json`)));
  }
});

test("the generator check mode detects drift without rewriting it", (context) => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "riftbound-official-check-"));
  context.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }));

  fs.mkdirSync(path.join(temporaryRoot, "canon", "rulings"), { recursive: true });
  fs.cpSync(path.join(KB_ROOT, "canon", "cards"), path.join(temporaryRoot, "canon", "cards"), {
    recursive: true,
  });
  fs.copyFileSync(
    path.join(KB_ROOT, "canon", "rulings", "index.json"),
    path.join(temporaryRoot, "canon", "rulings", "index.json"),
  );

  const generator = path.join(KB_ROOT, "scripts", "import-official-unleashed-april-2026.mjs");
  const runGenerator = (...arguments_) =>
    execFileSync(process.execPath, [generator, "--root", temporaryRoot, ...arguments_], {
      stdio: ["ignore", "pipe", "pipe"],
    });
  runGenerator();
  assert.doesNotThrow(() => runGenerator("--check"));

  const cardPath = path.join(temporaryRoot, "canon", "cards", "unl-139-219.json");
  const card = JSON.parse(fs.readFileSync(cardPath, "utf8"));
  const injectedLink =
    "riftbound-kb://canon/rulings/records/ruling.guards-errata-2026-04-03.json";
  card.errata_links.push(injectedLink);
  const injectedCard = `${JSON.stringify(card, null, 2)}\n`;
  fs.writeFileSync(cardPath, injectedCard, "utf8");
  assert.throws(
    () => runGenerator("--check"),
    (error) => /drift detected/i.test(String(error.stderr)),
  );
  assert.equal(fs.readFileSync(cardPath, "utf8"), injectedCard);

  runGenerator();
  assert.doesNotThrow(() => runGenerator("--check"));

  const target = path.join(
    temporaryRoot,
    "canon",
    "rulings",
    "records",
    "ruling.bone-skewer-errata-2026-04-03.json",
  );
  const tampered = fs
    .readFileSync(target, "utf8")
    .replace("official_source_text_verified", "tampered_after_review");
  fs.writeFileSync(target, tampered, "utf8");

  assert.throws(
    () => runGenerator("--check"),
    (error) => /drift detected/i.test(String(error.stderr)),
  );
  assert.equal(fs.readFileSync(target, "utf8"), tampered);
});
