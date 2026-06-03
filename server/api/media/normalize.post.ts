import { normalizeEmbedInput } from '../../utils/media'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ url?: string; kind?: 'image' | 'audio' | 'video' }>(event)
  const rawUrl = String(body?.url ?? '').trim()

  if (!rawUrl) {
    throw createError({ statusCode: 400, statusMessage: 'url_required' })
  }

  return {
    media: normalizeEmbedInput(rawUrl, body?.kind)
  }
})
