# ADR 0001: Semantic Segmentation (Not Purely Sentence-Based)

- **Date:** 2026-06-14
- **Decision:** Segments derive from sentence boundaries but may group consecutive conceptual sentences into one Hyperframe segment when they form one narrative unit.
- **Status:** Accepted

## Context

Strict 1:1 sentence-to-segment mapping is clean but breaks for conceptual content. A tutorial like *"Step 1. Step 2. Step 3."* is one idea, not three clips.

## Decision

1. Split on sentence-terminating punctuation
2. Assign Pexels/Hyperframe per sentence
3. Group consecutive Hyperframe sentences when they form a coherent conceptual unit

Pexels sentences stay 1:1.

## Consequences

- Conceptual runs render as one coherent composition
- Cleaner timeline for tutorials/abstract passages
- Splitter requires semantic understanding, not just regex
