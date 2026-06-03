<script setup lang="ts">
import type { SpaceRecord } from './types/canvas'

const { data: settings } = await useFetch<Pick<SpaceRecord, 'theme'>>('/api/settings')

const themeStyle = computed(() => {
  const theme = settings.value?.theme
  if (!theme) return {}

  return {
    '--page': theme.page,
    '--ink': theme.ink,
    '--muted': theme.muted,
    '--line': theme.line,
    '--line-dark': theme.ink,
    '--chrome': theme.chrome,
    '--blue': theme.accent,
    '--panel-bg': 'color-mix(in srgb, var(--page) 88%, var(--ink) 12%)',
    '--panel-fg': 'var(--ink)',
    '--panel-muted': 'color-mix(in srgb, var(--ink) 58%, var(--page) 42%)',
    '--panel-border': 'color-mix(in srgb, var(--ink) 78%, var(--page) 22%)',
    '--app-grid-size': `${theme.gridSize}px`,
    '--app-radius': `${theme.radius}px`,
    '--grid-opacity': theme.grid ? 1 : 0
  }
})

watchEffect(() => {
  if (!import.meta.client) return

  const root = document.documentElement
  const style = themeStyle.value

  for (const [key, value] of Object.entries(style)) {
    root.style.setProperty(key, String(value))
  }
})
</script>

<template>
  <div :style="themeStyle">
    <AppTopbar />
    <NuxtPage />
  </div>
</template>
