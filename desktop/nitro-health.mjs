const CHECK_KEYS = ['ytdlp', 'ffmpeg', 'ytdlpJsRuntime']

/**
 * Turn a non-OK `/api/health` body into a suffix for the desktop boot dialog.
 *
 * @param {number} status
 * @param {unknown} body
 */
export function formatDegradedHealthError(status, body) {
  const prefix = `HTTP ${status}`
  const checks = body && typeof body === 'object' ? /** @type {Record<string, any>} */ (body).checks : null
  if (!checks || typeof checks !== 'object') return prefix

  /** @type {string[]} */
  const details = []
  for (const key of CHECK_KEYS) {
    const check = checks[key]
    if (check && check.available === false) {
      details.push(`${key}: ${check.error || 'unavailable'}`)
    }
  }
  const audio = checks.audioWorkDir
  if (audio && audio.writable === false) {
    details.push(`audioWorkDir: ${audio.error || 'not writable'}`)
  }
  if (details.length === 0) return prefix
  return `${prefix}: ${details.join('; ')}`
}

/**
 * @param {string} healthUrl
 * @param {string} lastError
 */
export function formatHealthTimeoutMessage(healthUrl, lastError) {
  return `Nitro health check timed out (${healthUrl}): ${lastError}`
}
