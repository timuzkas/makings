<script setup lang="ts">
import type { AuthUser } from '../types/canvas'

const { data: auth, refresh } = await useFetch<{ user: AuthUser | null }>('/api/auth/me', {
  default: () => ({ user: null })
})

async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  await refresh()
  await navigateTo('/')
}
</script>

<template>
  <nav class="top-island" aria-label="Main">
    <div class="nav-cluster">
      <NuxtLink to="/" aria-label="Feed">feed</NuxtLink>
      <NuxtLink to="/explore" aria-label="Explore">explore</NuxtLink>
      <NuxtLink :to="`/space/${auth.user?.handle ?? 'ena'}`" aria-label="Space">space</NuxtLink>
      <NuxtLink v-if="!auth.user" to="/login" aria-label="Login">login</NuxtLink>
      <button v-else type="button" class="top-user" @click="logout">@{{ auth.user.handle }}</button>
    </div>
  </nav>
</template>
