import { describe, expect, test } from "bun:test"
import { KNOWN_MODELS, parseModelsOutput } from "../../src/agy/models.js"

describe("model discovery", () => {
  test("parses tab-separated agy models output", () => {
    const output = [
      "Fetching available models...",
      "gemini-3.8-flash-low\tGemini 3.8 Flash (Low)",
      "gemini-4-argon-medium\tGemini 4 Argon (Medium)",
      "",
    ].join("\n")
    expect(parseModelsOutput(output)).toEqual([
      { id: "gemini-3.8-flash-low", name: "Gemini 3.8 Flash (Low)" },
      { id: "gemini-4-argon-medium", name: "Gemini 4 Argon (Medium)" },
    ])
  })

  test("falls back to the slug when no display name is present", () => {
    expect(parseModelsOutput("custom-model\n")).toEqual([{ id: "custom-model", name: "custom-model" }])
  })

  test("bundled snapshot matches the installed slug shape", () => {
    expect(KNOWN_MODELS.length).toBeGreaterThan(0)
    for (const model of KNOWN_MODELS) expect(model.id).toMatch(/^[a-z0-9.-]+$/)
  })
})
