<script setup lang="ts">
import Tray from '~/components/ui/Tray.vue'
import AppFlyout from '~/components/layout/AppFlyout.vue'
import { MYO_EDITOR_KEY } from '~/components/myo-editor/keys'
import { TRACK_CHAPTER_SPLIT_KEY } from '~/composables/useTrackChapterSplitEditor'
import type { PlaylistTrack } from '~/components/playlist/types'
import { youtubeIdForTrack } from '#shared/myo-editor/trackTrim'
import { splitGroupSourceTitle, splitSourceDuration } from '#shared/myo-editor/splitTrack'
import type { YoutubeChapter } from '#shared/myo-editor/youtubeChapters'

const open = defineModel<boolean>('open', { default: false })
const trackId = defineModel<string | null>('trackId', { default: null })

const editor = inject(MYO_EDITOR_KEY)
const splitShell = inject(TRACK_CHAPTER_SPLIT_KEY, null)
const { playEvent } = useUiSound()
const { showError } = useToast()

const isPhoneLayout = ref(false)
const headingId = 'track-chapter-split-heading'

const chapters = ref<YoutubeChapter[]>([])
const loading = ref(false)
const loadError = ref<string | null>(null)

let phoneMq: MediaQueryList | null = null
let fetchAbort: AbortController | null = null

const HEADING_MAX = 38

function capHeading(text: string) {
  if (text.length <= HEADING_MAX) return text
  return `${text.slice(0, HEADING_MAX - 1).trimEnd()}…`
}

const track = computed<PlaylistTrack | null>(() => {
  if (!editor || !trackId.value) return null
  return editor.playlist.value.find(item => item.id === trackId.value) ?? null
})

const headingText = computed(() => (
  capHeading(track.value ? splitGroupSourceTitle(track.value.title) : 'Split by chapters')
))

const youtubeId = computed(() => {
  const current = track.value
  return current ? youtubeIdForTrack(current) ?? null : null
})

const sourceDuration = computed(() => {
  const current = track.value
  if (!current) return 0
  return splitSourceDuration(current, editor?.playlist.value ?? [])
})

const trayOpen = computed({
  get: () => isPhoneLayout.value && open.value,
  set: (value: boolean) => {
    if (!value) requestClose()
  },
})

function formatTimestamp(seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  const mins = Math.floor(total / 60)
  const secs = total % 60
  return `${mins}:${String(secs).padStart(2, '0')}`
}

async function loadChapters() {
  const id = youtubeId.value
  chapters.value = []
  loadError.value = null
  if (!id) return

  fetchAbort?.abort()
  fetchAbort = new AbortController()
  const { signal } = fetchAbort
  loading.value = true
  try {
    const data = await $fetch<{ chapters: YoutubeChapter[] }>(
      `/api/youtube/preview/${id}/chapters`,
      { signal },
    )
    if (signal.aborted) return
    chapters.value = data.chapters
    if (data.chapters.length < 2) {
      loadError.value = 'No chapters found on this video.'
    }
  }
  catch (err) {
    if (signal.aborted) return
    loadError.value = 'Could not load chapters for this video.'
    showError(loadError.value)
  }
  finally {
    if (!signal.aborted) loading.value = false
  }
}

function beginOpen() {
  void loadChapters()
  playEvent('toggleOn')
}

function finishClose() {
  trackId.value = null
  splitShell?.restoreFocus()
}

function requestClose() {
  if (!open.value) return
  playEvent('buttonClick')
  open.value = false
}

function onConfirm() {
  const next = track.value
  if (!next || !editor || chapters.value.length < 2) return
  editor.splitTrackByChapters(next.id, chapters.value)
  playEvent('buttonPrimary')
  open.value = false
}

function syncPhoneLayout() {
  isPhoneLayout.value = phoneMq?.matches ?? false
}

watch(open, (value) => {
  if (value) beginOpen()
  else fetchAbort?.abort()
})

onMounted(() => {
  phoneMq = window.matchMedia('(max-width: 599px)')
  syncPhoneLayout()
  phoneMq.addEventListener('change', syncPhoneLayout)
  if (open.value) beginOpen()
})

onUnmounted(() => {
  fetchAbort?.abort()
  phoneMq?.removeEventListener('change', syncPhoneLayout)
})
</script>

<template>
  <Tray
    v-if="isPhoneLayout"
    v-model:open="trayOpen"
    :title="headingText"
    height="auto"
    :play-sounds="false"
    @close="finishClose"
  >
    <div class="track-chapter-split-body">
      <p v-if="loading" class="track-chapter-split-status">
        Loading chapters…
      </p>
      <p v-else-if="loadError" class="track-chapter-split-status">
        {{ loadError }}
      </p>
      <ol v-else class="track-chapter-split-list">
        <li v-for="(chapter, index) in chapters" :key="index">
          <span class="track-chapter-split-list__time">{{ formatTimestamp(chapter.startSeconds) }}</span>
          <span class="track-chapter-split-list__title">{{ chapter.title }}</span>
        </li>
      </ol>
      <div class="track-chapter-split-footer">
        <button type="button" class="panel-footer-btn panel-footer-btn--short" @click="requestClose">
          Cancel
        </button>
        <button
          type="button"
          class="panel-footer-btn panel-footer-btn--short panel-footer-btn--primary"
          :disabled="chapters.length < 2"
          @click="onConfirm"
        >
          Split into {{ chapters.length }} chapters
        </button>
      </div>
    </div>
  </Tray>

  <AppFlyout
    v-if="!isPhoneLayout"
    v-model:open="open"
    :title="headingText"
    :heading-id="headingId"
    heading-tone="green-lighter"
    header-class="bg-maru-orange"
    face-class="bg-maru-green-lighter"
    size="md"
    dismiss-label="Cancel"
    @close="requestClose"
    @after-leave="finishClose"
  >
    <div class="track-chapter-split-body">
      <p v-if="loading" class="track-chapter-split-status">
        Loading chapters…
      </p>
      <p v-else-if="loadError" class="track-chapter-split-status">
        {{ loadError }}
      </p>
      <ol v-else class="track-chapter-split-list">
        <li v-for="(chapter, index) in chapters" :key="index">
          <span class="track-chapter-split-list__time">{{ formatTimestamp(chapter.startSeconds) }}</span>
          <span class="track-chapter-split-list__title">{{ chapter.title }}</span>
        </li>
      </ol>
    </div>
    <template #footer>
      <button
        type="button"
        class="panel-footer-btn panel-footer-btn--short panel-footer-btn--primary shrink-0"
        :disabled="chapters.length < 2"
        @click="onConfirm"
      >
        <span class="panel-footer-btn__label">Split into {{ chapters.length }} chapters</span>
      </button>
    </template>
  </AppFlyout>
</template>

<style scoped>
.track-chapter-split-body {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.track-chapter-split-status {
  opacity: 0.75;
}

.track-chapter-split-list {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  max-height: 50vh;
  overflow-y: auto;
}

.track-chapter-split-list li {
  display: flex;
  gap: 0.75rem;
  align-items: baseline;
}

.track-chapter-split-list__time {
  font-variant-numeric: tabular-nums;
  opacity: 0.65;
  flex-shrink: 0;
}

.track-chapter-split-footer {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}
</style>
