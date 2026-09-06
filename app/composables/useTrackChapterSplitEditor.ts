import type { InjectionKey, Ref } from 'vue'

export interface TrackChapterSplitEditorShell {
  open: Ref<boolean>
  trackId: Ref<string | null>
  returnFocusEl: Ref<HTMLElement | null>
  openForTrack: (trackId: string) => void
  close: () => void
  restoreFocus: () => void
}

export const TRACK_CHAPTER_SPLIT_KEY: InjectionKey<TrackChapterSplitEditorShell>
  = Symbol('trackChapterSplitEditor')

export function useTrackChapterSplitEditorShell(): TrackChapterSplitEditorShell {
  const open = ref(false)
  const trackId = ref<string | null>(null)
  const returnFocusEl = ref<HTMLElement | null>(null)

  function openForTrack(id: string) {
    const active = document.activeElement
    returnFocusEl.value = active instanceof HTMLElement ? active : null
    trackId.value = id
    open.value = true
  }

  function close() {
    open.value = false
    trackId.value = null
  }

  function restoreFocus() {
    const el = returnFocusEl.value
    returnFocusEl.value = null
    if (el && typeof el.focus === 'function' && document.contains(el)) {
      el.focus()
    }
  }

  return { open, trackId, returnFocusEl, openForTrack, close, restoreFocus }
}
