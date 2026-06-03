import { getCurrentUserFromToken } from '../../data/store'

export default defineEventHandler((event) => {
  return {
    user: getCurrentUserFromToken(getCookie(event, 'makings_session'))
  }
})
