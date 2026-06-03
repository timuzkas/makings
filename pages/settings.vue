<script setup lang="ts">
import type { CanvasNode, SpaceLink, SpaceRecord } from '../types/canvas'

interface SettingsPayload {
  handle: string
  name: string
  status?: string
  links?: SpaceLink[]
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
const editableLinks = computed(() => (settings.value?.links ?? []).map(normalizeLink))

function splitCsv(value?: string) {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function normalizeLink(link: SpaceLink) {
  if (typeof link === 'string') {
    return {
      label: linkLabel(link),
      url: link
    }
  }

  return {
    label: link.label ?? '',
    url: link.url
  }
}

function normalizeLinks(links: SpaceLink[] = []) {
  return links
    .map(normalizeLink)
    .map((link) => ({
      label: link.label.trim(),
      url: link.url.trim()
    }))
    .filter((link) => link.url)
}

function linkLabel(link: string) {
  return link.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').replace(/\/$/, '')
}

function patchLink(index: number, patch: Partial<{ label: string, url: string }>) {
  if (!settings.value) return
  const links = editableLinks.value
  links[index] = { ...links[index], ...patch }
  settings.value.links = links
}

function addLink() {
  if (!settings.value) return
  settings.value.links = [...editableLinks.value, { label: '', url: '' }]
}

function removeLink(index: number) {
  if (!settings.value) return
  settings.value.links = editableLinks.value.filter((_, linkIndex) => linkIndex !== index)
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
    body: {
      ...settings.value,
      links: normalizeLinks(settings.value.links)
    }
  })
  saving.value = false
  await refresh()
}

function resetTheme() {
  if (!settings.value?.theme) return
  settings.value.theme = {
    page: '#ffffff',
    ink: '#101010',
    muted: '#686866',
    line: '#dddddd',
    chrome: '#ffffff',
    accent: '#3a71ff',
    grid: true,
    gridSize: 40,
    radius: 8,
    rasterization: true
  }
}
</script>

<template>
  <main v-if="settings && profile && theme" class="page page-settings">
    <button class="settings-reset" type="button" @click="resetTheme">reset theme</button>
    <section class="settings-column">
      <div class="settings-band">
        <label class="settings-field">
          <span>space name</span>
          <input v-model="settings.name" aria-label="Name" placeholder="Public name for your space" />
        </label>
        <label class="settings-field">
          <span>status</span>
          <input v-model="settings.status" aria-label="Status" placeholder="Short line shown near your handle" />
        </label>
        <div class="settings-field">
          <span>links</span>
          <div v-for="(link, index) in editableLinks" :key="index" class="settings-link-row">
            <input
              :value="link.label"
              :aria-label="`Link ${index + 1} display name`"
              placeholder="display name"
              @input="patchLink(index, { label: ($event.target as HTMLInputElement).value })"
            />
            <input
              :value="link.url"
              :aria-label="`Link ${index + 1} URL`"
              placeholder="https://example.com"
              @input="patchLink(index, { url: ($event.target as HTMLInputElement).value })"
            />
            <button type="button" aria-label="Remove link" @click="removeLink(index)">x</button>
          </div>
          <button type="button" class="settings-add-link" @click="addLink">add link</button>
        </div>
      </div>

      <div class="settings-band">
        <label class="settings-field">
          <span>profile avatar</span>
          <input :value="profile.avatar" aria-label="Avatar" placeholder="Image URL for your profile node" @input="patchProfile({ avatar: ($event.target as HTMLInputElement).value })" />
        </label>
        <label class="settings-field">
          <span>profile name</span>
          <input :value="profile.nickname" aria-label="Nickname" placeholder="Name shown inside profile nodes" @input="patchProfile({ nickname: ($event.target as HTMLInputElement).value })" />
        </label>
        <label class="settings-field">
          <span>profile description</span>
          <textarea :value="profile.description" aria-label="Description" rows="4" placeholder="Short profile text for profile nodes" @input="patchProfile({ description: ($event.target as HTMLTextAreaElement).value })" />
        </label>
        <label class="settings-field">
          <span>profile tags</span>
          <input :value="profile.tags?.join(', ')" aria-label="Tags" placeholder="design, research, music" @input="patchProfile({ tags: splitCsv(($event.target as HTMLInputElement).value) })" />
        </label>
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
          <input :value="theme.gridSize" type="number" min="12" placeholder="40" @input="patchTheme('gridSize', Number(($event.target as HTMLInputElement).value))" />
        </label>
        <label class="setting-inline">
          <span>radius</span>
          <input :value="theme.radius" type="number" min="0" placeholder="8" @input="patchTheme('radius', Number(($event.target as HTMLInputElement).value))" />
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
