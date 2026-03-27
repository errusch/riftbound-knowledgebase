---
id: analysis.reference.optimization
type: analysis_note
title: OPTIMIZATION.md - Performance & Token Discipline
source_kind: local_derived_doc
source_path: /Users/eric/hextech-analytics/docs/OPTIMIZATION.md
source_date: unknown
trust_level: derived_unverified
status: reviewed
tags:
  - hextech-doc
  - derived
  - optimization
---

## Import Notes
- Imported at: `2026-03-27T18:57:16.420535Z`
- This document is non-canonical and remains outside `canon/`.

## Original Content
# OPTIMIZATION.md - Performance & Token Discipline

## 🎯 Goal
Reduce token overhead by 90%+ while maintaining "Inevitable" quality.

## 1. Session Initialization (Context Control)
- **Minimal Load**: On session start, load ONLY `SOUL.md`, `USER.md`, `IDENTITY.md`, and the current `memory/YYYY-MM-DD.md`.
- **On-Demand Memory**: Use `memory_search()` and `memory_get()` to pull specific snippets. Never load `MEMORY.md` or large history blocks by default.
- **Surgical Tooling**: Read only the lines necessary from project files using `limit` and `offset`.

## 2. Model Routing
- **Default (Flash)**: Use `google/gemini-3-flash-preview` (or Haiku equivalent) for routine tasks:
  - File reading/writing
  - Git operations
  - Status checks
  - Simple formatting
- **Premium (Pro/Sonnet)**: Use `google/gemini-3-pro-preview` (or Sonnet equivalent) ONLY for:
  - Architecture decisions
  - Complex UI/UX Audits
  - Deep debugging/security analysis
  - Strategic planning

## 3. Prompt Caching Strategy
- **Stable Context**: Keep `DESIGN_SYSTEM.md`, `TECH_STACK.md`, and `PRD.md` in separate files.
- **Batching**: Group related API calls and tool executions within 5-minute windows to maximize cache hits.
- **Maintenance**: Update system files (SOUL, etc.) only during maintenance passes, not during active task loops.

## 4. Rate Limits & Discipline
- **Pacing**: Minimum 5s between intense API calls; 10s between web searches.
- **Search Cap**: Max 5 searches per task batch, then a 2-minute "cooldown" for reasoning.
- **Batching Work**: One surgical commit for 5 changes is better than 5 small commits.
- **Budget**: Target < $0.10 per routine session.

## 5. Summary Discipline
- Keep replies brief and value-dense.
- Avoid repeating context the user already knows.
- Use `NO_REPLY` or `HEARTBEAT_OK` when silence is the most efficient response.
