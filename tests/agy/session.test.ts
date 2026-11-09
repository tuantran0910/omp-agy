import { describe, expect, test } from "bun:test"
import type { ChildLike } from "../../src/agy/session.js"
import { AgyError, AgySession } from "../../src/agy/session.js"

class FakeChild implements ChildLike {
  writes: string[] = []
  signals: string[] = []
  ended = false
  private stdout: ((chunk: Buffer | string) => void)[] = []
  private stderr: ((chunk: Buffer | string) => void)[] = []
  private close: ((code: number | null) => void)[] = []
  private errors: ((error: Error) => void)[] = []

  write(data: string): unknown {
    this.writes.push(data)
    return true
  }

  endInput(): unknown {
    this.ended = true
    return true
  }

  onStdout(listener: (chunk: Buffer | string) => void): void {
    this.stdout.push(listener)
  }

  onStderr(listener: (chunk: Buffer | string) => void): void {
    this.stderr.push(listener)
  }

  onClose(listener: (code: number | null) => void): void {
    this.close.push(listener)
  }

  onError(listener: (error: Error) => void): void {
    this.errors.push(listener)
  }

  kill(signal: NodeJS.Signals = "SIGTERM"): boolean {
    this.signals.push(signal)
    return true
  }

  emit(event: unknown): void {
    const line = `${JSON.stringify(event)}\n`
    for (const listener of this.stdout) listener(line)
  }

  emitStderr(text: string): void {
    for (const listener of this.stderr) listener(text)
  }

  emitClose(code: number | null): void {
    for (const listener of this.close) listener(code)
  }
}

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

function setup() {
  const child = new FakeChild()
  const calls: { binary: string; args: readonly string[]; cwd: string }[] = []
  const session = new AgySession({
    binary: "agy",
    modelId: "gemini-3.8-flash-low",
    cwd: "/tmp/project",
    mode: "plan",
    timeoutMs: 5_000,
    spawn: (binary, args, cwd) => {
      calls.push({ binary, args, cwd })
      return child
    },
  })
  return { child, calls, session }
}

describe("AgySession", () => {
  test("rejects a model id that looks like a CLI flag", () => {
    expect(
      () =>
        new AgySession({
          binary: "agy",
          modelId: "--dangerously-skip-permissions",
          cwd: "/tmp",
          mode: "plan",
          timeoutMs: 1_000,
        }),
    ).toThrow(/invalid agy model id/)
  })

  test("spawns one stream-json session with the verified flags", async () => {
    const { calls, child, session } = setup()
    void session.send("hello")
    await tick()
    expect(calls.length).toBe(1)
    const call = calls[0]
    expect(call?.binary).toBe("agy")
    expect(call?.args).toEqual([
      "--input-format",
      "stream-json",
      "--output-format",
      "stream-json",
      "--model",
      "gemini-3.8-flash-low",
      "--add-dir",
      "/tmp/project",
      "--mode",
      "plan",
      "--disable-slash-commands",
    ])
    expect(JSON.parse(child.writes[0] ?? "{}")).toEqual({
      event: "user",
      message: { content: "hello" },
    })
  })

  test("streams text deltas and resolves with per-turn usage", async () => {
    const { child, session } = setup()
    const deltas: string[] = []
    const promise = session.send("hi", { onText: (delta) => deltas.push(delta) })
    await tick()

    child.emit({ event: "init", conversation_id: "conv-1", init: {} })
    child.emit({ event: "step_update", step_update: { state: "ACTIVE", text_delta: "he" } })
    child.emit({ event: "step_update", step_update: { state: "ACTIVE", text_delta: "llo" } })
    child.emit({
      event: "result",
      result: {
        conversation_id: "conv-1",
        status: "SUCCESS",
        response: "hello",
        num_turns: 1,
        usage: {
          input_tokens: 100,
          output_tokens: 2,
          thinking_tokens: 3,
          cache_read_tokens: 50,
          total_tokens: 155,
        },
      },
    })

    const outcome = await promise
    expect(deltas.join("")).toBe("hello")
    expect(outcome.response).toBe("hello")
    expect(outcome.conversationId).toBe("conv-1")
    expect(outcome.usage).toEqual({ input: 100, output: 2, cacheRead: 50, thinking: 3, total: 155 })
  })

  test("second turn reports only the delta of cumulative counters", async () => {
    const { child, session } = setup()
    const first = session.send("one")
    await tick()
    child.emit({
      event: "result",
      result: {
        status: "SUCCESS",
        response: "1",
        usage: { input_tokens: 100, output_tokens: 5, total_tokens: 105 },
      },
    })
    await first

    const second = session.send("two")
    await tick()
    child.emit({
      event: "result",
      result: {
        status: "SUCCESS",
        response: "2",
        usage: { input_tokens: 250, output_tokens: 8, total_tokens: 258 },
      },
    })
    expect((await second).usage).toEqual({ input: 150, output: 3, cacheRead: 0, thinking: 0, total: 153 })
  })

  test("non-SUCCESS status rejects with agy's error", async () => {
    const { child, session } = setup()
    const promise = session.send("hi")
    await tick()
    child.emitStderr("permission denied for run_command")
    child.emit({
      event: "result",
      result: { status: "ERROR", response: "", error: "tool needed approval", usage: {} },
    })
    const error = await promise.catch((reason: unknown) => reason)
    expect(error).toBeInstanceOf(AgyError)
    expect((error as AgyError).status).toBe("ERROR")
    expect((error as AgyError).message).toBe("tool needed approval")
  })

  test("abort kills the child and rejects as ABORTED", async () => {
    const { child, session } = setup()
    const controller = new AbortController()
    const promise = session.send("hi", { signal: controller.signal })
    await tick()
    controller.abort()
    const error = await promise.catch((reason: unknown) => reason)
    expect((error as AgyError).status).toBe("ABORTED")
    expect(child.signals).toContain("SIGTERM")
    expect(child.ended).toBe(true)
  })

  test("system prompt is sent once, before the first turn only", async () => {
    const { child, session } = setup()
    const first = session.send("one", {}, "SYSTEM")
    await tick()
    child.emit({
      event: "result",
      result: { status: "SUCCESS", response: "1", usage: { total_tokens: 1 } },
    })
    await first
    const second = session.send("two", {}, "SYSTEM")
    await tick()
    child.emit({
      event: "result",
      result: { status: "SUCCESS", response: "2", usage: { total_tokens: 2 } },
    })
    await second

    const contents = child.writes.map((write) => JSON.parse(write).message.content as string)
    expect(contents[0]).toBe("SYSTEM\n\none")
    expect(contents[1]).toBe("two")
  })

  test("a child exit mid-turn rejects the pending turn", async () => {
    const { child, session } = setup()
    const promise = session.send("hi")
    await tick()
    child.emitClose(1)
    const error = await promise.catch((reason: unknown) => reason)
    expect(error).toBeInstanceOf(AgyError)
    expect((error as AgyError).status).toBe("EXIT 1")
  })
})
