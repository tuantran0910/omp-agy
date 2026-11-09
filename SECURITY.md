# Security and Terms-of-Service posture

`omp-agy` is a thin adapter around Google's own Antigravity CLI. It holds no
Antigravity credentials and has no network code of its own.

## Dependency posture

- The published package has **zero runtime dependencies**. `@oh-my-pi/pi-ai`
  and `@oh-my-pi/pi-coding-agent` are host-provided types/runtime modules and
  are declared as dev dependencies only.
- `bun audit` is part of `bun run check` and CI. The tree is currently clean.
- A `zod` override pins `4.6.7` to clear
  [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5)
  (memory exhaustion in oversized constrained collections) pulled in by the dev
  toolchain (`pi-coding-agent → puppeteer-core → chromium-bidi → zod`).
- `bun.lock` is committed so installs are reproducible.

## Hardening in the adapter

| Control                             | Behavior                                                                                                                                                                                                                                                                       |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| No shell                            | `agy` is spawned with `execFile`-style argv. Prompts travel as JSON on stdin; no `shell: true`, no interpolation.                                                                                                                                                              |
| Fixed protocol flags                | `AGY_ARGS` may not contain `--input-format`, `--output-format`, `--print`, `--prompt`, `--model`, `--conversation`, `--add-dir`, `--settings`, `-p`, or `--dangerously-skip-permissions`; startup fails loudly instead of letting extra args hijack the stream or permissions. |
| Model id validation                 | Model ids must start alphanumeric and match `[A-Za-z0-9._-]*`; a flag-looking id such as `--dangerously-skip-permissions` is rejected before spawn.                                                                                                                            |
| No `--dangerously-skip-permissions` | Never passed by the adapter, and blocked in `AGY_ARGS`. Headless permission rules stay in `~/.gemini/antigravity-cli/settings.json`.                                                                                                                                           |
| Framing limits                      | The NDJSON line buffer drops any single line over 8 MiB instead of growing without bound.                                                                                                                                                                                      |
| Output handling                     | `agy` stderr is capped at 4 KB and only used in error messages; stdout is parsed and streamed, never executed.                                                                                                                                                                 |
| Process hygiene                     | Per-turn watchdog kills the child (`SIGTERM` → `SIGKILL`); abort kills immediately; `exit` closes all sessions; the `SIGTERM` hook re-raises the signal after cleanup so the host still terminates.                                                                            |
| Slash commands                      | Disabled in stream mode, so prompt text is never interpreted as a CLI command.                                                                                                                                                                                                 |
| Credentials                         | The extension never reads `~/.gemini/**` or any OAuth material.                                                                                                                                                                                                                |

## Data handling

| Data                          | Handling                                                                                |
| ----------------------------- | --------------------------------------------------------------------------------------- |
| Antigravity OAuth credentials | Never read. `agy` owns them and handles refresh.                                        |
| Prompts/responses             | Passed through the CLI's stdio pipes, streamed to OMP, not persisted by this extension. |
| Token counts                  | Kept in memory per process for `/agy-cost`; not written to disk.                        |
| stderr                        | Bounded in-memory buffer for error messages; never persisted.                           |

## Reporting

Open a private security advisory on the repository rather than a public issue if
you believe the adapter leaks credentials or can be driven to execute
unintended commands outside the `agy` permission model.
