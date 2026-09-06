import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { PlaylistTrack } from './types.ts'
import {
  canChapterSplitTrack,
  chapterSplitTrackId,
  chapterTrackTitle,
  chaptersToPlaylistTracks,
  formatChapterSplitChip,
  isValidYoutubeChapters,
  removeChapterPart,
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

describe('formatChapterSplitChip', () => {
  it('labels the real chapter count', () => {
    assert.equal(formatChapterSplitChip(13), 'Splits into 13 chapters')
    assert.equal(formatChapterSplitChip(2), 'Splits into 2 chapters')
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

describe('removeChapterPart', () => {
  function chapterRow(index: number, count: number, overrides: Partial<PlaylistTrack> = {}): PlaylistTrack {
    return track({
      id: chapterSplitTrackId('abcdefghijk', index),
      title: `Chapter ${index + 1}`,
      split: {
        groupId: 'abcdefghijk',
        index,
        count,
        startSeconds: index * 60,
        durationSeconds: 60,
        sourceDurationSeconds: count * 60,
        kind: 'chapters',
      },
      ...overrides,
    })
  }

  it('renumbers the remaining chapters contiguously', () => {
    const playlist = [chapterRow(0, 3), chapterRow(1, 3), chapterRow(2, 3)]
    const result = removeChapterPart(playlist, chapterSplitTrackId('abcdefghijk', 1))
    assert.equal(result.length, 2)
    assert.equal(result[0]?.title, 'Chapter 1')
    assert.equal(result[0]?.split?.index, 0)
    assert.equal(result[0]?.split?.count, 2)
    assert.equal(result[1]?.title, 'Chapter 3')
    assert.equal(result[1]?.split?.index, 1)
    assert.equal(result[1]?.split?.count, 2)
  })

  it('collapses to a plain ungrouped track when only one chapter remains', () => {
    const playlist = [chapterRow(0, 2), chapterRow(1, 2)]
    const result = removeChapterPart(playlist, chapterSplitTrackId('abcdefghijk', 0))
    assert.equal(result.length, 1)
    assert.equal(result[0]?.title, 'Chapter 2')
    assert.equal(result[0]?.split, undefined)
  })

  it('preserves surrounding playlist tracks and their order', () => {
    const before = track({ id: 'before-track', title: 'Before' })
    const after = track({ id: 'after-track', title: 'After' })
    const playlist = [before, chapterRow(0, 2), chapterRow(1, 2), after]
    const result = removeChapterPart(playlist, chapterSplitTrackId('abcdefghijk', 0))
    assert.deepEqual(result.map(t => t.id), ['before-track', chapterSplitTrackId('abcdefghijk', 1), 'after-track'])
  })

  it('is a no-op for a track not in a chapter-split group', () => {
    const standalone = track({ id: 'solo' })
    assert.deepEqual(removeChapterPart([standalone], 'solo'), [standalone])
  })

  it('is a no-op for an auto-split group (unchanged whole-group-only removal)', () => {
    const auto = [
      track({
        id: 'x#p0',
        split: { groupId: 'x', index: 0, count: 2, startSeconds: 0, durationSeconds: 60, kind: 'auto' },
      }),
      track({
        id: 'x#p1',
        split: { groupId: 'x', index: 1, count: 2, startSeconds: 60, durationSeconds: 60, kind: 'auto' },
      }),
    ]
    assert.deepEqual(removeChapterPart(auto, 'x#p0'), auto)
  })
})
