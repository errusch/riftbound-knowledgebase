#!/usr/bin/env python3.12
"""Ultra-slow retry for the 5 missing official @riftbound stream transcripts.

Same cooldown approach as ultra_slow_rr_retry.py: no IP rotation, let YouTube
bot heuristics cool down naturally between attempts.
- 5 IDs (4x Atlanta + Utrecht Day 2 Top 8), all confirmed to HAVE en auto-captions
  via the android player client on 2026-07-02
- 3 rounds max, 20-30 min randomized sleep between attempts
- on success: writes metadata.json sidecar and repairs ingest-index.json entry
"""
import json, os, random, subprocess, time
from pathlib import Path
from datetime import datetime, timezone

VIDEOS = {
    "sOp6lmZRqgY": "Riftbound Regional Qualifier Utrecht - Day 2 (Top 8)",
    "czwtukHHRP0": "Riftbound Regional Qualifier Atlanta - Day 2 (Top 8)",
    "B8n8eB1NpNI": "Riftbound Regional Qualifier Atlanta - Day 2 (Rounds 9-13)",
    "Dz2D5owlMWw": "Riftbound Regional Qualifier Atlanta - Day 1 (Rounds 5-8)",
    "cvo8YTdadHg": "Riftbound Regional Qualifier Atlanta - Day 1 (Rounds 1-4)",
}
BASE = Path.home() / "Playground/riftbound-kb/media/youtube/riftbound-channel"
RAW = BASE / "transcripts/raw"
INDEX = BASE / "ingest-index.json"
yt_dlp = os.path.expanduser("~/Library/Python/3.9/bin/yt-dlp")

def vtt_for(vid):
    for p in RAW.glob(f"{vid}/{vid}*.vtt"):
        if p.stat().st_size > 1000:
            return p
    return None

def finalize(vid, title, vtt_path):
    now = datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
    meta = {
        "videoId": vid,
        "title": title,
        "url": f"https://www.youtube.com/watch?v={vid}",
        "channel": "Riftbound",
        "fetchedAt": now,
        "vttFiles": [vtt_path.name],
        "description": "",
    }
    (RAW / vid / "metadata.json").write_text(json.dumps(meta, indent=2) + "\n")

    idx = json.loads(INDEX.read_text())
    for e in idx["entries"]:
        if e["videoId"] == vid:
            e["status"] = "complete"
            e["blockedReason"] = None
            e["fetchedAt"] = now
            e["transcriptRelPath"] = (
                f"media/youtube/riftbound-channel/transcripts/raw/{vid}/{vtt_path.name}"
            )
    INDEX.write_text(json.dumps(idx, indent=2) + "\n")
    print(f"    finalized {vid}: metadata.json written, index repaired", flush=True)

print(f"Riftbound missing-streams retry started {datetime.now().isoformat()}", flush=True)

# fresh 429 as of launch — cool down before the first attempt
initial = random.randint(1500, 1800)
print(f"Initial cooldown {initial}s", flush=True)
time.sleep(initial)

for round_no in range(1, 4):
    print(f"=== ROUND {round_no}/3 ===", flush=True)
    for i, (vid, title) in enumerate(VIDEOS.items(), 1):
        existing = vtt_for(vid)
        if existing:
            print(f"[{round_no}.{i}] {vid}: already has VTT, skip", flush=True)
            continue
        print(f"[{round_no}.{i}] {vid}: trying at {datetime.now().isoformat()}", flush=True)
        cmd = [
            yt_dlp,
            "--cookies-from-browser", "brave",
            "--extractor-args", "youtube:player_client=android",
            "--skip-download",
            "--write-auto-subs",
            "--sub-langs", "en",
            "--sub-format", "vtt",
            "--retries", "3",
            "-o", str(RAW / vid / vid),
            f"https://www.youtube.com/watch?v={vid}",
        ]
        r = subprocess.run(cmd, capture_output=True, text=True)
        got = vtt_for(vid)
        if got:
            print(f"    SUCCESS: {got.name} ({got.stat().st_size:,} bytes)", flush=True)
            finalize(vid, title, got)
        else:
            tail = (r.stderr or r.stdout).strip().splitlines()
            print(f"    failed: {tail[-1] if tail else 'no output'}", flush=True)
        if all(vtt_for(v) for v in VIDEOS):
            break
        pause = random.randint(1200, 1800)
        print(f"    sleeping {pause}s", flush=True)
        time.sleep(pause)
    if all(vtt_for(v) for v in VIDEOS):
        break

done = [v for v in VIDEOS if vtt_for(v)]
missing = [v for v in VIDEOS if not vtt_for(v)]
print(f"FINISHED {datetime.now().isoformat()} — got {len(done)}/5", flush=True)
if missing:
    print(f"STILL MISSING: {missing}", flush=True)
