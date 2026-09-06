import type { PlaylistTrack, TrackSplit } from './types.ts'
import { canTrimTrack } from './trackTrim.ts'
import { PART_TITLE_MAX, splitGroupSourceTitle } from './splitTrack.ts'

export interface YoutubeChapter {
  title: string
  startSeconds: number
  endSeconds: number
}

const OVERLAP_EPSILON_SECONDS = 0.5
const SOURCE_DURATION_EPSILON_SECONDS = 1.5

/** Real chapter markers, ascending and non-overlapping, fitting within the source duration. */
export function isValidYoutubeChapters(
  chapters: YoutubeChapter[],
  sourceDurationSeconds: number,
): boolean {
  if (!Array.isArray(chapters) || chapters.length < 2) return false
  if (!Number.isFinite(sourceDurationSeconds) || sourceDurationSeconds <= 0) return false

  let previousEnd = 0
  for (const chapter of chapters) {
    if (!Number.isFinite(chapter.startSeconds) || !Number.isFinite(chapter.endSeconds)) return false
    if (chapter.endSeconds <= chapter.startSeconds) return false
    if (chapter.startSeconds < previousEnd - OVERLAP_EPSILON_SECONDS) return false
    previousEnd = chapter.endSeconds
  }

  return previousEnd <= sourceDurationSeconds + SOURCE_DURATION_EPSILON_SECONDS
}

export function chapterSplitTrackId(youtubeId: string, index: number): string {
  return `${youtubeId}#c${index}`
}

export function chapterTrackTitle(rawTitle: string, index: number): string {
  const trimmed = rawTitle?.trim()
  if (!trimmed) return `Chapter ${index + 1}`
  return trimmed.length <= PART_TITLE_MAX ? trimmed : trimmed.slice(0, PART_TITLE_MAX).trimEnd()
}

/**
 * One PlaylistTrack per real chapter marker, replacing an ungrouped source track.
 * Mirrors applySourceTrimAndSplit's row-building, but ranges come from real
 * chapter timestamps instead of equal-duration slicing.
 */
export function chaptersToPlaylistTracks(
  source: PlaylistTrack,
  chapters: YoutubeChapter[],
  sourceDurationSeconds: number,
): PlaylistTrack[] {
  const youtubeId = source.youtubeId?.trim()
  if (!youtubeId) return [source]
  if (!isValidYoutubeChapters(chapters, sourceDurationSeconds)) return [source]

  const baseTitle = splitGroupSourceTitle(source.title)
  const {
    split: _split,
    trim: _trim,
    chapterKey: _chapterKey,
    trackKey: _trackKey,
    yotoReuse: _yotoReuse,
    ...rest
  } = source

  return chapters.map((chapter, index) => {
    const split: TrackSplit = {
      groupId: youtubeId,
      index,
      count: chapters.length,
      startSeconds: chapter.startSeconds,
      durationSeconds: chapter.endSeconds - chapter.startSeconds,
      sourceDurationSeconds,
      kind: 'chapters',
    }
    return {
      ...rest,
      id: chapterSplitTrackId(youtubeId, index),
      title: chapterTrackTitle(chapter.title, index) || baseTitle,
      duration: chapter.endSeconds - chapter.startSeconds,
      split,
    }
  })
}

/** Only offer chapter-splitting on an ungrouped, untrimmed-split YouTube row. */
export function canChapterSplitTrack(
  track: Pick<PlaylistTrack, 'source' | 'youtubeId' | 'id' | 'split'>,
): boolean {
  if (track.split) return false
  return canTrimTrack(track)
}
