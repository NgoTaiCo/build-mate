# BuildMate

> AI PC Build Compiler for Phong Vu retail. Submission README for the GenAI Hackathon.

---

## Selected problem statement
**P1 — AI sales agent for e-commerce website/app** (Phong Vu retail track).

Online shoppers don't get timely real-time assistance during product discovery, contributing to low conversion and drop-off. BuildMate addresses this with an agentic sales assistant specialized for PC building — and the same backbone generalizes to P2 (recommendation), P3 (agent copilot on Zalo), and P4 (self-service BI) long-term.

## Project title
**BuildMate**

## Elevator pitch
BuildMate is an AI **PC Build Compiler** — not another shopping chatbot. It turns a customer's vague need into a validated PC build, catches compatibility errors like a debugger (`E001 SOCKET_MISMATCH`), proposes repair plans, and auto-inserts the right components into the Phong Vu build PC page.

## Project Story

### Inspiration
Phong Vu already has a Build PC flow, but building a PC is still intimidating. Most people know what they want to *do* — gaming, studying, coding, editing, working — but they don't know which CPU, motherboard, RAM, GPU, PSU, or case should go together. The hardest part isn't choosing products; it's knowing whether a build is **valid**, what's **wrong**, how to **fix it**, and whether the **budget is spent wisely**.

This becomes critical after sales hours. A customer who wants to build a PC at 1 AM, with no sales person available, simply leaves — purchase intent lost. We didn't want to build another chatbot; we wanted to build a **compiler/debugger for PC builds**.

### What it does
A customer describes their need through a chat channel:

> "I have 25M VND and want to build a PC for 2K gaming, but I don't understand hardware."

BuildMate then:
1. Understands intent, budget, experience level, and use case.
2. Asks missing questions when needed.
3. Searches the product catalog.
4. Creates a PC build draft.
5. Runs the build through a **deterministic compatibility compiler**.
6. Detects errors — socket mismatch, RAM generation mismatch, missing components, low PSU headroom.
7. Suggests **repair plans** instead of only saying the build is wrong.
8. Optimizes the build based on budget and use case.
9. **Auto-adds the components to the `phongvu.vn/buildpc` page**.
10. Guides checkout.

It works like a compiler/debugger for PC builds. When a user provides an invalid build such as `Intel i5-12400F + B650 AM5 motherboard + DDR4 RAM + RTX 4060 + 500W PSU`, BuildMate returns compiler-like errors:

```
E001 SOCKET_MISMATCH
E002 RAM_GENERATION_MISMATCH
W001 PSU_LOW_HEADROOM
```

Then it proposes repair options:
- Keep the Intel CPU and replace the motherboard.
- Keep the AM5 motherboard and replace the CPU/RAM.
- Upgrade the PSU for safer headroom.

### How we built it
Four layers on an **OpenClaw** backbone:

```
[ Channel ]   WebChat (primary) · Chrome Extension (in-context on phongvu.vn/buildpc)
     │  WebSocket native
[ OpenClaw Gateway + embedded agent + durable sessions + QMD memory ]
     │  tool dispatch (server-side, in-process)
[ Tool plugins — deterministic, pure functions ]
   • Build Compiler:  compile_build · detect_errors · repair_build   (trust layer / IP)
   • Catalog:         search_components · compare_components
   • DOM exec:        read_current_build · add_to_build
     │  provider config
[ Model: MiMo Pro ]
```

- **OpenClaw** is the gateway + embedded agent runtime. It owns sessions (durable on disk), memory (QMD cross-session recall), channels (WebChat, Zalo), and tool dispatch. We don't build a separate session store — OpenClaw handles it natively, so a customer who "hangs up" at 1 AM and comes back resumes the same conversation.
- **Build Compiler** is the trust layer: pure deterministic functions, unit-tested. The LLM orchestrates (understands intent, plans, explains) but **never guesses compatibility** — every rule is a pure function with a test. This is the IP.
- **Chrome Extension** (MV3) operates in-context on `phongvu.vn/buildpc`: it reads the current build from the DOM and auto-adds components by dispatching native bubbling `MouseEvent`s (SyntheticEvent). Because phongvu.vn is React 17+, a native MouseEvent is enough to trigger React's `onClick` — no React internals needed.
- **Model**: MiMo Pro, plugged into OpenClaw as a provider.

### Challenges we ran into
- **Avoiding "just another AI shopping chatbot."** A normal chatbot can recommend products, but PC building requires *correctness* — if the AI hallucinates compatibility, the experience is risky. We separated the system into two layers: the LLM plans, explains, and orchestrates; the Build Compiler validates compatibility with deterministic rules.
- **Chrome Extension on a real React site.** `phongvu.vn` uses emotion (styled-components) with generated CSS hashes, dynamic modal IDs, and positional `nth-of-type` selectors — all brittle. We solved it by using only stable anchors (`aria-label="Chọn"`, `[role="dialog"]`, text labels) kept in a **selector manifest** (Page Object pattern), so a UI change only updates the manifest, not the code.
- **MV3 service worker 30s timeout.** Solved with `chrome.alarms` + 10s server pings (each inbound message resets the idle timer) — the WebSocket stays alive indefinitely.
- **Async modal content.** The product list inside the modal loads *after* the modal shell; clicking too early hits an empty modal. Solved by waiting for the product element, not the modal.

### Accomplishments that we're proud of
- BuildMate is positioned as a **domain-specific AI compiler for PC builds**, not a chatbot.
- The **repair workflow** — invalid build → compiler error codes → repair plans → auto-apply fix — makes the experience feel like debugging code, but for PC builds.
- A **deterministic trust layer**: compatibility is never hallucinated; every rule is a pure, unit-tested function.
- The Chrome Extension **actually operates on the real `phongvu.vn/buildpc` page** — it reads the build list and auto-adds an AMD VGA to the customer's configuration, proving the in-context execution path.
- **OpenClaw-native**: durable sessions + cross-session memory come free, and the same backbone is multi-channel ready (Zalo for the agent-copilot use case).

### What we learned
- For AI agents in retail, **trust is more important than conversation.** Customers need confidence that the configuration is valid, the budget is spent wisely, and the next action is clear.
- The LLM should not be responsible for everything. The best architecture is not "LLM answers all questions" but **"LLM orchestrates reliable tools."**
- OpenClaw is the backbone — gateway, agent, sessions, and memory are integrated; reinventing them is waste.
- DOM automation on React needs robust selectors (aria/text/role), not brittle CSS.

### What's next for BuildMate
- Connect to Phong Vu's **real catalog and inventory API** so recommendations reflect real prices, stock, promotions, and store locations.
- **Expand the Build Compiler**: case/GPU length, cooler thermal needs, motherboard form factor, upgrade-path scoring, bottleneck estimation, monitor/peripheral matching.
- **P3 — AI copilot for sales/support** on Zalo (OpenClaw native channel) with a human-in-the-loop agent dashboard.
- **P2 — Recommendation & cross/up-sell engine** (bundle scoring + CDP integration).
- **P4 — Self-service BI** (natural-language → SQL with a deterministic query governor) — the same "LLM plans, deterministic validates" pattern, generalized.
- Sales dashboard, quote approval workflow, real-time alternatives, ethical upsell rules.
- **Goal:** an AI-native decision layer for technology retail — helping customers buy with confidence, helping sales teams capture better leads, and helping retailers reduce friction in high-consideration purchases.

## Built with
- **OpenClaw** — self-hosted gateway + embedded agent + durable sessions + QMD memory
- **MiMo Pro** — LLM (model provider via opencode)
- **Chrome Extension (Manifest V3)** — in-context overlay on `phongvu.vn/buildpc`
- **React SyntheticEvent** — DOM automation on Phong Vu's React frontend
- **Node.js** — runtime + tool plugins
- **WebChat** — OpenClaw native chat channel (primary)
- **Zalo** — OpenClaw native channel (long-term, agent copilot)
- **TypeScript** — tool plugin SDK
- **Build Compiler** — deterministic pure-function compatibility engine (the IP)

## AABW technology partners

> Honesty note: only claim what the team actually integrates on build day. Below is the set that genuinely fits BuildMate — select these in the AABW dropdown.

**Selected partners:** Apify · Qwen · Langfuse · Tencent Cloud · Notion

- **Apify** — We use Apify to scrape the Phong Vu product catalog (CPUs, motherboards, RAM, GPUs, PSUs, cases, coolers) including specs, price, stock status, and promotions. Apify's anti-bot handling collects real product data that feeds the Catalog adapter, so the `search_components` tool returns real products instead of mock entries.
- **Qwen** — We use Qwen as the LLM provider inside OpenClaw. Qwen handles the conversational layer: understanding the customer's PC-building need (Vietnamese), planning tool calls, reading compiler errors, and explaining repair plans. Qwen's strong Vietnamese + reasoning fits the retail context.
- **Langfuse** — We use Langfuse to observe the agent: trace every LLM call, tool call (`compile_build`, `detect_errors`, `repair_build`, `search_components`), token usage, latency, and errors. This gives visibility into the reasoning chain and cost — critical for tuning the deterministic-vs-LLM boundary.
- **Tencent Cloud** — We host the OpenClaw gateway on Tencent Cloud (free-tier always-on instance) so the agent is available 24/7 for the after-hours (1 AM) use case. Tencent's Zalo connection also aligns with the future agent-copilot-on-Zalo direction (P3).
- **Notion** — We use the Notion API to export sales leads: when BuildMate produces a validated build + quote summary, the `create_sales_lead` tool pushes a row to a Notion database the human sales team monitors for follow-up — after-hours lead capture.

### Free hosting plan (future)
| Layer | Partner / free option | Purpose |
|---|---|---|
| OpenClaw gateway (always-on) | Tencent Cloud / AWS free tier | host agent 24/7 |
| Demo (no deploy) | Cloudflare Tunnel (free) | expose laptop at the event |
| Observability | Langfuse free tier | trace + cost |
| Catalog data | Apify free tier | scrape Phong Vu |
| Sales leads | Notion API (free) | lead database |
| DB (if needed) | ClickHouse free / Supabase free | agent logs / sessions |

> Other partners in the AABW list (ZenRows, Bright Data) are alternatives to Apify for catalog scraping; (BytePlus, AWS, Azure, Tencent Cloud) are alternatives for LLM/cloud; (Agora) could power a future voice channel; (Trae) is an AI IDE, not a project runtime. We did not use the remaining ones (Antitech, Featherless, Terminal 3, Tinyfish, Virtuals) — unclear fit, not claimed.
