/** Default track title derived from an uploaded file's name. */
export function titleFromUploadFilename(filename: string): string {
  const withoutExt = filename.replace(/\.[^./\\]+$/, '')
  const spaced = withoutExt.replace(/[_-]+/g, ' ').trim()
  return spaced || 'Untitled track'
}
