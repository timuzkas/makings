import { getCurrentUserFromToken, toggleLike } from '../../data/store'

export default defineEventHandler(async (event) => {
  const user = getCurrentUserFromToken(getCookie(event, 'atelier_session'))
  if (!user) throw createError({ statusCode: 401, statusMessage: 'login_required' })

  const body = await readBody<{ handle?: string; id?: string }>(event)
  if (!body.handle || !body.id) throw createError({ statusCode: 400, statusMessage: 'fragment_required' })

  try {
    return toggleLike(user.handle, { handle: body.handle, id: body.id })
  } catch (error) {
    throw createError({
      statusCode: 400,
      statusMessage: error instanceof Error ? error.message : 'like_failed'
    })
  }
})
