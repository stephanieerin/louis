import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { titleFromUploadFilename } from './localUpload.ts'

describe('titleFromUploadFilename', () => {
  it('strips the extension and normalizes separators', () => {
    assert.equal(titleFromUploadFilename('my_favorite-song.mp3'), 'my favorite song')
  })

  it('trims whitespace left over after stripping', () => {
    assert.equal(titleFromUploadFilename('  track.mp3'), 'track')
  })

  it('falls back to a placeholder when the name is empty after stripping', () => {
    assert.equal(titleFromUploadFilename('.mp3'), 'Untitled track')
    assert.equal(titleFromUploadFilename('___.mp3'), 'Untitled track')
  })

  it('handles a filename with no extension', () => {
    assert.equal(titleFromUploadFilename('plain-name'), 'plain name')
  })
})
