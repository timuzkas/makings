import { getCurrentUserFromToken, getSpace } from '../data/store'

export default defineEventHandler((event) => {
  const user = getCurrentUserFromToken(getCookie(event, 'atelier_session'))

  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'login_required' })
  }

  const space = getSpace(user.handle)

  if (!space) {
    throw createError({ statusCode: 404, statusMessage: 'Settings not found' })
  }

  return {
    handle: space.handle,
    name: space.name,
    bio: space.bio,
    status: space.status,
    links: space.links,
    googleFonts: space.googleFonts,
    theme: space.theme,
    profile: space.nodes.find((node) => node.id === 'user-card')
  }
})
