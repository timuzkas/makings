import { createHash, randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import type { CanvasNode, NodeMediaKind, NodeMediaRef, SpaceRecord } from '../../types/canvas'
import { MAX_MEDIA_BYTES, MAX_SPACE_MEDIA_BYTES, inferMediaKindFromMime, mediaKindFromNodeKind, normalizeMediaRef, parseEmbedUrl } from '../../utils/media'

const mediaRoot = join(process.cwd(), '.data', 'media')
const mediaIndexPath = join(process.cwd(), '.data', 'media-index.json')

interface MediaRecord {
  id: string
  space: string
  kind: NodeMediaKind
  mimeType: string
  bytes: number
  ext: string
  originalName?: string
  posterSrc?: string
  width?: number
  height?: number
  durationMs?: number
  sha256: string
  createdAt: string
}

interface MediaIndex {
  records: MediaRecord[]
}

const allowedMimeTypes: Record<NodeMediaKind, Set<string>> = {
  image: new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  audio: new Set(['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/mp4', 'audio/x-m4a', 'audio/aac']),
  video: new Set(['video/mp4', 'video/webm', 'video/ogg'])
}

const extensionByMimeType: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/ogg': 'ogg',
  'audio/webm': 'webm',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'aac',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/ogg': 'ogv'
}

export function normalizeSpaceNodes(space: SpaceRecord): SpaceRecord {
  return {
    ...space,
    nodes: space.nodes.map(normalizeNodeMediaForStorage)
  }
}

export function normalizeNodeMediaForStorage(node: CanvasNode): CanvasNode {
  const kind = mediaKindFromNodeKind(node.kind)
  if (!kind) return node

  const media = normalizeMediaRef(node.media, kind)
  return media ? { ...node, media } : { ...node, media: undefined }
}

export function normalizeEmbedInput(raw: string, fallbackKind?: NodeMediaKind): NodeMediaRef {
  const media = parseEmbedUrl(raw, fallbackKind)
  if (!media) {
    throw createError({ statusCode: 400, statusMessage: 'Use a direct media URL or a YouTube/Vimeo video link.' })
  }

  return media
}

export function storeUploadedMedia(input: {
  space: string
  fileName?: string
  mimeType?: string
  bytes: Buffer
  requestedKind?: NodeMediaKind
  width?: number
  height?: number
  durationMs?: number
  posterSrc?: string
}) {
  const detectedMimeType = detectMimeType(input.bytes)
  const claimedMimeType = normalizeMimeType(input.mimeType ?? '')
  const mimeType = detectedMimeType ?? claimedMimeType
  if (!mimeType) {
    throw createError({ statusCode: 400, statusMessage: 'Unsupported media type.' })
  }

  if (detectedMimeType && claimedMimeType && detectedMimeType !== claimedMimeType) {
    throw createError({ statusCode: 400, statusMessage: 'Uploaded file type does not match its contents.' })
  }

  const kind = inferMediaKindFromMime(mimeType)
  if (!kind) {
    throw createError({ statusCode: 400, statusMessage: 'Unsupported media type.' })
  }

  if (input.requestedKind && input.requestedKind !== kind && !(input.requestedKind === 'video' && mimeType === 'image/gif')) {
    throw createError({ statusCode: 400, statusMessage: 'This file does not match the selected node type.' })
  }

  if (!allowedMimeTypes[kind].has(mimeType)) {
    throw createError({ statusCode: 400, statusMessage: 'Unsupported media type.' })
  }

  if (input.bytes.byteLength > MAX_MEDIA_BYTES) {
    throw createError({ statusCode: 400, statusMessage: 'This file can’t fit the free-tier upload limit. Use an embed link.' })
  }

  const index = readMediaIndex()
  const usage = mediaUsageForSpace(index, input.space)
  if (usage + input.bytes.byteLength > MAX_SPACE_MEDIA_BYTES) {
    throw createError({ statusCode: 400, statusMessage: 'This space is out of hosted-media quota.' })
  }

  const ext = extensionByMimeType[mimeType] ?? cleanExtension(input.fileName) ?? 'bin'
  const id = randomUUID()
  const spaceDir = join(mediaRoot, input.space)
  const filePath = join(spaceDir, `${id}.${ext}`)
  const sha256 = createHash('sha256').update(input.bytes).digest('hex')

  mkdirSync(spaceDir, { recursive: true })
  writeFileSync(filePath, input.bytes)

  const record: MediaRecord = {
    id,
    space: input.space,
    kind,
    mimeType,
    bytes: input.bytes.byteLength,
    ext,
    originalName: input.fileName,
    posterSrc: input.posterSrc,
    width: input.width,
    height: input.height,
    durationMs: input.durationMs,
    sha256,
    createdAt: new Date().toISOString()
  }

  const next: MediaIndex = {
    records: [...index.records.filter((item) => !(item.space === record.space && item.id === record.id)), record]
  }
  writeMediaIndex(next)

  return {
    ...record,
    src: mediaUrl(record.space, record.id)
  }
}

export function getMediaRecord(space: string, id: string) {
  return readMediaIndex().records.find((record) => record.space === space && record.id === id) ?? null
}

export function readStoredMedia(space: string, id: string) {
  const record = getMediaRecord(space, id)
  if (!record) return null

  const filePath = join(mediaRoot, space, `${record.id}.${record.ext}`)
  if (!existsSync(filePath)) return null

  return {
    record,
    filePath,
    bytes: readFileSync(filePath)
  }
}

export function cleanupSpaceMedia(space: string, nodes: CanvasNode[]) {
  const index = readMediaIndex()
  const keepIds = new Set(
    nodes
      .map((node) => normalizeNodeMediaForStorage(node).media)
      .filter((media): media is NodeMediaRef => Boolean(media && media.mode === 'upload' && media.id))
      .map((media) => media.id as string)
  )

  const stale = index.records.filter((record) => record.space === space && !keepIds.has(record.id))
  if (!stale.length) return

  for (const record of stale) {
    const filePath = join(mediaRoot, space, `${record.id}.${record.ext}`)
    if (existsSync(filePath)) {
      unlinkSync(filePath)
    }
  }

  const next: MediaIndex = {
    records: index.records.filter((record) => !(record.space === space && !keepIds.has(record.id)))
  }
  writeMediaIndex(next)

  const spaceDir = join(mediaRoot, space)
  if (existsSync(spaceDir) && !next.records.some((record) => record.space === space)) {
    rmSync(spaceDir, { recursive: true, force: true })
  }
}

export function hostedMediaMeta(record: ReturnType<typeof storeUploadedMedia>): NodeMediaRef {
  return {
    id: record.id,
    mode: 'upload',
    kind: record.kind,
    src: record.src,
    provider: 'direct',
    mimeType: record.mimeType,
    bytes: record.bytes,
    width: record.width,
    height: record.height,
    durationMs: record.durationMs,
    originalName: record.originalName,
    posterSrc: record.posterSrc
  }
}

export function mediaUsageForSpace(index: MediaIndex, space: string) {
  return index.records
    .filter((record) => record.space === space)
    .reduce((sum, record) => sum + record.bytes, 0)
}

function readMediaIndex(): MediaIndex {
  if (!existsSync(mediaIndexPath)) {
    writeMediaIndex({ records: [] })
  }

  const stored = JSON.parse(readFileSync(mediaIndexPath, 'utf8')) as Partial<MediaIndex>
  return {
    records: stored.records ?? []
  }
}

function writeMediaIndex(index: MediaIndex) {
  mkdirSync(join(process.cwd(), '.data'), { recursive: true })
  writeFileSync(mediaIndexPath, JSON.stringify(index, null, 2))
}

function normalizeMimeType(mimeType: string) {
  const normalized = mimeType.trim().toLowerCase()
  return normalized || null
}

function cleanExtension(fileName?: string) {
  const ext = extname(fileName ?? '').toLowerCase().replace('.', '')
  return ext || null
}

function mediaUrl(space: string, id: string) {
  return `/api/media/${encodeURIComponent(space)}/${encodeURIComponent(id)}`
}

function detectMimeType(bytes: Buffer) {
  if (bytes.byteLength < 12) return null

  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  if (bytes.subarray(0, 6).toString('ascii') === 'GIF87a' || bytes.subarray(0, 6).toString('ascii') === 'GIF89a') return 'image/gif'
  if (bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp'
  if (bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WAVE') return 'audio/wav'
  if (bytes.subarray(0, 4).toString('ascii') === 'OggS') return 'audio/ogg'
  if (bytes.subarray(0, 3).toString('ascii') === 'ID3' || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)) return 'audio/mpeg'
  if (bytes.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = bytes.subarray(8, 12).toString('ascii').trim()
    if (['M4A ', 'M4B ', 'isom', 'mp42', 'qt  ', 'M4V '].includes(brand)) {
      return brand.startsWith('M4A') ? 'audio/mp4' : 'video/mp4'
    }
    return 'video/mp4'
  }
  if (bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return null

  return null
}
