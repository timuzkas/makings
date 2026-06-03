<script setup lang="ts">
import type { CanvasNode, SpaceRecord } from '../types/canvas'

interface SettingsPayload {
  handle: string
  name: string
  bio?: string
  status?: string
  links?: string[]
  googleFonts?: string[]
  theme?: SpaceRecord['theme']
  profile?: CanvasNode
}

const saving = ref(false)
const fontName = ref('')
const { data: settings, refresh } = await useFetch<SettingsPayload>('/api/settings')

const profile = computed(() => settings.value?.profile)
const theme = computed(() => settings.value?.theme)
const themePresets = computed(() => theme.value ? [
  { key: 'page', label: 'page', value: theme.value.page },
  { key: 'ink', label: 'ink', value: theme.value.ink },
  { key: 'muted', label: 'muted', value: theme.value.muted },
  { key: 'line', label: 'line', value: theme.value.line },
  { key: 'chrome', label: 'chrome', value: theme.value.chrome },
  { key: 'accent', label: 'accent', value: theme.value.accent }
] : [])

function splitCsv(value?: string) {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function patchProfile(patch: Partial<CanvasNode>) {
  if (!settings.value?.profile) return
  settings.value.profile = { ...settings.value.profile, ...patch }
}

function patchTheme(key: keyof NonNullable<SpaceRecord['theme']>, value: string | boolean | number) {
  if (!settings.value?.theme) return
  settings.value.theme = { ...settings.value.theme, [key]: value }
}

function addFont() {
  if (!settings.value) return
  const font = fontName.value.trim()
  if (!font) return
  settings.value.googleFonts = [...new Set([...(settings.value.googleFonts ?? []), font])]
  fontName.value = ''
}

function removeFont(font: string) {
  if (!settings.value) return
  settings.value.googleFonts = (settings.value.googleFonts ?? []).filter((item) => item !== font)
}

async function save() {
  if (!settings.value) return
  saving.value = true
  await $fetch('/api/settings', {
    method: 'PATCH',
    body: settings.value
  })
  saving.value = false
  await refresh()
}
</script>

<template>
  <main v-if="settings && profile && theme" class="page page-settings">
    <section class="settings-column">
      <div class="settings-band">
        <input v-model="settings.name" aria-label="Name" />
        <input v-model="settings.status" aria-label="Status" />
        <textarea v-model="settings.bio" aria-label="Bio" rows="4" />
        <input
          :value="settings.links?.join(', ')"
          aria-label="Links"
          @input="settings.links = splitCsv(($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="settings-band">
        <input :value="profile.avatar" aria-label="Avatar" @input="patchProfile({ avatar: ($event.target as HTMLInputElement).value })" />
        <input :value="profile.nickname" aria-label="Nickname" @input="patchProfile({ nickname: ($event.target as HTMLInputElement).value })" />
        <textarea :value="profile.description" aria-label="Description" rows="4" @input="patchProfile({ description: ($event.target as HTMLTextAreaElement).value })" />
        <input :value="profile.tags?.join(', ')" aria-label="Tags" @input="patchProfile({ tags: splitCsv(($event.target as HTMLInputElement).value) })" />
      </div>
    </section>

    <section class="settings-column">
      <div class="theme-grid">
        <ThemeColorPicker
          v-for="preset in themePresets"
          :key="preset.label"
          :label="preset.label"
          :model-value="preset.value"
          :presets="themePresets"
          @update:model-value="patchTheme(preset.key as keyof NonNullable<SpaceRecord['theme']>, $event)"
        />
      </div>

      <div class="settings-band">
        <label class="setting-inline">
          <span>grid</span>
          <input :checked="theme.grid" type="checkbox" @change="patchTheme('grid', ($event.target as HTMLInputElement).checked)" />
        </label>
        <label class="setting-inline">
          <span>grid size</span>
          <input :value="theme.gridSize" type="number" min="12" @input="patchTheme('gridSize', Number(($event.target as HTMLInputElement).value))" />
        </label>
        <label class="setting-inline">
          <span>radius</span>
          <input :value="theme.radius" type="number" min="0" @input="patchTheme('radius', Number(($event.target as HTMLInputElement).value))" />
        </label>
        <label class="setting-inline">
          <span>rasterization</span>
          <input :checked="theme.rasterization !== false" type="checkbox" @change="patchTheme('rasterization', ($event.target as HTMLInputElement).checked)" />
        </label>
      </div>

      <div class="settings-band">
        <div class="font-importer settings-fonts">
          <input v-model="fontName" aria-label="Google font" placeholder="Google font name" />
          <button type="button" @click="addFont">import</button>
          <div v-for="font in settings.googleFonts" :key="font" class="font-chip">
            <button type="button">{{ font }}</button>
            <button type="button" class="font-delete" :aria-label="`Delete ${font}`" @click="removeFont(font)">x</button>
          </div>
        </div>
      </div>

      <button class="settings-save" type="button" @click="save">{{ saving ? 'saving' : 'save settings' }}</button>
    </section>
  </main>
</template>
