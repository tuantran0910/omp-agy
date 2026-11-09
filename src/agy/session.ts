import { spawn } from "node:child_process"
import type { AgyResultEnvelope, AgyUsage } from "./protocol.js"
import { NdjsonLineBuffer, parseEvent } from "./protocol.js"
import type { UsageTotals } from "./usage.js"
import { deltaUsage, toTotals, zeroUsage } from "./usage.js"

/** Minimal child-process surface, kept callback-based so tests can inject a fake. */
export interface ChildLike {
  write(data: string): unknown
  endInput(): unknown
  onStdout(listener: (chunk: Buffer | string) => void): void
  onStderr(listener: (chunk: Buffer | string) => void): void
  onClose(listener: (code: number | null) => void): void
  onError(listener: (error: Error) => void): void
  kill(signal?: NodeJS.Signals): boolean
}

export type SpawnAgy = (binary: string, args: readonly string[], cwd: string) => ChildLike

export interface AgySessionConfig {
  binary: string
  modelId: string
  cwd: string
  mode: "plan" | "accept-edits" | "auto"
  timeoutMs: number
  extraArgs?: readonly string[]
  spawn?: SpawnAgy
}

export interface AgyTurnHandlers {
  onText?: (delta: string) => void
  signal?: AbortSignal
}

export interface AgyTurnOutcome {
  response: string
  conversationId?: string
  usage: UsageTotals
  numTurns?: number
  status: string
}

export class AgyError extends Error {
  constructor(
    message: string,
    readonly status?: string,
    readonly stderr?: string,
  ) {
    super(message)
    this.name = "AgyError"
  }
}

const defaultSpawn: SpawnAgy = (binary, args, cwd) => {
  const child = spawn(binary, [...args], { cwd, stdio: ["pipe", "pipe", "pipe"] })
  return {
    write: (data) => child.stdin.write(data),
    endInput: () => child.stdin.end(),
    onStdout: (listener) => void child.stdout.on("data", listener),
    onStderr: (listener) => void child.stderr.on("data", listener),
    onClose: (listener) => void child.on("close", listener),
    onError: (listener) => void child.on("error", listener),
    kill: (signal) => child.kill(signal),
  }
}

function sessionArgs(config: AgySessionConfig): string[] {
  const args = [
    "--input-format",
    "stream-json",
    "--output-format",
    "stream-json",
    "--model",
    config.modelId,
    "--add-dir",
    config.cwd,
    "--mode",
    config.mode,
    // Headless slash commands answer the CLI itself and terminate a stream
    // session with status ERROR; prompts are data here, not commands.
    "--disable-slash-commands",
  ]
  if (config.extraArgs) args.push(...config.extraArgs)
  return args
}

interface PendingTurn {
  resolve: (outcome: AgyTurnOutcome) => void
  reject: (error: Error) => void
  handlers: AgyTurnHandlers
}

/**
 * One long-lived `agy` process per (session, cwd, model).
 *
 * The persistent stdin session keeps the conversation warm and lets agy reuse
 * its prompt cache across turns; a process per turn pays startup and loses the
 * cache every time.
 */
export class AgySession {
  private child: ChildLike | null = null
  private readonly lines = new NdjsonLineBuffer()
  private pending: PendingTurn | null = null
  private tail: Promise<unknown> = Promise.resolve()
  private stderrTail = ""
  private cumulative: UsageTotals = zeroUsage()
  private lastReported: UsageTotals = zeroUsage()
  private systemSent = false
  conversationId?: string

  constructor(private readonly config: AgySessionConfig) {}

  private ensureChild(): ChildLike {
    if (this.child) return this.child
    const spawner = this.config.spawn ?? defaultSpawn
    const child = spawner(this.config.binary, sessionArgs(this.config), this.config.cwd)
    this.child = child

    child.onStdout((chunk) => {
      for (const line of this.lines.push(String(chunk))) this.handleLine(line)
    })
    child.onStderr((chunk) => {
      this.stderrTail = `${this.stderrTail}${String(chunk)}`.slice(-4000)
    })
    child.onError((error) => {
      this.failPending(new AgyError(`failed to spawn agy: ${error.message}`, "SPAWN", this.stderrTail))
    })
    child.onClose((code) => {
      this.child = null
      if (this.pending) {
        const status = code === 0 ? undefined : `EXIT ${String(code)}`
        this.failPending(new AgyError(`agy session closed (exit ${String(code)})`, status, this.stderrTail))
      }
    })
    return child
  }

  private handleLine(line: string): void {
    const event = parseEvent(line)
    if (!event) return
    if (event.event === "init") {
      if (typeof event.conversation_id === "string") this.conversationId = event.conversation_id
      return
    }
    if (event.event === "step_update") {
      const update = event.step_update
      if (update && typeof update.text_delta === "string" && update.text_delta !== "") {
        this.pending?.handlers.onText?.(update.text_delta)
      }
      return
    }
    if (event.event === "result") this.finishTurn(event.result)
  }

  private finishTurn(result: AgyResultEnvelope | undefined): void {
    const pending = this.pending
    if (!pending) return
    this.pending = null
    if (!result) {
      pending.reject(new AgyError("agy emitted an empty result event", "INVALID", this.stderrTail))
      return
    }
    if (typeof result.conversation_id === "string") this.conversationId = result.conversation_id

    this.cumulative = toTotals(result.usage)
    const delta = deltaUsage(this.lastReported, this.cumulative)
    this.lastReported = this.cumulative

    const status = result.status ?? "UNKNOWN"
    if (status !== "SUCCESS") {
      pending.reject(
        new AgyError(result.error?.trim() || `agy turn ended with status ${status}`, status, this.stderrTail),
      )
      return
    }
    pending.resolve({
      response: result.response ?? "",
      conversationId: this.conversationId,
      usage: delta,
      numTurns: result.num_turns,
      status,
    })
  }

  private failPending(error: Error): void {
    const pending = this.pending
    this.pending = null
    pending?.reject(error)
  }

  /** Serializes turns: agy runs one prompt at a time per session. */
  send(prompt: string, handlers: AgyTurnHandlers = {}, systemPrefix?: string): Promise<AgyTurnOutcome> {
    let text = prompt
    if (!this.systemSent && systemPrefix !== undefined && systemPrefix.trim() !== "") {
      text = `${systemPrefix}\n\n${prompt}`
      this.systemSent = true
    } else if (!this.systemSent) {
      this.systemSent = true
    }
    const run = (): Promise<AgyTurnOutcome> => this.runTurn(text, handlers)
    const next = this.tail.then(run, run)
    this.tail = next.then(
      () => undefined,
      () => undefined,
    )
    return next
  }

  private runTurn(prompt: string, handlers: AgyTurnHandlers): Promise<AgyTurnOutcome> {
    const child = this.ensureChild()
    const { promise, resolve, reject } = Promise.withResolvers<AgyTurnOutcome>()

    const timer = setTimeout(() => {
      this.abort(new AgyError(`agy turn timed out after ${this.config.timeoutMs} ms`, "TIMEOUT"))
    }, this.config.timeoutMs)

    const onAbort = (): void => {
      this.abort(new AgyError("agy turn aborted", "ABORTED"))
    }
    handlers.signal?.addEventListener("abort", onAbort, { once: true })

    const settle = {
      resolve: (outcome: AgyTurnOutcome): void => {
        clearTimeout(timer)
        handlers.signal?.removeEventListener("abort", onAbort)
        resolve(outcome)
      },
      reject: (error: Error): void => {
        clearTimeout(timer)
        handlers.signal?.removeEventListener("abort", onAbort)
        reject(error)
      },
    }

    this.pending = { resolve: settle.resolve, reject: settle.reject, handlers }

    if (handlers.signal?.aborted) {
      this.abort(new AgyError("agy turn aborted", "ABORTED"))
      return promise
    }

    this.lastReported = this.cumulative
    child.write(`${JSON.stringify({ event: "user", message: { content: prompt } })}\n`)
    return promise
  }

  private abort(error: AgyError): void {
    const child = this.child
    this.child = null
    this.failPending(error)
    if (child) {
      child.endInput()
      child.kill("SIGTERM")
      setTimeout(() => child.kill("SIGKILL"), 2_000).unref()
    }
  }

  close(): void {
    this.abort(new AgyError("agy session closed", "CLOSED"))
  }

  stats(): { cumulative: UsageTotals; conversationId?: string } {
    return { cumulative: this.cumulative, conversationId: this.conversationId }
  }
}

export class AgySessionManager {
  private readonly sessions = new Map<string, AgySession>()
  createCount = 0

  constructor(
    private readonly config: Omit<AgySessionConfig, "modelId" | "cwd">,
    private readonly spawner?: SpawnAgy,
  ) {}

  session(cwd: string, modelId: string): AgySession {
    const key = `${cwd}\u0000${modelId}`
    const existing = this.sessions.get(key)
    if (existing) return existing
    const session = new AgySession({ ...this.config, cwd, modelId, spawn: this.spawner })
    this.sessions.set(key, session)
    this.createCount += 1
    return session
  }

  statsSnapshot(): { sessions: number; input: number; output: number; cacheRead: number; created: number } {
    let input = 0
    let output = 0
    let cacheRead = 0
    for (const session of this.sessions.values()) {
      const { cumulative } = session.stats()
      input += cumulative.input
      output += cumulative.output
      cacheRead += cumulative.cacheRead
    }
    return { sessions: this.sessions.size, input, output, cacheRead, created: this.createCount }
  }

  closeAll(): void {
    for (const session of this.sessions.values()) session.close()
    this.sessions.clear()
  }
}

export type { AgyUsage }
