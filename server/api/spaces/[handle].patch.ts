import { getCurrentUserFromToken, saveSpace } from '../../data/store'

export default defineEventHandler(async (event) => {
  const handle = getRouterParam(event, 'handle') ?? ''
  const body = await readBody(event)
  const user = getCurrentUserFromToken(getCookie(event, 'atelier_session'))

  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'login_required' })
  }

  if (user.handle !== handle) {
    throw createError({ statusCode: 403, statusMessage: 'not_space_owner' })
  }

  try {
    return saveSpace(handle, body)
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Space not found' })
  }
})
