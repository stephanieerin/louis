/**
 * Health-probe helpers for yt-dlp's JS runtime (Electron-as-node / node.cmd).
 * Kept out of server/ so unit tests do not import Nitro modules.
 */
import { existsSync } from 'node:fs'

const PROBE_TIMEOUT_MS = 15_000

/**
 * @param {string} binaryPath
 */
export function jsRuntimeUsesShell(binaryPath) {
  return /\.(cmd|bat)$/i.test(binaryPath)
}

/**
 * execFile options for probing a JS runtime binary (Windows `.cmd` needs a shell).
 * @param {string} binaryPath
 * @param {NodeJS.ProcessEnv} [env]
 */
export function jsRuntimeExecOptions(binaryPath, env = process.env) {
  /** @type {{ timeout: number, env: NodeJS.ProcessEnv, shell?: boolean }} */
  const options = {
    timeout: PROBE_TIMEOUT_MS,
    env: { ...env, ELECTRON_RUN_AS_NODE: '1' },
  }
  if (jsRuntimeUsesShell(binaryPath)) options.shell = true
  return options
}

/**
 * Desktop Nitro is already Electron-as-node — do not spawn `node.cmd` for health.
 * Returns null when this process is not that runtime (Docker / native Node).
 *
 * @param {string} runtime
 * @param {string | null} binaryPath
 * @param {{
 *   env?: NodeJS.ProcessEnv,
 *   version?: string,
 *   execPath?: string,
 *   pathExists?: (filePath: string) => boolean,
 * }} [options]
 * @returns {{ available: true, path: string, version: string } | { available: false, error: string } | null}
 */
export function electronAsNodeProbe(runtime, binaryPath, options = {}) {
  const env = options.env ?? process.env
  const version = options.version ?? process.version
  if (runtime !== 'node' || !env.ELECTRON_RUN_AS_NODE || !version) return null

  if (binaryPath) {
    const exists = (options.pathExists ?? existsSync)(binaryPath)
    if (!exists) {
      return { available: false, error: `JS runtime not executable at ${binaryPath}` }
    }
    return { available: true, path: binaryPath, version }
  }

  return { available: true, path: options.execPath ?? process.execPath, version }
}
