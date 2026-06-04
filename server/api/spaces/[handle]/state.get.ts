import { listGlobalState } from '../../../data/store'

export default defineEventHandler((event) => {
  const handle = getRouterParam(event, 'handle') ?? ''

  try {
    return listGlobalState(handle)
  } catch (error) {
    throw createError({
      statusCode: 404,
      statusMessage: error instanceof Error ? error.message : 'state_missing'
    })
  }
})
