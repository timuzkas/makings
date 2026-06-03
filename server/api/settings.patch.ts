import { getCurrentUserFromToken, getSpace, saveSpace } from '../data/store'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const user = getCurrentUserFromToken(getCookie(event, 'atelier_session'))

  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'login_required' })
  }

  const current = getSpace(user.handle)

  if (!current) {
    throw createError({ statusCode: 404, statusMessage: 'Settings not found' })
  }

  const nodes = current.nodes.map((node) => {
    if (node.id !== 'user-card') return node
    return {
      ...node,
      ...(body.profile ?? {}),
      id: 'user-card',
      kind: 'profile',
      locked: true
    }
  })

  return saveSpace(current.handle, {
    name: body.name ?? current.name,
    bio: body.bio ?? current.bio,
    status: body.status ?? current.status,
    links: body.links ?? current.links,
    googleFonts: body.googleFonts ?? current.googleFonts,
    theme: {
      ...current.theme,
      ...(body.theme ?? {})
    },
    nodes
  })
})
