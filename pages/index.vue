<script setup lang="ts">
import type { CanvasNode, FeedFragment } from '../types/canvas'

const { data: fragments } = await useFetch<FeedFragment[]>('/api/feed', {
  default: () => []
})
const pendingLike = ref('')
const pendingComment = ref('')
const commentDrafts = reactive<Record<string, string>>({})
const openComments = reactive<Record<string, boolean>>({})
const wordmark = 'makings'.split('')

function fragmentKey(fragment: FeedFragment) {
  return `${fragment.handle}:${fragment.id}`
}

function feedSnippetStyle(fragment: FeedFragment, index: number) {
  const pattern = index % 6
  const wide = pattern === 0 || pattern === 4
  const tall = pattern === 1 || pattern === 5

  return {
    gridColumn: wide ? 'span 2' : undefined,
    '--snippet-preview-height': `${tall ? 250 : wide ? 220 : pattern === 2 ? 205 : 180}px`
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
    transform: `translate(${node.x - fragment.bounds.x}px, ${node.y - fragment.bounds.y}px) ${rotate} ${nodeScale} ${tilt}`,
    zIndex: node.z,
    opacity: node.opacity ?? 1,
    background: node.color,
    color: node.textColor ?? (node.kind === 'video' || node.kind === 'audio' || node.kind === 'portal' ? '#ffffff' : '#101010'),
    borderColor: node.borderColor ?? '#101010',
    borderWidth: `${node.borderWidth ?? 1}px`,
    borderRadius: `${node.radius ?? 0}px`,
    padding: `${node.padding ?? 0}px`,
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

function previewWorldStyle(fragment: FeedFragment) {
  const scale = previewScale(fragment)

  return {
    width: `${fragment.bounds.w * scale}px`,
    height: `${fragment.bounds.h * scale}px`
  }
}

function previewCanvasStyle(fragment: FeedFragment) {
  const scale = previewScale(fragment)

  return {
    width: `${fragment.bounds.w}px`,
    height: `${fragment.bounds.h}px`,
    transform: `scale(${scale})`
  }
}

function previewScale(fragment: FeedFragment) {
  const width = Math.max(1, fragment.bounds.w)
  const height = Math.max(1, fragment.bounds.h)
  return Math.min(180 / width, 180 / height)
}

function linePoint(node: CanvasNode, point: 'start' | 'bend' | 'end', axis: 'x' | 'y') {
  if (point === 'start') return axis === 'x' ? node.lineStartX ?? 3 : node.lineStartY ?? 50
  if (point === 'end') return axis === 'x' ? node.lineEndX ?? 97 : node.lineEndY ?? 50
  return axis === 'x' ? node.lineBendX ?? 50 : node.lineBendY ?? 50
}

function lineHasBend(node: CanvasNode) {
  return Number.isFinite(node.lineBendX) && Number.isFinite(node.lineBendY)
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
          <span class="snippet-world" :style="previewWorldStyle(fragment)">
          <span class="snippet-canvas" :style="previewCanvasStyle(fragment)">
            <span
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
                    <path d="M0,0 L8,4 L0,8 Z" fill="currentColor" />
                  </marker>
                </defs>
                <path
                  :d="linePath(node)"
                  :marker-end="node.arrowEnd !== false ? `url(#snippet-arrow-${fragment.id}-${node.id})` : undefined"
                />
              </svg>
              <span v-else-if="node.kind === 'text'" class="node-text">{{ node.text }}</span>
              <span v-else-if="node.kind === 'portal'" class="node-portal">{{ node.text }}</span>
              <span v-else class="node-label">{{ node.text }}</span>
            </span>
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
