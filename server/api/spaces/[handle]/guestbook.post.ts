import { addGuestbookEntry, getCurrentUserFromToken } from '../../../data/store'

export default defineEventHandler(async (event) => {
  const handle = getRouterParam(event, 'handle') ?? ''
  const user = getCurrentUserFromToken(getCookie(event, 'makings_session'))
  if (!user) throw createError({ statusCode: 401, statusMessage: 'login_required' })

  const body = await readBody<{ nodeId?: string; body?: string }>(event)
  if (!body.nodeId) throw createError({ statusCode: 400, statusMessage: 'node_required' })

  try {
    return addGuestbookEntry(user.handle, handle, body.nodeId, body.body ?? '')
  } catch (error) {
    throw createError({
      statusCode: 400,
      statusMessage: error instanceof Error ? error.message : 'guestbook_failed'
    })
  }
})
