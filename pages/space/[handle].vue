<script setup lang="ts">
import type { ActionType, AuthUser, CanvasNode, CanvasTrigger, NodeMediaKind, NodeMediaRef, SpaceLink, SpaceRecord, TriggerType } from '../../types/canvas'
import { MAX_MEDIA_BYTES, mediaKindFromNodeKind, normalizeMediaRef } from '../../utils/media'

const route = useRoute()
const handle = computed(() => String(route.params.handle))
const surface = ref()
const mode = ref<'view' | 'edit'>('view')
const selected = ref<CanvasNode | null>(null)
const saving = ref(false)
const mediaBusy = ref(false)
const mediaError = ref('')
const followPending = ref(false)
const googleFontName = ref('')
const mediaDraftUrl = ref('')
const mediaInput = ref<HTMLInputElement | null>(null)
const capturing = ref(false)
const effectSettingsOpen = ref(false)
const captureFrame = reactive({
  x: 180,
  y: 150,
  w: 360,
  h: 260
})
const captureDraft = reactive({
  title: '',
  caption: '',
  tags: ''
})
const triggerDraft = reactive({
  type: 'click' as TriggerType,
  action: 'toggle' as ActionType,
  targetId: '',
  fragmentId: '',
  message: 'signal',
  color: '#35f28f',
  animation: 'pulse' as CanvasNode['animation'],
  property: 'color',
  value: '#35f28f',
  delaySeconds: 0
})
const editingTriggerId = ref('')
const triggerProperties = [
  'text',
  'nickname',
  'description',
  'tags',
  'color',
  'textColor',
  'borderColor',
  'arrowEnd',
  'x',
  'y',
  'w',
  'h',
  'r',
  'scale',
  'lineStartX',
  'lineStartY',
  'lineEndX',
  'lineEndY',
  'lineBendX',
  'lineBendY',
  'opacity',
  'radius',
  'padding',
  'gap',
  'fontSize',
  'fontWeight',
  'effectStrength',
  'shadowX',
  'shadowY',
  'blurAmount',
  'outlineSize',
  'tiltX',
  'tiltY',
  'perspective',
  'layout',
  'effect',
  'animation',
  'hidden'
]

const { data: space, refresh } = await useFetch<SpaceRecord>(() => `/api/spaces/${handle.value}`)
const { data: auth } = await useFetch<{ user: AuthUser | null }>('/api/auth/me', {
  default: () => ({ user: null })
})
const canEdit = computed(() => Boolean(space.value && auth.value.user?.handle === space.value.handle))
const rasterizationEnabled = computed(() => space.value?.theme?.rasterization !== false)

const googleFontLinks = computed(() => {
  return (space.value?.googleFonts ?? []).map((font) => ({
    rel: 'stylesheet',
    href: `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font).replaceAll('%20', '+')}:wght@300;400;500;600;700;800;900&display=swap`
  }))
})
const themePresets = computed(() => {
  const theme = space.value?.theme
  if (!theme) return []

  return [
    { key: 'page', label: 'page', value: theme.page },
    { key: 'ink', label: 'ink', value: theme.ink },
    { key: 'muted', label: 'muted', value: theme.muted },
    { key: 'line', label: 'line', value: theme.line },
    { key: 'chrome', label: 'chrome', value: theme.chrome },
    { key: 'accent', label: 'accent', value: theme.accent }
  ]
})
const spaceThemeStyle = computed(() => {
  const theme = space.value?.theme
  if (!theme) return {}

  return {
    '--page': theme.page,
    '--ink': theme.ink,
    '--muted': theme.muted,
    '--line': theme.line,
    '--line-dark': theme.ink,
    '--chrome': theme.chrome,
    '--accent': theme.accent,
    '--blue': theme.accent,
    '--panel-bg': 'color-mix(in srgb, var(--page) 88%, var(--ink) 12%)',
    '--panel-fg': 'var(--ink)',
    '--panel-muted': 'color-mix(in srgb, var(--ink) 58%, var(--page) 42%)',
    '--panel-border': 'color-mix(in srgb, var(--ink) 78%, var(--page) 22%)',
    '--control-bg': 'var(--panel-bg)',
    '--control-fg': 'var(--panel-fg)',
    '--control-muted': 'var(--panel-muted)',
    '--control-border': 'var(--panel-border)',
    '--control-active-bg': 'var(--ink)',
    '--control-active-fg': 'var(--page)',
    '--control-accent': 'var(--accent)',
    '--control-accent-soft': 'color-mix(in srgb, var(--accent) 16%, var(--panel-bg))',
    '--app-grid-size': `${theme.gridSize}px`,
    '--app-radius': `${theme.radius}px`,
    '--grid-opacity': theme.grid ? 1 : 0
  }
})

useHead(() => ({
  link: googleFontLinks.value
}))

const nodeOptions = computed(() => space.value?.nodes ?? [])
const fragmentOptions = computed(() => space.value?.fragments ?? [])
const kindOptions = [
  { label: 'profile', value: 'profile' },
  { label: 'text', value: 'text' },
  { label: 'shape', value: 'shape' },
  { label: 'line', value: 'line' },
  { label: 'image', value: 'image' },
  { label: 'video', value: 'video' },
  { label: 'audio', value: 'audio' },
  { label: 'portal', value: 'portal' }
]
const triggerTypeOptions = [
  { label: 'click', value: 'click' },
  { label: 'hover', value: 'hover' },
  { label: 'load', value: 'load' },
  { label: 'message', value: 'message' }
]
const triggerActionOptions = [
  { label: 'toggle visibility', value: 'toggle' },
  { label: 'show object', value: 'show' },
  { label: 'hide object', value: 'hide' },
  { label: 'toggle audio', value: 'toggle-audio' },
  { label: 'toggle video', value: 'toggle-video' },
  { label: 'move camera', value: 'focus' },
  { label: 'send message', value: 'message' },
  { label: 'change color', value: 'tint' },
  { label: 'set animation', value: 'animate' },
  { label: 'set any property', value: 'set-property' }
]
const layoutOptions = [
  { label: 'center', value: 'center' },
  { label: 'start', value: 'start' },
  { label: 'end', value: 'end' },
  { label: 'stretch', value: 'stretch' }
]
const effectOptions = [
  { label: 'none', value: 'none' },
  { label: 'shadow', value: 'shadow' },
  { label: 'hard', value: 'hard-shadow' },
  { label: 'blur', value: 'blur' },
  { label: 'invert', value: 'invert' },
  { label: 'outline', value: 'outline' }
]
const animationOptions = [
  { label: 'still', value: 'none' },
  { label: 'pulse', value: 'pulse' },
  { label: 'float', value: 'float' },
  { label: 'spin', value: 'spin' },
  { label: 'breathe', value: 'breathe' },
  { label: 'jitter', value: 'jitter' }
]
const fontFamilyOptions = computed(() => [
  { label: 'avenir', value: 'Avenir Next, Segoe UI, Helvetica Neue, sans-serif' },
  { label: 'serif', value: 'Georgia, Times New Roman, serif' },
  { label: 'mono', value: 'Courier New, monospace' },
  { label: 'impact', value: 'Impact, Haettenschweiler, Arial Narrow Bold, sans-serif' },
  { label: 'soft', value: 'Trebuchet MS, Lucida Grande, sans-serif' },
  ...(space.value?.googleFonts ?? []).map((font) => ({ label: font, value: fontStack(font) }))
])

function nodeLabel(node: CanvasNode) {
  return node.label || node.nickname || node.text || `${node.kind} ${node.id.slice(-4)}`
}

const triggerTargetOptions = computed(() => nodeOptions.value.map((node) => ({
  label: nodeLabel(node),
  value: node.id
})))
const fragmentSelectOptions = computed(() => fragmentOptions.value.map((fragment) => ({
  label: fragment.title,
  value: fragment.id
})))
const triggerPropertyOptions = computed(() => triggerProperties.map((property) => ({
  label: property,
  value: property
})))
const selectedMediaKind = computed(() => selected.value ? mediaKindFromNodeKind(selected.value.kind) : null)
const selectedMedia = computed(() => selected.value ? normalizeMediaRef(selected.value.media, selectedMediaKind.value ?? undefined) : undefined)
const selectedTriggers = computed(() => {
  if (!selected.value || !space.value) return []
  return space.value.triggers.filter((trigger) => trigger.sourceId === selected.value?.id)
})

watch(
  () => route.query.fragment,
  (fragment) => {
    if (fragment && surface.value) surface.value.focusFragment(String(fragment))
  },
  { immediate: true }
)

watch(
  () => route.query.mode,
  (nextMode) => {
    if (nextMode === 'edit' && canEdit.value) mode.value = 'edit'
  },
  { immediate: true }
)

watch(canEdit, (allowed) => {
  if (!allowed && mode.value === 'edit') {
    mode.value = 'view'
    capturing.value = false
    selected.value = null
  }
}, { immediate: true })

function setNodes(nodes: CanvasNode[]) {
  if (space.value) space.value.nodes = nodes
}

function selectNode(node: CanvasNode | null) {
  selected.value = node
  mediaDraftUrl.value = normalizeMediaRef(node?.media, mediaKindFromNodeKind(node?.kind ?? 'text') ?? undefined)?.src ?? ''
  mediaError.value = ''
  triggerDraft.targetId = node?.id ?? ''
  triggerDraft.fragmentId = space.value?.fragments[0]?.id ?? ''
  editingTriggerId.value = ''
}

function patchSelected(patch: Partial<CanvasNode>) {
  if (!selected.value) return
  if (patch.kind) {
    const nextKind = mediaKindFromNodeKind(patch.kind)
    const currentMedia = normalizeMediaRef(selected.value.media, selectedMediaKind.value ?? undefined)
    if (!nextKind) {
      patch.media = undefined
    } else if (currentMedia && currentMedia.kind !== nextKind) {
      patch.media = undefined
    }
  }
  selected.value = { ...selected.value, ...patch }
  surface.value?.updateSelected(patch)
}

function patchPortalTargetSpaceHandle(value: string) {
  const trimmed = value.trim().toLowerCase()
  patchSelected({ portalTargetSpaceHandle: trimmed || undefined })
}

function patchPortalTargetFragmentId(value: string) {
  const trimmed = value.trim()
  patchSelected({ portalTargetFragmentId: trimmed || undefined })
}

function linkHref(link: SpaceLink) {
  const raw = typeof link === 'string' ? link : link.url
  const trimmed = raw.trim()
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

function linkLabel(link: SpaceLink) {
  if (typeof link !== 'string' && link.label?.trim()) return link.label.trim()
  const raw = typeof link === 'string' ? link : link.url
  return raw.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').replace(/\/$/, '')
}

async function toggleFollowSpace() {
  if (!space.value || auth.value.user?.handle === space.value.handle) return

  followPending.value = true

  try {
    const result = await $fetch<{ following: boolean; followers: number }>('/api/social/follow', {
      method: 'POST',
      body: { handle: space.value.handle }
    })

    space.value.followers = result.followers
    space.value.followedByMe = result.following
  } catch {
    await navigateTo('/login')
  } finally {
    followPending.value = false
  }
}

function beginCapture() {
  capturing.value = true
  captureFrame.x = Math.round(window.innerWidth / 2 - 180)
  captureFrame.y = Math.round(window.innerHeight / 2 - 130)
  captureFrame.w = 360
  captureFrame.h = 260
}

function startCaptureMove(event: PointerEvent) {
  event.preventDefault()
  const target = event.currentTarget as HTMLElement
  const startX = event.clientX
  const startY = event.clientY
  const original = { ...captureFrame }

  target.setPointerCapture(event.pointerId)

  const move = (moveEvent: PointerEvent) => {
    captureFrame.x = Math.max(8, Math.min(window.innerWidth - captureFrame.w - 8, original.x + moveEvent.clientX - startX))
    captureFrame.y = Math.max(76, Math.min(window.innerHeight - captureFrame.h - 8, original.y + moveEvent.clientY - startY))
  }

  const up = () => {
    target.removeEventListener('pointermove', move)
    target.removeEventListener('pointerup', up)
    target.removeEventListener('pointercancel', up)
  }

  target.addEventListener('pointermove', move)
  target.addEventListener('pointerup', up)
  target.addEventListener('pointercancel', up)
}

function startCaptureResize(event: PointerEvent) {
  event.preventDefault()
  event.stopPropagation()
  const target = event.currentTarget as HTMLElement
  const startX = event.clientX
  const startY = event.clientY
  const original = { ...captureFrame }

  target.setPointerCapture(event.pointerId)

  const move = (moveEvent: PointerEvent) => {
    captureFrame.w = Math.max(120, Math.min(window.innerWidth - captureFrame.x - 8, original.w + moveEvent.clientX - startX))
    captureFrame.h = Math.max(90, Math.min(window.innerHeight - captureFrame.y - 8, original.h + moveEvent.clientY - startY))
  }

  const up = () => {
    target.removeEventListener('pointermove', move)
    target.removeEventListener('pointerup', up)
    target.removeEventListener('pointercancel', up)
  }

  target.addEventListener('pointermove', move)
  target.addEventListener('pointerup', up)
  target.addEventListener('pointercancel', up)
}

async function persistSpace() {
  if (!space.value || !surface.value || !canEdit.value) return

  saving.value = true
  await $fetch(`/api/spaces/${handle.value}`, {
    method: 'PATCH',
    body: {
      nodes: space.value.nodes,
      fragments: space.value.fragments,
      triggers: space.value.triggers,
      googleFonts: space.value.googleFonts
    }
  })
  saving.value = false
  await refresh()
}

async function publishCapture() {
  if (!space.value || !surface.value) return

  const title = captureDraft.title.trim() || `capture ${space.value.fragments.length + 1}`
  const id = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `fragment-${Date.now()}`
  const bounds = surface.value.screenRectToWorldBounds({ ...captureFrame })
  const fragment = {
    id,
    handle: space.value.handle,
    title,
    caption: captureDraft.caption.trim(),
    tags: captureDraft.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
    bounds
  }

  space.value.fragments = [...space.value.fragments.filter((item) => item.id !== id), fragment]
  captureDraft.title = ''
  captureDraft.caption = ''
  captureDraft.tags = ''
  capturing.value = false
  await persistSpace()
}

function patchTags(value: string) {
  patchSelected({
    tags: value
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
  })
}

function addGoogleFont() {
  if (!space.value || !canEdit.value) return

  const font = googleFontName.value.trim()
  if (!font) return

  space.value.googleFonts = [...new Set([...(space.value.googleFonts ?? []), font])]
  googleFontName.value = ''
}

function removeGoogleFont(font: string) {
  if (!space.value || !canEdit.value) return
  space.value.googleFonts = (space.value.googleFonts ?? []).filter((item) => item !== font)
}

function applyGoogleFont(font: string) {
  patchSelected({ fontFamily: fontStack(font) })
}

function fontStack(font: string) {
  return `"${font}", sans-serif`
}

type NumberField =
  | 'x'
  | 'y'
  | 'w'
  | 'h'
  | 'r'
  | 'scale'
  | 'z'
  | 'borderWidth'
  | 'radius'
  | 'padding'
  | 'gap'
  | 'opacity'
  | 'fontSize'
  | 'fontWeight'
  | 'animationMs'
  | 'effectStrength'
  | 'shadowX'
  | 'shadowY'
  | 'blurAmount'
  | 'outlineSize'
  | 'tiltX'
  | 'tiltY'
  | 'perspective'

function patchNumber(key: NumberField, value: string | number) {
  const parsed = Number(value)
  if (Number.isFinite(parsed)) patchSelected({ [key]: parsed })
}

function numberStep(key: NumberField) {
  if (key === 'opacity') return 0.01
  if (key === 'scale') return 0.01
  if (key === 'effectStrength' || key === 'blurAmount') return 0.1
  if (key === 'fontWeight') return 10
  if (key === 'animationMs') return 20
  if (key === 'perspective') return 20
  return 1
}

function clampNumber(key: NumberField, value: number) {
  if (['w', 'h'].includes(key)) return Math.max(24, value)
  if (['borderWidth', 'radius', 'padding', 'gap', 'effectStrength', 'blurAmount', 'outlineSize'].includes(key)) return Math.max(0, value)
  if (key === 'opacity') return Math.max(0, Math.min(1, value))
  if (key === 'scale') return Math.max(0.05, value)
  if (key === 'fontSize') return Math.max(6, value)
  if (key === 'fontWeight') return Math.max(100, Math.min(950, value))
  if (key === 'animationMs') return Math.max(120, value)
  if (key === 'perspective') return Math.max(120, value)
  if (key === 'tiltX' || key === 'tiltY') return Math.max(-70, Math.min(70, value))
  return value
}

function startNumberScrub(event: PointerEvent, key: NumberField, value: unknown) {
  if (!selected.value) return

  event.preventDefault()
  const target = event.currentTarget as HTMLElement
  const startX = event.clientX
  const startValue = Number(value ?? 0)
  const step = numberStep(key)

  target.setPointerCapture(event.pointerId)

  const move = (moveEvent: PointerEvent) => {
    const delta = moveEvent.clientX - startX
    const multiplier = moveEvent.shiftKey ? 5 : 1
    const next = clampNumber(key, startValue + delta * step * multiplier)
    patchNumber(key, key === 'opacity' ? next.toFixed(2) : Math.round(next))
  }

  const up = () => {
    target.removeEventListener('pointermove', move)
    target.removeEventListener('pointerup', up)
    target.removeEventListener('pointercancel', up)
  }

  target.addEventListener('pointermove', move)
  target.addEventListener('pointerup', up)
  target.addEventListener('pointercancel', up)
}

function triggerNeedsTarget(action: ActionType) {
  return ['toggle', 'show', 'hide', 'toggle-audio', 'toggle-video', 'tint', 'animate', 'set-property'].includes(action)
}

function resetTriggerDraft() {
  editingTriggerId.value = ''
  triggerDraft.type = 'click'
  triggerDraft.action = 'toggle'
  triggerDraft.targetId = selected.value?.id ?? ''
  triggerDraft.fragmentId = space.value?.fragments[0]?.id ?? ''
  triggerDraft.message = 'signal'
  triggerDraft.color = '#35f28f'
  triggerDraft.animation = 'pulse'
  triggerDraft.property = 'color'
  triggerDraft.value = '#35f28f'
  triggerDraft.delaySeconds = 0
}

function editTrigger(trigger: CanvasTrigger) {
  const action = trigger.actions[0]

  editingTriggerId.value = trigger.id
  triggerDraft.type = trigger.type
  triggerDraft.action = action?.type ?? 'toggle'
  triggerDraft.targetId = action?.targetId ?? selected.value?.id ?? ''
  triggerDraft.fragmentId = action?.fragmentId ?? space.value?.fragments[0]?.id ?? ''
  triggerDraft.message = action?.message ?? trigger.message ?? 'signal'
  triggerDraft.color = action?.color ?? '#35f28f'
  triggerDraft.animation = action?.animation ?? 'pulse'
  triggerDraft.property = action?.property ?? 'color'
  triggerDraft.value = String(action?.value ?? action?.color ?? '#35f28f')
  triggerDraft.delaySeconds = Number(action?.delayMs ?? 0) / 1000
}

function saveTrigger() {
  if (!space.value || !selected.value || !canEdit.value) return

  const trigger: CanvasTrigger = {
    id: editingTriggerId.value || `trigger-${crypto.randomUUID().slice(0, 8)}`,
    sourceId: selected.value.id,
    type: triggerDraft.type,
    message: triggerDraft.type === 'message' ? triggerDraft.message : undefined,
    actions: [
      {
        type: triggerDraft.action,
        delayMs: Math.max(0, Math.round(Number(triggerDraft.delaySeconds || 0) * 1000)),
        targetId: triggerNeedsTarget(triggerDraft.action) ? triggerDraft.targetId : undefined,
        fragmentId: triggerDraft.action === 'focus' ? triggerDraft.fragmentId : undefined,
        message: triggerDraft.action === 'message' ? triggerDraft.message : undefined,
        color: triggerDraft.action === 'tint' ? triggerDraft.color : undefined,
        animation: triggerDraft.action === 'animate' ? triggerDraft.animation : undefined,
        property: triggerDraft.action === 'set-property' ? triggerDraft.property : undefined,
        value: triggerDraft.action === 'set-property' ? triggerDraft.value : undefined
      }
    ]
  }

  if (editingTriggerId.value) {
    space.value.triggers = space.value.triggers.map((item) => (item.id === editingTriggerId.value ? trigger : item))
  } else {
    space.value.triggers = [...space.value.triggers, trigger]
  }

  resetTriggerDraft()
}

function removeTrigger(id: string) {
  if (!space.value || !canEdit.value) return
  space.value.triggers = space.value.triggers.filter((trigger) => trigger.id !== id)
  if (editingTriggerId.value === id) resetTriggerDraft()
}

async function deleteFragment(id: string) {
  if (!space.value || !canEdit.value) return
  space.value.fragments = space.value.fragments.filter((fragment) => fragment.id !== id)
  await persistSpace()
}

async function save() {
  if (!space.value || !canEdit.value) return
  await persistSpace()
}

function openMediaPicker() {
  const kind = selectedMediaKind.value
  if (!kind) {
    mediaError.value = 'Select an image, audio, or video node first.'
    return
  }

  if (!canEdit.value || mode.value !== 'edit') {
    mediaError.value = 'Switch to edit mode before uploading media.'
    return
  }

  mediaError.value = ''
  if (mediaInput.value) {
    mediaInput.value.value = ''
    mediaInput.value.click()
  }
}

async function onMediaFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  await applyFileToCanvas(file)
}

async function applyEmbedLink() {
  const kind = selectedMediaKind.value
  if (!selected.value || !kind) return

  const rawUrl = mediaDraftUrl.value.trim()
  if (!rawUrl) {
    patchSelected({ media: undefined })
    return
  }

  mediaBusy.value = true
  mediaError.value = ''

  try {
    const result = await $fetch<{ media: NodeMediaRef }>('/api/media/normalize', {
      method: 'POST',
      body: {
        url: rawUrl,
        kind
      }
    })

    patchSelected({
      text: '',
      media: result.media
    })
    mediaDraftUrl.value = result.media.src
  } catch (error: any) {
    mediaError.value = error?.data?.statusMessage ?? 'Use a direct media URL or a supported video link.'
  } finally {
    mediaBusy.value = false
  }
}

async function applyFileToCanvas(file: File, point?: { x: number; y: number }) {
  if (!space.value || !canEdit.value || mode.value !== 'edit') return

  const kind = mediaKindFromFile(file)
  if (!kind) {
    mediaError.value = 'Only image, audio, and video files are supported.'
    return
  }

  mediaBusy.value = true
  mediaError.value = ''

  try {
    const prepared = await prepareUploadCandidate(file, kind)
    if (prepared.file.size > MAX_MEDIA_BYTES) {
      throw new Error('This file can’t fit the free-tier upload limit. Use an embed link.')
    }

    const form = new FormData()
    form.set('space', space.value.handle)
    form.set('kind', kind)
    form.set('file', prepared.file, prepared.file.name)
    if (prepared.width) form.set('width', String(prepared.width))
    if (prepared.height) form.set('height', String(prepared.height))
    if (prepared.durationMs) form.set('durationMs', String(prepared.durationMs))

    const result = await $fetch<{ media: NodeMediaRef }>('/api/media/upload', {
      method: 'POST',
      body: form
    })

    if (selected.value && selectedMediaKind.value === kind) {
      patchSelected({
        text: '',
        media: result.media
      })
    } else {
      const targetPoint = point ?? {
        x: Math.round(window.innerWidth / 2),
        y: Math.round(window.innerHeight / 2)
      }
      surface.value?.addNodeAt(kind, targetPoint, {
        text: '',
        media: result.media
      })
    }

    mediaDraftUrl.value = result.media.src
  } catch (error: any) {
    mediaError.value = error?.data?.statusMessage ?? error?.message ?? 'Media upload failed.'
  } finally {
    mediaBusy.value = false
  }
}

async function prepareUploadCandidate(file: File, kind: NodeMediaKind) {
  if (file.size <= MAX_MEDIA_BYTES) {
    return {
      file,
      ...(await readMediaMetrics(file, kind))
    }
  }

  if (kind === 'image' && file.type !== 'image/gif') {
    const compressed = await compressImageFile(file)
    if (compressed) {
      return {
        file: compressed,
        ...(await readMediaMetrics(compressed, kind))
      }
    }
  }

  if (kind === 'audio' || kind === 'video') {
    const transcoded = await transcodeMediaFile(file, kind)
    if (transcoded) {
      return {
        file: transcoded,
        ...(await readMediaMetrics(transcoded, kind))
      }
    }
  }

  throw new Error('This file can’t fit the free-tier upload limit. Use an embed link.')
}

async function compressImageFile(file: File) {
  const image = await loadImage(file)
  const hasTransparency = imageHasTransparency(image)
  const widths = [image.naturalWidth, 1600, 1280, 960, 720, 540, 420]
    .filter((value, index, items) => value > 0 && items.indexOf(value) === index)
    .sort((a, b) => b - a)

  for (const width of widths) {
    const scale = Math.min(1, width / image.naturalWidth)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))

    const context = canvas.getContext('2d')
    if (!context) continue

    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const mimeTypes = hasTransparency ? ['image/webp', 'image/png'] : ['image/webp', 'image/jpeg']
    const qualities = hasTransparency ? [0.82, 0.72, 0.62] : [0.84, 0.74, 0.64, 0.54]

    for (const mimeType of mimeTypes) {
      for (const quality of qualities) {
        const blob = await canvasToBlob(canvas, mimeType, quality)
        if (blob && blob.size <= MAX_MEDIA_BYTES) {
          return new File([blob], renameFile(file.name, mimeType), { type: mimeType })
        }
      }
    }
  }

  return null
}

async function transcodeMediaFile(file: File, kind: 'audio' | 'video') {
  if (!('MediaRecorder' in window)) return null

  const element = document.createElement(kind)
  element.preload = 'auto'
  if (kind === 'video') {
    element.muted = true
    element.playsInline = true
  }

  const objectUrl = URL.createObjectURL(file)

  try {
    await new Promise<void>((resolve, reject) => {
      element.src = objectUrl
      element.onloadedmetadata = () => resolve()
      element.onerror = () => reject(new Error('Unable to read media file.'))
    })

    const stream = typeof element.captureStream === 'function' ? element.captureStream() : null
    if (!stream) return null

    const mimeType = pickRecorderMimeType(kind)
    if (!mimeType) return null

    const chunks: BlobPart[] = []
    const recorder = new MediaRecorder(stream, {
      mimeType,
      audioBitsPerSecond: kind === 'audio' ? 48_000 : 56_000,
      videoBitsPerSecond: kind === 'video' ? 180_000 : undefined
    })

    recorder.addEventListener('dataavailable', (event) => {
      if (event.data.size) chunks.push(event.data)
    })

    const stopped = new Promise<Blob>((resolve) => {
      recorder.addEventListener('stop', () => resolve(new Blob(chunks, { type: mimeType })), { once: true })
    })

    recorder.start(250)
    await element.play().catch(() => undefined)
    await waitForPlaybackToFinish(element)
    if (recorder.state !== 'inactive') recorder.stop()
    const blob = await stopped
    if (!blob.size || blob.size > MAX_MEDIA_BYTES) return null

    return new File([blob], renameFile(file.name, mimeType), { type: mimeType })
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

function pickRecorderMimeType(kind: 'audio' | 'video') {
  const candidates = kind === 'audio'
    ? ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus']
    : ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']

  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? null
}

function waitForPlaybackToFinish(element: HTMLMediaElement) {
  const durationMs = Number.isFinite(element.duration) ? element.duration * 1000 : 0
  const timeoutMs = Math.max(1000, Math.min(15000, durationMs + 1000))

  return new Promise<void>((resolve) => {
    let done = false
    const finish = () => {
      if (done) return
      done = true
      element.pause()
      element.removeEventListener('ended', finish)
      window.clearTimeout(timeout)
      resolve()
    }

    const timeout = window.setTimeout(finish, timeoutMs)
    element.addEventListener('ended', finish, { once: true })
  })
}

async function readMediaMetrics(file: File, kind: NodeMediaKind) {
  if (kind === 'image') {
    const image = await loadImage(file)
    return {
      width: image.naturalWidth,
      height: image.naturalHeight
    }
  }

  const media = await loadMediaElement(file, kind)
  return {
    width: kind === 'video' ? (media as HTMLVideoElement).videoWidth : undefined,
    height: kind === 'video' ? (media as HTMLVideoElement).videoHeight : undefined,
    durationMs: Number.isFinite(media.duration) ? Math.round(media.duration * 1000) : undefined
  }
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    const objectUrl = URL.createObjectURL(file)
    image.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Unable to read image.'))
    }
    image.src = objectUrl
  })
}

function imageHasTransparency(image: HTMLImageElement) {
  const canvas = document.createElement('canvas')
  canvas.width = Math.min(64, image.naturalWidth)
  canvas.height = Math.min(64, image.naturalHeight)
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return false
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height)
  for (let index = 3; index < data.length; index += 4) {
    if (data[index] < 255) return true
  }
  return false
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality?: number) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, quality)
  })
}

function renameFile(fileName: string, mimeType: string) {
  const stem = fileName.replace(/\.[^.]+$/, '') || 'media'
  const ext = mimeType.split('/')[1]?.split(';')[0]?.replace('mpeg', 'mp3')?.replace('jpeg', 'jpg') ?? 'bin'
  return `${stem}.${ext}`
}

function loadMediaElement(file: File, kind: 'audio' | 'video') {
  return new Promise<HTMLMediaElement>((resolve, reject) => {
    const element = document.createElement(kind)
    const objectUrl = URL.createObjectURL(file)
    element.preload = 'auto'
    element.onloadedmetadata = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(element)
    }
    element.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Unable to read media.'))
    }
    element.src = objectUrl
  })
}

function mediaKindFromFile(file: File): NodeMediaKind | null {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('audio/')) return 'audio'
  if (file.type.startsWith('video/')) return 'video'
  return null
}

function onPaste(event: ClipboardEvent) {
  if (!canEdit.value || mode.value !== 'edit') return
  const file = [...(event.clipboardData?.files ?? [])][0]
  if (!file) return
  event.preventDefault()
  void applyFileToCanvas(file)
}

function onDrop(event: DragEvent) {
  if (!canEdit.value || mode.value !== 'edit') return
  const file = event.dataTransfer?.files?.[0]
  if (!file) return
  event.preventDefault()
  void applyFileToCanvas(file, {
    x: event.clientX,
    y: event.clientY
  })
}

function onDragOver(event: DragEvent) {
  if (!canEdit.value || mode.value !== 'edit') return
  if (event.dataTransfer?.types.includes('Files')) {
    event.preventDefault()
  }
}

onMounted(() => {
  window.addEventListener('paste', onPaste)
  window.addEventListener('drop', onDrop)
  window.addEventListener('dragover', onDragOver)
})

onBeforeUnmount(() => {
  window.removeEventListener('paste', onPaste)
  window.removeEventListener('drop', onDrop)
  window.removeEventListener('dragover', onDragOver)
})
</script>

<template>
  <main v-if="space" class="page page-space" :style="spaceThemeStyle">
    <input
      ref="mediaInput"
      class="sr-only-input"
      type="file"
      :accept="selectedMediaKind === 'image' ? 'image/*' : selectedMediaKind === 'audio' ? 'audio/*' : selectedMediaKind === 'video' ? 'video/*' : 'image/*,audio/*,video/*'"
      @change="onMediaFileChange"
    />
    <CanvasSurface
      ref="surface"
      :nodes="space.nodes"
      :fragments="space.fragments"
      :triggers="space.triggers"
      :mode="mode"
      :space-handle="space.handle"
      :rasterization="rasterizationEnabled"
      @change="setNodes"
      @select="selectNode"
    />
    <aside class="space-left-stack">
      <div class="space-meta">
        <div class="space-identity">
          <div class="space-title-row">
            <NuxtLink class="space-handle" :to="`/space/${space.handle}`">@{{ space.handle }}</NuxtLink>
            <strong v-if="space.name" class="space-name">{{ space.name }}</strong>
          </div>
          <div v-if="space.links?.length" class="space-links">
            <a
              v-for="link in space.links"
              :key="typeof link === 'string' ? link : `${link.label}-${link.url}`"
              :href="linkHref(link)"
              target="_blank"
              rel="noreferrer"
            >
              {{ linkLabel(link) }}
            </a>
          </div>
        </div>
        <div class="space-meta-actions">
          <span v-if="space.status" class="space-status">{{ space.status }}</span>
          <span class="space-followers">{{ space.followers }} followers</span>
          <button v-if="auth.user?.handle !== space.handle" type="button" @click="toggleFollowSpace">{{ followPending ? '...' : space.followedByMe ? 'following' : 'follow' }}</button>
          <NuxtLink v-if="canEdit" class="meta-link" to="/settings">settings</NuxtLink>
        </div>
      </div>

      <div class="rail rail-left">
        <div v-for="fragment in space.fragments" :key="fragment.id" class="rail-item">
          <button
            class="rail-link"
            type="button"
            @click="surface?.focusFragment(fragment.id)"
          >
            {{ fragment.title }}
          </button>
          <button
            v-if="canEdit && mode === 'edit'"
            class="rail-delete"
            type="button"
            :title="`delete ${fragment.title}`"
            @click="deleteFragment(fragment.id)"
          >
            x
          </button>
        </div>
      </div>

      <div v-if="canEdit && mode === 'edit'" class="tool-dock" aria-label="Tools">
        <button type="button" title="Text" @click="surface?.addNode('text')">T</button>
        <button type="button" title="Shape" @click="surface?.addNode('shape')">□</button>
        <button type="button" title="Line / arrow" @click="surface?.addNode('line')">↗</button>
        <button type="button" title="Image" @click="surface?.addNode('image')">▧</button>
        <button type="button" title="Video" @click="surface?.addNode('video')">▶</button>
        <button type="button" title="Audio" @click="surface?.addNode('audio')">≋</button>
        <button type="button" title="Portal" @click="surface?.addNode('portal')">○</button>
      </div>
    </aside>

    <aside class="mode-switch" aria-label="Mode">
      <button type="button" :class="{ active: mode === 'view' }" @click="mode = 'view'">view</button>
      <button v-if="canEdit" type="button" :class="{ active: mode === 'edit' }" @click="mode = 'edit'">edit</button>
      <button v-if="canEdit && mode === 'edit'" type="button" @click="beginCapture">capture</button>
      <button v-if="canEdit && mode === 'edit'" type="button" @click="save">{{ saving ? '...' : 'save' }}</button>
    </aside>

    <div v-if="canEdit && capturing" class="capture-layer">
      <div class="capture-scrim" />
      <div
        class="capture-frame"
        :style="{
          transform: `translate(${captureFrame.x}px, ${captureFrame.y}px)`,
          width: `${captureFrame.w}px`,
          height: `${captureFrame.h}px`
        }"
        @pointerdown="startCaptureMove"
      >
        <span class="capture-corner" @pointerdown="startCaptureResize" />
      </div>
      <aside class="capture-panel">
        <span>capture region</span>
        <label>
          <span>name</span>
          <input v-model="captureDraft.title" placeholder="publish title" aria-label="Capture name" />
        </label>
        <label>
          <span>caption</span>
          <input v-model="captureDraft.caption" placeholder="caption" aria-label="Capture caption" />
        </label>
        <label>
          <span>tags</span>
          <input v-model="captureDraft.tags" placeholder="tags" aria-label="Capture tags" />
        </label>
        <div class="capture-actions">
          <button type="button" @click="publishCapture">push to feed</button>
          <button type="button" @click="capturing = false">cancel</button>
        </div>
      </aside>
    </div>

    <aside v-if="canEdit && mode === 'edit' && selected" class="property-dock" aria-label="Properties">
      <section class="dock-section">
        <span class="dock-section-label">object</span>
        <input :value="selected.label ?? ''" aria-label="Object name" placeholder="object name" @input="patchSelected({ label: ($event.target as HTMLInputElement).value })" />
        <CompactSelect
          label="kind"
          :model-value="selected.kind"
          :options="kindOptions"
          @update:model-value="patchSelected({ kind: $event as CanvasNode['kind'] })"
        />
        <ThemeColorPicker
          :label="'fill'"
          :model-value="selected.color"
          :presets="themePresets"
          @update:model-value="patchSelected({ color: $event })"
        />
        <label class="toggle-row">
          <input :checked="selected.interpolate !== false" type="checkbox" @change="patchSelected({ interpolate: ($event.target as HTMLInputElement).checked })" />
          interpolate
        </label>
        <label class="toggle-row">
          <input :checked="selected.hidden !== true" type="checkbox" @change="patchSelected({ hidden: !($event.target as HTMLInputElement).checked })" />
          visible
        </label>
        <label v-if="selected.kind === 'line'" class="toggle-row">
          <input :checked="selected.arrowEnd !== false" type="checkbox" @change="patchSelected({ arrowEnd: ($event.target as HTMLInputElement).checked })" />
          arrow end
        </label>
        <label v-if="selected.kind === 'line' && selected.arrowEnd !== false" class="toggle-row">
          <input :checked="selected.arrowHeadStyle !== 'lines'" type="checkbox" @change="patchSelected({ arrowHeadStyle: ($event.target as HTMLInputElement).checked ? 'filled' : 'lines' })" />
          filled head
        </label>

        <textarea v-if="selected.kind !== 'line'" :value="selected.text" aria-label="Text" rows="3" @input="patchSelected({ text: ($event.target as HTMLTextAreaElement).value })" />
        <PortalTargetPicker
          v-if="selected.kind === 'portal'"
          :current-handle="space.handle"
          :current-fragments="space.fragments"
          :model-space-handle="selected.portalTargetSpaceHandle"
          :model-fragment-id="selected.portalTargetFragmentId"
          @update:model-space-handle="patchPortalTargetSpaceHandle"
          @update:model-fragment-id="patchPortalTargetFragmentId"
        />
      </section>

      <section v-if="selectedMediaKind" class="dock-section media-fields">
        <span class="dock-section-label">media</span>
        <div class="dock-actions media-mode-actions">
          <button
            type="button"
            :class="{ active: selectedMedia?.mode !== 'embed' }"
            @click="openMediaPicker"
          >
            upload
          </button>
          <button
            type="button"
            :class="{ active: selectedMedia?.mode === 'embed' }"
            @click="patchSelected({ media: undefined })"
          >
            embed link
          </button>
        </div>
        <label>
          <span>embed url</span>
          <input v-model="mediaDraftUrl" placeholder="https://..." @keydown.enter.prevent="applyEmbedLink" />
        </label>
        <div class="dock-actions">
          <button type="button" @click="applyEmbedLink">{{ mediaBusy ? '...' : 'apply link' }}</button>
          <button type="button" @click="openMediaPicker">{{ mediaBusy ? '...' : 'upload file' }}</button>
        </div>
        <span class="media-hint">Hosted uploads are capped at 500 KB each and 10 MB per space. Larger files should use embeds.</span>
        <span v-if="selectedMedia?.mode === 'upload'" class="media-hint">
          hosted {{ Math.round((selectedMedia.bytes ?? 0) / 1024) }} KB
        </span>
        <span v-if="mediaError" class="media-error">{{ mediaError }}</span>
      </section>

        <section v-if="selected.kind === 'profile'" class="dock-section profile-fields">
          <span class="dock-section-label">profile</span>
          <input :value="selected.avatar" aria-label="Avatar" placeholder="avatar url" @input="patchSelected({ avatar: ($event.target as HTMLInputElement).value })" />
          <input :value="selected.nickname" aria-label="Nickname" placeholder="nickname" @input="patchSelected({ nickname: ($event.target as HTMLInputElement).value })" />
          <textarea :value="selected.description" aria-label="Description" rows="3" placeholder="description" @input="patchSelected({ description: ($event.target as HTMLTextAreaElement).value })" />
          <input :value="selected.tags?.join(', ') ?? ''" aria-label="Tags" placeholder="tags" @input="patchTags(($event.target as HTMLInputElement).value)" />
          <div class="profile-toggle-grid">
            <label>
              <input :checked="selected.showAvatar !== false" type="checkbox" @change="patchSelected({ showAvatar: ($event.target as HTMLInputElement).checked })" />
              avatar
            </label>
            <label>
              <input :checked="selected.showNickname !== false" type="checkbox" @change="patchSelected({ showNickname: ($event.target as HTMLInputElement).checked })" />
              name
            </label>
            <label>
              <input :checked="selected.showDescription !== false" type="checkbox" @change="patchSelected({ showDescription: ($event.target as HTMLInputElement).checked })" />
              bio
            </label>
            <label>
              <input :checked="selected.showTags !== false" type="checkbox" @change="patchSelected({ showTags: ($event.target as HTMLInputElement).checked })" />
              tags
            </label>
          </div>
        </section>

      <section class="dock-section">
        <span class="dock-section-label">frame</span>
        <div class="field-grid">
          <label v-for="field in ['x', 'y', 'w', 'h', 'r', 'scale', 'z']" :key="field">
            <span
              class="scrub-label"
              @pointerdown="startNumberScrub($event, field as 'x' | 'y' | 'w' | 'h' | 'r' | 'scale' | 'z', selected[field as keyof CanvasNode])"
            >
              {{ field === 'scale' ? 's' : field }}
            </span>
            <input
              :value="field === 'scale' ? Number(selected.scale ?? 1).toFixed(2) : Math.round(Number(selected[field as keyof CanvasNode] ?? 0))"
              type="number"
              :step="field === 'scale' ? 0.05 : 1"
              @input="patchNumber(field as 'x' | 'y' | 'w' | 'h' | 'r' | 'scale' | 'z', ($event.target as HTMLInputElement).value)"
            />
          </label>
        </div>

        <div class="range-stack">
          <label class="slider-row">
            <span>opacity</span>
            <input :value="selected.opacity ?? 1" aria-label="Opacity" type="range" min="0" max="1" step="0.01" @input="patchNumber('opacity', ($event.target as HTMLInputElement).value)" />
          </label>
        </div>
      </section>

      <section class="dock-section">
        <span class="dock-section-label">style</span>
        <div class="field-grid">
          <label>
            <span class="scrub-label" @pointerdown="startNumberScrub($event, 'padding', selected.padding ?? 0)">pad</span>
            <input :value="selected.padding ?? 0" type="number" min="0" @input="patchNumber('padding', ($event.target as HTMLInputElement).value)" />
          </label>
          <label>
            <span class="scrub-label" @pointerdown="startNumberScrub($event, 'gap', selected.gap ?? Math.max(0, Math.round((selected.padding ?? 0) / 2)))">gap</span>
            <input :value="selected.gap ?? Math.max(0, Math.round((selected.padding ?? 0) / 2))" type="number" min="0" @input="patchNumber('gap', ($event.target as HTMLInputElement).value)" />
          </label>
          <label>
            <span class="scrub-label" @pointerdown="startNumberScrub($event, 'radius', selected.radius ?? 0)">rad</span>
            <input :value="selected.radius ?? 0" type="number" min="0" @input="patchNumber('radius', ($event.target as HTMLInputElement).value)" />
          </label>
          <label>
            <span class="scrub-label" @pointerdown="startNumberScrub($event, 'borderWidth', selected.borderWidth ?? 1)">line</span>
            <input :value="selected.borderWidth ?? 1" type="number" min="0" @input="patchNumber('borderWidth', ($event.target as HTMLInputElement).value)" />
          </label>
          <label>
            <span class="scrub-label" @pointerdown="startNumberScrub($event, 'fontSize', selected.fontSize ?? 16)">size</span>
            <input :value="selected.fontSize ?? 16" type="number" min="6" @input="patchNumber('fontSize', ($event.target as HTMLInputElement).value)" />
          </label>
          <label>
            <span class="scrub-label" @pointerdown="startNumberScrub($event, 'fontWeight', selected.fontWeight ?? 700)">bold</span>
            <input :value="selected.fontWeight ?? 700" type="number" min="100" max="950" step="50" @input="patchNumber('fontWeight', ($event.target as HTMLInputElement).value)" />
          </label>
          <label>
            <span class="scrub-label" @pointerdown="startNumberScrub($event, 'animationMs', selected.animationMs ?? 1800)">ms</span>
            <input :value="selected.animationMs ?? 1800" type="number" min="120" step="100" @input="patchNumber('animationMs', ($event.target as HTMLInputElement).value)" />
          </label>
        </div>

        <div class="dock-row dock-color-row">
          <ThemeColorPicker
            :label="'text'"
            :model-value="selected.textColor ?? space.value?.theme.ink ?? '#101010'"
            :presets="themePresets"
            @update:model-value="patchSelected({ textColor: $event })"
          />
          <ThemeColorPicker
            :label="'border'"
            :model-value="selected.borderColor ?? space.value?.theme.line ?? '#202020'"
            :presets="themePresets"
            @update:model-value="patchSelected({ borderColor: $event })"
          />
        </div>

        <div class="select-grid">
          <CompactSelect
            label="font"
            :model-value="selected.fontFamily ?? 'Avenir Next, Segoe UI, Helvetica Neue, sans-serif'"
            :options="fontFamilyOptions"
            @update:model-value="patchSelected({ fontFamily: $event })"
          />
          <CompactSelect
            label="layout"
            :model-value="selected.layout ?? 'center'"
            :options="layoutOptions"
            @update:model-value="patchSelected({ layout: $event as CanvasNode['layout'] })"
          />
          <CompactSelect
            label="effect"
            :model-value="selected.effect ?? 'none'"
            :options="effectOptions"
            @update:model-value="patchSelected({ effect: $event as CanvasNode['effect'] })"
          />
          <button class="effect-settings-button" type="button" :class="{ active: effectSettingsOpen }" @click="effectSettingsOpen = !effectSettingsOpen">settings</button>
          <CompactSelect
            label="anim"
            :model-value="selected.animation ?? 'none'"
            :options="animationOptions"
            @update:model-value="patchSelected({ animation: $event as CanvasNode['animation'] })"
          />
        </div>

        <div v-if="effectSettingsOpen" class="effect-settings">
          <span class="dock-section-label">effect settings</span>
          <div class="field-grid">
            <label>
              <span class="scrub-label" @pointerdown="startNumberScrub($event, 'effectStrength', selected.effectStrength ?? 1)">power</span>
              <input :value="selected.effectStrength ?? 1" type="number" min="0" step="0.1" @input="patchNumber('effectStrength', ($event.target as HTMLInputElement).value)" />
            </label>
            <label>
              <span class="scrub-label" @pointerdown="startNumberScrub($event, 'shadowX', selected.shadowX ?? 8)">sx</span>
              <input :value="selected.shadowX ?? 8" type="number" step="1" @input="patchNumber('shadowX', ($event.target as HTMLInputElement).value)" />
            </label>
            <label>
              <span class="scrub-label" @pointerdown="startNumberScrub($event, 'shadowY', selected.shadowY ?? 8)">sy</span>
              <input :value="selected.shadowY ?? 8" type="number" step="1" @input="patchNumber('shadowY', ($event.target as HTMLInputElement).value)" />
            </label>
            <label>
              <span class="scrub-label" @pointerdown="startNumberScrub($event, 'blurAmount', selected.blurAmount ?? 2)">blur</span>
              <input :value="selected.blurAmount ?? 2" type="number" min="0" step="0.5" @input="patchNumber('blurAmount', ($event.target as HTMLInputElement).value)" />
            </label>
            <label>
              <span class="scrub-label" @pointerdown="startNumberScrub($event, 'outlineSize', selected.outlineSize ?? 6)">out</span>
              <input :value="selected.outlineSize ?? 6" type="number" min="0" step="1" @input="patchNumber('outlineSize', ($event.target as HTMLInputElement).value)" />
            </label>
            <label>
              <span class="scrub-label" @pointerdown="startNumberScrub($event, 'perspective', selected.perspective ?? 900)">persp</span>
              <input :value="selected.perspective ?? 900" type="number" min="120" step="20" @input="patchNumber('perspective', ($event.target as HTMLInputElement).value)" />
            </label>
          </div>
          <div class="range-stack">
            <label class="slider-row">
              <span>tilt x</span>
              <input :value="selected.tiltX ?? 0" type="range" min="-70" max="70" @input="patchNumber('tiltX', ($event.target as HTMLInputElement).value)" />
            </label>
            <label class="slider-row">
              <span>tilt y</span>
              <input :value="selected.tiltY ?? 0" type="range" min="-70" max="70" @input="patchNumber('tiltY', ($event.target as HTMLInputElement).value)" />
            </label>
          </div>
        </div>
      </section>

      <section class="dock-section font-importer">
          <span class="dock-section-label">fonts</span>
          <input v-model="googleFontName" aria-label="Google font" placeholder="Google font name" />
          <button type="button" @click="addGoogleFont">import</button>
          <div v-for="font in space.googleFonts ?? []" :key="font" class="font-chip">
            <button type="button" @click="applyGoogleFont(font)">{{ font }}</button>
            <button type="button" class="font-delete" :aria-label="`Delete ${font}`" @click="removeGoogleFont(font)">x</button>
          </div>
      </section>

      <section class="dock-section">
        <span class="dock-section-label">actions</span>
        <div class="dock-actions">
          <button type="button" :disabled="selected.locked" @click="patchSelected({ hidden: !selected.hidden })">{{ selected.hidden ? 'show' : 'hide' }}</button>
          <button type="button" @click="surface?.bringForward()">front</button>
          <button type="button" @click="surface?.sendBackward()">back</button>
          <button type="button" :disabled="selected.locked" @click="surface?.duplicateSelected()">copy</button>
          <button type="button" :disabled="selected.locked" @click="surface?.removeSelected()">delete</button>
        </div>
      </section>

        <section class="dock-section trigger-editor">
          <span class="dock-section-label">triggers</span>
          <label>
            <span>when selected object receives</span>
            <CompactSelect
              label="trigger"
              :model-value="triggerDraft.type"
              :options="triggerTypeOptions"
              @update:model-value="triggerDraft.type = $event as TriggerType"
            />
          </label>
          <label>
            <span>do</span>
            <CompactSelect
              label="action"
              :model-value="triggerDraft.action"
              :options="triggerActionOptions"
              @update:model-value="triggerDraft.action = $event as ActionType"
            />
          </label>
          <label>
            <span>after seconds</span>
            <input v-model.number="triggerDraft.delaySeconds" type="number" min="0" step="0.1" placeholder="0.5" />
          </label>
          <label v-if="triggerNeedsTarget(triggerDraft.action)">
            <span>target object</span>
            <CompactSelect
              label="target"
              :model-value="triggerDraft.targetId || 'none'"
              :options="[{ label: 'none', value: '' }, ...triggerTargetOptions]"
              @update:model-value="triggerDraft.targetId = $event"
            />
          </label>
          <label v-if="triggerDraft.action === 'focus'">
            <span>target area</span>
            <CompactSelect
              label="fragment"
              :model-value="triggerDraft.fragmentId || 'none'"
              :options="[{ label: 'none', value: '' }, ...fragmentSelectOptions]"
              @update:model-value="triggerDraft.fragmentId = $event"
            />
          </label>
          <label v-if="triggerDraft.action === 'message' || triggerDraft.type === 'message'">
            <span>message name</span>
            <input v-model="triggerDraft.message" />
          </label>
          <label v-if="triggerDraft.action === 'tint'">
            <span>new color</span>
            <input v-model="triggerDraft.color" type="color" />
          </label>
          <label v-if="triggerDraft.action === 'animate'">
            <span>animation</span>
            <CompactSelect
              label="anim"
              :model-value="triggerDraft.animation"
              :options="animationOptions"
              @update:model-value="triggerDraft.animation = $event as CanvasNode['animation']"
            />
          </label>
          <div v-if="triggerDraft.action === 'set-property'" class="trigger-property-row">
            <label>
              <span>property</span>
              <CompactSelect
                label="property"
                :model-value="triggerDraft.property"
                :options="triggerPropertyOptions"
                @update:model-value="triggerDraft.property = $event"
              />
            </label>
            <label>
              <span>value</span>
              <input v-model="triggerDraft.value" placeholder="+10 / -10 / =-10" />
            </label>
          </div>
          <div class="trigger-actions">
            <button type="button" @click="saveTrigger">{{ editingTriggerId ? 'update trigger' : 'add trigger' }}</button>
            <button v-if="editingTriggerId" type="button" @click="resetTriggerDraft">cancel</button>
          </div>
        </section>

        <section v-if="selectedTriggers.length" class="dock-section trigger-list">
          <div v-for="trigger in selectedTriggers" :key="trigger.id" class="trigger-line">
            <button type="button" @click="editTrigger(trigger)">
              {{ trigger.type }} -> {{ trigger.actions[0]?.type }}
              <span v-if="trigger.actions[0]?.delayMs"> / {{ (trigger.actions[0].delayMs / 1000).toFixed(1) }}s</span>
              <span v-if="trigger.actions[0]?.property"> / {{ trigger.actions[0]?.property }}</span>
            </button>
            <button type="button" aria-label="Delete trigger" @click="removeTrigger(trigger.id)">x</button>
          </div>
        </section>
    </aside>
  </main>
</template>
