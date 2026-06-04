<script setup lang="ts">
import type { CanvasNode, FeedFragment } from '../types/canvas'
import { renderRichText } from '../utils/richText'

const { data: fragments } = await useFetch<FeedFragment[]>('/api/feed', {
  default: () => []
})
const pendingLike = ref('')
const pendingComment = ref('')
const commentDrafts = reactive<Record<string, string>>({})
const openComments = reactive<Record<string, boolean>>({})
const wordmark = 'makings'.split('')

const previewHeights = [220, 250, 205, 180, 220, 250]
const feedFontLinks = computed(() => {
  const fonts = new Set<string>()

  for (const fragment of fragments.value ?? []) {
    for (const font of fragment.googleFonts ?? []) {
      if (font.trim()) fonts.add(font.trim())
    }
  }

  return [...fonts].map((font) => ({
    rel: 'stylesheet',
    href: `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font).replaceAll('%20', '+')}:wght@300;400;500;600;700;800;900&display=swap`
  }))
})

useHead(() => ({
  link: feedFontLinks.value
}))

function fragmentKey(fragment: FeedFragment) {
  return `${fragment.handle}:${fragment.id}`
}

function previewHeight(index: number) {
  return previewHeights[index % previewHeights.length] ?? 180
}

function feedSnippetStyle(fragment: FeedFragment, index: number) {
  const pattern = index % 6
  const wide = pattern === 0 || pattern === 4
  const height = previewHeight(index)

  return {
    gridColumn: wide ? 'span 2' : undefined,
    '--page': fragment.theme?.page ?? '#ffffff',
    '--ink': fragment.theme?.ink ?? '#101010',
    '--muted': fragment.theme?.muted ?? 'color-mix(in srgb, var(--ink) 62%, var(--page) 38%)',
    '--line': fragment.theme?.line ?? '#dddddd',
    '--line-dark': fragment.theme?.ink ?? '#101010',
    '--snippet-page': fragment.theme?.page ?? 'var(--page)',
    '--snippet-preview-height': `${height}px`
  }
}

function toggleComments(fragment: FeedFragment) {
  const key = fragmentKey(fragment)
  openComments[key] = !openComments[key]
}

async function toggleLike(fragment: FeedFragment) {
  pendingLike.value = fragmentKey(fragment)

  try {
    const result = await $fetch<{ liked: boolean; likes: number }>('/api/social/like', {
      method: 'POST',
      body: {
        handle: fragment.handle,
        id: fragment.id
      }
    })

    fragment.likedByMe = result.liked
    fragment.likes = result.likes
  } catch {
    await navigateTo('/login')
  } finally {
    pendingLike.value = ''
  }
}

async function submitComment(fragment: FeedFragment) {
  const key = fragmentKey(fragment)
  const body = commentDrafts[key]?.trim()
  if (!body) return

  pendingComment.value = key

  try {
    const result = await $fetch<Pick<FeedFragment, 'comments' | 'commentCount'>>('/api/social/comment', {
      method: 'POST',
      body: {
        handle: fragment.handle,
        id: fragment.id,
        body
      }
    })

    fragment.comments = result.comments ?? []
    fragment.commentCount = result.commentCount ?? fragment.comments.length
    commentDrafts[key] = ''
  } catch {
    await navigateTo('/login')
  } finally {
    pendingComment.value = ''
  }
}

function previewNodeStyle(node: CanvasNode, fragment: FeedFragment) {
  const rotate = `rotate(${node.r ?? 0}deg)`
  const nodeScale = `scale(${node.scale ?? 1})`
  const tilt = `perspective(${node.perspective ?? 900}px) rotateX(${node.tiltX ?? 0}deg) rotateY(${node.tiltY ?? 0}deg)`

  return {
    width: `${node.w}px`,
    height: `${node.h}px`,
    left: `${node.x - fragment.bounds.x}px`,
    top: `${node.y - fragment.bounds.y}px`,
    transform: `${rotate} ${nodeScale} ${tilt}`,
    transformOrigin: node.kind === 'line' ? lineTransformOrigin(node) : 'center center',
    zIndex: node.z,
    opacity: node.opacity ?? 1,
    background: node.kind === 'line' ? 'transparent' : node.color,
    color: node.kind === 'line' ? node.color : (node.textColor ?? (node.kind === 'video' || node.kind === 'audio' || node.kind === 'portal' ? '#ffffff' : '#101010')),
    borderColor: node.kind === 'line' ? 'transparent' : (node.borderColor ?? '#101010'),
    borderWidth: node.kind === 'line' ? 0 : `${node.borderWidth ?? 1}px`,
    borderRadius: `${node.radius ?? 0}px`,
    padding: node.kind === 'line' ? '0px' : `${node.padding ?? 0}px`,
    placeItems: node.layout ?? 'center',
    fontFamily: node.fontFamily ?? 'Avenir Next, Segoe UI, Helvetica Neue, sans-serif',
    '--node-line-width': `${node.borderWidth ?? 4}px`,
    '--node-color': node.color,
    '--node-text': node.textColor ?? (node.kind === 'video' || node.kind === 'audio' || node.kind === 'portal' ? '#ffffff' : '#101010'),
    '--node-font': node.fontFamily ?? 'Avenir Next, Segoe UI, Helvetica Neue, sans-serif',
    '--node-size': `${node.fontSize ?? (node.kind === 'text' ? 52 : 16)}px`,
    '--node-weight': node.fontWeight ?? 700,
    '--node-gap': `${node.gap ?? Math.max(0, Math.round((node.padding ?? 0) / 2))}px`,
    '--node-speed': `${node.animationMs ?? 1800}ms`,
    '--effect-strength': node.effectStrength ?? 1,
    '--effect-shadow-x': `${node.shadowX ?? 8}px`,
    '--effect-shadow-y': `${node.shadowY ?? 8}px`,
    '--effect-blur': `${node.blurAmount ?? 2}px`,
    '--effect-outline': `${node.outlineSize ?? 6}px`
  }
}

function previewWorldStyle(fragment: FeedFragment, index: number) {
  const scale = previewScale(fragment, index)

  return {
    width: `${fragment.bounds.w * scale}px`,
    height: `${fragment.bounds.h * scale}px`
  }
}

function previewCanvasStyle(fragment: FeedFragment, index: number) {
  const scale = previewScale(fragment, index)

  return {
    width: `${fragment.bounds.w}px`,
    height: `${fragment.bounds.h}px`,
    transform: `scale(${scale})`
  }
}

function previewScale(fragment: FeedFragment, index: number) {
  const width = Math.max(1, fragment.bounds.w)
  const height = Math.max(1, fragment.bounds.h)
  const targetWidth = index % 6 === 0 || index % 6 === 4 ? 440 : 260
  return Math.min(targetWidth / width, previewHeight(index) / height)
}

function interpolatePreviewText(value: string | undefined, fragment: FeedFragment) {
  return String(value ?? '').replace(/%([a-zA-Z0-9_-]+)%/g, (match, key: string) => {
    const variable = fragment.stateVariables?.find((item) => item.key === key)
    return variable ? String(variable.initialValue) : match
  })
}

function linePoint(node: CanvasNode, point: 'start' | 'bend' | 'end', axis: 'x' | 'y') {
  if (point === 'start') return axis === 'x' ? node.lineStartX ?? 3 : node.lineStartY ?? 50
  if (point === 'end') return axis === 'x' ? node.lineEndX ?? 97 : node.lineEndY ?? 50
  return axis === 'x' ? node.lineBendX ?? 50 : node.lineBendY ?? 50
}

function lineHasBend(node: CanvasNode) {
  return Number.isFinite(node.lineBendX) && Number.isFinite(node.lineBendY)
}

function lineTransformOrigin(node: CanvasNode) {
  const points = [
    { x: linePoint(node, 'start', 'x'), y: linePoint(node, 'start', 'y') },
    { x: linePoint(node, 'end', 'x'), y: linePoint(node, 'end', 'y') }
  ]

  if (lineHasBend(node)) {
    points.push({ x: linePoint(node, 'bend', 'x'), y: linePoint(node, 'bend', 'y') })
  }

  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  const centerX = (Math.min(...xs) + Math.max(...xs)) / 2
  const centerY = (Math.min(...ys) + Math.max(...ys)) / 2

  return `${centerX}% ${centerY}%`
}

function lineEffectStyle(node: CanvasNode) {
  if (node.effect === 'shadow') {
    return {
      filter: 'drop-shadow(calc(var(--effect-shadow-x) * var(--effect-strength)) calc(var(--effect-shadow-y) * var(--effect-strength)) calc(12px * var(--effect-strength)) rgba(0, 0, 0, 0.22))'
    }
  }

  if (node.effect === 'hard-shadow') {
    return {
      filter: 'drop-shadow(calc(var(--effect-shadow-x) * var(--effect-strength)) calc(var(--effect-shadow-y) * var(--effect-strength)) 0 var(--ink))'
    }
  }

  return {}
}

function lineOutlineStyle(node: CanvasNode) {
  if (node.effect !== 'outline') return {}

  return {
    stroke: 'var(--page)',
    strokeWidth: 'calc(var(--node-line-width) + (var(--effect-outline) * 2))',
    pointerEvents: 'none'
  }
}

function linePath(node: CanvasNode) {
  const start = `M ${linePoint(node, 'start', 'x')} ${linePoint(node, 'start', 'y')}`
  const end = `${linePoint(node, 'end', 'x')} ${linePoint(node, 'end', 'y')}`

  if (lineHasBend(node)) {
    return `${start} Q ${linePoint(node, 'bend', 'x')} ${linePoint(node, 'bend', 'y')} ${end}`
  }

  return `${start} L ${end}`
}
</script>

<template>
  <main class="page page-feed">
    <h1 class="index-wordmark" aria-label="makings">
      <span class="index-wordmark-track" aria-hidden="true">
        <span
          v-for="(letter, index) in wordmark"
          :key="`${letter}-${index}`"
          class="index-wordmark-letter"
          :style="{ '--i': index }"
        >
          {{ letter }}
        </span>
      </span>
    </h1>
    <section class="feed-grid">
      <article
        v-for="(fragment, index) in fragments"
        :key="fragment.id"
        class="feed-snippet"
        :style="feedSnippetStyle(fragment, index)"
      >
        <NuxtLink class="snippet-link" :to="`/space/${fragment.handle}?fragment=${fragment.id}`">
          <span class="snippet-preview">
          <span class="snippet-world" :style="previewWorldStyle(fragment, index)">
          <span class="snippet-canvas" :style="previewCanvasStyle(fragment, index)">
            <div
              v-for="node in fragment.nodes"
              :key="node.id"
              class="snippet-node canvas-node"
              :class="[
                `snippet-${node.kind}`,
                `is-${node.kind}`,
                `effect-${node.effect ?? 'none'}`,
                `anim-${node.animation ?? 'none'}`
              ]"
              :style="previewNodeStyle(node, fragment)"
            >
              <template v-if="node.kind === 'profile'">
                <img v-if="node.showAvatar !== false" class="profile-avatar" :src="node.avatar" alt="" />
                <strong v-if="node.showNickname !== false" class="profile-name">{{ node.nickname }}</strong>
                <p v-if="node.showDescription !== false" class="profile-description">{{ node.description }}</p>
                <span v-if="node.showTags !== false" class="profile-tags">
                  <span v-for="tag in node.tags" :key="tag">{{ tag }}</span>
                </span>
              </template>
              <svg v-else-if="node.kind === 'line'" class="snippet-line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <defs>
                  <marker
                    :id="`snippet-arrow-${fragment.id}-${node.id}`"
                    markerWidth="8"
                    markerHeight="8"
                    refX="7"
                    refY="4"
                    orient="auto"
                    markerUnits="strokeWidth"
                  >
                    <path
                      v-if="node.arrowHeadStyle === 'lines'"
                      d="M1,1 L7,4 L1,7"
                      fill="none"
                      :stroke="node.color"
                      stroke-width="1.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                    <path
                      v-else
                      d="M0,0 L8,4 L0,8 Z"
                      :fill="node.color"
                    />
                  </marker>
                </defs>
                <path
                  v-if="node.effect === 'outline'"
                  class="line-outline-path"
                  :d="linePath(node)"
                  :style="lineOutlineStyle(node)"
                />
                <path
                  class="line-base-path"
                  :d="linePath(node)"
                  :marker-end="node.arrowEnd !== false ? `url(#snippet-arrow-${fragment.id}-${node.id})` : undefined"
                  :style="lineEffectStyle(node)"
                />
              </svg>
              <span v-else-if="node.kind === 'text'" class="node-text" v-html="renderRichText(interpolatePreviewText(node.text, fragment))"></span>
              <span v-else-if="node.kind === 'portal'" class="node-portal">{{ interpolatePreviewText(node.text, fragment) }}</span>
              <span v-else-if="node.kind === 'guestbook'" class="node-label">{{ interpolatePreviewText(node.guestbookPrompt || node.text || 'guestbook', fragment) }}</span>
              <NodeMediaContent v-else-if="node.media" :node="node" context="feed" />
              <span v-else class="node-label">{{ interpolatePreviewText(node.text, fragment) }}</span>
            </div>
          </span>
          </span>
          </span>
          <span class="snippet-title">{{ fragment.title }}</span>
          <span class="snippet-caption">{{ fragment.caption || 'published from canvas' }}</span>
        </NuxtLink>
        <span class="snippet-meta">
          <span>@{{ fragment.handle }}</span>
          <span>{{ fragment.tags?.length ? fragment.tags.join(' / ') : 'untagged' }}</span>
          <span>{{ Math.round(fragment.bounds.w) }}x{{ Math.round(fragment.bounds.h) }}</span>
          <button type="button" :class="{ active: fragment.likedByMe }" @click="toggleLike(fragment)">
            {{ pendingLike === fragmentKey(fragment) ? '...' : `${fragment.likes ?? 0} like` }}
          </button>
        </span>
        <section class="snippet-comments">
          <button class="comment-toggle" type="button" @click="toggleComments(fragment)">
            {{ openComments[fragmentKey(fragment)] ? 'hide' : 'show' }} {{ fragment.commentCount ?? 0 }} comments
          </button>
          <form v-if="openComments[fragmentKey(fragment)]" class="comment-panel" @submit.prevent="submitComment(fragment)">
            <span v-for="comment in fragment.comments ?? []" :key="comment.id" class="comment-line">
              <NuxtLink :to="`/space/${comment.author.handle}`">@{{ comment.author.handle }}</NuxtLink>
              <span>{{ comment.body }}</span>
            </span>
            <label>
              <span>comment</span>
              <input
                v-model="commentDrafts[fragmentKey(fragment)]"
                maxlength="280"
                placeholder="write a comment"
              />
            </label>
            <button type="submit" :disabled="pendingComment === fragmentKey(fragment) || !commentDrafts[fragmentKey(fragment)]?.trim()">
              {{ pendingComment === fragmentKey(fragment) ? 'posting...' : 'post comment' }}
            </button>
          </form>
        </section>
      </article>
    </section>
  </main>
</template>
