from __future__ import annotations

import json
import subprocess
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.lib.kb_cli import build_prep_brief_payload, top_legend_pairs
from scripts.lib.kb_common import IGNORED_DUPLICATE_ROOT, load_json


KB = ROOT / "scripts" / "query" / "kb"
GOLDEN = json.loads((ROOT / "tests" / "fixtures" / "kb_golden.json").read_text(encoding="utf-8"))


def run_kb(*args: str) -> str:
    completed = subprocess.run(
        [str(KB), *args],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=True,
    )
    return completed.stdout


class KBRegressionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        subprocess.run([str(ROOT / "scripts" / "build" / "rebuild_indexes")], cwd=ROOT, check=True)

    def test_required_indexes_exist(self) -> None:
        required = [
            ROOT / "data" / "indexes" / "all_objects.json",
            ROOT / "data" / "indexes" / "graph_edges.json",
            ROOT / "data" / "indexes" / "conflicts_by_topic.json",
            ROOT / "data" / "indexes" / "cards_lookup.json",
            ROOT / "data" / "indexes" / "legend_lookup.json",
            ROOT / "data" / "indexes" / "quality_report.json",
            ROOT / "data" / "indexes" / "meta_snapshots.json",
            ROOT / "data" / "indexes" / "vod_links.json",
        ]
        missing = [path.name for path in required if not path.exists()]
        self.assertEqual([], missing)

    def test_rule_query_prefers_official_atoms(self) -> None:
        fixture = GOLDEN["rule"]
        output = run_kb("rule", fixture["query"])
        self.assertIn("Official Rules", output)
        self.assertIn("Derived Conflicts", output)
        self.assertLess(output.index("Official Rules"), output.index("Derived Conflicts"))
        for object_id in fixture["required_ids"]:
            self.assertIn(object_id, output)
        for object_id in fixture["conflict_ids"]:
            self.assertIn(object_id, output)

    def test_card_query_includes_rulings_and_guides(self) -> None:
        fixture = GOLDEN["card"]
        output = run_kb("card", fixture["query"])
        self.assertIn(fixture["card_id"], output)
        self.assertIn(fixture["expected_provenance"], output)
        self.assertIn(fixture["ruling_id"], output)
        for guide_id in fixture["guide_ids"]:
            self.assertIn(guide_id, output)

    def test_prep_query_contains_sections_questions_and_citations(self) -> None:
        fixture = GOLDEN["prep"]
        output = run_kb("prep", "--legend", fixture["legend"], "--opponent", fixture["opponent"], "--dry-run")
        for section in fixture["required_sections"]:
            self.assertIn(section, output)
            self.assertNotIn(f"{section}\n- none", output)
        for citation in fixture["required_citations"]:
            self.assertIn(citation, output)
        self.assertIn("Which battlefield orders matter most for Draven?", output)
        self.assertIn("What does Draven need to respect first against Kai'Sa?", output)

    def test_meta_query_includes_generated_and_legacy_signals(self) -> None:
        fixture = GOLDEN["meta"]
        output = run_kb("meta", "--legend", fixture["legend"])
        for phrase in fixture["required_phrases"]:
            self.assertIn(phrase, output)
        for fragment in fixture["required_list_fragments"]:
            self.assertIn(fragment, output)
        self.assertIn("Supporting Sources", output)

    def test_source_query_returns_provenance_payload(self) -> None:
        fixture = GOLDEN["source"]
        payload = json.loads(run_kb("source", fixture["object_id"]))
        self.assertEqual(fixture["expected_title"], payload["meta"]["title"])
        self.assertEqual(fixture["expected_provenance"], payload["provenance"])
        self.assertEqual(fixture["expected_source_kind"], payload["meta"]["source_kind"])

    def test_top_five_prep_pairs_have_non_empty_sections(self) -> None:
        pairs = top_legend_pairs(5)
        self.assertGreaterEqual(len(pairs), 5)
        for legend, opponent in pairs:
            payload = build_prep_brief_payload(legend, opponent, None)
            record = payload["record"]
            self.assertTrue(record["recent_lists"], f"missing recent lists for {legend} vs {opponent}")
            self.assertTrue(record["practice_questions"], f"missing practice questions for {legend} vs {opponent}")
            self.assertTrue(record["citations"], f"missing citations for {legend} vs {opponent}")

    def test_top_five_legends_have_stable_meta_outputs(self) -> None:
        snapshot = load_json(ROOT / "data" / "meta" / "2026-03-27.json", {})
        legends = [item["legend"] for item in snapshot.get("record", {}).get("legends", [])[:5]]
        self.assertGreaterEqual(len(legends), 5)
        for legend in legends:
            output = run_kb("meta", "--legend", legend)
            self.assertIn(f"Meta: {legend}", output)
            self.assertIn("Recent Lists", output)
            self.assertTrue(
                "Generated snapshot:" in output or "Legacy tier snapshot:" in output,
                f"missing meta signals for {legend}",
            )

    def test_quality_report_tracks_draft_and_conflict_state(self) -> None:
        report = load_json(ROOT / "data" / "indexes" / "quality_report.json", {})
        draft_ids = {item["id"] for item in report.get("draft_objects", [])}
        self.assertIn("canon.errata-set-1-origins", draft_ids)
        topics = {item["topic"] for item in report.get("conflicted_by_topic", [])}
        self.assertIn("tournament", topics)
        self.assertIn("active_review_queue", report)
        self.assertIn("quarantined_objects", report)

    def test_trust_policy_promotes_and_quarantines_expected_objects(self) -> None:
        objects = {item["id"]: item for item in load_json(ROOT / "data" / "indexes" / "all_objects.json", [])}
        self.assertEqual("derived_verified", objects["analysis.reference.core-rules"]["trust_level"])
        self.assertEqual("derived_verified", objects["analysis.reference.mechanics"]["trust_level"])
        player_tags = set(objects["player.draven"].get("tags", []))
        self.assertTrue({"quarantined", "non-authoritative", "low-confidence"}.issubset(player_tags))

    def test_definition_query_prefers_game_reference_over_product_docs(self) -> None:
        output = run_kb("ask", "What does [M] mean in Riftbound?")
        self.assertIn("analysis.reference.mechanics", output)
        self.assertNotIn("analysis.reference.app-flow", output)

    def test_indexes_do_not_reference_ignored_duplicate_repo(self) -> None:
        duplicate_root = str(IGNORED_DUPLICATE_ROOT)
        for name in ["all_objects", "decks", "events", "graph_edges"]:
            payload = load_json(ROOT / "data" / "indexes" / f"{name}.json", [])
            blob = json.dumps(payload)
            self.assertNotIn(duplicate_root, blob)


if __name__ == "__main__":
    unittest.main()
