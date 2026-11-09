import { describe, expect, test } from "bun:test"
import { API_ID, PROVIDER_ID, providerModels } from "../src/provider/agy-provider.js"

describe("provider model metadata", () => {
  test("every registered model carries the ids OMP expects", () => {
    const models = providerModels()
    expect(models.length).toBeGreaterThan(0)
    for (const model of models) {
      expect(model.id).toMatch(/^[a-z0-9.-]+$/)
      expect(model.api).toBe(API_ID)
      expect(model.reasoning).toBe(true)
      expect(model.input).toEqual(["text"])
      expect(model.contextWindow).toBeGreaterThan(0)
      expect(model.maxTokens).toBeGreaterThan(0)
    }
    expect(PROVIDER_ID).toBe("agy")
  })

  test("reports zero cost because Antigravity bills against quota", () => {
    for (const model of providerModels()) {
      expect(model.cost).toEqual({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 })
    }
  })

  test("model ids are unique", () => {
    const ids = providerModels().map((model) => model.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
