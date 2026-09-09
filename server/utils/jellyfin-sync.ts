import { copyFile, mkdir, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { H3Event } from 'h3'

export interface JellyfinSyncConfig {
  /** Container-side path Louis writes exported audio into. */
  musicDir: string
  /** Container-side path Louis writes .m3u8 playlist files into. */
  playlistsDir: string
  /** Path prefix to write into m3u8 lines, as Jellyfin's own filesystem sees it. */
  pathPrefix: string
  /** Base URL for Jellyfin's API (e.g. http://jellyfin:8096) — optional, refresh-only. */
  baseUrl?: string
  /** Jellyfin API key — optional, used only to trigger Library/Refresh. */
  apiKey?: string
}

function trimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function resolveJellyfinSyncConfig(event?: H3Event): JellyfinSyncConfig | null {
  const config = event ? useRuntimeConfig(event) : useRuntimeConfig()
  const musicDir = trimmed(config.jellyfinMusicDir)
  const playlistsDir = trimmed(config.jellyfinPlaylistsDir)
  const pathPrefix = trimmed(config.jellyfinPathPrefix)
  if (!musicDir || !playlistsDir || !pathPrefix) return null

  return {
    musicDir,
    playlistsDir,
    pathPrefix: pathPrefix.replace(/\/+$/, ''),
    baseUrl: trimmed(config.jellyfinBaseUrl) || undefined,
    apiKey: trimmed(config.jellyfinApiKey) || undefined,
  }
}

export function isJellyfinSyncConfigured(event?: H3Event): boolean {
  return resolveJellyfinSyncConfig(event) !== null
}

const YOTO_TRACK_URL_PREFIX = 'yoto:#'
const SHA256_PATTERN = /^[a-f0-9]{64}$/i

/** Parses the sha256 out of Louis's own `yoto:#<sha256>` trackUrl scheme. */
export function extractSha256FromYotoTrackUrl(trackUrl?: string | null): string | null {
  if (!trackUrl || !trackUrl.startsWith(YOTO_TRACK_URL_PREFIX)) return null
  const sha256 = trackUrl.slice(YOTO_TRACK_URL_PREFIX.length).trim()
  return SHA256_PATTERN.test(sha256) ? sha256 : null
}

const FORMAT_TO_EXT: Record<string, string> = {
  aac: '.m4a',
  m4a: '.m4a',
  mp3: '.mp3',
  mpeg: '.mp3',
  opus: '.opus',
  ogg: '.ogg',
  wav: '.wav',
  flac: '.flac',
}

/** Best-effort file extension for a track with no fresh local file this save. */
export function extensionForYotoFormat(format?: string | null): string {
  const key = (format || '').trim().toLowerCase()
  return FORMAT_TO_EXT[key] || '.m4a'
}

export interface JellyfinSyncTrack {
  title: string
  durationSeconds?: number
  sha256: string | null
  ext: string
  /** Present only when this track's audio was freshly produced by this save. */
  freshLocalFilePath?: string
}

function audioFilePath(config: JellyfinSyncConfig, sha256: string, ext: string): string {
  return path.join(config.musicDir, `${sha256}${ext}`)
}

function m3u8FilePath(config: JellyfinSyncConfig, cardId: string): string {
  return path.join(config.playlistsDir, `${cardId}.m3u8`)
}

async function fileExists(filePath: string): Promise<boolean> {
  return stat(filePath).then(() => true).catch(() => false)
}

async function exportTrackAudio(
  config: JellyfinSyncConfig,
  sha256: string,
  ext: string,
  sourceFilePath: string,
): Promise<void> {
  await mkdir(config.musicDir, { recursive: true })
  const destPath = audioFilePath(config, sha256, ext)
  if (await fileExists(destPath)) return
  await copyFile(sourceFilePath, destPath)
}

function m3u8DurationField(seconds?: number): number {
  return Number.isFinite(seconds) && (seconds ?? 0) > 0 ? Math.round(seconds!) : -1
}

/** Pure text-building — kept separate from filesystem I/O so it's directly testable. */
export function buildM3u8Contents(
  cardTitle: string,
  tracks: Array<{ title: string, durationSeconds?: number, relativePath: string }>,
): string {
  const lines = ['#EXTM3U', `#PLAYLIST:${cardTitle}`]
  for (const track of tracks) {
    lines.push(`#EXTINF:${m3u8DurationField(track.durationSeconds)},${track.title}`)
    lines.push(track.relativePath)
  }
  return `${lines.join('\n')}\n`
}

export async function removeJellyfinPlaylist(config: JellyfinSyncConfig, cardId: string): Promise<void> {
  await rm(m3u8FilePath(config, cardId), { force: true })
}

export async function triggerJellyfinLibraryRefresh(config: JellyfinSyncConfig): Promise<void> {
  if (!config.baseUrl || !config.apiKey) return
  try {
    await fetch(`${config.baseUrl.replace(/\/+$/, '')}/Library/Refresh`, {
      method: 'POST',
      headers: { 'X-Emby-Token': config.apiKey },
    })
  }
  catch (err) {
    console.error('[jellyfin-sync] library refresh failed', err)
  }
}

/**
 * Rebuilds one Yoto card's Jellyfin playlist from scratch. Tracks with a
 * `freshLocalFilePath` get their audio (re-)exported into the content-addressed
 * pool; others are included only if a prior sync already exported that sha256
 * (the documented v1 gap: a never-yet-processed pre-existing track is skipped
 * until it's next re-extracted).
 */
export async function syncJellyfinPlaylist(
  event: H3Event | undefined,
  input: { cardId: string, cardTitle: string, tracks: JellyfinSyncTrack[] },
): Promise<void> {
  const config = resolveJellyfinSyncConfig(event)
  if (!config) return

  const resolved: Array<{ title: string, durationSeconds?: number, relativePath: string }> = []

  for (const track of input.tracks) {
    if (!track.sha256) continue

    if (track.freshLocalFilePath) {
      await exportTrackAudio(config, track.sha256, track.ext, track.freshLocalFilePath)
    }
    else if (!(await fileExists(audioFilePath(config, track.sha256, track.ext)))) {
      continue
    }

    resolved.push({
      title: track.title,
      durationSeconds: track.durationSeconds,
      relativePath: `${config.pathPrefix}/${track.sha256}${track.ext}`,
    })
  }

  await mkdir(config.playlistsDir, { recursive: true })
  await writeFile(m3u8FilePath(config, input.cardId), buildM3u8Contents(input.cardTitle, resolved))
  await triggerJellyfinLibraryRefresh(config)
}
