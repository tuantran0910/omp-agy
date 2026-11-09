/** Runtime configuration, read once when the extension loads. */

export type AgyMode = "plan" | "accept-edits" | "auto"

export interface AgyConfig {
  binary: string
  mode: AgyMode
  timeoutMs: number
  extraArgs: string[]
}

export const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000

function stringValue(env: NodeJS.ProcessEnv, name: string): string | undefined {
  const value = env[name]
  return value !== undefined && value !== "" ? value : undefined
}

function numberValue(env: NodeJS.ProcessEnv, name: string): number | undefined {
  const raw = stringValue(env, name)
  if (raw === undefined) return undefined
  const value = Number(raw)
  return Number.isFinite(value) && value > 0 ? value : undefined
}

function modeValue(env: NodeJS.ProcessEnv): AgyMode {
  const mode = stringValue(env, "AGY_MODE")
  return mode === "accept-edits" || mode === "auto" || mode === "plan" ? mode : "plan"
}

const FORBIDDEN_ARG_PREFIXES = [
  "--dangerously-skip-permissions",
  "--input-format",
  "--output-format",
  "--print",
  "--prompt",
  "--model",
  "--conversation",
  "--add-dir",
  "--settings",
] as const

function parseExtraArgs(raw: string | undefined): string[] {
  if (raw === undefined) return []
  const args = raw.split(" ").filter((arg) => arg !== "")
  for (const arg of args) {
    if (
      arg === "-p" ||
      FORBIDDEN_ARG_PREFIXES.some((prefix) => arg === prefix || arg.startsWith(`${prefix}=`))
    ) {
      throw new Error(`AGY_ARGS may not override protocol or permission flags: ${arg}`)
    }
  }
  return args
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AgyConfig {
  return {
    binary: stringValue(env, "AGY_BINARY") ?? "agy",
    mode: modeValue(env),
    timeoutMs: numberValue(env, "AGY_TIMEOUT_MS") ?? DEFAULT_TIMEOUT_MS,
    extraArgs: parseExtraArgs(stringValue(env, "AGY_ARGS")),
  }
}
