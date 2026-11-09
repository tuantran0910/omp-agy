# Agent notes for omp-agy

Extension layout:

```
src/
  index.ts              entry: config -> provider -> commands -> cleanup
  config.ts             AGY_* environment parsing
  agy/
    protocol.ts         stream-json NDJSON events + line buffer
    session.ts          persistent agy process, turn queue, abort, usage deltas
    prompt.ts           latest-user-turn extraction, one-time system prefix
    models.ts           `agy models`, `/usage`, `--version` helpers
    usage.ts            cumulative -> per-turn token math
  provider/
    agy-provider.ts     OMP provider registration + stream translator
  commands/
    index.ts            /agy-models /agy-usage /agy-cost /agy-doctor
tests/                  mirrors src, bun:test
docs/                   architecture and decision records
```

Rules when editing:

- Keep the provider free of transport detail; `agy/` must stay CLI-shaped.
- Verify protocol changes against a real `agy --output-format stream-json` run.
- Per-turn usage must be a delta; agy usage counters are cumulative.
- Never introduce USD pricing.
- `bun run check` before proposing a change.
