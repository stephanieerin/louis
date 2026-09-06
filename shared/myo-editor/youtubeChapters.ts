import type { PlaylistTrack, TrackSplit } from './types.ts'
import { canTrimTrack } from './trackTrim.ts'
import { PART_TITLE_MAX, playlistBlocks, splitGroupSourceTitle } from './splitTrack.ts'

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

export function formatChapterSplitChip(chapterCount: number): string {
  return `Splits into ${chapterCount} chapters`
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

/**
 * Offer chapter-splitting on an ungrouped YouTube row OR an existing
 * equal-duration auto-split group (replacing it entirely) — but not on a
 * group that's already chapter-split. Long videos (>55min, exactly the ones
 * most likely to have real chapters) are auto-split the instant they're
 * added, so gating on "ungrouped only" would hide this action for them.
 */
export function canChapterSplitTrack(
  track: Pick<PlaylistTrack, 'source' | 'youtubeId' | 'id' | 'split'>,
): boolean {
  if (track.split?.kind === 'chapters') return false
  return canTrimTrack(track)
}

/**
 * Removes one track from a chapter-split group, renumbering the rest so the
 * group stays contiguous (0..N-1) — collapses to a plain ungrouped track if
 * only one chapter remains. No-op if `trackId` isn't in a chapter group
 * (auto-split groups keep their existing whole-group-only removal).
 */
export function removeChapterPart(playlist: PlaylistTrack[], trackId: string): PlaylistTrack[] {
  const blocks = playlistBlocks(playlist)
  const blockIndex = blocks.findIndex(block => (
    block.kind === 'split'
    && block.tracks[0]?.split?.kind === 'chapters'
    && block.tracks.some(track => track.id === trackId)
  ))
  if (blockIndex < 0) return playlist

  const block = blocks[blockIndex]!
  const remaining = block.tracks.filter(track => track.id !== trackId)

  const replacement: PlaylistTrack[] = remaining.length <= 1
    ? remaining.map((track) => {
        const { split: _split, ...rest } = track
        return rest
      })
    : remaining.map((track, index) => ({
        ...track,
        split: { ...track.split!, index, count: remaining.length },
      }))

  const before = blocks.slice(0, blockIndex).flatMap(b => b.tracks)
  const after = blocks.slice(blockIndex + 1).flatMap(b => b.tracks)
  return [...before, ...replacement, ...after]
}
