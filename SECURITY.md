# Security and Terms-of-Service posture

`omp-agy` is a thin adapter around Google's own Antigravity CLI. It deliberately
holds no Antigravity credentials and has no network code of its own.

## What the extension can see

| Data                          | Handling                                                                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Antigravity OAuth credentials | Never read. `agy` owns `~/.gemini/**` and handles refresh.                                                                      |
| Prompts/responses             | Passed through the CLI's stdio pipes; the child process output is parsed, streamed to OMP, and not persisted by this extension. |
| Token counts                  | Read from `result.usage` and kept in memory per process for `/agy-cost`.                                                        |
| `agy` stderr                  | Kept in a bounded 4 KB buffer for error messages; never written to disk.                                                        |

## What the extension must never do

- Never call Antigravity APIs directly.
- Never pass `--dangerously-skip-permissions`.
- Never read or copy `oauth_creds.json`, cookies, or browser storage.
- Never send OMP tool schemas or tool results to the child as if they were part
  of agy's own transcript.

## Reporting

Open a private security advisory on the repository rather than a public issue if
you believe the adapter leaks credentials or can be driven to execute
unintended commands outside the `agy` permission model.
