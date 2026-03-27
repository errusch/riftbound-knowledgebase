---
id: analysis.intel.bookmark.14
type: analysis_note
title: Bookmark Intel 14
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
Context bloat discovery: agent was loading 11,887 tokens of system prompt on every message; solution is to audit /context detail and trim or lazy-load heavy sections.

## Actionability
- Actionable: True
- Action Item: Run context audit on Blitz's system prompt; trim or lazy-load sections that don't need to be present every turn.

## Source Metadata
- Author: code_rams
- Category: openclaw_ai
- Tweet URL: https://x.com/code_rams/status/2025371800587436344
- Date: 2026-02-22T00:47:21.000Z
- Source: x_bookmarks
