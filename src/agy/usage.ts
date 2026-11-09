import type { Usage } from "@oh-my-pi/pi-ai"
import type { AgyUsage } from "./protocol.js"

/**
 * Token totals from agy are **cumulative per session**; OMP wants per-turn
 * usage. These helpers turn the cumulative counters into deltas so cost
 * displays do not double-count every previous turn.
 */
export interface UsageTotals {
  input: number
  output: number
  cacheRead: number
  thinking: number
  total: number
}

export function zeroUsage(): UsageTotals {
  return { input: 0, output: 0, cacheRead: 0, thinking: 0, total: 0 }
}

function count(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0
}

export function toTotals(usage: AgyUsage | undefined): UsageTotals {
  const input = count(usage?.input_tokens)
  const output = count(usage?.output_tokens)
  const cacheRead = count(usage?.cache_read_tokens)
  const thinking = count(usage?.thinking_tokens)
  const reported = count(usage?.total_tokens)
  return {
    input,
    output,
    cacheRead,
    thinking,
    total: reported > 0 ? reported : input + output + cacheRead + thinking,
  }
}

/** Per-turn delta between two cumulative samples, clamped at zero. */
export function deltaUsage(previous: UsageTotals, next: UsageTotals): UsageTotals {
  const subtract = (a: number, b: number): number => (a >= b ? a - b : a)
  return {
    input: subtract(next.input, previous.input),
    output: subtract(next.output, previous.output),
    cacheRead: subtract(next.cacheRead, previous.cacheRead),
    thinking: subtract(next.thinking, previous.thinking),
    total: subtract(next.total, previous.total),
  }
}

/** Maps a per-turn agy delta onto OMP's `Usage` (thinking counts as output). */
export function toOmpUsage(delta: UsageTotals): Usage {
  return {
    input: delta.input,
    output: delta.output + delta.thinking,
    cacheRead: delta.cacheRead,
    cacheWrite: 0,
    totalTokens: delta.total,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  }
}
