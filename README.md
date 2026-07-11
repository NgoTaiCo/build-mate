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

## Current Chrome Extension demo

Chrome Extension hiện chạy đúng tại `https://phongvu.vn/buildpc`: panel BuildMate theo dõi build theo kiểu read-only và có flow **Thêm VGA demo**. User phải xác nhận trong panel trước khi extension mở chooser VGA và chọn product đầu tiên; extension không đi tới checkout, payment, navigation hoặc multi-tab.

Để cài demo, chạy `npm test`, mở `chrome://extensions`, bật Developer mode và **Load unpacked** thư mục `apps/chrome-extension`. Sau khi cài, mở đúng URL canonical, refresh tab rồi bấm launcher BuildMate. OpenClaw bridge hiện chỉ có mock command adapter; Gateway node pairing là phase integration riêng.

## AABW technology partners

> Honesty note: only claim what the team actually integrates on build day. Below is the set that genuinely fits BuildMate — select these in the AABW dropdown.

**Selected partners:** Apify · Langfuse · Notion

> Hosting: OpenClaw gateway is **self-hosted locally** (team laptop / on-prem), not on a cloud provider. Durable sessions live on disk at `~/.openclaw/`.

- **Apify** — We use Apify to scrape the Phong Vu product catalog (CPUs, motherboards, RAM, GPUs, PSUs, cases, coolers) including specs, price, stock status, and promotions. Apify's anti-bot handling collects real product data that feeds the Catalog adapter, so the `search_components` tool returns real products instead of mock entries.
- **Langfuse** — We use Langfuse to observe the agent: trace every LLM call, tool call (`compile_build`, `detect_errors`, `repair_build`, `search_components`), token usage, latency, and errors. This gives visibility into the reasoning chain and cost — critical for tuning the deterministic-vs-LLM boundary.
- **Notion** — We use the Notion API to export sales leads: when BuildMate produces a validated build + quote summary, the `create_sales_lead` tool pushes a row to a Notion database the human sales team monitors for follow-up — after-hours lead capture.

### Hosting plan
| Layer | Option | Purpose |
|---|---|---|
| OpenClaw gateway | **Self-hosted local** (team laptop / on-prem) | run agent, durable sessions on disk (`~/.openclaw/`) |
| Demo (no deploy) | Cloudflare Tunnel (free) | expose local laptop at the event |
| Observability | Langfuse free tier | trace + cost |
| Catalog data | Apify free tier | scrape Phong Vu |
| Sales leads | Notion API (free) | lead database |
| DB (if needed) | ClickHouse free / Supabase free | agent logs / sessions |

> Other partners in the AABW list: (ZenRows, Bright Data) are alternatives to Apify for catalog scraping; (AWS, Azure, BytePlus, Tencent Cloud) are cloud-hosting options we did not use — BuildMate self-hosts OpenClaw locally; (Qwen, BytePlus) are alternative LLM providers — we use MiMo Pro via opencode and do not claim a partner LLM; (Agora) could power a future voice channel; (Trae) is an AI IDE, not a project runtime. We did not use the remaining ones (Antitech, Featherless, Terminal 3, Tinyfish, Virtuals) — unclear fit, not claimed.
