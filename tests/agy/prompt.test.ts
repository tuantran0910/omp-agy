import { describe, expect, test } from "bun:test"
import type { Context, Message } from "@oh-my-pi/pi-ai"
import { buildTurnPrompt, latestUserText, messageText, systemPrefix } from "../../src/agy/prompt.js"

const user = (text: string): Message => ({ role: "user", content: text, timestamp: 0 })
const assistant = (text: string): Message => ({
  role: "assistant",
  content: [{ type: "text", text }],
  api: "agy-cli",
  provider: "agy",
  model: "gemini-3.8-flash-low",
  usage: {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  },
  stopReason: "stop",
  timestamp: 0,
})

describe("prompt construction", () => {
  test("uses only the latest user turn", () => {
    expect(latestUserText([user("first"), assistant("reply"), user("second")])).toBe("second")
  })

  test("joins text blocks and ignores images", () => {
    const message: Message = {
      role: "user",
      content: [
        { type: "text", text: "describe" },
        { type: "image", data: "AAAA", mimeType: "image/png" },
      ],
      timestamp: 0,
    }
    expect(messageText(message)).toBe("describe")
    expect(latestUserText([message])).toBe("describe")
  })

  test("returns empty when no user message exists", () => {
    expect(buildTurnPrompt({ messages: [assistant("only assistant")] })).toBe("")
  })

  test("collects system prompt parts", () => {
    const context: Context = { systemPrompt: ["a", " ", "b"], messages: [] }
    expect(systemPrefix(context)).toBe("a\n\nb")
  })
})
