/**
 * Desktop `--js-runtimes` spec for yt-dlp.
 * Windows: Louis.exe (PE) so health and yt-dlp do not CreateProcess a .cmd.
 * macOS / Linux: shebang shim in the audio bin dir.
 *
 * @param {string} platform
 * @param {string} execPath Electron / Louis binary
 * @param {string} nodeShimPath unix `node` or win `node.cmd` on PATH
 */
export function ytdlpJsRuntimeSpecForDesktop(platform, execPath, nodeShimPath) {
  if (platform === 'win32') return `node:${execPath}`
  return `node:${nodeShimPath}`
}
