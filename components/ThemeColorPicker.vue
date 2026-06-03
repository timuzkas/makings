<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'

interface Preset {
  label: string
  value: string
}

const props = withDefaults(defineProps<{
  label: string
  modelValue: string
  presets?: Preset[]
}>(), {
  presets: () => [
    { label: 'page', value: 'var(--page)' },
    { label: 'ink', value: 'var(--ink)' },
    { label: 'muted', value: 'var(--muted)' },
    { label: 'line', value: 'var(--line)' },
    { label: 'chrome', value: 'var(--chrome)' },
    { label: 'accent', value: 'var(--accent)' }
  ]
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const open = ref(false)
const root = ref<HTMLElement | null>(null)
const popover = ref<HTMLElement | null>(null)
const popoverStyle = reactive({
  top: '0px',
  left: '0px',
  width: '380px'
})
const hexDraft = ref(props.modelValue)
const normalizedHex = computed(() => normalizeHex(props.modelValue))
const colorInputValue = computed(() => normalizedHex.value ?? '#000000')

function normalizeHex(value: string) {
  const match = value.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (!match) return ''
  const hex = match[1]
  return `#${hex.length === 3 ? hex.split('').map((char) => char + char).join('') : hex}`.toLowerCase()
}

function pick(value: string) {
  emit('update:modelValue', value)
}

function pickHex(value: string) {
  hexDraft.value = value
  const hex = normalizeHex(value)
  if (hex) pick(hex)
}

function updatePosition() {
  if (!root.value) return
  const rect = root.value.getBoundingClientRect()
  const width = Math.min(380, window.innerWidth - 16)
  const maxHeight = Math.min(360, window.innerHeight - 16)
  const opensUp = rect.bottom + 6 + maxHeight > window.innerHeight && rect.top > window.innerHeight - rect.bottom
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))
  popoverStyle.top = `${opensUp ? Math.max(8, rect.top - maxHeight - 6) : rect.bottom + 6}px`
  popoverStyle.left = `${left}px`
  popoverStyle.width = `${width}px`
}

function closeOnOutside(event: MouseEvent) {
  if (!open.value) return
  const target = event.target as Node | null
  if (
    target
    && root.value
    && popover.value
    && !root.value.contains(target)
    && !popover.value.contains(target)
  ) {
    open.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', closeOnOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', closeOnOutside)
  window.removeEventListener('resize', updatePosition)
  window.removeEventListener('scroll', updatePosition, true)
})

watch(open, async (nextOpen) => {
  if (!nextOpen) {
    window.removeEventListener('resize', updatePosition)
    window.removeEventListener('scroll', updatePosition, true)
    return
  }
  await nextTick()
  updatePosition()
  window.addEventListener('resize', updatePosition)
  window.addEventListener('scroll', updatePosition, true)
})

watch(() => props.modelValue, (value) => {
  hexDraft.value = value
})
</script>

<template>
  <div ref="root" class="color-picker" :class="{ open }">
    <button
      type="button"
      class="color-picker-chip"
      :aria-expanded="open"
      :aria-label="`${label} color ${modelValue}`"
      @click="open = !open"
    >
      <span class="color-picker-swatch" :style="{ background: modelValue }" />
      <span class="color-picker-label">{{ label }}</span>
      <span class="color-picker-chev">▾</span>
    </button>
    <Teleport to="body">
      <div ref="popover" v-show="open" class="color-picker-popover" :style="popoverStyle" aria-label="Theme colors">
        <label class="color-picker-head">
          <span>hex</span>
          <input
            :value="hexDraft"
            class="color-picker-hex"
            inputmode="text"
            placeholder="#101010"
            spellcheck="false"
            @input="pickHex(($event.target as HTMLInputElement).value)"
          />
          <input :value="colorInputValue" type="color" @input="pick(($event.target as HTMLInputElement).value)" />
        </label>
        <div class="color-picker-swatches">
          <button
            v-for="preset in props.presets"
            :key="preset.label"
            type="button"
            class="color-swatch"
            :class="{ active: modelValue === preset.value }"
            :style="{ background: preset.value }"
            :title="preset.label"
            :aria-label="`${label}: ${preset.label}`"
            @click="pick(preset.value)"
          >
            <span class="sr-only">{{ preset.label }}</span>
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>
