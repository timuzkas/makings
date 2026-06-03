<script setup lang="ts">
import type { CanvasFragment, SpaceRecord, SpaceSummary } from '../types/canvas'

const props = defineProps<{
  currentHandle: string
  currentFragments: CanvasFragment[]
  modelSpaceHandle?: string
  modelFragmentId?: string
}>()

const emit = defineEmits<{
  'update:modelSpaceHandle': [value: string]
  'update:modelFragmentId': [value: string]
}>()

const open = ref(false)
const root = ref<HTMLElement | null>(null)
const popover = ref<HTMLElement | null>(null)
const popoverStyle = reactive({
  top: '0px',
  left: '0px',
  width: '320px'
})

const { data: spaces } = await useFetch<SpaceSummary[]>('/api/spaces', {
  default: () => []
})

const selectedHandle = computed(() => props.modelSpaceHandle?.trim() || props.currentHandle)
const selectedSpaceLabel = computed(() => {
  if (!props.modelSpaceHandle?.trim()) return `this space · @${props.currentHandle}`
  const match = spaces.value.find((space) => space.handle === props.modelSpaceHandle)
  return match ? `${match.name} · @${match.handle}` : `@${props.modelSpaceHandle}`
})

const { data: remoteSpace } = await useFetch<SpaceRecord | null>(
  () => selectedHandle.value && selectedHandle.value !== props.currentHandle ? `/api/spaces/${selectedHandle.value}` : null,
  {
    default: () => null,
    watch: [selectedHandle]
  }
)

const fragmentOptions = computed(() => {
  const fragments = selectedHandle.value === props.currentHandle
    ? props.currentFragments
    : (remoteSpace.value?.fragments ?? [])

  return fragments.map((fragment) => ({
    id: fragment.id,
    label: fragment.title
  }))
})

const selectedFragmentLabel = computed(() => {
  if (!props.modelFragmentId?.trim()) return 'space root'
  const match = fragmentOptions.value.find((fragment) => fragment.id === props.modelFragmentId)
  return match ? match.label : props.modelFragmentId
})

const orderedSpaces = computed(() => {
  const current = spaces.value.find((space) => space.handle === props.currentHandle)
  const others = spaces.value.filter((space) => space.handle !== props.currentHandle)
  return current ? [current, ...others] : spaces.value
})

function chooseSpace(handle: string) {
  emit('update:modelSpaceHandle', handle === props.currentHandle ? '' : handle)
  emit('update:modelFragmentId', '')
}

function chooseFragment(fragmentId: string) {
  emit('update:modelFragmentId', fragmentId)
  open.value = false
}

function closeOnOutside(event: MouseEvent) {
  if (!open.value) return
  const target = event.target as Node | null
  if (target && root.value && popover.value && !root.value.contains(target) && !popover.value.contains(target)) {
    open.value = false
  }
}

function updatePosition() {
  if (!root.value) return
  const rect = root.value.getBoundingClientRect()
  const width = Math.min(320, window.innerWidth - 16)
  const maxHeight = Math.min(420, window.innerHeight - 16)
  const opensUp = rect.bottom + 6 + maxHeight > window.innerHeight && rect.top > window.innerHeight - rect.bottom
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))
  popoverStyle.top = `${opensUp ? Math.max(8, rect.top - maxHeight - 6) : rect.bottom + 6}px`
  popoverStyle.left = `${left}px`
  popoverStyle.width = `${width}px`
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
  <div ref="root" class="portal-target-picker" :class="{ open }">
    <button
      type="button"
      class="portal-target-button"
      :aria-expanded="open"
      aria-label="Portal target"
      @click="open = !open"
    >
      <span class="portal-target-label">portal target</span>
      <span class="portal-target-summary">
        <strong class="portal-target-space">{{ selectedSpaceLabel }}</strong>
        <span class="portal-target-divider">/</span>
        <span class="portal-target-fragment">{{ selectedFragmentLabel }}</span>
      </span>
      <span class="portal-target-chevron">▾</span>
    </button>
    <Teleport to="body">
      <div v-show="open" ref="popover" class="portal-target-popover" :style="popoverStyle">
        <div class="portal-target-columns">
        <div class="portal-target-section">
          <span class="portal-target-section-label">space</span>
          <button
            type="button"
            class="portal-target-option"
            :class="{ active: !modelSpaceHandle }"
            @click="chooseSpace(currentHandle)"
          >
            <strong>this space</strong>
            <span>@{{ currentHandle }}</span>
          </button>
          <button
            v-for="space in orderedSpaces.filter((item) => item.handle !== currentHandle)"
            :key="space.handle"
            type="button"
            class="portal-target-option"
            :class="{ active: selectedHandle === space.handle }"
            @click="chooseSpace(space.handle)"
          >
            <strong>{{ space.name }}</strong>
            <span>@{{ space.handle }}</span>
          </button>
        </div>

        <div class="portal-target-section">
          <span class="portal-target-section-label">fragment</span>
          <button
            type="button"
            class="portal-target-option"
            :class="{ active: !modelFragmentId }"
            @click="chooseFragment('')"
          >
            <strong>space root</strong>
            <span>no fragment focus</span>
          </button>
          <button
            v-for="fragment in fragmentOptions"
            :key="fragment.id"
            type="button"
            class="portal-target-option"
            :class="{ active: modelFragmentId === fragment.id }"
            @click="chooseFragment(fragment.id)"
          >
            <strong>{{ fragment.label }}</strong>
            <span>{{ fragment.id }}</span>
          </button>
        </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
