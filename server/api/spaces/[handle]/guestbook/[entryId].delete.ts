import { deleteGuestbookEntry, getCurrentUserFromToken } from '../../../../data/store'

export default defineEventHandler((event) => {
  const handle = getRouterParam(event, 'handle') ?? ''
  const entryId = getRouterParam(event, 'entryId') ?? ''
  const user = getCurrentUserFromToken(getCookie(event, 'makings_session'))
  if (!user) throw createError({ statusCode: 401, statusMessage: 'login_required' })

  try {
    return deleteGuestbookEntry(user.handle, handle, entryId)
  } catch (error) {
    throw createError({
      statusCode: 403,
      statusMessage: error instanceof Error ? error.message : 'guestbook_delete_failed'
    })
  }
})
