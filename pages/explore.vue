<script setup lang="ts">
import type { SpaceLink, SpaceSummary } from '../types/canvas'

const query = ref('')
const { data: spaces } = await useFetch<SpaceSummary[]>('/api/spaces', {
  default: () => []
})
const pendingFollow = ref('')

const filteredSpaces = computed(() => {
  const term = query.value.trim().toLowerCase()

  if (!term) {
    return spaces.value
  }

  return spaces.value.filter((space) => {
    return [
      space.handle,
      space.name,
      space.bio,
      space.status,
      ...(space.links ?? []).flatMap((link) => [linkLabel(link), typeof link === 'string' ? link : link.url]),
      ...space.fragments.flatMap((fragment) => [fragment.title, fragment.caption, ...(fragment.tags ?? [])])
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term))
  })
})

function linkLabel(link: SpaceLink) {
  if (typeof link !== 'string' && link.label?.trim()) return link.label.trim()
  const raw = typeof link === 'string' ? link : link.url
  return raw.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').replace(/\/$/, '')
}

async function toggleFollow(space: SpaceSummary) {
  pendingFollow.value = space.handle

  try {
    const result = await $fetch<{ following: boolean; followers: number }>('/api/social/follow', {
      method: 'POST',
      body: { handle: space.handle }
    })

    space.followedByMe = result.following
    space.followers = result.followers
  } catch {
    await navigateTo('/login')
  } finally {
    pendingFollow.value = ''
  }
}
</script>

<template>
  <main class="page page-explore">
    <section class="explore-search">
      <input v-model="query" type="search" aria-label="Search spaces" placeholder="search spaces, tags, people" />
    </section>

    <section class="explore-lines">
      <article
        v-for="space in filteredSpaces"
        :key="space.handle"
        class="explore-line"
      >
        <NuxtLink class="explore-main" :to="`/space/${space.handle}`">
          <span>@{{ space.handle }}</span>
          <span>{{ space.fragments.length }} drops</span>
          <strong>{{ space.name || space.bio || space.handle }}</strong>
          <span class="explore-bio">{{ space.bio || 'open canvas' }}</span>
          <span class="explore-tags">{{ space.fragments.flatMap((fragment) => fragment.tags ?? []).slice(0, 5).join(' / ') || 'open space' }}</span>
          <span class="explore-links">{{ space.links?.slice(0, 2).map(linkLabel).join(' / ') || `${space.followers} followers` }}</span>
          <span>{{ space.status }}</span>
        </NuxtLink>
        <button type="button" class="social-button" :class="{ active: space.followedByMe }" @click="toggleFollow(space)">
          {{ pendingFollow === space.handle ? '...' : space.followedByMe ? 'following' : 'follow' }}
        </button>
      </article>
    </section>
  </main>
</template>
