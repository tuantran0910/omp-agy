# omp-agy

[![CI](https://github.com/tuantran0910/omp-agy/actions/workflows/ci.yml/badge.svg)](https://github.com/tuantran0910/omp-agy/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

OMP extension + provider for **Google Antigravity CLI** (`agy`).

`omp-agy` lets OMP use Antigravity models by delegating to Google's own `agy`
binary. Authentication, tools, permissions and quota stay inside the CLI; this
extension never reads OAuth tokens and never calls Antigravity APIs directly.

```bash
omp -e ./dist/index.js -p "explain this crate" --model agy/gemini-3.8-flash-low
```

## Features

- **Persistent sessions** — one `agy --input-format stream-json` process per
  working directory and model, so turns stay warm and the prompt cache can hit.
- **Honest accounting** — per-turn token deltas from agy's cumulative counters;
  thinking tokens are counted as output; cache reads are reported separately.
- **Quota-aware** — no invented USD pricing. `/agy-usage` surfaces the CLI's
  weekly and five-hour meters; `/agy-cost` shows token totals and cache share.
- **Correct transport** — line-buffered NDJSON, status/error mapping, abort and
  timeout handling, and no `--effort` (effort is encoded in the model slug).
- **Commands** — `/agy-models`, `/agy-usage`, `/agy-cost`, `/agy-doctor`.

## Why these choices

Verified against `agy 1.5.3` and the official docs
([headless](https://antigravity.google/docs/cli/headless/),
[models](https://antigravity.google/docs/models),
[permissions](https://antigravity.google/docs/permissions?tab=cli)):

- One process per turn pays startup and loses prompt-cache reuse; a persistent
  stream-json session keeps the conversation and cache warm.
- Only the latest user turn is forwarded: agy owns its tool loop, so replaying
  OMP tool schemas/results duplicates context and desynchronises the child.
- agy reports cumulative usage per session; OMP needs per-turn usage.
- Antigravity bills against plan quota, not tokens, so model cost is zero.
- Model slugs encode effort (`gemini-3.8-flash-low|medium|high`); passing a
  conflicting `--effort` is rejected. The adapter never passes `--effort`.
- Stream mode cannot use CLI slash commands (`/model` exits the session with
  `ERROR`), so the adapter disables slash-command expansion and treats prompts
  as data.

## Install

```bash
git clone https://github.com/tuantran0910/omp-agy.git
cd omp-agy
bun install
bun run build
```

Load it for one run:

```bash
omp -e ./dist/index.js -p "hello" --model agy/gemini-3.8-flash-low
```

Keep it available by linking or copying the built extension into
`~/.omp/agent/extensions/`. Prerequisite: an authenticated `agy` CLI
(`agy --version`, then run `agy` once for OAuth).

## Configuration

| Variable         | Default   | Purpose                                                   |
| ---------------- | --------- | --------------------------------------------------------- |
| `AGY_BINARY`     | `agy`     | CLI path/name                                             |
| `AGY_MODE`       | `plan`    | `plan` \| `accept-edits` \| `auto` (headless permissions) |
| `AGY_TIMEOUT_MS` | `1800000` | Per-turn watchdog; the child is killed on expiry          |
| `AGY_ARGS`       | empty     | Extra space-separated flags forwarded to every session    |

Provider id `agy`, API id `agy-cli`. Model rows mirror `agy models`; quotas are
plan-dependent — on the reference account Gemini Flash has headroom while
Claude/GPT and Gemini 4 Argon are nearly exhausted, so the cheap Flash slugs are
the sane default.

## Development

```bash
bun run check     # typecheck + lint + unit tests + build
bun test          # unit tests
bun run format    # biome
```

The unit suite never touches the network. Live checks (each costs a little
quota) are documented in [CONTRIBUTING.md](CONTRIBUTING.md).

```
src/
  index.ts              entry: config -> provider -> commands -> cleanup
  config.ts             AGY_* environment parsing
  agy/                  transport: protocol, session, prompt, usage, model helpers
  provider/             OMP provider registration + stream translator
  commands/             slash commands
tests/                  mirrors src
docs/                   architecture and decision records
```

## Acknowledgements

Thanks to **[raultov/opencode-agy-bridge](https://github.com/raultov/opencode-agy-bridge)**
for the ideas and references that informed this adapter's design — in
particular the CLI-as-sole-conduit approach, conversation continuity, and the
cost-control framing that shaped `/agy-cost` and `/agy-usage`.

## License

MIT. See [LICENSE](LICENSE).
