#!/usr/bin/env node
/**
 * Fill GH_TOKEN from `gh auth token` when unset, then run release-it.
 * release-it does not read gh's keyring; CI still creates the Release if this fails.
 */
import { execFileSync, spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

if (!process.env.GH_TOKEN && !process.env.GITHUB_TOKEN) {
  try {
    const token = execFileSync('gh', ['auth', 'token'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    if (token) process.env.GH_TOKEN = token
  }
  catch {
    console.warn(
      '[release] No GH_TOKEN/GITHUB_TOKEN and `gh auth token` failed. '
      + 'GitHub Release may be skipped locally; CI will create it from CHANGELOG.md.',
    )
  }
}

const releaseIt = fileURLToPath(new URL('../../node_modules/release-it/bin/release-it.js', import.meta.url))
const child = spawn(process.execPath, [releaseIt, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env,
})
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  process.exit(code ?? 1)
})
