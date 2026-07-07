# Implementation Plan: Build Compiler Deterministic Core

**Branch**: `001-build-compiler-core` | **Date**: 2026-07-07 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-build-compiler-core/spec.md`

## Summary

Build Compiler = deterministic trust layer (ADR-0001 §3, Constitution Principle II) — pure-function library kiểm tra 5 compatibility rule (socket, RAM generation, missing component, cooler clearance, form-factor) + 1 PSU warning, sinh `errors[]` kèm mã ổn định (`E001`–`E006`, `W001`) và `repair_plan[]` chứa fix constraint-based cho mỗi lỗi. Package riêng TypeScript, zero runtime dependency ngoài Node, zero OpenClaw runtime dependency — verify độc lập qua `npm test` (~15 unit test, 5 rule × ~3 case). Đây là IP cốt lõi fit vào HOUR 3-6 của 1-day plan (ADR-0003 §3).

**Clarifications propagated (session 2026-07-07 — xem spec.md §Clarifications)**: (1) storage thêm vào 7 loại bắt buộc cho `E003` (boot-completeness — không storage thì không cài OS); (2) monitor↔GPU performance rule KHÔNG thêm (LLM suggestion layer, out of trust scope); (3) TDP tổng = sum mọi component có `tdp`>0 **ngoại trừ PSU** (PSU cấp điện, không tải DC hệ thống); (4) PSU efficiency rating (80 Plus White/Gold/Platinum) KHÔNG branch trong W001 (rating = AC→DC transfer semantics, không đổi DC capacity); (5) PSU loại trừ TDP sum (systemic consequence của #3).

## Technical Context

**Language/Version**: TypeScript 5.x trên Node.js 22.17 LTS (LTS đã cài, Constitution Quality Gate = `npm test`)
**Primary Dependencies**: zero runtime dependency (pure functions); dev-only: `typescript`, `tsx` (chạy TS test), `@types/node`
**Storage (persistence)**: N/A — pure functions, không persist, không I/O. _(Lưu ý: "storage" trong spec = linh kiện PC storage — SSD/HDD, không phải storage hệ thống.)_
**Testing**: `node:test` (Node built-in test runner) + `node:assert/strict` — zero external test dependency, chạy standalone
**Target Platform**: Node 22+ (server-side tool plugin, nhưng library verify độc lập không cần OpenClaw)
**Project Type**: library (package riêng — ADR-0001 §4.4 "Tách Compiler thành package riêng, test độc lập")
**Performance Goals**: validation <50ms / build (computation trivial, in-process, không network/I/O)
**Constraints**: zero OpenClaw runtime dependency (FR-011); zero external runtime dependency; deterministic — cùng input → cùng output (FR-009); pure functions — không side-effect, không I/O; mỗi rule có unit test (Constitution Principle II)
**Scale/Scope**: 5 rule + 1 warning rule, 7 error/warning code (`E001`-`E006`, `W001`), 7 loại linh kiện bắt buộc cho `E003` (CPU/mainboard/RAM/PSU/cooler/case/storage), ~15 test, 1 package (`packages/compiler/`). TDP tổng scope: mọi component có `tdp`>0 **ngoại trừ PSU**.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| # | Nguyên tắc (Constitution) | Trạng thái | Ghi chú |
|---|---|---|---|
| I | OpenClaw owns session/memory | PASS | Compiler không touch session/memory. Không xây SessionStore. |
| II | Build Compiler = deterministic trust layer, pure functions, unit-testable, LLM không đoán compatibility, mỗi rule có unit test | PASS by design | Feature này = embodiment của Principle II. 5 rule deterministic, ~15 test, repair plan constraint-based (không LLM). Clarifications (monitor↔GPU, PSU rating) reinforce: các check non-deterministic đẩy về LLM layer, không vào trust layer. |
| III | Model = provider config, không thêm LangChain/LangGraph | PASS | Compiler pure functions, không gọi model. |
| IV | WebChat = channel primary | N/A | Compiler = tool plugin, channel-agnostic. |
| V | Docs tiếng Việt + English thuật ngữ, ADR format, không emoji | PASS | Plan docs theo convention. |

| Constraint | Trạng thái | Ghi chú |
|---|---|---|
| Hackathon time-box (HOUR 3-6 = Compiler) | PASS | Đúng slot ADR-0003 §3. |
| MVP = S1+S3, S3 KHÔNG cắt | PASS | detect_errors + repair_build = S3 core. |
| Quality Gate: `npm test` xanh trước demo | PASS by design | Plan output ~15 unit test standalone. |
| boundary-architect: Compiler = Tool plugin layer, pure, package riêng | PASS | `packages/compiler/` tách, không trộn OpenClaw runtime. |
| ADR-0003 §2.3 scope (OUT: P2/P3/P4, payment thật) | PASS | Out-of-scope list (FR-013) bao gồm RGB/aesthetic/price/monitor-performance/PSU-rating — không overshoot. |

**Gate result (pre-Phase 0)**: PASS — không violation. Không cần Complexity Tracking.

### Post-Phase 1 re-check (sau khi design xong + clarifications propagated)

| # | Nguyên tắc | Re-check | Evidence |
|---|---|---|---|
| I | OpenClaw owns session/memory | PASS | `data-model.md` §8 explicit: no state, no persistence; repair workflow state = caller (OpenClaw session) responsibility, không phải Compiler core. |
| II | Deterministic trust layer, pure, unit-testable, no LLM | PASS | `contracts/compiler-api.md` §1-§3: 3 pure function, no side-effect/no I/O. `data-model.md` §7 invariant: deterministic order, no short-circuit, TDP sum excludes PSU. `research.md` §1 TS strict + §2 `node:test`. `quickstart.md` ~15 test = gate. Repair plan constraint-based, không LLM (`contracts` §5 non-goals). **Clarifications reinforce**: monitor↔GPU (§10) + PSU rating (§12) pushed to LLM layer; TDP-PSU exclusion (§11) deterministic + testable; storage-E003 (§9) deterministic boot-completeness check. |
| III | Model = provider config | PASS | `contracts/compiler-api.md` §5 non-goals: "KHÔNG gọi LLM (Principle II — deterministic only)". |
| IV | WebChat primary | N/A | Library channel-agnostic — `contracts` không mention channel. |
| V | Docs tiếng Việt + English thuật ngữ | PASS | Tất cả artifact (plan/research/data-model/contracts/quickstart) theo convention. |
| Hackathon | time-box HOUR 3-6 | PASS | `quickstart.md` explicit: wire-up = feature sau (HOUR 8-10); feature này = core only. |
| Quality Gate | `npm test` xanh | PASS | `quickstart.md` documents `npm test` = Constitution Quality Gate, ~15 test (8 suites incl. missing-7-type + psu-TDP-excl-PSU). |
| boundary | Compiler = Tool plugin layer, package riêng | PASS | `packages/compiler/` tách; `contracts` §5 non-goals: "KHÔNG handle OpenClaw session/tool registration (wire-up feature sau)". |
| ADR-0003 §2.3 scope | OUT: P2/P3/P4, payment thật, no scope creep | PASS | FR-013 + `contracts` §5 non-goals explicit: RGB/aesthetic/price/monitor-performance/PSU-rating all OUT. Storage-E003 = within scope (boot-completeness, not new rule). TDP-PSU exclusion = within scope (refine existing W001). |

**Gate result (post-Phase 1 + clarifications)**: PASS — design không drift, clarifications strengthen Principle II (more deterministic checks, non-deterministic pushed to LLM). Không violation cần Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/001-build-compiler-core/
├── plan.md              # This file
├── research.md          # Phase 0 output (§1-§12 — incl. clarification decisions)
├── data-model.md        # Phase 1 output (incl. Storage entity, TDP scope)
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── compiler-api.md  # public function contracts
├── checklists/
│   └── requirements.md  # from /speckit.specify
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
packages/
└── compiler/                    # ADR-0001 §4.4: package riêng, test độc lập
    ├── package.json             # name: @buildmate/compiler, "test": node --test
    ├── tsconfig.json            # strict, target ES2023, module NodeNext
    ├── src/
    │   ├── index.ts             # public API barrel: compileBuild, detectErrors, repairBuild
    │   ├── types.ts             # Build, Component (incl. Storage), CompilerError, RepairPlan, ErrorCode
    │   ├── codes.ts             # error code constants (E001..E006, W001) — stable codes
    │   ├── validate.ts          # orchestrate all rules → errors[] (TDP sum excludes PSU)
    │   ├── repair.ts            # errors[] → repair_plan[] (constraint-based fixes)
    │   └── rules/
    │       ├── socket.ts        # E001 SOCKET_MISMATCH
    │       ├── ram-gen.ts       # E002 RAM_GEN_MISMATCH
    │       ├── missing.ts       # E003 MISSING_COMPONENT (7 required types incl. storage)
    │       ├── cooler.ts        # E004 COOLER_CLEARANCE_MISMATCH
    │       ├── form-factor.ts   # E005 FORM_FACTOR_MISMATCH
    │       └── psu.ts           # W001 PSU_TIGHT (sum tdp of non-PSU components)
    └── tests/
        ├── socket.test.ts       # ≥3 case: pass / fail / boundary
        ├── ram-gen.test.ts      # ≥3 case
        ├── missing.test.ts      # ≥4 case: each-of-7-types-missing / all-present / empty-build
        ├── cooler.test.ts       # ≥3 case
        ├── form-factor.test.ts  # ≥3 case
        ├── psu.test.ts          # ≥3 case (pass/warn/boundary + PSU-tdp-excluded case)
        ├── repair.test.ts       # repair plan apply → re-validate → resolved
        └── validate.test.ts     # multi-error, empty-build, missing-attribute edge cases
```

**Structure Decision**: Single library package tại `packages/compiler/` (npm workspaces-ready). Lý do: ADR-0001 §4.4 yêu cầu "Tách Compiler thành package riêng, test độc lập (không phụ thuộc OpenClaw runtime)". Package tách = ranh giới vật lý enforcement Principle II — OpenClaw tool plugin (feature sau) import `@buildmate/compiler` làm dependency, không trộn code. Repo root `package.json` (tạo ở feature wire-up sau, không phải feature này) sẽ declare workspace; feature này chỉ tạo `packages/compiler/` self-contained.

## Complexity Tracking

> Không có Constitution violation → bảng trống, không ghi.

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --- | --- | --- |
| — | — | — |
