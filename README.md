# omp-agy

[![CI](https://github.com/tuantran0910/omp-agy/actions/workflows/ci.yml/badge.svg)](https://github.com/tuantran0910/omp-agy/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/omp-agy.svg)](https://www.npmjs.com/package/omp-agy)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Use **Google Antigravity** models from [OMP](https://omp.sh) by delegating to
Google's own `agy` CLI. Authentication, tools, permissions and quota stay inside
the CLI; this extension never reads OAuth tokens and never calls Antigravity
APIs directly.

```bash
omp -p "explain this crate" --model agy/gemini-3.8-flash-low
```

## Install

**1. Install and sign in to the Antigravity CLI** (once per machine):

```bash
curl -fsSL https://antigravity.google/cli/install.sh | bash
agy            # opens the browser for OAuth on first run
agy models     # confirm the CLI works
```

**2. Install the extension:**

```bash
omp plugin install omp-agy
```

**3. Pick a model and chat:**

```bash
omp --model agy/gemini-3.8-flash-low
# or one-shot
omp -p "summarize this repo" --model agy/gemini-3.8-flash-low
```

`agy models` lists the available slugs; the extension registers all of them as
`agy/<slug>`. Gemini 3.8 Flash is the cheapest and usually has quota headroom.

> Upgrade later with `omp plugin install omp-agy@latest` (or `omp plugin update omp-agy`).
> Nothing else is required — `package.json` points OMP at the bundled `dist/` build.

### From a checkout (contributors)

```bash
git clone https://github.com/tuantran0910/omp-agy.git
cd omp-agy
bun install
bun run build
omp -e ./dist/index.js -p "hello" --model agy/gemini-3.8-flash-low
```

To make a checkout permanent, link the build into OMP's extension root:

```bash
ln -sfn "$(pwd)/dist/index.js" ~/.omp/agent/extensions/omp-agy.js
```

## Use it well

| Goal                                       | Command       |
| ------------------------------------------ | ------------- |
| List models with names                     | `/agy-models` |
| See weekly / five-hour quota               | `/agy-usage`  |
| Token totals for this session, cache share | `/agy-cost`   |
| Diagnose binary, version, models, quota    | `/agy-doctor` |

Antigravity bills against **plan quota**, not per-token dollars, so model costs
report `0`. Watch `/agy-usage`; when a model group is exhausted, switch slugs
rather than retrying the same one.

## Configuration

| Variable         | Default   | Purpose                                                 |
| ---------------- | --------- | ------------------------------------------------------- |
| `AGY_BINARY`     | `agy`     | CLI path/name                                           |
| `AGY_MODE`       | `plan`    | `plan` \| `accept-edits` \| `auto` headless permissions |
| `AGY_TIMEOUT_MS` | `1800000` | Per-turn watchdog; the child is killed on expiry        |
| `AGY_ARGS`       | empty     | Extra space-separated flags forwarded to every session  |

## How it works

- One persistent `agy --input-format stream-json --output-format stream-json`
  process per working directory and model, so turns stay warm and the prompt
  cache can hit.
- Only the latest user turn is forwarded; agy runs its own tool loop.
- Usage is reported per turn as a delta of agy's cumulative counters.
- Effort lives in the model slug (`…-low|medium|high`); no `--effort` is passed.
- Slash commands are disabled in stream mode so prompts are always data.

See [`docs/architecture.md`](docs/architecture.md) and
[`docs/decisions.md`](docs/decisions.md).

## Troubleshooting

| Symptom                                   | Fix                                                                                                                                 |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `agy: command not found`                  | Install the CLI (step 1) or set `AGY_BINARY=/path/to/agy`                                                                           |
| `authentication required`                 | Run `agy` interactively once                                                                                                        |
| Turn fails with `WAITING`/permission text | The tool needed approval in headless mode; add a scoped rule under `permissions.allow` in `~/.gemini/antigravity-cli/settings.json` |
| Quota error or `1%` meters                | Use a different model group, or wait for the five-hour/weekly refresh                                                               |
| `agy: no user message in context`         | A turn was requested with no user text; retry from a user prompt                                                                    |

## Development

```bash
bun run check     # typecheck + lint + tests + build
bun test          # unit tests only
bun run format    # biome
```

```
src/
  index.ts              entry: config → provider → commands → cleanup
  config.ts             AGY_* environment parsing
  agy/                  transport: protocol, session, prompt, usage, model helpers
  provider/             OMP provider registration and stream translator
  commands/             slash commands
tests/                  mirrors src
docs/                   architecture and decision records
```

## Acknowledgements

Thanks to **[raultov/opencode-agy-bridge](https://github.com/raultov/opencode-agy-bridge)**
for the ideas and references that informed this adapter's design — in particular
the CLI-as-sole-conduit approach, conversation continuity, and the cost-control
framing behind `/agy-cost` and `/agy-usage`.

## License

MIT. See [LICENSE](LICENSE).
