---
id: analysis.reference.lessons
type: analysis_note
title: LESSONS.md - Hextech Analytics
source_kind: local_derived_doc
source_path: /Users/eric/hextech-analytics/docs/LESSONS.md
source_date: unknown
trust_level: derived_unverified
status: reviewed
tags:
  - hextech-doc
  - derived
  - lessons
---

## Import Notes
- Imported at: `2026-03-27T18:57:16.417263Z`
- This document is non-canonical and remains outside `canon/`.

## Original Content
# LESSONS.md - Hextech Analytics

## Architecture Lessons
- (Pending initial build and audit)

## Design Lessons
- **Symmetry of Intent**: A premium feel is often achieved by removing elements that compete for attention. Standardizing navigation labels ("The Meta" vs "Meta Snapshot") was critical.
- **Surface Depth**: Using `backdrop-blur` and lowered border opacities (`zaun/10`) creates a layered, "glassmorphic" feel that feels more tactile than solid colors.
- **Cinematic Pacing**: Slowing down transitions for hero elements (`duration-[3000ms]`) while keeping interaction feedback fast (`150ms`) creates a high-end, cinematic pacing.
