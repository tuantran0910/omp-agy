import type { Context, Message } from "@oh-my-pi/pi-ai"

/** Extracts plain text from a single OMP message. */
export function messageText(message: Message): string {
  if (message.role === "user") {
    const content = message.content
    if (typeof content === "string") return content
    return content
      .filter((block): block is { type: "text"; text: string } => block.type === "text")
      .map((block) => block.text)
      .join("\n")
  }
  if (message.role === "developer") {
    const content = message.content
    if (typeof content === "string") return content
    return content
      .filter((block): block is { type: "text"; text: string } => block.type === "text")
      .map((block) => block.text)
      .join("\n")
  }
  return ""
}

/** Latest user turn in the transcript, or "" when none exists. */
export function latestUserText(messages: readonly Message[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message && message.role === "user") return messageText(message)
  }
  return ""
}

/**
 * Builds the text for one agy turn.
 *
 * Only the latest user message travels to agy: the child keeps its own
 * conversation, and replaying OMP's tool schemas, tool results, or prior
 * assistant turns would duplicate context and break its transcript.
 * The system prompt is prepended by the session on its first turn only, which
 * keeps the prompt prefix stable so agy's cache can hit on every later turn.
 */
export function buildTurnPrompt(context: Context): string {
  return latestUserText(context.messages)
}

export function systemPrefix(context: Context): string {
  const parts = context.systemPrompt ?? []
  return parts.filter((part) => part.trim() !== "").join("\n\n")
}
