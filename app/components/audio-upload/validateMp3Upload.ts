import { YOTO_MYO_MAX_TRACK_BYTES } from '#shared/myo-editor/yotoMyoLimits'

export const MP3_UPLOAD_ACCEPT = 'audio/mpeg,audio/mp3,.mp3'

const ALLOWED_MIME = new Set(['audio/mpeg', 'audio/mp3'])

export interface Mp3UploadValidation {
  ok: boolean
  error?: string
}

function hasMp3Extension(filename: string): boolean {
  return filename.toLowerCase().endsWith('.mp3')
}

export function validateMp3Upload(file: File): Mp3UploadValidation {
  if (!file || file.size <= 0) {
    return { ok: false, error: 'Choose an MP3 file to upload.' }
  }

  const mime = (file.type || '').toLowerCase()
  if (!(mime && ALLOWED_MIME.has(mime)) && !hasMp3Extension(file.name)) {
    return { ok: false, error: 'Choose an MP3 file.' }
  }

  if (file.size > YOTO_MYO_MAX_TRACK_BYTES) {
    const maxMb = Math.round(YOTO_MYO_MAX_TRACK_BYTES / 1_000_000)
    return { ok: false, error: `File is too large (max ${maxMb} MB).` }
  }

  return { ok: true }
}
