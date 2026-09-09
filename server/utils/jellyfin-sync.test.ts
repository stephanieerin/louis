import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildM3u8Contents,
  extensionForYotoFormat,
  extractSha256FromYotoTrackUrl,
} from './jellyfin-sync.ts'

const SHA = 'a'.repeat(64)

describe('extractSha256FromYotoTrackUrl', () => {
  it('parses a well-formed yoto:# trackUrl', () => {
    assert.equal(extractSha256FromYotoTrackUrl(`yoto:#${SHA}`), SHA)
  })

  it('accepts uppercase hex', () => {
    assert.equal(extractSha256FromYotoTrackUrl(`yoto:#${SHA.toUpperCase()}`), SHA.toUpperCase())
  })

  it('rejects missing, malformed, or non-yoto URLs', () => {
    assert.equal(extractSha256FromYotoTrackUrl(undefined), null)
    assert.equal(extractSha256FromYotoTrackUrl(''), null)
    assert.equal(extractSha256FromYotoTrackUrl('https://example.com/track.mp3'), null)
    assert.equal(extractSha256FromYotoTrackUrl('yoto:#not-a-hash'), null)
    assert.equal(extractSha256FromYotoTrackUrl(`yoto:#${SHA.slice(0, 10)}`), null)
  })
})

describe('extensionForYotoFormat', () => {
  it('maps known formats', () => {
    assert.equal(extensionForYotoFormat('aac'), '.m4a')
    assert.equal(extensionForYotoFormat('mp3'), '.mp3')
    assert.equal(extensionForYotoFormat('opus'), '.opus')
  })

  it('is case-insensitive', () => {
    assert.equal(extensionForYotoFormat('MP3'), '.mp3')
  })

  it('defaults unknown/missing formats to .m4a', () => {
    assert.equal(extensionForYotoFormat('sasquatch'), '.m4a')
    assert.equal(extensionForYotoFormat(undefined), '.m4a')
    assert.equal(extensionForYotoFormat(''), '.m4a')
  })
})

describe('buildM3u8Contents', () => {
  it('writes a standard EXTM3U header, playlist title, and one EXTINF+path pair per track', () => {
    const result = buildM3u8Contents('My Playlist', [
      { title: 'Intro', durationSeconds: 90, relativePath: '/media/music/a.m4a' },
      { title: 'Track Two', durationSeconds: 125, relativePath: '/media/music/b.m4a' },
    ])
    assert.equal(result, [
      '#EXTM3U',
      '#PLAYLIST:My Playlist',
      '#EXTINF:90,Intro',
      '/media/music/a.m4a',
      '#EXTINF:125,Track Two',
      '/media/music/b.m4a',
      '',
    ].join('\n'))
  })

  it('writes -1 for missing/invalid duration, matching the M3U convention for unknown length', () => {
    const result = buildM3u8Contents('P', [
      { title: 'No duration', relativePath: '/x.m4a' },
      { title: 'Zero duration', durationSeconds: 0, relativePath: '/y.m4a' },
    ])
    assert.match(result, /#EXTINF:-1,No duration/)
    assert.match(result, /#EXTINF:-1,Zero duration/)
  })

  it('produces an empty-but-valid playlist for zero tracks', () => {
    assert.equal(buildM3u8Contents('Empty', []), '#EXTM3U\n#PLAYLIST:Empty\n')
  })
})
