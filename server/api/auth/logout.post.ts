import { clearSession } from '../../data/store'

export default defineEventHandler((event) => {
  const token = getCookie(event, 'atelier_session')

  if (token) {
    clearSession(token)
  }

  deleteCookie(event, 'atelier_session', { path: '/' })
  return { ok: true }
})
