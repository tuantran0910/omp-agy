# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- OMP provider `agy` (`agy-cli` API) backed by a persistent
  `agy --input-format stream-json` session per working directory and model.
- Per-turn usage accounting from agy's cumulative counters, including
  `thinking_tokens` and `cache_read_tokens`.
- Commands: `/agy-models`, `/agy-usage`, `/agy-cost`, `/agy-doctor`.
- NDJSON line buffer, status/error mapping, abort and timeout handling.
- Unit suite covering protocol framing, usage deltas, prompt extraction,
  configuration, provider metadata, and session lifecycle.
- Biome configuration, CI workflow, architecture notes and decision records.

### Design

- Antigravity billing is quota-based, so model costs report zero and quota is
  surfaced from `agy -p /usage`.
- Effort is part of the model slug; the adapter never passes `--effort`.
- Only the latest user turn is forwarded; agy owns its tool loop.

[Unreleased]: https://github.com/tuantran0910/omp-agy/compare/main...HEAD
