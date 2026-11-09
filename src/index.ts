/**
 * omp-agy — OMP extension + provider for Google Antigravity CLI (`agy`).
 *
 * Entry point only: configuration, provider registration, commands, cleanup.
 * Transport details live in `agy/`, provider shaping in `provider/`.
 */
import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent"
import { AgySessionManager } from "./agy/session.js"
import { registerCommands } from "./commands/index.js"
import { loadConfig } from "./config.js"
import {
  API_ID,
  createStreamSimple,
  PROVIDER_BASE_URL,
  PROVIDER_ID,
  providerModels,
} from "./provider/agy-provider.js"

export type { AgyEvent, AgyResultEnvelope, AgyUsage } from "./agy/protocol.js"
export { AgyError, AgySession, AgySessionManager } from "./agy/session.js"
export { API_ID, PROVIDER_ID } from "./provider/agy-provider.js"

export default function agyExtension(pi: ExtensionAPI): void {
  const config = loadConfig()
  const manager = new AgySessionManager({
    binary: config.binary,
    mode: config.mode,
    timeoutMs: config.timeoutMs,
    extraArgs: config.extraArgs,
  })

  pi.registerProvider(PROVIDER_ID, {
    baseUrl: PROVIDER_BASE_URL,
    apiKey: "unused-by-extension",
    api: API_ID,
    streamSimple: createStreamSimple(manager),
    models: providerModels(),
  })

  registerCommands(pi, { binary: config.binary, manager })

  const shutdown = (): void => manager.closeAll()
  process.once("exit", shutdown)
  // Re-raise after cleanup: installing a SIGTERM listener suppresses Node's
  // default termination, so the process must keep dying the way OMP expects.
  const onSigterm = (): void => {
    shutdown()
    process.removeListener("SIGTERM", onSigterm)
    process.kill(process.pid, "SIGTERM")
  }
  process.once("SIGTERM", onSigterm)
}
