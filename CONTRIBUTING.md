# Contributing

Thanks for helping improve `omp-agy`.

## Prerequisites

- Bun `1.3.x` (`packageManager` pins the version)
- Node.js 20+ for local scripts
- An authenticated `agy` CLI (`agy --version`, then run `agy` once for OAuth)

The unit suite never calls the network. Live checks are opt-in.

## Workflow

```bash
bun install
bun run check        # typecheck + lint + tests + build
bun run test         # unit tests only
bun run format       # biome check --write
```

Live integration (spends Antigravity quota; use the cheap Flash-low slug):

```bash
agy -p "Reply with exactly: pong" --model gemini-3.8-flash-low --output-format json
bun run build
omp -e ./dist/index.js -p "Reply with exactly: pong" --model agy/gemini-3.8-flash-low --no-session
```

## Ground rules

1. **The CLI is the only conduit.** Never read, store, or forward Antigravity
   OAuth tokens, and never call Antigravity APIs directly. See
   [`SECURITY.md`](SECURITY.md).
2. **Match the documented CLI schema.** `stream-json` events, status values and
   flag semantics come from the official docs; verify against `agy` before
   changing the parser.
3. **No invented pricing.** Antigravity bills against plan quota. Token counts
   are evidence; USD is not.
4. **Tests for behavior.** New public functions need a test. Parser, usage math
   and session lifecycle are the sensitive areas.
5. **Small modules.** `src/agy/` owns transport, `src/provider/` shapes OMP
   models and stream events, `src/commands/` owns slash commands.

## Commit messages

Conventional Commits, imperative mood: `feat: add quota-aware doctor`,
`fix: buffer partial NDJSON lines`.
