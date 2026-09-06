import { YOTO_MYO_MAX_TRACK_BYTES } from '#shared/myo-editor/yotoMyoLimits'
import { titleFromUploadFilename } from '#shared/myo-editor/localUpload'
import { hasContentManageScope } from '../../utils/yoto-auth'
import { getYotoAuthScope } from '../../utils/yoto'
import { ingestLocalAudioFile } from '../../utils/local-audio-upload'
import { probeAudioDurationSeconds } from '../../utils/ffmpeg-split'

function looksLikeMp3(buffer: Buffer): boolean {
  if (buffer.length < 4) return false
  if (buffer.subarray(0, 3).toString('latin1') === 'ID3') return true
  // MPEG audio frame sync: 11 set bits, then a valid MPEG version/layer.
  return buffer[0] === 0xFF && (buffer[1]! & 0xE0) === 0xE0
}

export default defineEventHandler(async (event) => {
  const scope = getYotoAuthScope(event)
  if (!hasContentManageScope(scope)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Reconnect to Yoto to grant playlist edit permission (user:content:manage).',
    })
  }

  const form = await readMultipartFormData(event)
  if (!form?.length) {
    throw createError({ statusCode: 400, statusMessage: 'Expected multipart form with a file field' })
  }

  const filePart = form.find(part => part.name === 'file' && part.data?.length)
  if (!filePart) {
    throw createError({ statusCode: 400, statusMessage: 'Missing file' })
  }

  const buffer = Buffer.from(filePart.data)
  if (buffer.length === 0 || buffer.length > YOTO_MYO_MAX_TRACK_BYTES) {
    throw createError({
      statusCode: 413,
      statusMessage: `File size out of range (max ${Math.round(YOTO_MYO_MAX_TRACK_BYTES / 1_000_000)} MB)`,
    })
  }

  if (!looksLikeMp3(buffer)) {
    throw createError({ statusCode: 400, statusMessage: 'Not a recognizable MP3 file' })
  }

  const filename = (filePart.filename || 'upload.mp3').trim() || 'upload.mp3'
  const ingested = await ingestLocalAudioFile(event, buffer, filename)
  const durationSeconds = await probeAudioDurationSeconds(ingested.filePath)

  return {
    fileRef: ingested.sha256,
    filename,
    title: titleFromUploadFilename(filename),
    durationSeconds: durationSeconds ?? undefined,
  }
})
