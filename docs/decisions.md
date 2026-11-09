# Decision records

Short records for choices that shape the adapter. Each entry states the
constraint observed in the CLI, the decision, and the consequence.

## ADR-001: Persistent stream-json session instead of a process per turn

**Context.** `agy --print` exits after one turn. Per-turn invocations pay process
startup and lose prompt-cache reuse; the CLI documents a stdin mode that keeps a
conversation and emits one `result` event per turn.
**Decision.** One long-lived `agy --input-format stream-json --output-format
stream-json` process per `(cwd, model)`, serialized turns.
**Consequence.** Lower latency and better cache reuse; the adapter must own
process lifetime, aborts, timeouts, and partial-line framing.

## ADR-002: Forward only the latest user turn

**Context.** agy runs its own agent loop with its own tools and transcript.
OMP's context contains tool schemas and tool results the child already produced.
**Decision.** Send the latest user text (plus the system prompt once). Never
replay OMP tool calls, results, or prior assistant turns.
**Consequence.** No duplicated context or desynchronised child transcript; OMP
tools are not available inside the agy turn, by design.

## ADR-003: Quota-based accounting, zero USD cost

**Context.** Antigravity bills plans through weekly and five-hour quota meters
(`agy -p /usage`), not per-token API pricing; there is no BYOK.
**Decision.** Report zero cost on every model, track tokens and cache reads, and
surface quota through `/agy-usage`.
**Consequence.** Cost displays in OMP stay honest (zero) while quota pressure is
visible; no fabricated dollar figures.

## ADR-004: Never pass `--effort`

**Context.** Effort is embedded in the model slug (`gemini-3.8-flash-low`,
`…-medium`, `…-high`). Passing a conflicting `--effort` fails with
`invalid model selection` (verified against agy 1.5.3).
**Decision.** Model selection is the only effort control.
**Consequence.** One fewer failure mode; callers choose a slug, not two knobs.

## ADR-005: Disable slash commands in stream mode

**Context.** A stream prompt answered by the CLI itself (for example `/model`)
ends the session with `status=ERROR`.
**Decision.** Pass `--disable-slash-commands`; prompts are data.
**Consequence.** Skills/slash expansion inside agy is off; the OMP side keeps
its own commands.

## ADR-006: Extension-owned `agy-cli` API

**Context.** The CLI is not an HTTP endpoint, so no built-in wire API fits.
**Decision.** Register a custom provider with an extension-owned API id and
`streamSimple`, building `AssistantMessageEventStream` events directly.
**Consequence.** The adapter owns process cleanup and error translation; OMP
keeps model selection, roles, and usage rendering.
