# Project Rules

## Git Commits

After any Write/Edit operation that produces a meaningful artifact, commit immediately using conventional commits format:

```
git add <file> && git commit -m "type(scope): description"
```

Types: `docs` for planning/architecture artifacts, `feat` for new feature files, `chore` for config/setup.

# SPECKIT
<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
at specs/009-openclaw-chat-backend/plan.md
<!-- SPECKIT END -->

## Active Technologies
- TypeScript 5.x trên Node.js 22.17 LTS (đồng bộ với `packages/compiler`) + `@modelcontextprotocol/sdk` (^1.29.0 — official TypeScript MCP SDK), `zod` (^3.x — tool input schema, required bởi SDK's `registerTool`), `@buildmate/compiler` (workspace/local dependency — 001-build-compiler-core); dev-only: `typescript`, `tsx`, `@types/node` (008-compiler-mcp-server)
- N/A — server stateless, không persist, không session; Compiler bên dưới cũng pure/stateless (008-compiler-mcp-server)

## Recent Changes
- 008-compiler-mcp-server: Added TypeScript 5.x trên Node.js 22.17 LTS (đồng bộ với `packages/compiler`) + `@modelcontextprotocol/sdk` (^1.29.0 — official TypeScript MCP SDK), `zod` (^3.x — tool input schema, required bởi SDK's `registerTool`), `@buildmate/compiler` (workspace/local dependency — 001-build-compiler-core); dev-only: `typescript`, `tsx`, `@types/node`
