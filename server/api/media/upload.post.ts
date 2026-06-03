import { getCurrentUserFromToken } from '../../data/store'
import { hostedMediaMeta, storeUploadedMedia } from '../../utils/media'

export default defineEventHandler(async (event) => {
  const user = getCurrentUserFromToken(getCookie(event, 'makings_session'))
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'login_required' })
  }

  const form = await readMultipartFormData(event)
  const field = (name: string) => form?.find((entry) => entry.name === name)
  const file = field('file')
  const space = String(field('space')?.data?.toString('utf8') ?? '').trim()
  const requestedKind = String(field('kind')?.data?.toString('utf8') ?? '').trim() as 'image' | 'audio' | 'video' | ''

  if (!file?.data || !space) {
    throw createError({ statusCode: 400, statusMessage: 'upload_requires_file_and_space' })
  }

  if (user.handle !== space) {
    throw createError({ statusCode: 403, statusMessage: 'not_space_owner' })
  }

  const width = readOptionalNumber(field('width')?.data?.toString('utf8'))
  const height = readOptionalNumber(field('height')?.data?.toString('utf8'))
  const durationMs = readOptionalNumber(field('durationMs')?.data?.toString('utf8'))
  const posterSrc = String(field('posterSrc')?.data?.toString('utf8') ?? '').trim() || undefined

  const stored = storeUploadedMedia({
    space,
    fileName: file.filename,
    mimeType: file.type,
    bytes: file.data,
    requestedKind: requestedKind || undefined,
    width,
    height,
    durationMs,
    posterSrc
  })

  return {
    media: hostedMediaMeta(stored)
  }
})

function readOptionalNumber(value?: string | null) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}
