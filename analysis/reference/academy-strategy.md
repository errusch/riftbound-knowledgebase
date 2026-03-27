---
id: analysis.reference.academy-strategy
type: analysis_note
title: ACADEMY_STRATEGY.md
source_kind: local_derived_doc
source_path: /Users/eric/hextech-analytics/docs/ACADEMY_STRATEGY.md
source_date: unknown
trust_level: derived_unverified
status: reviewed
tags:
  - hextech-doc
  - derived
  - academy-strategy
---

## Import Notes
- Imported at: `2026-03-27T18:57:16.406102Z`
- This document is non-canonical and remains outside `canon/`.

## Original Content
# ACADEMY_STRATEGY.md

## Objective
Restructure `/academy` to segregate user journeys by experience level: **New Players**, **Transfers**, and **Veterans**.

## User Personas & Journeys

### 1. The Initiate (New Player)
*   **Profile:** Never played a TCG, or played very casually. Overwhelmed by jargon ("Stack", "Priority", "Tempo").
*   **Goal:** Understand the basic loop (Draw -> Play -> Attack) and not look stupid.
*   **Top 3 Use Cases:**
    1.  **"How do I play?"** -> Needs `The Zero-to-Hero Primer` (Basics).
    2.  **"What do I buy?"** -> Needs `Starter Deck Guide` (To be created/linked).
    3.  **"What is this card?"** -> Needs direct access to `Card Library` (Visual learning).

### 2. The Outlander (Transfer Portal)
*   **Profile:** Magic/YGO/Pokemon veteran. Knows how to play, just needs to know *what is different*. Hates tutorials that explain what "Mana" is.
*   **Goal:** Map existing knowledge to Riftbound mechanics to gain an immediate edge.
*   **Top 3 Use Cases:**
    1.  **"I play [X], what do I play here?"** -> Needs `Transfer Portal` (Archetype matching).
    2.  **"How does the Stack work?"** -> Needs `Mechanics Deep Dive` (Advanced Rules).
    3.  **"What is the meta?"** -> Needs `Tier List` access immediately after understanding the rules.

### 3. The Veteran (Riftbound Pro)
*   **Profile:** Has played the alpha/beta. Knows the rules. Wants to win the next tournament or speculate on the market.
*   **Goal:** Deep specific knowledge. Frame data, matchups, financial specs.
*   **Top 3 Use Cases:**
    1.  **"What's the tech for the new set?"** -> Needs `Spiritforged Protocol` (Set reviews).
    2.  **"How do I pilot this specific deck?"** -> Needs `Champion Deep Dives` (e.g., "Sivir Midrange Guide").
    3.  **"What should I buy/sell?"** -> Needs `Market` signals.

## Implementation Plan

### Visual Structure (Vertical Segmentation)

1.  **Level 1: BASIC TRAINING (The Initiate)**
    *   *Visual:* Clean, inviting, blue/white tones.
    *   *Content:* "Start Here". "Zero to Hero". Link to Card Database.

2.  **Level 2: TRANSFER PROTOCOL (The Outlander)**
    *   *Visual:* Purple/Void tones (Portal theme).
    *   *Content:* The existing Transfer Portal grid. "Skip the tutorial, get the visa."

3.  **Level 3: ADVANCED WARFARE (The Veteran)**
    *   *Visual:* Gold/Hextech tones (Prestige/Ranked theme).
    *   *Content:* "Spiritforged Launch". "Champion Mastery". Links to "Meta" and "Market".

### Action Items
- Refactor `app/learn/page.tsx` to use this 3-tier layout.
- Ensure distinct visual headers for each section.
- Add cross-links to `Tier List` and `Market` in the Veteran section to close the loop.
