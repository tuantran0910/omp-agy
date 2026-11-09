import { execFile } from "node:child_process"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

export interface AgyModelInfo {
  id: string
  name: string
}

/**
 * Fallback list captured from `agy models` (agy 1.5.3). Kept as a fallback so
 * provider registration never blocks on a subprocess; `loadModels()` refreshes
 * it from the installed binary.
 */
export const KNOWN_MODELS: readonly AgyModelInfo[] = [
  { id: "gemini-4-argon-low", name: "Gemini 4 Argon (Low)" },
  { id: "gemini-4-argon-medium", name: "Gemini 4 Argon (Medium)" },
  { id: "gemini-4-argon-high", name: "Gemini 4 Argon (High)" },
  { id: "gemini-3.8-flash-low", name: "Gemini 3.8 Flash (Low)" },
  { id: "gemini-3.8-flash-medium", name: "Gemini 3.8 Flash (Medium)" },
  { id: "gemini-3.8-flash-high", name: "Gemini 3.8 Flash (High)" },
  { id: "claude-opus-5-5-low", name: "Claude Opus 5.5 (Low)" },
  { id: "claude-opus-5-5-medium", name: "Claude Opus 5.5 (Medium)" },
  { id: "claude-opus-5-5-high", name: "Claude Opus 5.5 (High)" },
  { id: "claude-sonnet-5-5-low", name: "Claude Sonnet 5.5 (Low)" },
  { id: "claude-sonnet-5-5-medium", name: "Claude Sonnet 5.5 (Medium)" },
  { id: "claude-sonnet-5-5-high", name: "Claude Sonnet 5.5 (High)" },
  { id: "gpt-oss-120b-medium", name: "GPT-OSS 120B (Medium)" },
]

/** Parses `agy models` output: `slug<TAB>Display Name` per line. */
export function parseModelsOutput(text: string): AgyModelInfo[] {
  const models: AgyModelInfo[] = []
  for (const line of text.split("\n")) {
    const [slug, ...rest] = line.split("\t")
    const id = slug?.trim() ?? ""
    if (id === "" || id.startsWith("Fetching")) continue
    const name = rest.join(" ").trim() || id
    models.push({ id, name })
  }
  return models
}

/** Reads the live model list; falls back to the bundled snapshot on failure. */
export async function loadModels(binary: string, timeoutMs = 15_000): Promise<AgyModelInfo[]> {
  try {
    const { stdout } = await execFileAsync(binary, ["models"], { timeout: timeoutMs })
    const models = parseModelsOutput(stdout)
    return models.length > 0 ? models : [...KNOWN_MODELS]
  } catch {
    return [...KNOWN_MODELS]
  }
}

/** Quota meters from `agy -p /usage`, one line each. */
export async function loadUsage(binary: string, timeoutMs = 20_000): Promise<string> {
  try {
    const { stdout } = await execFileAsync(binary, ["-p", "/usage"], { timeout: timeoutMs })
    return stdout.trim()
  } catch (error) {
    const failed = error as { stdout?: string; stderr?: string; message?: string }
    return (failed.stdout ?? failed.stderr ?? failed.message ?? "agy /usage failed").trim()
  }
}

export async function loadVersion(binary: string, timeoutMs = 10_000): Promise<string> {
  try {
    const { stdout } = await execFileAsync(binary, ["--version"], { timeout: timeoutMs })
    return stdout.trim()
  } catch {
    return "unknown"
  }
}
