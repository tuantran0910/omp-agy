import { describe, expect, test } from "bun:test"
import { NdjsonLineBuffer, parseEvent } from "../../src/agy/protocol.js"

describe("NdjsonLineBuffer", () => {
  test("reassembles a JSON object split across chunks", () => {
    const buffer = new NdjsonLineBuffer()
    expect(buffer.push('{"event":"init","conversation_id":"a')).toEqual([])
    expect(buffer.push('bc"}\n{"event":"result"}\n')).toEqual([
      '{"event":"init","conversation_id":"abc"}',
      '{"event":"result"}',
    ])
  })

  test("flush emits a trailing partial line", () => {
    const buffer = new NdjsonLineBuffer()
    buffer.push('{"event":"result"}')
    expect(buffer.flush()).toEqual(['{"event":"result"}'])
    expect(buffer.flush()).toEqual([])
  })
})

describe("parseEvent", () => {
  test("parses an event line", () => {
    const event = parseEvent('{"event":"step_update","step_update":{"text_delta":"hi"}}')
    expect(event?.event).toBe("step_update")
    expect(event?.step_update?.text_delta).toBe("hi")
  })

  test("ignores invalid or shapeless lines", () => {
    expect(parseEvent("not json")).toBeNull()
    expect(parseEvent("[1,2,3]")).toBeNull()
    expect(parseEvent('{"no_event":true}')).toBeNull()
  })
})
