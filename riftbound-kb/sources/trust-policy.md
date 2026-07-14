# Riftbound KB Trust Policy

Trust tiers
1. official
2. trusted_secondary
3. market
4. best_available
5. unverified

Interpretation
- official: official rules, errata, tournament policy, official news/event coverage
- trusted_secondary: high-signal non-official sources used to fill official gaps, including decklists/results and reviewed rules explanations
- market: trusted market/trend sources
- best_available: useful but not strongly trusted evidence
- unverified: not safe for canonical claims yet

Default rules
- official beats everything else
- if official is missing, use the best available source but label it
- unsupported claims should not be promoted into canonical files
- every canonical record should carry provenance metadata
- trusted-secondary rules explanations never override official rules, card text, errata, legality, or tournament policy
- community rules records must match the current canonical Core Rules version and resolve every cited rule, card, erratum, and official clarification before retrieval; unresolved records stay quarantined
- citation and card resolution are necessary but not sufficient: every retrievable community interpretation must also have an explicit full-corpus factual-review pass against the current official evidence cutoff
- an official supplement reference must resolve to an exact-source-verified canonical ruling whose source artifact and normalized source hash match the source lock; otherwise retrieval fails closed
- community rules sources are not evidence for deckbuilding, matchups, meta, or strategy

Trusted market sources for now
- TCGPlayer US
- Cardmarket EU
- magicalmeta.ink
