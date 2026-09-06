<script setup lang="ts">
import type { PlaylistTrack } from '~/components/playlist/types'
import TrackArtThumb from '~/components/track-art/TrackArtThumb.vue'
import { TRACK_ART_EDITOR_KEY } from '~/composables/useTrackArtEditor'
import { TRACK_TRIM_EDITOR_KEY } from '~/composables/useTrackTrimEditor'
import { TRACK_CHAPTER_SPLIT_KEY } from '~/composables/useTrackChapterSplitEditor'
import { MYO_EDITOR_KEY } from '~/components/myo-editor/keys'
import { formatDurationSeconds } from '#shared/myo-editor/youtubeDuration'
import { splitTrackAccessibleName } from '#shared/myo-editor/splitTrack'
import { canTrimTrack, isTrimmed, trimmedDurationSeconds } from '#shared/myo-editor/trackTrim'
import { canChapterSplitTrack } from '#shared/myo-editor/youtubeChapters'

const props = defineProps<{
  track: PlaylistTrack
  locked?: boolean
  displayTitle?: string
  partLabel?: string
  removeLabel?: string
  hideRemove?: boolean
  hideTrim?: boolean
}>()

const emit = defineEmits<{
  remove: [id: string]
}>()

const artEditor = inject(TRACK_ART_EDITOR_KEY)
const trimEditor = inject(TRACK_TRIM_EDITOR_KEY)
const chapterSplitEditor = inject(TRACK_CHAPTER_SPLIT_KEY, null)
const editor = inject(MYO_EDITOR_KEY, null)
const { playEvent } = useUiSound()

// Auto-split "Part N" rows have no meaningful distinct title to rename —
// only an ungrouped track or a real chapter (which shows its own title) can be.
const canRename = computed(() => !props.track.split || props.track.split.kind === 'chapters')
const renaming = ref(false)
const draftTitle = ref('')
const titleInputRef = ref<HTMLInputElement | null>(null)

function beginRename() {
  if (props.locked || !canRename.value) return
  draftTitle.value = props.track.title
  renaming.value = true
  nextTick(() => titleInputRef.value?.select())
}

function commitRename() {
  if (!renaming.value) return
  renaming.value = false
  const trimmed = draftTitle.value.trim()
  if (trimmed && trimmed !== props.track.title) {
    editor?.renameTrack(props.track.id, trimmed)
  }
}

function cancelRename() {
  renaming.value = false
}

function onRemoveHover() {
  if (props.locked) return
  playEvent('chipHover')
}

function onEditArt() {
  artEditor?.openForTrack(props.track.id)
}

function onTrim() {
  if (props.locked || !canTrim.value) return
  playEvent('buttonClick')
  trimEditor?.openForTrack(props.track.id)
}

function onChapterSplit() {
  if (props.locked || !canChapterSplit.value) return
  playEvent('buttonClick')
  chapterSplitEditor?.openForTrack(props.track.id)
}

const canTrim = computed(() => canTrimTrack(props.track))
const canChapterSplit = computed(() => canChapterSplitTrack(props.track))

const durationLabel = computed(() => {
  const seconds = trimmedDurationSeconds(props.track)
  if (typeof seconds !== 'number' || seconds <= 0) return ''
  return formatDurationSeconds(seconds)
})

const partLine = computed(() => {
  const title = props.displayTitle || props.track.title
  if (!durationLabel.value) return title
  return `${title} \u00B7 ${durationLabel.value}`
})
</script>

<template>
  <div class="playlist-track-row flex items-center gap-2 min-w-0 flex-1">
    <TrackArtThumb
      :track="track"
      :locked="locked"
      size="md"
      @edit="onEditArt"
    />

    <div
      v-if="partLabel"
      class="min-w-0 flex-1 flex items-center gap-2"
    >
      <input
        v-if="renaming"
        ref="titleInputRef"
        v-model="draftTitle"
        class="playlist-track-row__title-input type-title-sm font-maru-medium min-w-0 flex-1"
        aria-label="Track title"
        @keydown.enter="commitRename"
        @keydown.esc="cancelRename"
        @blur="commitRename"
      >
      <p
        v-else
        class="type-title-sm font-maru-medium truncate min-w-0 flex-1"
        :class="{ 'cursor-text': canRename }"
        :title="canRename ? 'Double-click to rename' : undefined"
        @dblclick="beginRename"
      >{{ partLine }}</p>
      <span class="playlist-split-part playlist-split-part--inline type-caption font-maru-mono tabular-nums shrink-0">{{ partLabel }}</span>
    </div>
    <div
      v-else
      class="min-w-0 flex-1 flex flex-col gap-1.5"
    >
      <input
        v-if="renaming"
        ref="titleInputRef"
        v-model="draftTitle"
        class="playlist-track-row__title-input type-title-sm font-maru-medium min-w-0"
        aria-label="Track title"
        @keydown.enter="commitRename"
        @keydown.esc="cancelRename"
        @blur="commitRename"
      >
      <p
        v-else
        class="type-title-sm font-maru-medium line-clamp-2 min-w-0"
        :class="{ 'cursor-text': canRename }"
        :title="canRename ? 'Double-click to rename' : undefined"
        @dblclick="beginRename"
      >{{ track.title }}</p>
      <p
        v-if="track.subtitle"
        class="playlist-item__subtitle text-maru-black/75"
      >{{ track.subtitle }}</p>
    </div>

    <button
      v-if="canTrim && !hideTrim"
      type="button"
      class="playlist-trim"
      :class="{ 'playlist-trim--on': isTrimmed(track) }"
      :disabled="locked"
      :aria-label="`Trim ${splitTrackAccessibleName(track)}`"
      aria-haspopup="dialog"
      @mouseenter="onRemoveHover"
      @click="onTrim"
    >
      <MaruEmoji name="Scissors" size="md" />
    </button>

    <button
      v-if="canChapterSplit && !hideTrim"
      type="button"
      class="playlist-trim"
      :disabled="locked"
      :aria-label="`Split ${splitTrackAccessibleName(track)} by chapters`"
      aria-haspopup="dialog"
      @mouseenter="onRemoveHover"
      @click="onChapterSplit"
    >
      <MaruEmoji name="CardIndexDividers" size="md" />
    </button>

    <button
      v-if="!hideRemove"
      type="button"
      class="playlist-remove"
      :disabled="locked"
      :aria-label="removeLabel || `Remove ${splitTrackAccessibleName(track)}`"
      @mouseenter="onRemoveHover"
      @click="emit('remove', track.id)"
    >
      <MaruEmoji name="Fire" size="md" />
    </button>
  </div>
</template>
