<script setup lang="ts">
import type { CanvasAction, CanvasFragment, CanvasNode, CanvasTrigger } from '../types/canvas'
import { mediaKindFromNodeKind, normalizeMediaRef } from '../utils/media'

const props = defineProps<{
  nodes: CanvasNode[]
  fragments: CanvasFragment[]
  triggers: CanvasTrigger[]
  mode: 'view' | 'edit'
  spaceHandle?: string
  activeId?: string
  rasterization?: boolean
}>()

const emit = defineEmits<{
  change: [nodes: CanvasNode[]]
  select: [node: CanvasNode | null]
}>()

const stageRef = ref<HTMLElement | null>(null)
const selectedId = ref(props.activeId ?? '')
const draggingId = ref('')
const resizingId = ref('')
const viewport = reactive({ x: 0, y: 0, zoom: 0.9 })
const localNodes = ref<CanvasNode[]>([])
const clipboardNode = ref<CanvasNode | null>(null)
const history = ref<CanvasNode[][]>([])
const numericActionProperties = new Set([
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
  'z',
  'borderWidth',
  'radius',
  'padding',
  'gap',
  'opacity',
  'fontSize',
  'fontWeight',
  'animationMs',
  'effectStrength',
  'shadowX',
  'shadowY',
  'blurAmount',
  'outlineSize',
  'tiltX',
  'tiltY',
  'perspective'
])
const booleanActionProperties = new Set(['hidden', 'arrowEnd', 'interpolate'])

function cloneNodes(nodes: CanvasNode[]) {
  return JSON.parse(JSON.stringify(toRaw(nodes))) as CanvasNode[]
}

function pushHistory() {
  history.value = [...history.value.slice(-39), cloneNodes(localNodes.value)]
}

function restoreNodes(nodes: CanvasNode[]) {
  localNodes.value = cloneNodes(nodes)
  const selected = localNodes.value.find((node) => node.id === selectedId.value) ?? null
  select(selected)
  sync()
}

function undo() {
  const previous = history.value.at(-1)
  if (!previous) return

  history.value = history.value.slice(0, -1)
  restoreNodes(previous)
}

function selectedNode() {
  return localNodes.value.find((node) => node.id === selectedId.value) ?? null
}

function copySelected() {
  const node = selectedNode()
  if (!node) return

  clipboardNode.value = JSON.parse(JSON.stringify(toRaw(node))) as CanvasNode
}

function pasteSelected() {
  if (!clipboardNode.value || props.mode !== 'edit') return

  pushHistory()

  const z = Math.max(...localNodes.value.map((node) => node.z), 0) + 1
    const next: CanvasNode = {
    ...JSON.parse(JSON.stringify(toRaw(clipboardNode.value))),
    id: `${clipboardNode.value.kind}-${crypto.randomUUID().slice(0, 8)}`,
    locked: false,
    x: clipboardNode.value.x + 32,
    y: clipboardNode.value.y + 32,
    z
  }

  localNodes.value.push(next)
  clipboardNode.value = { ...next }
  select(next)
  sync()
}

function cutSelected() {
  const node = selectedNode()
  if (!node || node.locked) return

  copySelected()
  pushHistory()
  localNodes.value = localNodes.value.filter((item) => item.id !== node.id)
  select(null)
  sync()
}

function isTypingTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null
  if (!element) return false

  return Boolean(element.closest('input, textarea, select, [contenteditable="true"]'))
}

function onKeyDown(event: KeyboardEvent) {
  if (props.mode !== 'edit' || isTypingTarget(event.target)) return

  const key = event.key.toLowerCase()

  if (key === 'delete' || key === 'backspace') {
    event.preventDefault()
    removeSelected()
  }

  if (!(event.ctrlKey || event.metaKey)) return

  if (key === 'c') {
    event.preventDefault()
    copySelected()
  }

  if (key === 'v') {
    event.preventDefault()
    pasteSelected()
  }

  if (key === 'x') {
    event.preventDefault()
    cutSelected()
  }

  if (key === 'z') {
    event.preventDefault()
    undo()
  }
}

watch(
  () => props.nodes,
  (nodes) => {
    localNodes.value = cloneNodes(nodes)
  },
  { immediate: true, deep: true }
)

const visibleNodes = computed(() => localNodes.value.filter((node) => !node.hidden))
const rasterizedWorld = computed(() => props.rasterization !== false)

function sync() {
  emit('change', cloneNodes(localNodes.value))
}

function select(node: CanvasNode | null) {
  selectedId.value = node?.id ?? ''
  emit('select', node ? { ...node } : null)
}

function nodeStyle(node: CanvasNode) {
  const rotate = `rotate(${node.r ?? 0}deg)`
  const scale = `scale(${node.scale ?? 1})`
  const tilt = `perspective(${node.perspective ?? 900}px) rotateX(${node.tiltX ?? 0}deg) rotateY(${node.tiltY ?? 0}deg)`
  const rasterized = props.rasterization !== false
  const sceneScale = rasterized ? 1 : viewport.zoom
  const nodeLeft = node.x * sceneScale
  const nodeTop = node.y * sceneScale
  const nodeWidth = node.w * sceneScale
  const nodeHeight = node.h * sceneScale
  const nodeBorderWidth = node.kind === 'line' ? 0 : (node.borderWidth ?? 1) * sceneScale
  const nodeRadius = (node.radius ?? 0) * sceneScale
  const nodePadding = (node.padding ?? 0) * sceneScale
  const nodeFontSize = (node.fontSize ?? (node.kind === 'text' ? 52 : 16)) * sceneScale
  const nodeGap = (node.gap ?? Math.max(0, Math.round((node.padding ?? 0) / 2))) * sceneScale
  const lineWidth = (node.borderWidth ?? 4) * sceneScale
  const shadowX = (node.shadowX ?? 8) * sceneScale
  const shadowY = (node.shadowY ?? 8) * sceneScale
  const blur = (node.blurAmount ?? 2) * sceneScale
  const outline = (node.outlineSize ?? 6) * sceneScale

  return {
    width: `${nodeWidth}px`,
    height: `${nodeHeight}px`,
    left: rasterized ? undefined : `${nodeLeft}px`,
    top: rasterized ? undefined : `${nodeTop}px`,
    transform: rasterized ? `translate(${node.x}px, ${node.y}px) ${rotate} ${scale} ${tilt}` : `${rotate} ${scale} ${tilt}`,
    transformOrigin: rasterized ? undefined : '0 0',
    zIndex: node.z,
    opacity: node.opacity ?? 1,
    borderColor: node.borderColor ?? '#202020',
    borderWidth: `${nodeBorderWidth}px`,
    borderRadius: `${nodeRadius}px`,
    padding: `${nodePadding}px`,
    placeItems: node.layout ?? 'center',
    '--node-color': node.color,
    '--node-text': node.textColor ?? (node.kind === 'video' || node.kind === 'audio' || node.kind === 'portal' ? '#ffffff' : '#101010'),
    '--node-font': node.fontFamily ?? 'Avenir Next, Segoe UI, Helvetica Neue, sans-serif',
    '--node-size': `${nodeFontSize}px`,
    '--node-weight': node.fontWeight ?? 700,
    '--node-line-width': `${lineWidth}px`,
    '--node-gap': `${nodeGap}px`,
    '--node-speed': `${node.animationMs ?? 1800}ms`,
    '--effect-strength': node.effectStrength ?? 1,
    '--effect-shadow-x': `${shadowX}px`,
    '--effect-shadow-y': `${shadowY}px`,
    '--effect-blur': `${blur}px`,
    '--effect-outline': `${outline}px`
  }
}

function fragmentStyle(fragment: CanvasFragment) {
  const rasterized = props.rasterization !== false
  const scale = rasterized ? 1 : viewport.zoom

  return {
    width: `${fragment.bounds.w * scale}px`,
    height: `${fragment.bounds.h * scale}px`,
    left: `${fragment.bounds.x * scale}px`,
    top: `${fragment.bounds.y * scale}px`,
    transform: rasterized ? `translate(${fragment.bounds.x}px, ${fragment.bounds.y}px)` : undefined
  }
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

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value))
}

function eventToLinePoint(event: PointerEvent, node: CanvasNode) {
  const element = (event.currentTarget as HTMLElement).closest('[data-node]')
  const rect = element?.getBoundingClientRect()

  if (!rect || rect.width <= 0 || rect.height <= 0) {
    return {
      x: linePoint(node, 'bend', 'x'),
      y: linePoint(node, 'bend', 'y')
    }
  }

  return {
    x: clampPercent(((event.clientX - rect.left) / rect.width) * 100),
    y: clampPercent(((event.clientY - rect.top) / rect.height) * 100)
  }
}

function onLineHandlePointerDown(event: PointerEvent, node: CanvasNode, point: 'start' | 'bend' | 'end', recordHistory = true) {
  event.stopPropagation()

  if (props.mode !== 'edit') {
    return
  }

  select(node)
  if (recordHistory) pushHistory()

  const target = event.currentTarget as HTMLElement
  let raf = 0
  let next = eventToLinePoint(event, node)

  target.setPointerCapture(event.pointerId)

  const commitPoint = () => {
    if (point === 'start') {
      node.lineStartX = next.x
      node.lineStartY = next.y
    } else if (point === 'end') {
      node.lineEndX = next.x
      node.lineEndY = next.y
    } else {
      node.lineBendX = next.x
      node.lineBendY = next.y
    }

    raf = 0
    emit('select', { ...node })
  }

  const move = (moveEvent: PointerEvent) => {
    next = eventToLinePoint(moveEvent, node)
    if (!raf) {
      raf = window.requestAnimationFrame(commitPoint)
    }
  }

  const up = () => {
    if (raf) {
      window.cancelAnimationFrame(raf)
      commitPoint()
    }

    target.removeEventListener('pointermove', move)
    target.removeEventListener('pointerup', up)
    target.removeEventListener('pointercancel', up)
    sync()
  }

  target.addEventListener('pointermove', move)
  target.addEventListener('pointerup', up)
  target.addEventListener('pointercancel', up)
}

function onLinePathPointerDown(event: PointerEvent, node: CanvasNode) {
  event.stopPropagation()

  if (props.mode !== 'edit') {
    return
  }

  select(node)
  const point = eventToLinePoint(event, node)

  if (!lineHasBend(node)) {
    pushHistory()
    node.lineBendX = point.x
    node.lineBendY = point.y
    emit('select', { ...node })
    sync()
  }

  onLineHandlePointerDown(event, node, 'bend', false)
}

function focusFragment(fragmentId: string) {
  const fragment = props.fragments.find((item) => item.id === fragmentId)
  const stage = stageRef.value

  if (!fragment || !stage) {
    return
  }

  const scaleX = stage.clientWidth / fragment.bounds.w
  const scaleY = stage.clientHeight / fragment.bounds.h
  viewport.zoom = Math.max(0.35, Math.min(1.5, Math.min(scaleX, scaleY) * 0.88))
  viewport.x = -(fragment.bounds.x + fragment.bounds.w / 2) * viewport.zoom + stage.clientWidth / 2
  viewport.y = -(fragment.bounds.y + fragment.bounds.h / 2) * viewport.zoom + stage.clientHeight / 2
}

function shiftColor(hex: string, delta: number) {
  if (!hex || !hex.startsWith('#')) return hex

  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)

  const amount = Math.round(delta)
  const nr = Math.max(0, Math.min(255, r + amount))
  const ng = Math.max(0, Math.min(255, g + amount))
  const nb = Math.max(0, Math.min(255, b + amount))

  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`
}

function parseActionValue(action: CanvasAction, target: CanvasNode) {
  if (!action.property) return action.value
  const fallback = action.value ?? ''

  function clampNumericActionValue(property: string, value: number) {
    if (['w', 'h'].includes(property)) return Math.max(24, value)
    if (['borderWidth', 'radius', 'padding', 'gap', 'effectStrength', 'blurAmount', 'outlineSize'].includes(property)) return Math.max(0, value)
    if (property === 'opacity') return Math.max(0, Math.min(1, value))
    if (property === 'scale') return Math.max(0.05, value)
    if (property === 'fontSize') return Math.max(6, value)
    if (property === 'fontWeight') return Math.max(100, Math.min(950, value))
    if (property === 'animationMs') return Math.max(120, value)
    if (property === 'perspective') return Math.max(120, value)
    return value
  }

  if (numericActionProperties.has(action.property)) {
    const raw = String(fallback).trim()
    const current = Number(target[action.property as keyof CanvasNode] ?? 0)
    const relative = raw.match(/^([+-]=?)(-?\d+(?:\.\d+)?)$/)

    if (relative) {
      const amount = Number(relative[2])
      if (!Number.isFinite(amount)) return target[action.property as keyof CanvasNode]
      const next = relative[1].startsWith('-') ? current - amount : current + amount
      return clampNumericActionValue(action.property, next)
    }

    const absolute = raw.startsWith('=') ? raw.slice(1) : raw
    const parsed = Number(absolute)
    return Number.isFinite(parsed) ? clampNumericActionValue(action.property, parsed) : target[action.property as keyof CanvasNode]
  }

  if (action.property === 'color' || action.property === 'textColor') {
    const raw = String(fallback).trim()
    const relative = raw.match(/^([+-])(\d+)$/)
    if (relative) {
      const current = String(target[action.property as keyof CanvasNode] ?? (action.property === 'color' ? '#ffffff' : '#101010'))
      const amount = Number(relative[2]) * (relative[1] === '-' ? -1 : 1)
      return shiftColor(current, amount)
    }
  }

  if (booleanActionProperties.has(action.property)) {
    return fallback === true || fallback === 'true' || fallback === '1'
  }

  if (action.property === 'tags') {
    return String(fallback)
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
  }

  return fallback
}

function runAction(action: CanvasAction) {
    const target = action.targetId
      ? localNodes.value.find((node) => node.id === action.targetId)
      : null

    if (action.type === 'toggle' && target) target.hidden = !target.hidden
    if (action.type === 'show' && target) target.hidden = false
    if (action.type === 'hide' && target) target.hidden = true
    if (action.type === 'toggle-audio' && target?.kind === 'audio') toggleMediaPlayback(target)
    if (action.type === 'toggle-video' && target?.kind === 'video') toggleMediaPlayback(target)
    if (action.type === 'tint' && target && action.color) target.color = action.color
    if (action.type === 'animate' && target) target.animation = action.animation ?? 'pulse'
    if (action.type === 'set-property' && target && action.property) {
      Object.assign(target, {
        [action.property]: parseActionValue(action, target)
      })
    }
    if (action.type === 'focus' && action.fragmentId) focusFragment(action.fragmentId)
    if (action.type === 'message') runTriggers('message', undefined, action.message)

  sync()
}

function runActions(actions: CanvasAction[]) {
  for (const action of actions) {
    const delayMs = Math.max(0, Number(action.delayMs ?? 0))

    if (delayMs > 0) {
      window.setTimeout(() => runAction(action), delayMs)
      continue
    }

    runAction(action)
  }
}

function runTriggers(type: CanvasTrigger['type'], sourceId?: string, message?: string) {
  const matches = props.triggers.filter((trigger) => {
    if (trigger.type !== type) return false
    if (type === 'message') return trigger.message === message
    return trigger.sourceId === sourceId
  })

  for (const trigger of matches) {
    runActions(trigger.actions)
  }
}

function onWheel(event: WheelEvent) {
  const stage = stageRef.value

  if (!stage) {
    return
  }

  event.preventDefault()
  const rotatingNode = props.mode === 'edit' && selectedId.value
    ? localNodes.value.find((node) => node.id === selectedId.value)
    : null

  if (rotatingNode && (draggingId.value || event.shiftKey)) {
    rotatingNode.r = (rotatingNode.r ?? 0) + event.deltaY * 0.15
    emit('select', { ...rotatingNode })
    sync()
    return
  }

  const nextZoom = Math.max(0.28, Math.min(2.2, viewport.zoom - event.deltaY * 0.001))
  const rect = stage.getBoundingClientRect()
  const pointerX = event.clientX - rect.left
  const pointerY = event.clientY - rect.top
  const worldX = (pointerX - viewport.x) / viewport.zoom
  const worldY = (pointerY - viewport.y) / viewport.zoom

  viewport.zoom = nextZoom
  viewport.x = pointerX - worldX * nextZoom
  viewport.y = pointerY - worldY * nextZoom
}

function onNodePointerDown(event: PointerEvent, node: CanvasNode) {
  if (props.mode !== 'edit') {
    return
  }

  select(node)

  const startX = event.clientX
  const startY = event.clientY
  const originalX = node.x
  const originalY = node.y
  const target = event.currentTarget as HTMLElement
  let nextX = node.x
  let nextY = node.y
  let raf = 0

  pushHistory()
  draggingId.value = node.id

  target.setPointerCapture(event.pointerId)

  const commitDrag = () => {
    node.x = nextX
    node.y = nextY
    raf = 0
    emit('select', { ...node })
  }

  const move = (moveEvent: PointerEvent) => {
    nextX = originalX + (moveEvent.clientX - startX) / viewport.zoom
    nextY = originalY + (moveEvent.clientY - startY) / viewport.zoom
    if (!raf) {
      raf = window.requestAnimationFrame(commitDrag)
    }
  }

  const up = () => {
    if (raf) {
      window.cancelAnimationFrame(raf)
      commitDrag()
    }
    target.removeEventListener('pointermove', move)
    target.removeEventListener('pointerup', up)
    target.removeEventListener('pointercancel', up)
    draggingId.value = ''
    sync()
  }

  target.addEventListener('pointermove', move)
  target.addEventListener('pointerup', up)
  target.addEventListener('pointercancel', up)
}

function onResizePointerDown(
  event: PointerEvent,
  node: CanvasNode,
  corner: 'nw' | 'ne' | 'sw' | 'se'
) {
  event.stopPropagation()
  select(node)

  if (props.mode !== 'edit') {
    return
  }

  const target = event.currentTarget as HTMLElement
  const startX = event.clientX
  const startY = event.clientY
  const original = {
    x: node.x,
    y: node.y,
    w: node.w,
    h: node.h
  }
  let next = { ...original }
  let raf = 0

  pushHistory()
  resizingId.value = node.id
  target.setPointerCapture(event.pointerId)

  const commitResize = () => {
    node.x = next.x
    node.y = next.y
    node.w = next.w
    node.h = next.h
    raf = 0
    emit('select', { ...node })
  }

  const move = (moveEvent: PointerEvent) => {
    const dx = (moveEvent.clientX - startX) / viewport.zoom
    const dy = (moveEvent.clientY - startY) / viewport.zoom
    const fromWest = corner.includes('w')
    const fromNorth = corner.includes('n')
    const minW = Math.min(80, Math.max(32, original.w))
    const minH = Math.min(56, Math.max(32, original.h))

    next.w = Math.max(minW, original.w + (fromWest ? -dx : dx))
    next.h = Math.max(minH, original.h + (fromNorth ? -dy : dy))
    next.x = fromWest ? original.x + original.w - next.w : original.x
    next.y = fromNorth ? original.y + original.h - next.h : original.y

    if (!raf) {
      raf = window.requestAnimationFrame(commitResize)
    }
  }

  const up = () => {
    if (raf) {
      window.cancelAnimationFrame(raf)
      commitResize()
    }
    target.removeEventListener('pointermove', move)
    target.removeEventListener('pointerup', up)
    target.removeEventListener('pointercancel', up)
    resizingId.value = ''
    sync()
  }

  target.addEventListener('pointermove', move)
  target.addEventListener('pointerup', up)
  target.addEventListener('pointercancel', up)
}

function onNodeClick(node: CanvasNode) {
  if (props.mode === 'view') {
    if (node.kind === 'portal') {
      const targetHandle = node.portalTargetSpaceHandle?.trim() || props.spaceHandle || ''
      const targetFragmentId = node.portalTargetFragmentId?.trim() || ''

      if (targetHandle) {
        if (targetHandle === props.spaceHandle && targetFragmentId) {
          focusFragment(targetFragmentId)
        } else {
          void navigateTo({
            path: `/space/${targetHandle}`,
            query: targetFragmentId ? { fragment: targetFragmentId } : undefined
          })
        }
      } else if (targetFragmentId) {
        focusFragment(targetFragmentId)
      }
    }
    runTriggers('click', node.id)
  }
}

function findNodeElement(nodeId: string) {
  const stage = stageRef.value
  if (!stage) return null

  return Array.from(stage.querySelectorAll<HTMLElement>('[data-node]')).find((element) => element.dataset.nodeId === nodeId) ?? null
}

function toggleMediaPlayback(target: CanvasNode) {
  if (!['audio', 'video'].includes(target.kind)) return

  const nodeElement = findNodeElement(target.id)
  if (!nodeElement) return

  const mediaElement = nodeElement.querySelector('audio, video') as HTMLMediaElement | null
  if (!mediaElement) return

  if (mediaElement.paused) {
    void mediaElement.play().catch(() => undefined)
  } else {
    mediaElement.pause()
  }
}

function onStagePointerDown(event: PointerEvent) {
  if ((event.target as HTMLElement).closest('[data-node]')) {
    return
  }

  select(null)

  const stage = stageRef.value
  if (!stage) return

  const startX = event.clientX
  const startY = event.clientY
  const originalX = viewport.x
  const originalY = viewport.y

  stage.setPointerCapture(event.pointerId)

  const move = (moveEvent: PointerEvent) => {
    viewport.x = originalX + moveEvent.clientX - startX
    viewport.y = originalY + moveEvent.clientY - startY
  }

  const up = () => {
    stage.removeEventListener('pointermove', move)
    stage.removeEventListener('pointerup', up)
    stage.removeEventListener('pointercancel', up)
  }

  stage.addEventListener('pointermove', move)
  stage.addEventListener('pointerup', up)
  stage.addEventListener('pointercancel', up)
}

function addNode(kind: CanvasNode['kind']) {
  pushHistory()

  const z = Math.max(...localNodes.value.map((node) => node.z), 0) + 1
  const center = viewportCenterWorldPosition()
  const width = kind === 'text' ? 280 : kind === 'line' ? 260 : 220
  const height = kind === 'text' ? 120 : kind === 'line' ? 80 : 180
  const node = buildNode(kind, {
    x: center.x - width / 2,
    y: center.y - height / 2,
    z
  })

  localNodes.value.push(node)
  select(node)
  sync()
  return node
}

function buildNode(kind: CanvasNode['kind'], patch: Partial<CanvasNode> = {}): CanvasNode {
  const width = kind === 'text' ? 280 : kind === 'line' ? 260 : 220
  const height = kind === 'text' ? 120 : kind === 'line' ? 80 : 180

  return {
    id: `${kind}-${crypto.randomUUID().slice(0, 8)}`,
    kind,
    label: kind,
    x: 0,
    y: 0,
    w: width,
    h: height,
    scale: 1,
    z: Math.max(...localNodes.value.map((node) => node.z), 0) + 1,
    text: kind,
    arrowEnd: kind === 'line',
    arrowHeadStyle: kind === 'line' ? 'filled' : undefined,
    lineStartX: kind === 'line' ? 3 : undefined,
    lineStartY: kind === 'line' ? 50 : undefined,
    lineEndX: kind === 'line' ? 97 : undefined,
    lineEndY: kind === 'line' ? 50 : undefined,
    interpolate: true,
    color: kind === 'shape' ? '#e8ff5c' : '#111111',
    textColor: kind === 'shape' || kind === 'text' || kind === 'line' ? '#101010' : '#ffffff',
    borderColor: '#202020',
    borderWidth: kind === 'line' ? 4 : 1,
    radius: kind === 'portal' ? 999 : 0,
    padding: kind === 'line' ? 0 : 12,
    gap: 8,
    opacity: 1,
    fontSize: kind === 'text' ? 52 : 16,
    fontWeight: 700,
    layout: 'center',
    effect: 'none',
    animation: 'none',
    animationMs: 1800,
    ...patch
  }
}

function updateSelected(patch: Partial<CanvasNode>) {
  const node = localNodes.value.find((item) => item.id === selectedId.value)
  if (!node) return

  pushHistory()
  Object.assign(node, patch)
  emit('select', { ...node })
  sync()
}

function removeSelected() {
  const selected = localNodes.value.find((node) => node.id === selectedId.value)
  if (selected?.locked) return

  pushHistory()
  localNodes.value = localNodes.value.filter((node) => node.id !== selectedId.value)
  select(null)
  sync()
}

function duplicateSelected() {
  const node = localNodes.value.find((item) => item.id === selectedId.value)
  if (!node) return
  if (node.locked) return

  pushHistory()
  const next = {
    ...node,
    id: `${node.kind}-${crypto.randomUUID().slice(0, 8)}`,
    x: node.x + 34,
    y: node.y + 34,
    z: Math.max(...localNodes.value.map((item) => item.z), 0) + 1
  }

  localNodes.value.push(next)
  select(next)
  sync()
}

function bringForward() {
  updateSelected({ z: Math.max(...localNodes.value.map((node) => node.z), 0) + 1 })
}

function sendBackward() {
  updateSelected({ z: Math.min(...localNodes.value.map((node) => node.z), 0) - 1 })
}

function screenRectToWorldBounds(rect: { x: number; y: number; w: number; h: number }) {
  const stage = stageRef.value
  if (!stage) {
    return { x: 0, y: 0, w: rect.w, h: rect.h }
  }

  const stageRect = stage.getBoundingClientRect()

  return {
    x: Math.round((rect.x - stageRect.left - viewport.x) / viewport.zoom),
    y: Math.round((rect.y - stageRect.top - viewport.y) / viewport.zoom),
    w: Math.round(rect.w / viewport.zoom),
    h: Math.round(rect.h / viewport.zoom)
  }
}

function worldPointFromClient(point: { x: number; y: number }) {
  const stage = stageRef.value
  if (!stage) return { x: 0, y: 0 }

  const stageRect = stage.getBoundingClientRect()
  return {
    x: Math.round((point.x - stageRect.left - viewport.x) / viewport.zoom),
    y: Math.round((point.y - stageRect.top - viewport.y) / viewport.zoom)
  }
}

function viewportCenterWorldPosition() {
  const stage = stageRef.value
  if (!stage) return { x: 0, y: 0 }

  const stageRect = stage.getBoundingClientRect()
  const center = worldPointFromClient({
    x: stageRect.left + stageRect.width / 2,
    y: stageRect.top + stageRect.height / 2
  })

  return center
}

function addNodeAt(kind: CanvasNode['kind'], point: { x: number; y: number }, patch: Partial<CanvasNode> = {}) {
  pushHistory()
  const world = worldPointFromClient(point)
  const node = buildNode(kind, {
    x: world.x,
    y: world.y,
    ...patch
  })
  localNodes.value.push(node)
  select(node)
  sync()
  return node
}

defineExpose({
  addNode,
  addNodeAt,
  updateSelected,
  removeSelected,
  duplicateSelected,
  bringForward,
  sendBackward,
  focusFragment,
  screenRectToWorldBounds,
  worldPointFromClient
})

onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
  focusFragment(props.fragments[0]?.id ?? '')
  const loadTrigger = props.triggers.find((trigger) => trigger.type === 'load')
  if (loadTrigger) runActions(loadTrigger.actions)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown)
})
</script>

<template>
  <div
    ref="stageRef"
    class="canvas-stage"
    :class="{ 'no-rasterization': props.rasterization === false }"
    @wheel="onWheel"
    @pointerdown="onStagePointerDown"
  >
    <div class="grid-layer" />
    <div
      class="canvas-world"
      :style="{
        transform: `translate(${viewport.x}px, ${viewport.y}px)${rasterizedWorld ? ' scale(' + viewport.zoom + ')' : ''}`
      }"
    >
      <button
        v-for="fragment in fragments"
        :key="fragment.id"
        class="fragment-outline"
        :style="fragmentStyle(fragment)"
        type="button"
        @click.stop="focusFragment(fragment.id)"
      >
        {{ fragment.title }}
      </button>

      <div
        v-for="node in visibleNodes"
        :key="node.id"
        class="canvas-node"
        :class="[
          `is-${node.kind}`,
          `effect-${node.effect ?? 'none'}`,
          `anim-${node.animation ?? 'none'}`,
          {
            selected: selectedId === node.id,
            editable: mode === 'edit',
            interpolated: node.interpolate !== false,
            tilted: props.rasterization !== false && Boolean(node.tiltX || node.tiltY),
            dragging: draggingId === node.id,
            resizing: resizingId === node.id
          }
        ]"
        :style="nodeStyle(node)"
        data-node
        :data-node-id="node.id"
        @pointerdown.stop="onNodePointerDown($event, node)"
        @click.stop="onNodeClick(node)"
        @mouseenter="mode === 'view' && runTriggers('hover', node.id)"
      >
        <template v-if="node.kind === 'profile'">
          <img v-if="node.showAvatar !== false" class="profile-avatar" :src="node.avatar" alt="" draggable="false">
          <strong v-if="node.showNickname !== false" class="profile-name">{{ node.nickname }}</strong>
          <p v-if="node.showDescription !== false" class="profile-description">{{ node.description }}</p>
          <div v-if="node.showTags !== false" class="profile-tags">
            <span v-for="tag in node.tags" :key="tag">{{ tag }}</span>
          </div>
        </template>
        <span v-else-if="node.kind === 'text'" class="node-text">{{ node.text }}</span>
        <template v-else-if="node.kind === 'line'">
          <svg class="node-line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <marker
                :id="`arrow-${node.id}`"
                markerWidth="8"
                markerHeight="8"
                refX="7"
                refY="4"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <path
                  v-if="node.arrowHeadStyle === 'lines'"
                  d="M1,1 L7,4 L1,7"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path
                  v-else
                  d="M0,0 L8,4 L0,8 Z"
                  fill="currentColor"
                />
              </marker>
            </defs>
            <path
              :d="linePath(node)"
              :marker-end="node.arrowEnd !== false ? `url(#arrow-${node.id})` : undefined"
              @pointerdown="onLinePathPointerDown($event, node)"
            />
          </svg>
          <template v-if="mode === 'edit' && selectedId === node.id">
            <button
              v-for="point in ['start', 'end']"
              :key="point"
              class="line-point"
              :class="`is-${point}`"
              :style="{ left: `${linePoint(node, point as 'start' | 'end', 'x')}%`, top: `${linePoint(node, point as 'start' | 'end', 'y')}%` }"
              type="button"
              :aria-label="`${point} point`"
              @pointerdown="onLineHandlePointerDown($event, node, point as 'start' | 'end')"
            />
            <button
              v-if="lineHasBend(node)"
              class="line-point is-bend"
              :style="{ left: `${linePoint(node, 'bend', 'x')}%`, top: `${linePoint(node, 'bend', 'y')}%` }"
              type="button"
              aria-label="bend point"
              @pointerdown="onLineHandlePointerDown($event, node, 'bend')"
            />
          </template>
        </template>
        <span v-else-if="node.kind === 'portal'" class="node-portal">{{ node.text }}</span>
        <NodeMediaContent
          v-else-if="normalizeMediaRef(node.media, mediaKindFromNodeKind(node.kind) ?? undefined)"
          :node="node"
        />
        <span v-else class="node-label">{{ node.text }}</span>

        <template v-if="mode === 'edit' && selectedId === node.id && node.kind !== 'line'">
          <button
            v-for="corner in ['nw', 'ne', 'sw', 'se']"
            :key="corner"
            class="resize-handle"
            :class="`is-${corner}`"
            type="button"
            :aria-label="`resize ${corner}`"
            @pointerdown="onResizePointerDown($event, node, corner as 'nw' | 'ne' | 'sw' | 'se')"
          />
        </template>
      </div>
    </div>

    <div class="zoom-readout">{{ Math.round(viewport.zoom * 100) }}</div>
  </div>
</template>
