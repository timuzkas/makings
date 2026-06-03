import { readStoredMedia } from '../../../utils/media'

export default defineEventHandler((event) => {
  const space = getRouterParam(event, 'space') ?? ''
  const id = getRouterParam(event, 'id') ?? ''
  const stored = readStoredMedia(space, id)

  if (!stored) {
    throw createError({ statusCode: 404, statusMessage: 'Media not found' })
  }

  setHeader(event, 'Content-Type', stored.record.mimeType)
  setHeader(event, 'Content-Length', String(stored.record.bytes))
  setHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')
  return stored.bytes
})
