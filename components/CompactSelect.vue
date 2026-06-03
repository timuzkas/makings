<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'

type Option = {
  label: string
  value: string
}

const props = defineProps<{
  label: string
  modelValue: string
  options: Option[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const open = ref(false)
const root = ref<HTMLElement | null>(null)
const popover = ref<HTMLElement | null>(null)
const currentLabel = computed(() => props.options.find((option) => option.value === props.modelValue)?.label ?? props.modelValue)
const popoverStyle = reactive({
  top: '0px',
  left: '0px',
  width: '240px'
})

function choose(value: string) {
  emit('update:modelValue', value)
  open.value = false
}

function updatePosition() {
  if (!root.value) return
  const rect = root.value.getBoundingClientRect()
  const width = Math.min(240, window.innerWidth - 16)
  const maxHeight = Math.min(320, window.innerHeight - 16)
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
</script>

<template>
  <div ref="root" class="compact-select" :class="{ open }">
    <button
      type="button"
      class="compact-select-button"
      :aria-expanded="open"
      :aria-label="label"
      @click="open = !open"
    >
      <span class="compact-select-label">{{ label }}</span>
      <span class="compact-select-value">{{ currentLabel }}</span>
      <span class="compact-select-chevron">▾</span>
    </button>
    <Teleport to="body">
      <div ref="popover" v-show="open" class="compact-select-popover" :style="popoverStyle" role="listbox" :aria-label="label">
        <button
          v-for="option in options"
          :key="option.value"
          type="button"
          class="compact-select-option"
          :class="{ active: modelValue === option.value }"
          @pointerdown.prevent="choose(option.value)"
        >
          {{ option.label }}
        </button>
      </div>
    </Teleport>
  </div>
</template>
