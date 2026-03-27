---
id: analysis.reference.frontend-guidelines
type: analysis_note
title: FRONTEND_GUIDELINES.md - Hextech Analytics
source_kind: local_derived_doc
source_path: /Users/eric/hextech-analytics/docs/FRONTEND_GUIDELINES.md
source_date: unknown
trust_level: derived_unverified
status: reviewed
tags:
  - hextech-doc
  - derived
  - frontend-guidelines
---

## Import Notes
- Imported at: `2026-03-27T18:57:16.414430Z`
- This document is non-canonical and remains outside `canon/`.

## Original Content
# FRONTEND_GUIDELINES.md - Hextech Analytics

## Architecture
- **Component First**: Small, reusable, and logic-less where possible.
- **Server Component Default**: Only use `'use client'` when interactivity is required.
- **Form Handling**: Use Server Actions for all mutations.

## Engineering
- **Type Safety**: No `any`. Use interfaces for all component props.
- **Styling**: Class variance authority (CVA) for complex component states.
- **File Structure**: `components/ui` for primitives, `components/features` for domain-specific logic.

## State Management
- Favor URL state over local state for filterable views (allows deep linking).
- Use `useOptimistic` for immediate UI feedback.
