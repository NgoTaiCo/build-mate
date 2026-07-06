Inspiration
Phong Vũ already has a Build PC flow, but building a PC is still intimidating for many customers. Most people know what they want to do — gaming, studying, coding, editing videos, or working — but they do not know which CPU, motherboard, RAM, GPU, PSU, or case should go together.

The hardest part is not choosing products. The hardest part is knowing whether a build is valid, what is wrong, how to fix it, and whether the budget is being spent wisely.

This becomes even more important after sales hours. If a customer wants to build a PC at 1 AM and no sales person is available, the purchase intent may be lost.

That inspired us to build BuildMate: an AI-powered PC Build Compiler that helps customers turn vague needs into validated PC builds, repairs invalid configurations, generates quote PDFs, and creates sales-ready leads for human follow-up.

What it does
BuildMate is an OpenAI-powered agentic PC build assistant for retail.

Customers can describe their needs through a chat channel, for example:

“I have 25M VND and want to build a PC for 2K gaming, but I do not understand hardware.”

BuildMate then:

Understands the customer’s intent, budget, experience level, and use case.
Asks missing questions when needed.
Searches a mock product catalog.
Creates a PC build draft.
Runs the build through a deterministic compatibility compiler.
Detects errors such as socket mismatch, RAM generation mismatch, missing components, or low PSU headroom.
Suggests repair plans instead of only saying the build is wrong.
Optimizes the build based on budget and use case.
Generates a quote PDF.
Creates a sales lead summary for the retail sales team.
BuildMate is not just a chatbot. It works like a compiler/debugger for PC builds.

How we built it
We designed BuildMate as an agentic backend system with an omnichannel chat interface.

The architecture has four main parts:

OpenClaw Gateway OpenClaw is used as the chat/session gateway. It receives customer messages from chat channels, keeps conversation context, and sends responses or quote PDFs back to the customer.

OpenAI Agent Orchestrator OpenAI is the reasoning layer. It classifies customer needs, asks follow-up questions, decides which tools to call, reads compiler errors, creates repair plans, explains trade-offs, and writes quote/sales summaries.

BuildMate Backend The backend manages Build Sessions, stores customer requirements, tracks selected components, executes agent tools, accesses the mock product catalog, generates PDFs, and creates sales leads.

Build Compiler The Build Compiler is the trust layer. It validates hardware compatibility using deterministic rules instead of letting the LLM guess. It checks CPU socket compatibility, RAM generation, PSU headroom, missing parts, budget fit, and basic use-case fit.

Core tools include:

classify_need
search_components
compile_build
detect_errors
repair_build
optimize_budget
generate_quote_pdf
create_sales_lead
The product catalog is mocked with realistic PC components such as CPUs, motherboards, RAM, GPUs, SSDs, PSUs, cases, and coolers.

Challenges we ran into
The biggest challenge was avoiding the trap of building “just another AI shopping chatbot.”

A normal chatbot can recommend products, but PC building requires correctness. If the AI hallucinates compatibility, the entire experience becomes risky. To solve this, we separated the system into two layers:

OpenAI plans, explains, and orchestrates.
The Build Compiler validates compatibility with deterministic rules.
Another challenge was scope. We initially considered building a Flutter app or a full web interface, but that would make the project look like a generic retail app. We decided to focus on the core agentic workflow: chat input, build compilation, repair planning, PDF generation, and sales lead capture.

We also had to design the experience so it works for different customer types: budget-sensitive students, gamers, creators, office users, and high-end buyers. The agent needs to upsell carefully without breaking trust.

Accomplishments that we're proud of
We are proud that BuildMate is not positioned as a chatbot, but as a domain-specific AI compiler for PC builds.

The system can take a vague customer request, turn it into structured requirements, generate a build, validate it, explain warnings, and create a sales-ready quote.

We are especially proud of the repair workflow. When a user provides an invalid build such as:

“Intel i5-12400F + B650 AM5 motherboard + DDR4 RAM + RTX 4060 + 500W PSU”

BuildMate does not simply say “this is wrong.” It returns compiler-like errors:

E001 SOCKET_MISMATCH
E002 RAM_GENERATION_MISMATCH
W001 PSU_LOW_HEADROOM
Then it proposes repair options:

Keep the Intel CPU and replace the motherboard.
Keep the AM5 motherboard and replace the CPU/RAM.
Upgrade the PSU for safer headroom.
This makes the experience feel like debugging code, but for PC builds.

What we learned
We learned that for AI agents in retail, trust is more important than conversation.

Customers do not only need recommendations. They need confidence that the configuration is valid, the budget is spent wisely, and the next action is clear.

We also learned that the LLM should not be responsible for everything. The best architecture is not “LLM answers all questions,” but “LLM orchestrates reliable tools.”

For BuildMate:

OpenAI is best at understanding intent, planning, explaining, and generating human-friendly outputs.
Deterministic tools are best at validating compatibility.
Backend state is necessary to manage long-running Build Sessions.
OpenClaw is useful as a channel gateway, especially for after-hours consultation and lead capture.
What's next for BuildMate
Next, we want to connect BuildMate to a real retail catalog and inventory system so that recommendations can reflect real prices, stock availability, promotions, and store locations.

We also want to expand the Build Compiler with more advanced compatibility checks:

Case and GPU length
Cooler and CPU thermal needs
Motherboard form factor
Upgrade path scoring
Bottleneck estimation
Monitor and peripheral matching
Future versions could include:

Sales dashboard for human follow-up
Zalo/Facebook/WebChat deployment
Quote approval workflow
Real-time product alternatives
Customer budget optimizer
Ethical upsell rules
Integration with warranty, delivery, and installment policies
Our goal is for BuildMate to become an AI-native decision layer for technology retail: helping customers buy with confidence, helping sales teams capture better leads, and helping retailers reduce friction in high-consideration purchases.