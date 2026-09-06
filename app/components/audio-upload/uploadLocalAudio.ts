export interface LocalAudioUploadResult {
  fileRef: string
  filename: string
  title: string
  durationSeconds?: number
}

export async function uploadLocalAudioFile(file: File): Promise<LocalAudioUploadResult> {
  const form = new FormData()
  form.append('file', file, file.name)

  return await $fetch<LocalAudioUploadResult>('/api/audio/upload', {
    method: 'POST',
    body: form,
  })
}

export function localAudioUploadError(err: unknown, fallback: string): string {
  const e = err as { data?: { statusMessage?: string }, statusMessage?: string, message?: string }
  const text = e?.data?.statusMessage ?? e?.statusMessage ?? e?.message ?? fallback
  return text.trim() || fallback
}
