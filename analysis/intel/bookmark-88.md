---
id: analysis.intel.bookmark.88
type: analysis_note
title: Bookmark Intel 88
source_kind: legacy_local_knowledge_db_bookmark_intel
source_path: /Users/eric/.openclaw/quarantine-20260323/old_openclaw_bak_03062026/workspace/databases/knowledge.db
source_date: 2026-03-06T10:11:31.039432Z
trust_level: derived_unverified
status: reviewed
tags:
  - intel
  - openclaw_ai
  - x_bookmarks
---

## Summary
On Mac, use launchd LaunchAgent instead of cron for scheduled tasks: built-in, more reliable, runs even after sleep/wake cycles — cron silently misses jobs when Mac sleeps.

## Actionability
- Actionable: True
- Action Item: Migrate Blitz's cron jobs to launchd LaunchAgents for reliability on macOS.

## Source Metadata
- Author: cathrynlavery
- Category: openclaw_ai
- Tweet URL: https://x.com/cathrynlavery/status/2024247142571741656
- Date: 2026-02-18T22:18:22.000Z
- Source: x_bookmarks
