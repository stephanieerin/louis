/**
 * Parse yt-dlp `--js-runtimes` value: `RUNTIME` or `RUNTIME:PATH`
 * (Windows paths keep their drive colon).
 * @param {string} spec
 * @returns {{ runtime: string, binaryPath: string | null }}
 */
export function parseYtdlpJsRuntimeSpec(spec) {
  const trimmed = String(spec || '').trim()
  const colon = trimmed.indexOf(':')
  if (colon <= 0) {
    return { runtime: trimmed || 'node', binaryPath: null }
  }
  return {
    runtime: trimmed.slice(0, colon),
    binaryPath: trimmed.slice(colon + 1) || null,
  }
}
