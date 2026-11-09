/** Slash commands exposed by the extension. */
import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent"
import { loadModels, loadUsage, loadVersion } from "../agy/models.js"
import type { AgySessionManager } from "../agy/session.js"

export interface CommandDeps {
  binary: string
  manager: AgySessionManager
}

export function registerCommands(pi: ExtensionAPI, deps: CommandDeps): void {
  const { binary, manager } = deps

  pi.registerCommand("agy-models", {
    description: "List Antigravity models reported by the installed agy CLI",
    handler: async (_args, ctx) => {
      const live = await loadModels(binary)
      const lines = live.map((model) => `  ${model.id.padEnd(28)} ${model.name}`)
      ctx.ui.notify(`agy models (${live.length}):\n${lines.join("\n")}`, "info")
    },
  })

  pi.registerCommand("agy-usage", {
    description: "Show Antigravity quota meters from `agy -p /usage`",
    handler: async (_args, ctx) => {
      const usage = await loadUsage(binary)
      ctx.ui.notify(usage === "" ? "agy /usage returned nothing" : usage, "info")
    },
  })

  pi.registerCommand("agy-cost", {
    description: "Show this session's agy token totals (cache hits included)",
    handler: async (_args, ctx) => {
      const stats = manager.statsSnapshot()
      const promptTokens = stats.cacheRead + stats.input
      const cacheShare = promptTokens > 0 ? (stats.cacheRead / promptTokens) * 100 : 0
      ctx.ui.notify(
        [
          `agy sessions: ${stats.sessions} (created ${stats.created})`,
          `input: ${stats.input.toLocaleString()}  output: ${stats.output.toLocaleString()}  cache-read: ${stats.cacheRead.toLocaleString()} (${cacheShare.toFixed(1)}% of prompt)`,
          "Cost is quota-based; watch /agy-usage rather than USD.",
        ].join("\n"),
        "info",
      )
    },
  })

  pi.registerCommand("agy-doctor", {
    description: "Check the agy binary, version, model list, and quota meters",
    handler: async (_args, ctx) => {
      const [version, live, usage] = await Promise.all([
        loadVersion(binary),
        loadModels(binary),
        loadUsage(binary),
      ])
      ctx.ui.notify(
        [`binary: ${binary}`, `version: ${version}`, `models: ${live.length}`, "", usage].join("\n"),
        "info",
      )
    },
  })
}
