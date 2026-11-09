/** NDJSON protocol emitted by `agy --output-format stream-json` (verified against agy 1.5.3). */

export interface AgyUsage {
  input_tokens?: number
  output_tokens?: number
  thinking_tokens?: number
  cache_read_tokens?: number
  total_tokens?: number
}

export interface AgyStepUpdate {
  conversation_id?: string
  step_index?: number
  state?: string
  step_type?: string
  text_delta?: string
  duration_seconds?: number
  usage?: AgyUsage
  tool_name?: string
}

export interface AgyResultEnvelope {
  conversation_id?: string
  status?: string
  response?: string
  error?: string
  duration_seconds?: number
  num_turns?: number
  usage?: AgyUsage
}

export interface AgyEvent {
  event: string
  conversation_id?: string
  step_update?: AgyStepUpdate
  result?: AgyResultEnvelope
}

/**
 * Splits a byte stream into NDJSON lines.
 *
 * A chunk boundary can fall inside a JSON object, so partial lines are kept
 * until their terminating newline arrives. Dropping them is what makes the
 * naive `chunk.split("\n")` parser lose events.
 */
export class NdjsonLineBuffer {
  private buffer = ""

  push(chunk: string): string[] {
    this.buffer += chunk
    const lines: string[] = []
    let index = this.buffer.indexOf("\n")
    while (index !== -1) {
      const line = this.buffer.slice(0, index).trim()
      if (line !== "") lines.push(line)
      this.buffer = this.buffer.slice(index + 1)
      index = this.buffer.indexOf("\n")
    }
    return lines
  }

  flush(): string[] {
    const line = this.buffer.trim()
    this.buffer = ""
    return line === "" ? [] : [line]
  }
}

export function parseEvent(line: string): AgyEvent | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(line)
  } catch {
    return null
  }
  if (typeof parsed !== "object" || parsed === null) return null
  const event = "event" in parsed ? parsed.event : undefined
  if (typeof event !== "string") return null
  // Boundary cast: the event name is validated; payload fields are narrowed by
  // each consumer before use.
  const eventLine = parsed as AgyEvent
  return eventLine
}
