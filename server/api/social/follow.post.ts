import { getCurrentUserFromToken, toggleFollow } from '../../data/store'

export default defineEventHandler(async (event) => {
  const user = getCurrentUserFromToken(getCookie(event, 'atelier_session'))
  if (!user) throw createError({ statusCode: 401, statusMessage: 'login_required' })

  const body = await readBody<{ handle?: string }>(event)
  if (!body.handle) throw createError({ statusCode: 400, statusMessage: 'handle_required' })

  try {
    return toggleFollow(user.handle, body.handle)
  } catch (error) {
    throw createError({
      statusCode: 400,
      statusMessage: error instanceof Error ? error.message : 'follow_failed'
    })
  }
})
