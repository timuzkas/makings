import { getCurrentUserFromToken, listGuestbookEntries } from '../../../data/store'

export default defineEventHandler((event) => {
  const handle = getRouterParam(event, 'handle') ?? ''
  const nodeId = String(getQuery(event).nodeId ?? '')
  const user = getCurrentUserFromToken(getCookie(event, 'makings_session'))

  if (!nodeId) {
    throw createError({ statusCode: 400, statusMessage: 'node_required' })
  }

  try {
    return listGuestbookEntries(handle, nodeId, user?.handle)
  } catch (error) {
    throw createError({
      statusCode: 404,
      statusMessage: error instanceof Error ? error.message : 'guestbook_missing'
    })
  }
})
