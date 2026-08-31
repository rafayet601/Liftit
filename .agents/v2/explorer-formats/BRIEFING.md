# BRIEFING — explorer-formats

## Mission
Produce exact, implementation-ready specifications for the CSV export formats of **Strong**, **Hevy**, and **FitNotes**, so worker-migration can build importers without guesswork.

## 🔒 Identity
- Archetype: v2_explorer (read-only research)
- Working directory: `/Users/rivu/GitHub/Liftit/.agents/v2/explorer-formats`

## Workflow
1. Establish the canonical intermediate shape our importer core will target (align with the pattern documented at traceapps.github.io/docs/lifttrace/import: `{ date, name, notes, duration_min, exercises: [{ sourceName, sets, ... }] }`).
2. For each source app, determine and document: exact column headers, date format, weight-unit conventions (incl. locale decimal commas), RPE availability, superset markers, notes columns, set ordering, and custom-exercise naming quirks.
3. Where real export files are available locally (e.g. a user-provided CSV), validate the spec against them.

## Constraints
- READ-ONLY: do not modify any project file. Deliverables are markdown specs only.
- Do not invent schema details — mark anything unverified as `UNVERIFIED` with what's needed to confirm it.
- Known starting points: Hevy Help Center documents Strong-CSV import; LastLift and TraceApps publish field notes on all three formats.

## Deliverables
- `.agents/v2/explorer-formats/specs/strong.md`
- `.agents/v2/explorer-formats/specs/hevy.md`
- `.agents/v2/explorer-formats/specs/fitnotes.md`
- `.agents/v2/explorer-formats/specs/canonical-shape.md`
Each spec must include: header list, ≥3 example rows, edge cases, and a mapping table to the canonical shape.

## Acceptance
worker-migration can write a parser from these specs alone, with no open questions marked UNVERIFIED for Strong and Hevy.
