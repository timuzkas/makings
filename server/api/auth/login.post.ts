import { loginUser } from '../../data/store'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ handle?: string; password?: string }>(event)

  try {
    const session = loginUser({
      handle: body.handle ?? '',
      password: body.password ?? ''
    })

    setCookie(event, 'atelier_session', session.token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30
    })

    return { user: session.user }
  } catch {
    throw createError({
      statusCode: 401,
      statusMessage: 'bad_login'
    })
  }
})
