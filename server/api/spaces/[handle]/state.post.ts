import { getCurrentUserFromToken, updateGlobalState } from '../../../data/store'
import type { StateValue } from '../../../../types/canvas'

export default defineEventHandler(async (event) => {
  const handle = getRouterParam(event, 'handle') ?? ''
  const user = getCurrentUserFromToken(getCookie(event, 'makings_session'))
  if (!user) throw createError({ statusCode: 401, statusMessage: 'login_required' })

  const body = await readBody<{ type?: string; stateKey?: string; value?: StateValue }>(event)

  try {
    return updateGlobalState(user.handle, handle, body)
  } catch (error) {
    throw createError({
      statusCode: 400,
      statusMessage: error instanceof Error ? error.message : 'state_update_failed'
    })
  }
})
