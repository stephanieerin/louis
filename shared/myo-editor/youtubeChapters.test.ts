import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { PlaylistTrack } from './types.ts'
import {
  canChapterSplitTrack,
  chapterSplitTrackId,
  chapterTrackTitle,
  chaptersToPlaylistTracks,
  isValidYoutubeChapters,
  type YoutubeChapter,
} from './youtubeChapters.ts'

function track(overrides: Partial<PlaylistTrack> = {}): PlaylistTrack {
  return {
    id: 'abcdefghijk',
    title: 'A long video',
    subtitle: '',
    thumbnailUrl: '',
    source: 'app-youtube',
    youtubeId: 'abcdefghijk',
    duration: 300,
    ...overrides,
  }
}

const CHAPTERS: YoutubeChapter[] = [
  { title: 'Intro', startSeconds: 0, endSeconds: 120 },
  { title: 'Track Two', startSeconds: 120, endSeconds: 300 },
]

describe('isValidYoutubeChapters', () => {
  it('accepts ascending, non-overlapping chapters within the source duration', () => {
    assert.equal(isValidYoutubeChapters(CHAPTERS, 300), true)
  })

  it('rejects fewer than two chapters', () => {
    assert.equal(isValidYoutubeChapters([CHAPTERS[0]!], 300), false)
    assert.equal(isValidYoutubeChapters([], 300), false)
  })

  it('rejects overlapping ranges', () => {
    const overlapping: YoutubeChapter[] = [
      { title: 'A', startSeconds: 0, endSeconds: 150 },
      { title: 'B', startSeconds: 120, endSeconds: 300 },
    ]
    assert.equal(isValidYoutubeChapters(overlapping, 300), false)
  })

  it('rejects a non-finite or non-positive source duration', () => {
    assert.equal(isValidYoutubeChapters(CHAPTERS, 0), false)
    assert.equal(isValidYoutubeChapters(CHAPTERS, Number.NaN), false)
  })

  it('rejects chapters extending well past the source duration', () => {
    assert.equal(isValidYoutubeChapters(CHAPTERS, 200), false)
  })
})

describe('chapterSplitTrackId', () => {
  it('uses a #c-prefixed suffix, distinct from auto-split #p', () => {
    assert.equal(chapterSplitTrackId('abcdefghijk', 0), 'abcdefghijk#c0')
    assert.equal(chapterSplitTrackId('abcdefghijk', 3), 'abcdefghijk#c3')
  })
})

describe('chapterTrackTitle', () => {
  it('trims whitespace and falls back to a numbered title when blank', () => {
    assert.equal(chapterTrackTitle('  Real Title  ', 0), 'Real Title')
    assert.equal(chapterTrackTitle('', 2), 'Chapter 3')
    assert.equal(chapterTrackTitle('   ', 4), 'Chapter 5')
  })

  it('truncates an overlong title', () => {
    const long = 'x'.repeat(150)
    const result = chapterTrackTitle(long, 0)
    assert.ok(result.length <= 100)
  })
})

describe('chaptersToPlaylistTracks', () => {
  it('builds one chapters-kind split row per chapter', () => {
    const rows = chaptersToPlaylistTracks(track(), CHAPTERS, 300)
    assert.equal(rows.length, 2)
    assert.equal(rows[0]?.title, 'Intro')
    assert.equal(rows[0]?.split?.kind, 'chapters')
    assert.equal(rows[0]?.split?.groupId, 'abcdefghijk')
    assert.equal(rows[0]?.split?.count, 2)
    assert.equal(rows[0]?.split?.startSeconds, 0)
    assert.equal(rows[0]?.split?.durationSeconds, 120)
    assert.equal(rows[1]?.title, 'Track Two')
    assert.equal(rows[1]?.split?.index, 1)
    assert.equal(rows[1]?.duration, 180)
  })

  it('falls back to the source track unchanged when chapters are invalid', () => {
    const source = track()
    const rows = chaptersToPlaylistTracks(source, [CHAPTERS[0]!], 300)
    assert.deepEqual(rows, [source])
  })

  it('falls back to the source track when there is no youtubeId', () => {
    const source = track({ youtubeId: undefined })
    const rows = chaptersToPlaylistTracks(source, CHAPTERS, 300)
    assert.deepEqual(rows, [source])
  })
})

describe('canChapterSplitTrack', () => {
  it('allows an ungrouped YouTube-sourced track', () => {
    assert.equal(canChapterSplitTrack(track()), true)
  })

  it('allows an existing auto-split group (long videos are auto-split immediately on add)', () => {
    const autoGrouped = track({
      split: {
        groupId: 'abcdefghijk', index: 0, count: 2, startSeconds: 0, durationSeconds: 120, kind: 'auto',
      },
    })
    assert.equal(canChapterSplitTrack(autoGrouped), true)
  })

  it('rejects a track already split by real chapters', () => {
    const chapterGrouped = track({
      split: {
        groupId: 'abcdefghijk', index: 0, count: 2, startSeconds: 0, durationSeconds: 120, kind: 'chapters',
      },
    })
    assert.equal(canChapterSplitTrack(chapterGrouped), false)
  })

  it('rejects non-YouTube sources', () => {
    assert.equal(canChapterSplitTrack(track({ source: 'stream', youtubeId: undefined })), false)
  })
})
