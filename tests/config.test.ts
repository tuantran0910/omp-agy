import { describe, expect, test } from "bun:test"
import { DEFAULT_TIMEOUT_MS, loadConfig } from "../src/config.js"

describe("config", () => {
  test("defaults to plan mode, agy binary, and the 30 minute watchdog", () => {
    expect(loadConfig({})).toEqual({
      binary: "agy",
      mode: "plan",
      timeoutMs: DEFAULT_TIMEOUT_MS,
      extraArgs: [],
    })
  })

  test("refuses args that would hijack the stream protocol or permissions", () => {
    for (const arg of [
      "--dangerously-skip-permissions",
      "--output-format=json",
      "--input-format",
      "--model=other",
      "--conversation=x",
      "-p",
    ]) {
      expect(() => loadConfig({ AGY_ARGS: `--sandbox ${arg}` })).toThrow(/may not override/)
    }
    expect(loadConfig({ AGY_ARGS: "--sandbox --log-file /tmp/agy.log" }).extraArgs).toEqual([
      "--sandbox",
      "--log-file",
      "/tmp/agy.log",
    ])
  })

  test("reads overrides and rejects unusable values", () => {
    const config = loadConfig({
      AGY_BINARY: "/opt/agy",
      AGY_MODE: "accept-edits",
      AGY_TIMEOUT_MS: "90000",
      AGY_ARGS: "--sandbox  --log-file /tmp/agy.log",
    })
    expect(config).toEqual({
      binary: "/opt/agy",
      mode: "accept-edits",
      timeoutMs: 90_000,
      extraArgs: ["--sandbox", "--log-file", "/tmp/agy.log"],
    })
    expect(loadConfig({ AGY_MODE: "yolo", AGY_TIMEOUT_MS: "-5" }).mode).toBe("plan")
    expect(loadConfig({ AGY_TIMEOUT_MS: "NaN" }).timeoutMs).toBe(DEFAULT_TIMEOUT_MS)
  })
})
