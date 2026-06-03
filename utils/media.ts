import type { CanvasNode, NodeKind, NodeMediaKind, NodeMediaProvider, NodeMediaRef } from '../types/canvas'

export const MAX_MEDIA_BYTES = 500 * 1024
export const MAX_SPACE_MEDIA_BYTES = 10 * 1024 * 1024

const directKindsByMimePrefix: Array<{ prefix: string; kind: NodeMediaKind }> = [
  { prefix: 'image/', kind: 'image' },
  { prefix: 'audio/', kind: 'audio' },
  { prefix: 'video/', kind: 'video' }
]

export function mediaKindFromNodeKind(kind: NodeKind): NodeMediaKind | null {
  return kind === 'image' || kind === 'audio' || kind === 'video' ? kind : null
}

export function normalizeNodeMedia(node: CanvasNode): CanvasNode {
  const kind = mediaKindFromNodeKind(node.kind)
  if (!kind) return node

  const media = normalizeMediaRef(node.media, kind)
  return media ? { ...node, media } : node
}

export function normalizeMediaRef(value: CanvasNode['media'], fallbackKind?: NodeMediaKind): NodeMediaRef | undefined {
  if (!value) return undefined

  if (typeof value === 'string') {
    const parsed = parseEmbedUrl(value, fallbackKind)
    if (!parsed) return undefined
    return parsed
  }

  const kind = value.kind ?? fallbackKind
  if (!kind || !isMediaKind(kind) || !isMediaMode(value.mode) || !isMediaProvider(value.provider)) return undefined
  if (typeof value.src !== 'string' || !value.src.trim()) return undefined

  return {
    ...value,
    kind,
    src: value.src.trim()
  }
}

export function parseEmbedUrl(raw: string, fallbackKind?: NodeMediaKind): NodeMediaRef | null {
  const src = raw.trim()
  if (!src) return null

  let url: URL
  try {
    url = new URL(src)
  } catch {
    return null
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    return null
  }

  const youtubeId = parseYouTubeId(url)
  if (youtubeId) {
    return {
      mode: 'embed',
      kind: 'video',
      provider: 'youtube',
      src: `https://www.youtube.com/embed/${youtubeId}`
    }
  }

  const vimeoId = parseVimeoId(url)
  if (vimeoId) {
    return {
      mode: 'embed',
      kind: 'video',
      provider: 'vimeo',
      src: `https://player.vimeo.com/video/${vimeoId}`
    }
  }

  const directKind = inferDirectMediaKind(url, fallbackKind)
  if (!directKind) {
    return null
  }

  return {
    mode: 'embed',
    kind: directKind,
    provider: 'direct',
    src: url.toString()
  }
}

export function inferMediaKindFromMime(mimeType: string): NodeMediaKind | null {
  const normalized = mimeType.toLowerCase()
  for (const entry of directKindsByMimePrefix) {
    if (normalized.startsWith(entry.prefix)) return entry.kind
  }
  return null
}

function inferDirectMediaKind(url: URL, fallbackKind?: NodeMediaKind): NodeMediaKind | null {
  const pathname = url.pathname.toLowerCase()
  const extension = pathname.includes('.') ? pathname.split('.').pop() ?? '' : ''
  const byExtension: Record<string, NodeMediaKind> = {
    jpg: 'image',
    jpeg: 'image',
    png: 'image',
    webp: 'image',
    gif: 'image',
    svg: 'image',
    mp3: 'audio',
    wav: 'audio',
    ogg: 'audio',
    m4a: 'audio',
    aac: 'audio',
    webm: 'video',
    mp4: 'video',
    mov: 'video',
    m4v: 'video',
    ogv: 'video'
  }

  return byExtension[extension] ?? fallbackKind ?? null
}

function parseYouTubeId(url: URL) {
  const host = url.hostname.replace(/^www\./, '').toLowerCase()
  if (host === 'youtu.be') {
    return cleanEmbedId(url.pathname.slice(1))
  }

  if (host === 'youtube.com' || host === 'm.youtube.com') {
    if (url.pathname === '/watch') {
      return cleanEmbedId(url.searchParams.get('v') ?? '')
    }
    if (url.pathname.startsWith('/embed/')) {
      return cleanEmbedId(url.pathname.split('/')[2] ?? '')
    }
    if (url.pathname.startsWith('/shorts/')) {
      return cleanEmbedId(url.pathname.split('/')[2] ?? '')
    }
  }

  return null
}

function parseVimeoId(url: URL) {
  const host = url.hostname.replace(/^www\./, '').toLowerCase()
  if (!['vimeo.com', 'player.vimeo.com'].includes(host)) return null

  const segments = url.pathname.split('/').filter(Boolean)
  const candidate = segments.at(-1) ?? ''
  return /^\d+$/.test(candidate) ? candidate : null
}

function cleanEmbedId(value: string) {
  const trimmed = value.trim()
  return /^[a-zA-Z0-9_-]{6,}$/.test(trimmed) ? trimmed : null
}

function isMediaKind(value: string): value is NodeMediaKind {
  return value === 'image' || value === 'audio' || value === 'video'
}

function isMediaMode(value: string): value is NodeMediaRef['mode'] {
  return value === 'upload' || value === 'embed'
}

function isMediaProvider(value: string): value is NodeMediaProvider {
  return value === 'direct' || value === 'youtube' || value === 'vimeo'
}
