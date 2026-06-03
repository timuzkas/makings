<script setup lang="ts">
import type { CanvasNode } from '../types/canvas'
import { mediaKindFromNodeKind, normalizeMediaRef } from '../utils/media'

const props = withDefaults(defineProps<{
  node: CanvasNode
  context?: 'canvas' | 'feed'
}>(), {
  context: 'canvas'
})

const media = computed(() => normalizeMediaRef(props.node.media, mediaKindFromNodeKind(props.node.kind) ?? undefined))
const showProviderTile = computed(() => props.context === 'feed' && media.value?.provider !== 'direct')
const providerLabel = computed(() => {
  if (!media.value) return ''
  return media.value.provider === 'youtube' ? 'YouTube video' : media.value.provider === 'vimeo' ? 'Vimeo video' : ''
})
</script>

<template>
  <div v-if="media" class="node-media" :class="[`is-${media.kind}`, `provider-${media.provider}`, `context-${context}`]">
    <img
      v-if="media.kind === 'image'"
      class="node-media-image"
      :src="media.src"
      :alt="node.label ?? node.text ?? ''"
      draggable="false"
    >
    <audio
      v-else-if="media.kind === 'audio' && media.provider === 'direct'"
      class="node-media-audio"
      :src="media.src"
      controls
      preload="metadata"
    />
    <template v-else-if="media.kind === 'video'">
      <div v-if="showProviderTile" class="node-media-provider-tile">
        <strong>{{ providerLabel }}</strong>
        <span>{{ node.label ?? node.text ?? 'embedded media' }}</span>
      </div>
      <iframe
        v-else-if="media.provider !== 'direct'"
        class="node-media-embed"
        :src="media.src"
        :title="node.label ?? node.text ?? 'embedded video'"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowfullscreen
        loading="lazy"
      />
      <video
        v-else
        class="node-media-video"
        :src="media.src"
        :poster="media.posterSrc"
        controls
        playsinline
        preload="metadata"
        :muted="context === 'feed'"
      />
    </template>
    <div v-else class="node-media-provider-tile">
      <strong>Unsupported media</strong>
    </div>
  </div>
</template>
