import { createHash } from 'node:crypto'
import { mkdir, readdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { H3Event } from 'h3'
import { getUploadsDir, resolveAudioWorkDirConfig } from './audio-work-dir'
import type { DownloadedAudio } from './youtube-download'

function extensionFor(originalFilename: string): string {
  const ext = path.extname(originalFilename).toLowerCase()
  return ext && ext.length <= 5 ? ext : '.mp3'
}

/**
 * Writes an uploaded audio buffer into the upload cache, content-addressed by
 * sha256 (there is no youtubeId to key on). Returns the same DownloadedAudio
 * shape youtube-download.ts uses, so it drops into the save pipeline unchanged.
 */
export async function ingestLocalAudioFile(
  event: H3Event | undefined,
  buffer: Buffer,
  originalFilename: string,
): Promise<DownloadedAudio> {
  const { audioWorkDir } = resolveAudioWorkDirConfig(event)
  const uploadsDir = getUploadsDir(audioWorkDir)
  await mkdir(uploadsDir, { recursive: true })

  const sha256 = createHash('sha256').update(buffer).digest('hex')
  const filename = `${sha256}${extensionFor(originalFilename)}`
  const filePath = path.join(uploadsDir, filename)

  const fromCache = await stat(filePath).then(() => true).catch(() => false)
  if (!fromCache) {
    await writeFile(filePath, buffer)
  }

  return { filePath, filename, sha256, fromCache }
}

/** Looks up a previously-ingested upload by its sha256 fileRef at save time. */
export async function findIngestedLocalAudioFile(
  audioWorkDir: string,
  fileRef: string,
): Promise<DownloadedAudio | null> {
  const uploadsDir = getUploadsDir(audioWorkDir)
  let entries: string[]
  try {
    entries = await readdir(uploadsDir)
  }
  catch {
    return null
  }

  const match = entries.find(name => name.startsWith(fileRef))
  if (!match) return null

  return {
    filePath: path.join(uploadsDir, match),
    filename: match,
    sha256: fileRef,
    fromCache: true,
  }
}
