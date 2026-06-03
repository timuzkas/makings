import { registerUser } from '../../data/store'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ handle?: string; password?: string; name?: string }>(event)

  try {
    const session = registerUser({
      handle: body.handle ?? '',
      password: body.password ?? '',
      name: body.name
    })

    setCookie(event, 'makings_session', session.token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30
    })

    return { user: session.user }
  } catch (error) {
    throw createError({
      statusCode: 400,
      statusMessage: error instanceof Error ? error.message : 'register_failed'
    })
  }
})
