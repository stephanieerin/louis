import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { H3Event } from 'h3'
import { createError } from 'h3'
import {
  classifyYtdlpStderr,
  formatYtdlpError,
  shouldEscalateToCookies,
} from '../../shared/myo-editor/ytdlpErrors.ts'
import { resolveYtdlpBinary } from './ytdlp-binary.ts'
import { resolveYtdlpCookiesArgs } from './ytdlp-cookies.ts'
import { ytdlpJsRuntimeArgs } from './ytdlp-js-runtime.ts'

const execFileAsync = promisify(execFile)

const YTDLP_DISCOVERY_TIMEOUT_MS = 30_000
const YTDLP_DISCOVERY_MAX_BUFFER = 12 * 1024 * 1024
const YTDLP_DISCOVERY_CONCURRENCY = 2

let activeDiscovery = 0
const discoveryWaiters: Array<() => void> = []

async function withDiscoverySlot<T>(fn: () => Promise<T>): Promise<T> {
  if (activeDiscovery >= YTDLP_DISCOVERY_CONCURRENCY) {
    await new Promise<void>(resolve => discoveryWaiters.push(resolve))
  }
  activeDiscovery += 1
  try {
    return await fn()
  }
  finally {
    activeDiscovery -= 1
    discoveryWaiters.shift()?.()
  }
}

interface YtdlpDumpEntry {
  id?: string
  title?: string
  description?: string
  channel?: string
  uploader?: string
  channel_id?: string
  thumbnail?: string
  thumbnails?: Array<{ url?: string }>
  duration?: number | null
  upload_date?: string
  live_status?: string
  availability?: string
  playlist_count?: number
  n_entries?: number
  entries?: Array<YtdlpDumpEntry | null>
  webpage_url?: string
  original_url?: string
  _type?: string
}

export interface RunYtdlpJsonOptions {
  event?: H3Event
  args: string[]
  cacheKey: string
}

type ExecFileError = {
  stderr?: string
  stdout?: string
  message?: string
  killed?: boolean
}

function stderrFromError(err: unknown): string {
  const e = err as ExecFileError
  return String(e.stderr || e.message || '')
}

function throwDiscoveryError(
  stderr: string,
  options?: { killed?: boolean, cookiesTried?: boolean },
): never {
  if (options?.killed) {
    throw createError({
      statusCode: 504,
      message: 'YouTube lookup timed out. Try again in a moment.',
    })
  }
  const errorClass = classifyYtdlpStderr(stderr)
  const formatOptions = { cookiesTried: options?.cookiesTried, kind: 'lookup' as const }
  if (errorClass === 'bot_signin') {
    throw createError({
      statusCode: 502,
      message: formatYtdlpError(stderr, 'discovery', formatOptions),
    })
  }
  if (errorClass === 'private') {
    throw createError({
      statusCode: 404,
      message: 'This YouTube playlist or video is private.',
    })
  }
  if (errorClass === 'unavailable') {
    throw createError({
      statusCode: 404,
      message: 'YouTube content was not found or is not public.',
    })
  }
  throw createError({
    statusCode: 502,
    message: formatYtdlpError(stderr, 'discovery', formatOptions),
  })
}

async function execYtdlpJson(
  binaryPath: string,
  args: string[],
): Promise<string> {
  const { stdout } = await execFileAsync(binaryPath, args, {
    timeout: YTDLP_DISCOVERY_TIMEOUT_MS,
    maxBuffer: YTDLP_DISCOVERY_MAX_BUFFER,
  })
  return stdout
}

function parseDump(stdout: string): YtdlpDumpEntry {
  const trimmed = stdout.trim()
  if (!trimmed) {
    throw createError({
      statusCode: 502,
      message: 'YouTube lookup returned no data.',
    })
  }
  try {
    return JSON.parse(trimmed) as YtdlpDumpEntry
  }
  catch {
    const entries: YtdlpDumpEntry[] = []
    for (const line of trimmed.split('\n')) {
      const piece = line.trim()
      if (!piece) continue
      try {
        entries.push(JSON.parse(piece) as YtdlpDumpEntry)
      }
      catch {
        throw createError({
          statusCode: 502,
          message: 'YouTube lookup returned invalid data.',
        })
      }
    }
    if (entries.length === 1) return entries[0]!
    if (entries.length > 1) return { entries }
    throw createError({
      statusCode: 502,
      message: 'YouTube lookup returned invalid data.',
    })
  }
}

/**
 * Run yt-dlp `-J` for discovery (search / playlist / channel / video metadata).
 * Anonymous first; one android client retry on bot-check, then cookies on bot / hard 403 / age-gate.
 */
export async function runYtdlpJson(options: RunYtdlpJsonOptions): Promise<YtdlpDumpEntry> {
  return withDiscoverySlot(async () => {
    const ytdlp = await resolveYtdlpBinary(options.event)
    const cookiesArgs = await resolveYtdlpCookiesArgs(options.event)
    const jsRuntimeArgs = ytdlpJsRuntimeArgs(options.event)
    const baseArgs = [
      ...jsRuntimeArgs,
      '--skip-download',
      '--no-warnings',
      '--ignore-no-formats-error',
      '-J',
      ...options.args,
    ]

    type DiscoveryAttempt = { cookies: boolean, playerClient: string | null }
    const attempts: DiscoveryAttempt[] = [{ cookies: false, playerClient: null }]
    if (cookiesArgs.length > 0) attempts.push({ cookies: true, playerClient: null })

    let lastStderr = ''
    let lastKilled = false
    let cookiesTried = false
    let insertedAndroid = false

    for (let i = 0; i < attempts.length; i++) {
      const attempt = attempts[i]!
      if (attempt.cookies) cookiesTried = true
      const clientArgs = attempt.playerClient
        ? ['--extractor-args', `youtube:player_client=${attempt.playerClient}`]
        : []
      const args = attempt.cookies
        ? [...cookiesArgs, ...clientArgs, ...baseArgs]
        : [...clientArgs, ...baseArgs]
      try {
        const stdout = await execYtdlpJson(ytdlp.path, args)
        return parseDump(stdout)
      }
      catch (err: unknown) {
        const e = err as ExecFileError & { statusCode?: number }
        if (e.statusCode) throw err
        lastStderr = stderrFromError(err)
        lastKilled = Boolean(e.killed)
        const errorClass = classifyYtdlpStderr(lastStderr)

        if (
          errorClass === 'bot_signin'
          && !attempt.cookies
          && !attempt.playerClient
          && !insertedAndroid
        ) {
          insertedAndroid = true
          attempts.splice(i + 1, 0, { cookies: false, playerClient: 'android' })
          console.info(`[yt-dlp] discovery retry client=android reason=bot_signin key=${options.cacheKey}`)
          continue
        }

        const canEscalate = !attempt.cookies
          && cookiesArgs.length > 0
          && shouldEscalateToCookies(errorClass, lastStderr)
        if (canEscalate) {
          console.info(`[yt-dlp] discovery escalate reason=${errorClass} key=${options.cacheKey}`)
          continue
        }
        throwDiscoveryError(lastStderr, { killed: lastKilled, cookiesTried })
      }
    }

    throwDiscoveryError(lastStderr, { killed: lastKilled, cookiesTried })
  })
}
