---
name: boundary-architect
description: Enforce BuildMate's 4-layer boundary architecture (ADR-0001) when decomposing features, placing code in the right layer, or reviewing module boundaries. Use when deciding where new code belongs (Channel vs OpenClaw Gateway vs Tool plugin vs Model provider), when a feature touches module separation, when reviewing a PR/plan/spec for architectural drift, or when breaking a product into features. Rejects SessionStore rebuilds, LLM compatibility-guessing, and external orchestrator layers.
---

# Boundary Architect Skill (BuildMate)

## When to Use

- Decomposing a product or feature into modules / sub-features.
- Deciding which layer new code belongs to.
- Reviewing a PR, plan, or spec for architectural drift vs ADR-0001.
- Any "where does this code go?" or "should we build X ourselves?" question.

## Source of truth

Read `docs/adr/0001-architecture-foundation.md` before deciding. The 4 layers, top to bottom:

1. **Channel** — WebChat (primary, OpenClaw native, port 18789, mọi browser). Chrome Extension = stretch. Zalo = P3. Do NOT build custom channel plumbing.
2. **OpenClaw Gateway + Agent + Session + Memory** — owns durable sessions, QMD memory, routing, compaction, tool dispatch. Do NOT build Backend Gateway / SessionStore / idempotency layer / keep-alive. Session durable at `~/.openclaw/agents/<id>/sessions/`.
3. **Tool plugins (ta xây)** — server-side, in-process via `api.registerTool(...)`. MUST be pure functions where deterministic:
   - **Build Compiler** = deterministic, pure, unit-testable. LLM KHÔNG đoán compatibility. Error codes `E001 SOCKET_MISMATCH` / `E002 RAM_GEN_MISMATCH` / `W001`...
   - **Catalog** = `search_components` / `compare_components` (Mock → PhongVuApi).
   - **DOM exec** = `read_current_build` / `add_to_build` (OpenClaw browser automation primary; Extension remote-tool bridge stretch).
   - **Checkout** = `guide_checkout` (guide, KHÔNG payment).
4. **Model provider** — mimo pro, OpenAI-compatible. Config in `~/.openclaw/openclaw.json`. NOT a separate orchestrator layer.

## 5 nguyên tắc (KHÔNG vi phạm)

1. **OpenClaw owns session/memory** — không tự xây.
2. **Build Compiler = deterministic pure functions** — LLM không đoán compatibility; mỗi rule có unit test.
3. **Model = provider config**, không phải layer orchestrator riêng.
4. **WebChat = channel primary**; Extension = stretch.
5. **Docs = tiếng Việt + thuật ngữ kỹ thuật English.**

## Decision procedure

When given a proposed feature / module / PR:

1. Map every new component to exactly one of the 4 layers. If a component spans layers, split it.
2. For each component, check the 5 nguyên tắc. Flag violations with `BOUNDARY_VIOLATION: <nguyên tắc số> — <reason>`.
3. For Tool-plugin-layer code, ask: "Is this deterministic?" If yes → pure function + unit test, no LLM call. If genuinely conversational (e.g. `guide_checkout`) → may call LLM.
4. Reject any proposal that: rebuilds SessionStore / Backend Gateway, adds an external orchestrator (LangChain / LangGraph) outside OpenClaw, lets the LLM judge PC compatibility, or builds channel plumbing OpenClaw already provides.
5. Output a boundary map.

## Output format

```markdown
## Boundary Review: <feature>

| Component | Layer | Nguyên tắc | Pure fn? | Unit test? | Violation |
|---|---|---|---|---|---|
| compile_build | Tool plugin / Compiler | #2 | Yes | Yes | — |
| ... | ... | ... | ... | ... | ... |
```

Then a verdict line: `APPROVED` or `BOUNDARY_VIOLATION` (list fixes).

## Hackathon guardrail (ADR-0003)

Scope = 1 day build + 1 day demo. MVP = S1 (find + compile) + S3 (repair). S3 KHÔNG cắt. Stretch = S2 (compare) / S4 (checkout). OUT = Chrome Extension overlay, payment thật, cào 100% catalog, P2/P3/P4. Flag any out-of-scope feature unless explicitly marked stretch/long-term.
