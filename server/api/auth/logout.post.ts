import { clearSession } from '../../data/store'

export default defineEventHandler((event) => {
  const token = getCookie(event, 'makings_session')

  if (token) {
    clearSession(token)
  }

  deleteCookie(event, 'makings_session', { path: '/' })
  return { ok: true }
})
