import { describe, expect, test } from "bun:test"
import type { AgyUsage } from "../../src/agy/protocol.js"
import { deltaUsage, toOmpUsage, toTotals, zeroUsage } from "../../src/agy/usage.js"

describe("usage accounting", () => {
  test("maps cumulative agy counters", () => {
    const usage: AgyUsage = {
      input_tokens: 278,
      output_tokens: 4,
      thinking_tokens: 10,
      cache_read_tokens: 30_214,
      total_tokens: 30_506,
    }
    expect(toTotals(usage)).toEqual({ input: 278, output: 4, cacheRead: 30_214, thinking: 10, total: 30_506 })
  })

  test("turns cumulative samples into per-turn deltas", () => {
    const first = toTotals({ input_tokens: 7_938, output_tokens: 1, total_tokens: 7_939 })
    const second = toTotals({ input_tokens: 15_950, output_tokens: 2, total_tokens: 15_952 })
    expect(deltaUsage(first, second)).toEqual({
      input: 8_012,
      output: 1,
      cacheRead: 0,
      thinking: 0,
      total: 8_013,
    })
  })

  test("clamps resets instead of reporting negative usage", () => {
    const previous = toTotals({ input_tokens: 100, output_tokens: 5, total_tokens: 105 })
    const reset = toTotals({ input_tokens: 10, output_tokens: 1, total_tokens: 11 })
    expect(deltaUsage(previous, reset).input).toBe(10)
  })

  test("maps thinking into output and zeroes cost (quota-based billing)", () => {
    const usage = toOmpUsage(deltaUsage(zeroUsage(), toTotals({ output_tokens: 4, thinking_tokens: 6 })))
    expect(usage.output).toBe(10)
    expect(usage.cost).toEqual({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 })
  })
})
