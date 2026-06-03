import { getSpace } from '../../data/store'

export default defineEventHandler((event) => {
  const handle = getRouterParam(event, 'handle') ?? ''
  const space = getSpace(handle, getCookie(event, 'makings_session'))

  if (!space) {
    throw createError({ statusCode: 404, statusMessage: 'Space not found' })
  }

  return space
})
