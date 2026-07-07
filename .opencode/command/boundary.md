---
description: Review a feature/module/PR against BuildMate's 4-layer boundary architecture (ADR-0001) and 5 nguyên tắc. Use when deciding where code belongs or checking architectural drift.
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Outline

Invoke the **boundary-architect** skill (`.opencode/skills/boundary-architect/SKILL.md`) to perform a boundary review.

1. If `$ARGUMENTS` names a feature, spec, PR, or module, review THAT. If empty, review the current diff (`git diff`) or the last commit (`git show --stat HEAD`).
2. Read `docs/adr/0001-architecture-foundation.md` first (source of truth for the 4 layers + 5 nguyên tắc).
3. Map every component to exactly one of the 4 layers: Channel / OpenClaw Gateway+Agent+Session+Memory / Tool plugins / Model provider. If a component spans layers, split it.
4. Check the 5 nguyên tắc. Flag violations as `BOUNDARY_VIOLATION: <số nguyên tắc> — <lý do>`.
5. For Tool-plugin-layer code, confirm: deterministic? → pure function + unit test, no LLM compatibility-guessing. Conversational only (`guide_checkout`) → may call LLM.
6. Apply hackathon guardrail (ADR-0003): flag S2/S4/P2-P4 features as OUT-OF-SCOPE unless explicitly marked stretch.
7. Output the boundary map table + verdict (`APPROVED` / `BOUNDARY_VIOLATION` + list fixes).
