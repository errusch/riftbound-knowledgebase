#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

function parseArguments(argv) {
  const options = { check: false, root: path.resolve(HERE, "..") };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--check") options.check = true;
    else if (argument === "--root" && argv[index + 1]) {
      options.root = path.resolve(argv[++index]);
    } else {
      throw new Error(`Unknown or incomplete argument: ${argument}`);
    }
  }
  return options;
}

const OPTIONS = parseArguments(process.argv.slice(2));
const KB_ROOT = OPTIONS.root;
const CARDS_DIR = path.join(KB_ROOT, "canon", "cards");
const RULINGS_DIR = path.join(KB_ROOT, "canon", "rulings");
const RECORDS_DIR = path.join(RULINGS_DIR, "records");
const SOURCES_DIR = path.join(RULINGS_DIR, "sources");
const INDEX_PATH = path.join(RULINGS_DIR, "index.json");
const GENERATED_AT = "2026-07-14T20:00:00.000Z";

const ERRATA = {
  source_id: "official.unleashed-errata-2026-04-03",
  source_name: "Riftbound Unleashed Errata Updates",
  source_url:
    "https://playriftbound.com/en-us/news/rules-and-releases/unleashed-errata-updates/",
  published_date: "2026-04-03",
  retrieved_at: "2026-07-14",
  authority: "official",
  raw: {
    media_type: "text/html",
    bytes: 134092,
    sha256: "c8971b31589c00af75a34fe7ed5dd9dac8e1dde7f05a39fc5cde3af5adabf9da",
  },
  normalized: {
    method: "pandoc 3.9 html-to-plain; remove blank lines; LF output",
    line_count: 132,
    sha256: "e909789cb081496b9969bec195f428db465ff0afc389274cc70423c8be2cfd24",
  },
};

const FAQ = {
  source_id: "official.unleashed-rules-faq-2026-04-29",
  source_name: "Riftbound Unleashed Rules FAQ and Clarifications",
  source_url:
    "https://playriftbound.com/en-us/news/rules-and-releases/unleashed-rules-faq-and-clarifications/",
  published_date: "2026-04-29",
  retrieved_at: "2026-07-14",
  authority: "official",
  precedence: "supersedes_crd_1_3_until_next_crd",
  effective_until: "next_core_rules_document",
  raw: {
    media_type: "text/html",
    bytes: 242671,
    sha256: "2ac07aa740df91f3eff14b45006b1b1f68e1e3ca4604af4ffa979bf5bf138840",
  },
  normalized: {
    method: "pandoc 3.9 html-to-plain; remove blank lines; LF output",
    line_count: 290,
    sha256: "555a37682b52dad9221f877fce3ac73530cd2a6d8007645d8ec56fd617ae7776",
  },
};

const sourceRecord = (source) => ({
  source_type: "official",
  source_name: source.source_name,
  source_url: source.source_url,
  source_date: source.published_date,
  retrieved_at: source.retrieved_at,
  trust_tier: "official",
  notes: "Transcribed from the complete official article inventory and verified against the live Riot page.",
});

const verifiedRecord = (source, fields) => ({
  ruling_id: fields.ruling_id,
  kind: fields.kind,
  title: fields.title,
  card_name: fields.card_name ?? null,
  card_id: fields.card_id ?? null,
  old_text: fields.old_text ?? null,
  new_text: fields.new_text ?? null,
  explanation: fields.explanation ?? null,
  effective_date: source.published_date,
  source_doc: source.source_name,
  affected_card_ids: fields.affected_card_ids ?? [],
  affected_rule_ids: fields.affected_rule_ids ?? [],
  topics: fields.topics ?? [],
  ...(fields.pending_rule_number ? { pending_rule_number: true } : {}),
  ...(fields.precedence
    ? {
        precedence: fields.precedence,
        effective_until: fields.effective_until,
      }
    : {}),
  source_artifact_id: source.source_id,
  source_sha256: source.normalized.sha256,
  source: sourceRecord(source),
  verification: {
    status: "official_source_text_verified",
    verified_at: "2026-07-14",
    method: "complete_official_article_section_inventory",
    notes:
      "Checked against the official source article, its section inventory, and the canonical CRD/card corpus.",
  },
});

const ERRATA_RECORDS = [
  verifiedRecord(ERRATA, {
    ruling_id: "ruling.guards-errata-2026-04-03",
    kind: "errata",
    title: "Guards! (errata)",
    card_name: "Guards!",
    card_id: "sfd-154-221",
    affected_card_ids: ["sfd-154-221"],
    old_text:
      "[Hidden] (Hide now for [A] to react with later for [0].)\nPlay a 2 [M] Sand Soldier unit token. You may pay [C] to ready it.",
    new_text:
      "[Hidden] (Hide now for [A] to react with later for [0].)\nPlay a 2 [M] Sand Soldier unit token. Then do this: You may pay [C] to ready it.",
    explanation:
      "The ready instruction is a reflexive trigger created after the Sand Soldier is played.",
    topics: ["reflexive triggers", "Hidden", "tokens"],
  }),
  verifiedRecord(ERRATA, {
    ruling_id: "ruling.relentless-pursuit-errata-2026-04-03",
    kind: "errata",
    title: "Relentless Pursuit (errata)",
    card_name: "Relentless Pursuit",
    card_id: "sfd-184-221",
    affected_card_ids: ["sfd-184-221"],
    old_text:
      "[Action] (Play on your turn or in showdowns.)\nMove a friendly unit. You may attach an Equipment with the same controller to it. This turn, that unit has \"When I conquer, you may move me to my base.\"",
    new_text:
      "[Action] (Play on your turn or in showdowns.)\nMove a friendly unit. You may attach up to one Equipment with the same controller to it. This turn, that unit has \"When I conquer, you may move me to my base.\"",
    explanation:
      "The Equipment choice is explicitly optional; choosing zero Equipment is legal.",
    topics: ["optional choices", "Equipment", "move"],
  }),
  verifiedRecord(ERRATA, {
    ruling_id: "ruling.death-from-below-errata-2026-04-03",
    kind: "errata",
    title: "Death from Below (errata)",
    card_name: "Death from Below",
    card_id: "unl-186-219",
    affected_card_ids: ["unl-186-219"],
    old_text:
      "Kill a unit at a battlefield. Then, if it had 3 [M] or less, you may play this from your trash for [A].",
    new_text:
      "Kill a unit at a battlefield. Then, if it had 3 [M] or less, do this: You may play this from your trash for [A].",
    explanation:
      "If the killed unit had 3 Might or less, the trash-play instruction is a reflexive trigger.",
    topics: ["reflexive triggers", "trash", "play"],
  }),
  verifiedRecord(ERRATA, {
    ruling_id: "ruling.bone-skewer-errata-2026-04-03",
    kind: "errata",
    title: "Bone Skewer (errata)",
    card_name: "Bone Skewer",
    card_id: "unl-139-219",
    affected_card_ids: ["unl-139-219"],
    old_text:
      "[Hidden] (Hide now for [A] to react with later for [0].)\nChoose a battlefield. An opponent reveals their hand. You may choose a unit from it. They play that unit to that battlefield, ignoring any and all costs. When they do, [Stun] it. (It doesn't deal combat damage this turn.)",
    new_text:
      "[Hidden] (Hide now for [A] to react with later for [0].)\nChoose a battlefield. An opponent reveals their hand. You may choose a unit from it. They play that unit to that battlefield, ignoring any and all costs. If they do, then do this: [Stun] it. (It doesn't deal combat damage this turn.)",
    explanation:
      "The reflexive Stun trigger is created only if the opponent actually plays the chosen unit.",
    topics: ["reflexive triggers", "Hidden", "Stun", "play"],
  }),
  verifiedRecord(ERRATA, {
    ruling_id: "ruling.deceiver-errata-2026-04-03",
    kind: "errata",
    title: "LeBlanc, Deceiver (errata)",
    card_name: "Deceiver",
    card_id: "unl-199-219",
    affected_card_ids: ["unl-199-219", "unl-235-219", "unl-235-star-219"],
    old_text:
      "When you conquer or hold, you may discard 1 and exhaust me to play a ready Reflection unit token there. It becomes a copy of another unit there. Give it [Temporary].",
    new_text:
      "When you conquer or hold, you may discard 1 and exhaust me to play a ready Reflection unit token there. Then do this: It becomes a copy of another unit there. Give it [Temporary].",
    explanation:
      "Copying another unit and granting Temporary happen in a reflexive trigger after the Reflection is played.",
    topics: ["reflexive triggers", "copy", "Reflection", "Temporary"],
  }),
  verifiedRecord(ERRATA, {
    ruling_id: "ruling.mirror-image-errata-2026-04-03",
    kind: "errata",
    title: "Mirror Image (errata)",
    card_name: "Mirror Image",
    card_id: "unl-200-219",
    affected_card_ids: ["unl-200-219"],
    old_text:
      "Choose a unit. Play a ready Reflection unit token to your base. It becomes a copy of that unit. Give it [Temporary]. (Kill it at the start of its controller's Beginning Phase, before scoring.)",
    new_text:
      "Choose a unit. Play a ready Reflection unit token to your base. Then do this: It becomes a copy of that unit. Give it [Temporary]. (Kill it at the start of its controller's Beginning Phase, before scoring.)",
    explanation:
      "The copy and Temporary instructions happen in a reflexive trigger after the Reflection is played.",
    topics: ["reflexive triggers", "copy", "Reflection", "Temporary"],
  }),
  verifiedRecord(ERRATA, {
    ruling_id: "ruling.keeper-of-masks-errata-2026-04-03",
    kind: "errata",
    title: "Keeper of Masks (errata)",
    card_name: "Keeper of Masks",
    card_id: "unl-081-219",
    affected_card_ids: ["unl-081-219"],
    old_text:
      "[Hidden] (Hide now for [A] to react with later for [0].)\n[Temporary] (Kill me at the start of my controller's Beginning Phase, before scoring.)\nWhen you play me, play two Reflection unit tokens here. They become copies of me.",
    new_text:
      "[Hidden] (Hide now for [A] to react with later for [0].)\n[Temporary] (Kill me at the start of my controller's Beginning Phase, before scoring.)\nWhen you play me, play two Reflection unit tokens here. Then do this: They become copies of me.",
    explanation:
      "The two Reflection tokens become copies in a reflexive trigger after they are played.",
    topics: ["reflexive triggers", "copy", "Reflection", "Temporary"],
  }),
  verifiedRecord(ERRATA, {
    ruling_id: "ruling.rengar-trophy-hunter-errata-2026-04-03",
    kind: "errata",
    title: "Rengar, Trophy Hunter (errata)",
    card_name: "Rengar, Trophy Hunter",
    card_id: "unl-120-219",
    affected_card_ids: ["unl-120-219", "unl-120a-219"],
    old_text:
      "[Ambush] (You may play me as a [Reaction] to a battlefield where you have units.)\nI can be played to a battlefield where there are enemy units (even if you don't have units there).",
    new_text:
      "[Ambush] (You may play me as a [Reaction] to a battlefield where you have units.)\nI can [Ambush] to a battlefield where there are enemy units, even if you don't have units there.",
    explanation:
      "The special enemy-battlefield permission applies to Ambush, not to every way Rengar could be played.",
    topics: ["Ambush", "Reaction", "play location"],
  }),
];

const superseding = (fields) =>
  verifiedRecord(FAQ, {
    ...fields,
    precedence: FAQ.precedence,
    effective_until: FAQ.effective_until,
  });

const FAQ_RECORDS = [
  superseding({
    ruling_id: "ruling.triggered-ability-structure-clarification-2026-04-29",
    kind: "rules_change",
    title: "Triggered ability structure and timing",
    affected_rule_ids: ["383.2", "383.3", "383.3.a", "383.3.b", "383.3.e", "387", "388", "742"],
    affected_card_ids: [
      "unl-187-219", "unl-229-219", "unl-229-star-219", "ogn-073-298",
      "sfd-032-221", "ogn-110-298", "ogn-251-298", "ogn-301-298",
      "ogn-301-star-298", "sfd-058-221", "sfd-058a-221", "unl-135-219",
      "sfd-084-221", "sfd-020-221", "sfd-020a-221",
    ],
    new_text:
      "Parse a triggered ability in this expected sequence: trigger condition; adjacent conditional; adjacent 'you may'; adjacent cost within instructions. An adjacent 'you may' controls whether the ability is placed on the chain, and an adjacent cost within instructions becomes its base cost during finalization. Elements appearing later are part of the resolving effect.",
    explanation:
      "This replaces the first-comma model. For example, Disarming Rake's adjacent 'you may' decides whether its trigger is placed on the chain, while Ornn, Blacksmith's later 'you may' is chosen on resolution. An 'if you do' instruction is not a cost; if the checked action is replaced or not performed, its later condition is false.",
    topics: ["triggered abilities", "cost within instructions", "you may", "if you do", "finalization"],
  }),
  superseding({
    ruling_id: "ruling.battlefield-control-cleanup-rules-change-2026-04-29",
    kind: "rules_change",
    title: "Empty battlefield control cleanup",
    affected_rule_ids: ["187.4.c", "323.6"],
    new_text:
      "Players lose control of any controlled Battlefields without their Units occupying them if the turn is in an open state and there is no Showdown or Combat ongoing there.",
    explanation:
      "Rule 323.6 is corrected to agree with 187.4.c: an empty battlefield does not lose its controller during a closed state or while a Showdown or Combat is ongoing there.",
    topics: ["battlefield control", "cleanup", "open state"],
  }),
  superseding({
    ruling_id: "ruling.showdown-staging-rules-change-2026-04-29",
    kind: "rules_change",
    title: "Showdown staging after Contested",
    affected_rule_ids: ["316.5.b", "323.8"],
    old_text:
      "A Showdown is marked as Staged at a Battlefield when the Contested status is applied to a Battlefield with no current controller.",
    new_text:
      "A Showdown is marked as staged at a Battlefield in the cleanup after the Contested status is applied to that Battlefield.",
    explanation:
      "Showdown staging happens in cleanup after Contested is applied and does not require the battlefield to be uncontrolled.",
    topics: ["Showdown", "Contested", "cleanup"],
  }),
  superseding({
    ruling_id: "ruling.showdown-opening-rules-change-2026-04-29",
    kind: "rules_change",
    title: "Opening a non-combat Showdown",
    affected_rule_ids: ["344.2"],
    old_text:
      "If Control of a Battlefield is Contested and the Battlefield in question is uncontrolled when it becomes Contested, a Showdown is opened during the Cleanup at the end of the action that caused the Battlefield to become Contested.",
    new_text:
      "If Control of a Battlefield is Contested and there aren't units controlled by different players there, a Showdown is opened during the Cleanup at the end of the action that caused the Battlefield to become Contested.",
    explanation:
      "The non-combat Showdown check depends on whether units controlled by different players are present, not whether the battlefield is uncontrolled.",
    topics: ["Showdown", "Contested", "cleanup"],
  }),
  superseding({
    ruling_id: "ruling.private-information-compulsory-actions-rules-change-2026-04-29",
    kind: "rules_change",
    title: "Mandatory actions involving private information",
    card_name: "Rift Herald",
    card_id: "unl-179-219",
    affected_card_ids: ["unl-179-219", "unl-179a-219"],
    affected_rule_ids: [],
    pending_rule_number: true,
    new_text:
      "A player cannot be compelled to perform an action on cards whose privacy is secret or private if that action specifies a type or quality of card. The player may ignore that action instead.",
    explanation:
      "This rule is effective immediately even though its permanent rule number is deferred to the next Core Rules update. It prevents compulsory effects such as Rift Herald's Deathknell from forcing proof about qualifying cards in a private hand.",
    topics: ["private information", "secret information", "mandatory actions"],
  }),
  superseding({
    ruling_id: "ruling.lethal-damage-modification-clarification-2026-04-29",
    kind: "rules_change",
    title: "Lethal damage modification and Elder Dragon",
    card_name: "Elder Dragon",
    card_id: "unl-118-219",
    affected_card_ids: ["unl-118-219", "unl-118a-219"],
    affected_rule_ids: ["323.5", "460.2.c.3"],
    new_text:
      "Lethal damage is normally a non-zero amount at least equal to a unit's Might, but effects can modify that definition. Damage marked by a player is that player's damage.",
    explanation:
      "While Elder Dragon is controlled, any non-zero damage its controller has marked on enemy units is lethal for cleanup and combat assignment. It also sees that controller's damage marked before Elder Dragon entered the board.",
    topics: ["lethal damage", "marked damage", "Elder Dragon", "combat assignment"],
  }),
  superseding({
    ruling_id: "ruling.battlefield-ability-control-clarification-2026-04-29",
    kind: "rules_change",
    title: "Control of battlefield abilities",
    card_name: "Abandoned Hall",
    card_id: "unl-205-219",
    affected_card_ids: ["unl-205-219"],
    affected_rule_ids: ["187.6", "187.6.a", "187.6.b"],
    new_text:
      "If a Battlefield ability indicates that a specific player makes a choice, that player alone adds it to the chain, makes all required choices, and controls the ability. If more than one player must choose, the battlefield's controller controls it.",
    explanation:
      "The specified chooser overrides the normal battlefield-controller or turn-player default for a triggered battlefield ability.",
    topics: ["battlefield abilities", "control", "choices", "chain"],
  }),
  superseding({
    ruling_id: "ruling.play-meaning-legion-clarification-2026-04-29",
    kind: "rules_change",
    title: "Technical meanings of play and Legion",
    affected_rule_ids: ["350.1", "353", "812.1.c"],
    new_text:
      "In trigger conditions, 'play' means resolving an item on the chain. In other conditions and effects that check whether a card was played, including Legion, it means finalizing the item. In other verb uses, it means placing an item on the chain and queuing it for finalization.",
    explanation:
      "These three transitional meanings govern whether play triggers happen, whether Legion is active, and when instructions that play a card have occurred.",
    topics: ["play", "Legion", "resolve", "finalize", "chain"],
  }),
  superseding({
    ruling_id: "ruling.combat-no-result-recall-rules-change-2026-04-29",
    kind: "rules_change",
    title: "No Result after Combat Cleanup recalls",
    affected_rule_ids: ["461.3.d"],
    old_text:
      "There is No Result if either both Players have units present during this step, or neither player has units present during this step.",
    new_text:
      "There is No Result if units were recalled during the Combat Cleanup, if both Players have units present during this task, or if neither player has units present during this task.",
    explanation:
      "A recall during Combat Cleanup prevents the remaining side from incorrectly winning solely because the recalled side is absent when combat results are determined.",
    topics: ["combat result", "recall", "Combat Cleanup", "No Result"],
  }),
  verifiedRecord(FAQ, {
    ruling_id: "ruling.aspirants-climb-green-father-victory-score-clarification-2026-04-29",
    kind: "ruling",
    title: "Aspirant's Climb, Green Father, and a tied Victory Score",
    affected_card_ids: ["ogn-276-298", "unl-195-219", "unl-233-219", "unl-233-star-219", "unl-t03"],
    affected_rule_ids: ["323.1", "466.1.b", "467"],
    explanation:
      "If Green Father replaces Aspirant's Climb with Brush while both players are at eight points, the lower Victory Score applies immediately, but neither tied player wins. The first battlefield scored still draws a card instead of awarding the final point; a later qualifying score can break the tie.",
    topics: ["Victory Score", "replace", "Brush", "points"],
  }),
  verifiedRecord(FAQ, {
    ruling_id: "ruling.brush-swap-back-replacement-clarification-2026-04-29",
    kind: "ruling",
    title: "Replacing Brush with Brush and swapping back",
    card_name: "Brush",
    card_id: "unl-t03",
    affected_card_ids: ["unl-t03"],
    affected_rule_ids: ["438.1", "438.7.b"],
    explanation:
      "A Brush token that is itself replaced ceases to exist. On swap back, the controller may choose any object in the replacement chain, including the original battlefield, because replacement relationships and statuses are inherited.",
    topics: ["replace", "swap back", "Brush", "tokens"],
  }),
  verifiedRecord(FAQ, {
    ruling_id: "ruling.turn-to-dust-attached-equipment-temporary-clarification-2026-04-29",
    kind: "ruling",
    title: "Granted rules text on attached Equipment",
    card_name: "Turn to Dust",
    card_id: "unl-070-219",
    affected_card_ids: ["unl-070-219"],
    affected_rule_ids: ["135.4", "718.2"],
    explanation:
      "Attached Equipment has only its printed rules text inactive. Rules text granted by another effect remains active, so Temporary granted by Turn to Dust will trigger and kill it in its controller's next Beginning Phase; granted Deflect also remains active.",
    topics: ["Equipment", "attached", "granted text", "Temporary", "Deflect"],
  }),
  verifiedRecord(FAQ, {
    ruling_id: "ruling.spinning-axe-granted-temporary-clarification-2026-04-29",
    kind: "ruling",
    title: "Granted Temporary on attached Spinning Axe",
    card_name: "Spinning Axe",
    card_id: "sfd-186-221",
    affected_card_ids: ["sfd-186-221"],
    affected_rule_ids: ["135.4", "718.2", "816.2", "816.2.a"],
    explanation:
      "An attached Spinning Axe has an inactive printed Temporary and an active granted Temporary. The active instance triggers and kills it; the redundancy rule does not suppress the only active instance.",
    topics: ["Equipment", "attached", "Temporary", "inactive text"],
  }),
  verifiedRecord(FAQ, {
    ruling_id: "ruling.battlefield-control-open-state-clarification-2026-04-29",
    kind: "ruling",
    title: "Keeping empty battlefield control while the chain is pending",
    affected_card_ids: ["ogn-208-298", "ogn-242-298", "sfd-200-221", "ogn-116-298", "sfd-165-221"],
    affected_rule_ids: ["187.4.c", "323.6"],
    explanation:
      "Battlefield control cannot be lost while an item is on the chain because the turn is not open. Cruel Patron, Baited Hook, Arcane Shift, and Glasc Mixologist can therefore remove the last unit and still play the resulting unit to that same controlled battlefield when their stated timing requirements are met.",
    topics: ["battlefield control", "open state", "chain", "cleanup"],
  }),
  verifiedRecord(FAQ, {
    ruling_id: "ruling.cleanup-during-finalization-clarification-2026-04-29",
    kind: "ruling",
    title: "Cleanups do not occur during finalization",
    affected_rule_ids: ["323", "335", "337", "338"],
    explanation:
      "Finalization is a single FEPR step for making choices, paying costs, and checking legality. Cleanups can occur after an item is added, after it is finalized, and after it resolves, but never partway through finalization.",
    topics: ["cleanup", "finalization", "FEPR", "chain"],
  }),
  verifiedRecord(FAQ, {
    ruling_id: "ruling.zilean-deceiver-reflection-copy-clarification-2026-04-29",
    kind: "ruling",
    title: "Zilean and Deceiver Reflection copies",
    card_name: "Deceiver",
    card_id: "unl-199-219",
    affected_card_ids: ["unl-086-219", "unl-199-219", "unl-235-219", "unl-235-star-219"],
    affected_rule_ids: ["375"],
    explanation:
      "Zilean's replacement effect makes a second ready Reflection as Deceiver plays one. After both tokens resolve, Deceiver's reflexive trigger makes both copies of the chosen unit and grants both Temporary. Becoming Zilean copies does not create another play event, so no loop occurs.",
    topics: ["replacement effects", "copy", "Reflection", "reflexive triggers"],
  }),
  verifiedRecord(FAQ, {
    ruling_id: "ruling.elder-dragon-counter-strike-prevention-clarification-2026-04-29",
    kind: "ruling",
    title: "Counter Strike preventing Elder Dragon damage",
    card_name: "Elder Dragon",
    card_id: "unl-118-219",
    affected_card_ids: ["unl-118-219", "unl-118a-219", "sfd-194-221"],
    affected_rule_ids: ["437.2.a"],
    explanation:
      "Counter Strike can prevent all one damage from Elder Dragon. Zero damage is equivalent to no damage dealt, so Elder Dragon has no controller-marked damage on that unit to redefine as lethal.",
    topics: ["prevent", "damage", "lethal damage", "Elder Dragon"],
  }),
  verifiedRecord(FAQ, {
    ruling_id: "ruling.elder-dragon-flash-location-targeting-clarification-2026-04-29",
    kind: "ruling",
    title: "Moving Elder Dragon's location-restricted targets",
    card_name: "Elder Dragon",
    card_id: "unl-118-219",
    affected_card_ids: ["unl-118-219", "unl-118a-219", "ogs-011-024"],
    affected_rule_ids: ["359.3.e", "359.3.e.3"],
    explanation:
      "Elder Dragon has a separate targeting restriction for each location. A target moved by Flash to a different location no longer meets the restriction under which it was chosen and is unaffected when the play effect resolves.",
    topics: ["targets", "location", "move", "Elder Dragon"],
  }),
  verifiedRecord(FAQ, {
    ruling_id: "ruling.jhin-countered-spell-energy-clarification-2026-04-29",
    kind: "ruling",
    title: "Jhin after a spell is countered",
    card_name: "Jhin, Meticulous Killer",
    card_id: "unl-089-219",
    affected_card_ids: ["unl-089-219", "unl-089a-219", "ogn-105-298"],
    affected_rule_ids: ["350.1", "353", "359"],
    explanation:
      "If a spell was finalized and its energy was spent, countering it later does not undo that expenditure. Singularity can therefore satisfy Jhin's energy-spent condition even when Singularity does not resolve.",
    topics: ["counter", "energy spent", "finalization", "play"],
  }),
  verifiedRecord(FAQ, {
    ruling_id: "ruling.alpha-strike-repulse-target-relationships-clarification-2026-04-29",
    kind: "ruling",
    title: "Alpha Strike target relationships after movement",
    card_name: "Alpha Strike",
    card_id: "unl-192-219",
    affected_card_ids: ["unl-192-219", "unl-059-219", "unl-059a-219", "ogs-011-024", "unl-106-219", "unl-021-219", "unl-142-219", "unl-184-219"],
    affected_rule_ids: ["359.3.e.3"],
    explanation:
      "Moving an Alpha Strike target to another board location can make it illegal without ending the targeting relationship, so it still counts as chosen for Repulse. Moving it to a non-board zone creates a new-object break and severs that relationship.",
    topics: ["targets", "chosen", "move", "zones", "Repulse"],
  }),
  verifiedRecord(FAQ, {
    ruling_id: "ruling.reckoners-arena-yone-activate-conquer-clarification-2026-04-29",
    kind: "ruling",
    title: "Reckoner's Arena activating Yone's conquer effect",
    card_name: "Yone, Blademaster",
    card_id: "sfd-116-221",
    affected_card_ids: ["ogn-286-298", "sfd-116-221", "sfd-233-221", "sfd-233-star-221"],
    affected_rule_ids: ["377", "383.4.c"],
    explanation:
      "Reckoner's Arena checks the specified unit conquer effects as if a conquer occurred, but no actual conquer occurs. Yone's additional 'previously uncontrolled' condition is still checked and fails when the Arena was already controlled.",
    topics: ["activate", "conquer effects", "trigger condition"],
  }),
  verifiedRecord(FAQ, {
    ruling_id: "ruling.atakhan-reksai-accelerate-clarification-2026-04-29",
    kind: "ruling",
    title: "Atakhan, Rek'Sai, and Accelerate",
    card_name: "Atakhan",
    card_id: "unl-170-219",
    affected_card_ids: ["unl-170-219", "sfd-029-221", "sfd-029a-221"],
    affected_rule_ids: ["805.1", "805.1.a"],
    explanation:
      "Paying Atakhan's Accelerate cost creates a delayed replacement effect that makes it enter ready. Killing Rek'Sai for Atakhan's additional cost can remove the keyword before resolution, but does not remove the already-created delayed replacement effect.",
    topics: ["Accelerate", "additional cost", "delayed replacement effect"],
  }),
  verifiedRecord(FAQ, {
    ruling_id: "ruling.hot-fepr-clarification-2026-04-29",
    kind: "ruling",
    title: "HOT FEPR task and chain sequencing",
    affected_rule_ids: ["305", "335", "335.3"],
    explanation:
      "Handle Outstanding Tasks before continuing FEPR. Finalize makes choices, pays costs, and checks legality; Execute adds an item or passes; after all players pass, Resolve processes the top finalized item. Outstanding tasks pause FEPR, and recursive task procedures finish before moving to the next procedure.",
    topics: ["HOT FEPR", "outstanding tasks", "finalization", "priority", "resolution"],
  }),
];

const ERRATA_SECTIONS = [
  ["spiritforged", "Guards!", ["ruling.guards-errata-2026-04-03"]],
  ["spiritforged", "Relentless Pursuit", ["ruling.relentless-pursuit-errata-2026-04-03"]],
  ["unleashed", "Death from Below", ["ruling.death-from-below-errata-2026-04-03"]],
  ["unleashed", "Bone Skewer", ["ruling.bone-skewer-errata-2026-04-03"]],
  ["unleashed", "Leblanc, Deceiver", ["ruling.deceiver-errata-2026-04-03"]],
  ["unleashed", "Mirror Image", ["ruling.mirror-image-errata-2026-04-03"]],
  ["unleashed", "Keeper of Masks", ["ruling.keeper-of-masks-errata-2026-04-03"]],
  ["unleashed", "Rengar, Trophy Hunter", ["ruling.rengar-trophy-hunter-errata-2026-04-03"]],
].map(([group, heading, record_ids]) => ({ group, heading, record_ids }));

const FAQ_SECTIONS = [
  ["revised_and_clarified_rulings", "Triggered Abilities", ["ruling.triggered-ability-structure-clarification-2026-04-29"]],
  ["revised_and_clarified_rulings", "Control of Battlefields and Showdowns", ["ruling.battlefield-control-cleanup-rules-change-2026-04-29", "ruling.showdown-staging-rules-change-2026-04-29", "ruling.showdown-opening-rules-change-2026-04-29"]],
  ["revised_and_clarified_rulings", "Mandatory Actions and Private Information", ["ruling.private-information-compulsory-actions-rules-change-2026-04-29"]],
  ["revised_and_clarified_rulings", "Lethal Damage Modification", ["ruling.lethal-damage-modification-clarification-2026-04-29"]],
  ["revised_and_clarified_rulings", "Control of Battlefield Abilities", ["ruling.battlefield-ability-control-clarification-2026-04-29"]],
  ["revised_and_clarified_rulings", "Legion", ["ruling.play-meaning-legion-clarification-2026-04-29"]],
  ["revised_and_clarified_rulings", "Results of Combat", ["ruling.combat-no-result-recall-rules-change-2026-04-29"]],
  ["frequently_asked_questions", "Aspirant's Climb, Green Father, and Brush at eight points", ["ruling.aspirants-climb-green-father-victory-score-clarification-2026-04-29"]],
  ["frequently_asked_questions", "Replacing Brush with Brush and swapping back", ["ruling.brush-swap-back-replacement-clarification-2026-04-29"]],
  ["frequently_asked_questions", "Turn to Dust on attached Equipment", ["ruling.turn-to-dust-attached-equipment-temporary-clarification-2026-04-29"]],
  ["frequently_asked_questions", "Granted Temporary on attached Spinning Axe", ["ruling.spinning-axe-granted-temporary-clarification-2026-04-29"]],
  ["frequently_asked_questions", "Open state and empty battlefield control", ["ruling.battlefield-control-open-state-clarification-2026-04-29"]],
  ["frequently_asked_questions", "Cleanup during finalization", ["ruling.cleanup-during-finalization-clarification-2026-04-29"]],
  ["frequently_asked_questions", "Zilean, Time Mage and Deceiver", ["ruling.zilean-deceiver-reflection-copy-clarification-2026-04-29"]],
  ["frequently_asked_questions", "Counter Strike and Elder Dragon", ["ruling.elder-dragon-counter-strike-prevention-clarification-2026-04-29"]],
  ["frequently_asked_questions", "Flash and Elder Dragon location targets", ["ruling.elder-dragon-flash-location-targeting-clarification-2026-04-29"]],
  ["frequently_asked_questions", "Countered Singularity and Jhin", ["ruling.jhin-countered-spell-energy-clarification-2026-04-29"]],
  ["frequently_asked_questions", "Alpha Strike, Flash, and Repulse", ["ruling.alpha-strike-repulse-target-relationships-clarification-2026-04-29"]],
  ["frequently_asked_questions", "Reckoner's Arena and Yone", ["ruling.reckoners-arena-yone-activate-conquer-clarification-2026-04-29"]],
  ["frequently_asked_questions", "Atakhan, Rek'Sai, and Accelerate", ["ruling.atakhan-reksai-accelerate-clarification-2026-04-29"]],
  ["frequently_asked_questions", "How HOT FEPR works", ["ruling.hot-fepr-clarification-2026-04-29"]],
].map(([group, heading, record_ids]) => ({ group, heading, record_ids }));

const renderJson = (value) => `${JSON.stringify(value, null, 2)}\n`;

const artifact = (source, group_counts, sections, record_count) => ({
  schema_version: 1,
  ...source,
  inventory: {
    group_counts,
    section_count: sections.length,
    record_count,
    sections,
  },
});

const records = [...ERRATA_RECORDS, ...FAQ_RECORDS];
const ids = records.map((record) => record.ruling_id);
if (new Set(ids).size !== ids.length) throw new Error("duplicate generated ruling id");
if (ERRATA_RECORDS.length !== 8) throw new Error("official errata inventory must contain 8 records");
if (FAQ_RECORDS.length !== 23) throw new Error("official FAQ inventory must contain 23 records");

const expectedOutputs = new Map();
const queueJson = (filePath, value) => expectedOutputs.set(filePath, renderJson(value));
const managedRulingUris = new Set(
  ids.map((rulingId) => `riftbound-kb://canon/rulings/records/${rulingId}.json`),
);

for (const record of records) {
  queueJson(path.join(RECORDS_DIR, `${record.ruling_id}.json`), record);
}

queueJson(
  path.join(SOURCES_DIR, "riftbound-unleashed-errata-2026-04-03.json"),
  artifact(ERRATA, { spiritforged: 2, unleashed: 6 }, ERRATA_SECTIONS, 8),
);
queueJson(
  path.join(SOURCES_DIR, "riftbound-unleashed-rules-faq-2026-04-29.json"),
  artifact(
    FAQ,
    { revised_and_clarified_rulings: 7, frequently_asked_questions: 14 },
    FAQ_SECTIONS,
    23,
  ),
);

const generatedCards = new Map();
for (const record of records) {
  const field = record.kind === "errata" ? "errata_links" : "rulings_links";
  const uri = `riftbound-kb://canon/rulings/records/${record.ruling_id}.json`;
  for (const cardId of record.affected_card_ids) {
    const cardPath = path.join(CARDS_DIR, `${cardId}.json`);
    if (!fs.existsSync(cardPath)) throw new Error(`${record.ruling_id}: missing card ${cardId}`);
    let card = generatedCards.get(cardPath);
    if (!card) {
      card = JSON.parse(fs.readFileSync(cardPath, "utf8"));
      for (const managedField of ["errata_links", "rulings_links"]) {
        card[managedField] = (card[managedField] ?? []).filter(
          (link) => !managedRulingUris.has(link),
        );
      }
    }
    card[field] = Array.from(new Set([...(card[field] ?? []), uri])).sort();
    generatedCards.set(cardPath, card);
  }
}
for (const [cardPath, card] of generatedCards) queueJson(cardPath, card);

const currentIndex = JSON.parse(fs.readFileSync(INDEX_PATH, "utf8"));
const itemsById = new Map(currentIndex.items.map((item) => [item.ruling_id, item]));
for (const record of records) {
  itemsById.set(record.ruling_id, {
    ruling_id: record.ruling_id,
    kind: record.kind,
    title: record.title,
    card_name: record.card_name,
    card_id: record.card_id,
    effective_date: record.effective_date,
    source_url: record.source.source_url,
    path: `canon/rulings/records/${record.ruling_id}.json`,
    verification_status: record.verification.status,
  });
}
const items = [...itemsById.values()].sort((a, b) =>
  a.ruling_id.localeCompare(b.ruling_id),
);
queueJson(INDEX_PATH, {
  ...currentIndex,
  generated_at: GENERATED_AT,
  count: items.length,
  items,
});

if (OPTIONS.check) {
  const drifted = [];
  for (const [filePath, expected] of expectedOutputs) {
    const actual = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : null;
    if (actual !== expected) drifted.push(path.relative(KB_ROOT, filePath));
  }
  if (drifted.length) {
    throw new Error(`Official supplement output drift detected: ${drifted.join(", ")}`);
  }
  console.log(
    `Verified ${ERRATA_RECORDS.length} errata and ${FAQ_RECORDS.length} official clarification records.`,
  );
} else {
  for (const [filePath, contents] of expectedOutputs) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, contents, "utf8");
  }
  console.log(
    `Imported ${ERRATA_RECORDS.length} errata and ${FAQ_RECORDS.length} official clarification records.`,
  );
}
