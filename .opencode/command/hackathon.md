---
description: Decompose the BuildMate product into 1-day time-boxed features with explicit goals, aligned to ADR-0003's 16h plan and the speckit SDD workflow.
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Outline

Help the user break the product into incremental, goal-bounded features for a 1-day hackathon. This command exists because time is the hard constraint — every feature needs a fixed goal and a time-box.

1. Read `.specify/memory/constitution.md` (goals + 5 nguyên tắc + hackathon constraints) and `docs/adr/0003-hackathon-execution.md` (MVP = S1+S3, 16h plan, stretch = S2/S4, OUT = Extension/payment/P2-P4).
2. If `$ARGUMENTS` names a target (e.g. "S1", "compiler", "catalog", "repair"), scope the breakdown to it. Otherwise propose the full 1-day decomposition across S1 + S3 (MVP) and S2 + S4 (stretch).
3. Produce a feature list. Each feature MUST have:
   - **Name** (2-4 words, branch-ready: `NNN-short-name`).
   - **Goal** (1 sentence, measurable — the "goal nhất định").
   - **Layer** (from ADR-0001 §3: which tool plugin / Channel / etc.).
   - **Time-box** (hour range from the 16h plan).
   - **MVP/stretch/OUT** label.
   - **Boundary check** (run boundary-architect mentally; does it violate any nguyên tắc? if yes, fix before specifying).
   - **Next action** = which speckit command to run (`/speckit.specify <feature description>`).
4. Order features by dependency, MVP first. S3 (repair) is non-negotiable MVP — never drop it.
5. Apply the boundary-architect skill to each proposed feature to catch violations early (e.g. "LLM guesses compatibility" → reject; "build SessionStore" → reject).
6. Present the plan as a table. Ask the user which feature to specify first, then suggest running `/speckit.specify <feature description>` to enter the SDD workflow.

## Guardrails

- Never propose features outside ADR-0003 scope without labeling them OUT / long-term.
- Never let an LLM judge PC compatibility — that's the Compiler's job (nguyên tắc II).
- Prefer small, independently-testable features (Constitution §Quality Gates).
- Each feature must be shippable/rehearsable within its time-box; if not, split it smaller.
