/**
 * OMP provider for the Antigravity CLI.
 *
 * Provider registration supplies model metadata plus `streamSimple`; the actual
 * transport is the extension-owned `agy-cli` API in `../agy/session.ts`.
 */

import type { Api, AssistantMessage, Context, Model, SimpleStreamOptions, Usage } from "@oh-my-pi/pi-ai"
import { AssistantMessageEventStream } from "@oh-my-pi/pi-ai/utils/event-stream"
import { KNOWN_MODELS } from "../agy/models.js"
import { buildTurnPrompt, systemPrefix } from "../agy/prompt.js"
import type { AgySessionManager } from "../agy/session.js"
import { AgyError } from "../agy/session.js"
import type { UsageTotals } from "../agy/usage.js"
import { zeroUsage } from "../agy/usage.js"

export const PROVIDER_ID = "agy"
export const API_ID = "agy-cli"
export const PROVIDER_BASE_URL = "https://agy-cli.invalid/"

export interface ProviderModelEntry {
  id: string
  name: string
  api: Api
  reasoning: boolean
  input: ("text" | "image")[]
  cost: { input: number; output: number; cacheRead: number; cacheWrite: number }
  contextWindow: number
  maxTokens: number
}

/** Model rows for `registerProvider`; entries mirror `agy models`. */
export function providerModels(): ProviderModelEntry[] {
  return KNOWN_MODELS.map((model) => ({
    id: model.id,
    name: model.name,
    api: API_ID as Api,
    reasoning: true,
    input: ["text"],
    // Antigravity bills against plan quota, not per token.
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 1_000_000,
    maxTokens: 65_536,
  }))
}

function toOmpUsage(totals: UsageTotals): Usage {
  return {
    input: totals.input,
    output: totals.output + totals.thinking,
    cacheRead: totals.cacheRead,
    cacheWrite: 0,
    totalTokens: totals.input + totals.output + totals.cacheRead + totals.thinking,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  }
}

function assistantMessage(
  model: Model<Api>,
  text: string,
  usage: Usage,
  stopReason: AssistantMessage["stopReason"],
  errorMessage?: string,
): AssistantMessage {
  return {
    role: "assistant",
    content: [{ type: "text", text }],
    api: model.api,
    provider: model.provider,
    model: model.id,
    usage,
    stopReason,
    timestamp: Date.now(),
    ...(errorMessage === undefined ? {} : { errorMessage }),
  }
}

export type StreamSimple = (
  model: Model<Api>,
  context: Context,
  options?: SimpleStreamOptions,
) => AssistantMessageEventStream

/**
 * Builds the stream translator for one session manager.
 *
 * OMP pushes only the latest user turn to agy because agy owns its own tool
 * loop and conversation; replaying OMP's transcript duplicates context.
 */
export function createStreamSimple(manager: AgySessionManager): StreamSimple {
  return (model, context, options) => {
    const stream = new AssistantMessageEventStream()
    const cwd = options?.cwd ?? process.cwd()
    const session = manager.session(cwd, model.id)
    const prompt = buildTurnPrompt(context)
    const prefix = systemPrefix(context)
    const usage = zeroUsage()
    let text = ""

    const partial = (stopReason: AssistantMessage["stopReason"], errorMessage?: string): AssistantMessage =>
      assistantMessage(model, text, toOmpUsage(usage), stopReason, errorMessage)

    if (prompt.trim() === "") {
      queueMicrotask(() => {
        stream.push({
          type: "error",
          reason: "error",
          error: assistantMessage(
            model,
            "",
            toOmpUsage(zeroUsage()),
            "error",
            "agy: no user message in context",
          ),
        })
      })
      return stream
    }

    stream.push({ type: "start", partial: partial("stop") })

    void session
      .send(
        prompt,
        {
          signal: options?.signal,
          onText: (delta) => {
            text += delta
            stream.push({ type: "text_delta", contentIndex: 0, delta, partial: partial("stop") })
          },
        },
        prefix,
      )
      .then((outcome) => {
        usage.input = outcome.usage.input
        usage.output = outcome.usage.output
        usage.cacheRead = outcome.usage.cacheRead
        usage.thinking = outcome.usage.thinking
        usage.total = outcome.usage.total
        const final = partial("stop")
        stream.push({ type: "text_end", contentIndex: 0, content: text, partial: final })
        stream.push({ type: "done", reason: "stop", message: final })
      })
      .catch((error: unknown) => {
        const aborted = error instanceof AgyError && error.status === "ABORTED"
        const message = error instanceof Error ? error.message : String(error)
        stream.push({
          type: "error",
          reason: aborted ? "aborted" : "error",
          error: assistantMessage(model, text, toOmpUsage(usage), aborted ? "aborted" : "error", message),
        })
      })

    return stream
  }
}
