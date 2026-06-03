import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import type { AuthUser, CanvasFragment, CanvasNode, FeedFragment, PostComment, PublicUser, SpaceRecord, SpaceSummary } from '../../types/canvas'
import { cleanupSpaceMedia, normalizeSpaceNodes } from '../utils/media'

const dbPath = join(process.cwd(), '.data', 'spaces.json')
const socialPath = join(process.cwd(), '.data', 'social.json')

interface StoredUser extends PublicUser {
  passwordHash: string
  salt: string
  createdAt: string
}

interface StoredSession {
  token: string
  handle: string
  createdAt: string
}

interface SocialState {
  users: StoredUser[]
  sessions: StoredSession[]
  follows: Array<{ from: string; to: string }>
  likes: Array<{ from: string; fragmentKey: string }>
  comments: Array<{ id: string; fragmentKey: string; authorHandle: string; body: string; createdAt: string }>
}

const defaultNodes: CanvasNode[] = [
  {
    id: 'user-card',
    kind: 'profile',
    locked: true,
    x: -690,
    y: -260,
    w: 340,
    h: 270,
    z: 20,
    avatar: 'https://api.dicebear.com/9.x/shapes/svg?seed=ena',
    nickname: 'ena',
    description: 'Spatial sketchbook, media wall, and public studio.',
    tags: ['visual', 'sound', 'remix'],
    color: '#ffffff',
    textColor: '#101010',
    borderColor: '#101010',
    borderWidth: 1,
    radius: 8,
    padding: 20,
    fontFamily: 'Avenir Next, Segoe UI, Helvetica Neue, sans-serif',
    fontSize: 15,
    fontWeight: 600,
    effect: 'shadow'
  },
  {
    id: 'intro',
    kind: 'text',
    x: -300,
    y: -220,
    w: 420,
    h: 130,
    z: 1,
    text: 'open studio',
    color: '#111111',
    textColor: '#111111',
    fontFamily: 'Georgia, Times New Roman, serif',
    fontSize: 64,
    fontWeight: 700,
    animation: 'none'
  },
  {
    id: 'current-piece',
    kind: 'shape',
    x: 160,
    y: -170,
    w: 360,
    h: 240,
    z: 2,
    text: 'current piece',
    color: '#e8ff5c',
    radius: 8,
    padding: 22,
    effect: 'hard-shadow'
  },
  {
    id: 'image-wall',
    kind: 'image',
    x: 560,
    y: -50,
    w: 300,
    h: 360,
    z: 3,
    text: 'image wall',
    color: '#7ee2ff',
    radius: 4,
    effect: 'shadow'
  },
  {
    id: 'sound-shelf',
    kind: 'audio',
    x: -520,
    y: 170,
    w: 260,
    h: 120,
    z: 4,
    text: 'sound shelf',
    color: '#111111',
    textColor: '#ffffff',
    radius: 999
  },
  {
    id: 'screening',
    kind: 'video',
    x: 120,
    y: 260,
    w: 420,
    h: 240,
    z: 5,
    text: 'screening',
    color: '#ff6f61',
    animation: 'breathe',
    animationMs: 2600
  },
  {
    id: 'hidden',
    kind: 'shape',
    x: -120,
    y: 80,
    w: 260,
    h: 180,
    z: 6,
    text: 'private layer',
    color: '#35f28f',
    hidden: true
  },
  {
    id: 'switch',
    kind: 'portal',
    x: -210,
    y: 330,
    w: 120,
    h: 120,
    z: 7,
    text: 'reveal',
    color: '#111111'
  }
]

const defaultSpaces: SpaceRecord[] = [
  {
    handle: 'ena',
    name: 'ena',
    bio: 'Spatial sketchbook, media wall, and public studio.',
    status: 'open for remix',
    followers: 1842,
    following: 219,
    links: [
      { label: 'portfolio', url: 'https://example.com' },
      { label: 'soundcloud', url: 'https://soundcloud.com' },
      { label: 'newsletter', url: 'https://example.com/newsletter' }
    ],
    googleFonts: [],
    theme: {
      page: '#ffffff',
      ink: '#101010',
      muted: '#686866',
      line: '#dddddd',
      chrome: '#ffffff',
      accent: '#3a71ff',
      grid: true,
      gridSize: 40,
      radius: 8,
      rasterization: true
    },
    nodes: defaultNodes,
    fragments: [
      {
        id: 'studio-entrance',
        handle: 'ena',
        title: 'studio entrance',
        caption: 'The first viewport of the space.',
        tags: ['studio', 'profile'],
        bounds: { x: -760, y: -310, w: 940, h: 410 }
      },
      {
        id: 'current-piece',
        handle: 'ena',
        title: 'current piece',
        caption: 'A shareable crop from the working area.',
        tags: ['work', 'visual'],
        bounds: { x: 100, y: -230, w: 470, h: 340 }
      },
      {
        id: 'media-wall',
        handle: 'ena',
        title: 'media wall',
        caption: 'Video and sound embedded inside the space.',
        tags: ['video', 'sound'],
        bounds: { x: 70, y: 220, w: 520, h: 330 }
      }
    ],
    triggers: [
      {
        id: 'switch-click',
        sourceId: 'switch',
        type: 'click',
        actions: [
          { type: 'toggle', targetId: 'hidden' },
          { type: 'message', message: 'signal' }
        ]
      },
      {
        id: 'signal-tint',
        sourceId: 'current-piece',
        type: 'message',
        message: 'signal',
        actions: [
          { type: 'tint', targetId: 'current-piece', color: '#35f28f' },
          { type: 'animate', targetId: 'current-piece', animation: 'pulse' }
        ]
      },
      {
        id: 'current-piece-hover',
        sourceId: 'current-piece',
        type: 'hover',
        actions: [
          { type: 'focus', fragmentId: 'current-piece' }
        ]
      }
    ]
  }
]

function hashPassword(password: string, salt = randomBytes(16).toString('hex')) {
  return {
    salt,
    passwordHash: scryptSync(password, salt, 64).toString('hex')
  }
}

const enaPassword = hashPassword('ena')

const defaultSocial: SocialState = {
  users: [
    {
      handle: 'ena',
      name: 'ena',
      bio: 'Spatial sketchbook, media wall, and public studio.',
      avatar: 'https://api.dicebear.com/9.x/shapes/svg?seed=ena',
      createdAt: new Date().toISOString(),
      ...enaPassword
    }
  ],
  sessions: [],
  follows: [],
  likes: [],
  comments: []
}

function readDb() {
  if (!existsSync(dbPath)) {
    writeDb(defaultSpaces)
  }

  const spaces = JSON.parse(readFileSync(dbPath, 'utf8')) as SpaceRecord[]
  const migrated = spaces.map(normalizeSpace)
  writeDb(migrated)
  return migrated
}

function writeDb(spaces: SpaceRecord[]) {
  mkdirSync(dirname(dbPath), { recursive: true })
  writeFileSync(dbPath, JSON.stringify(spaces, null, 2))
}

function readSocial() {
  if (!existsSync(socialPath)) {
    writeSocial(defaultSocial)
  }

  const stored = JSON.parse(readFileSync(socialPath, 'utf8')) as Partial<SocialState>
  const social: SocialState = {
    users: stored.users ?? [],
    sessions: stored.sessions ?? [],
    follows: stored.follows ?? [],
    likes: stored.likes ?? [],
    comments: stored.comments ?? []
  }
  const hasEna = social.users.some((user) => user.handle === 'ena')
  const next = hasEna ? social : { ...social, users: [...social.users, defaultSocial.users[0]] }
  writeSocial(next)
  return next
}

function writeSocial(social: SocialState) {
  mkdirSync(dirname(socialPath), { recursive: true })
  writeFileSync(socialPath, JSON.stringify(social, null, 2))
}

function normalizeSpace(space: SpaceRecord): SpaceRecord {
  const fallback = defaultSpaces.find((item) => item.handle === space.handle) ?? defaultSpaces[0]
  const profileFallback = fallback.nodes.find((node) => node.id === 'user-card')

  return normalizeSpaceNodes({
    ...fallback,
    ...space,
    theme: {
      ...fallback.theme,
      ...space.theme
    },
    googleFonts: space.googleFonts ?? [],
    nodes: space.nodes.map((node) => {
      if (node.id !== 'user-card' || !profileFallback) return node

      return {
        ...profileFallback,
        ...node,
        id: 'user-card',
        kind: 'profile',
        locked: true,
        showAvatar: node.showAvatar ?? true,
        showNickname: node.showNickname ?? true,
        showDescription: node.showDescription ?? true,
        showTags: node.showTags ?? true
      }
    })
  })
}

function nodesInFragment(nodes: CanvasNode[], fragment: CanvasFragment) {
  return nodes
    .filter((node) => {
      if (node.hidden) return false

      const nodeRight = node.x + node.w
      const nodeBottom = node.y + node.h
      const fragmentRight = fragment.bounds.x + fragment.bounds.w
      const fragmentBottom = fragment.bounds.y + fragment.bounds.h

      return node.x < fragmentRight
        && nodeRight > fragment.bounds.x
        && node.y < fragmentBottom
        && nodeBottom > fragment.bounds.y
    })
    .sort((a, b) => a.z - b.z)
}

export function listFeed(token?: string) {
  const social = readSocial()
  const viewer = getCurrentUserFromToken(token)

  return readDb().flatMap((space) => {
    return space.fragments.map((fragment): FeedFragment => {
      const key = fragmentKey(fragment)
      const comments = commentsForFragment(social, key)

      return {
        ...fragment,
        nodes: nodesInFragment(space.nodes, fragment),
        googleFonts: space.googleFonts ?? [],
        likes: social.likes.filter((like) => like.fragmentKey === key).length,
        likedByMe: viewer ? social.likes.some((like) => like.from === viewer.handle && like.fragmentKey === key) : false,
        comments: comments.slice(-3),
        commentCount: comments.length
      }
    })
  })
}

export function listSpaces(token?: string): SpaceSummary[] {
  const social = readSocial()
  const viewer = getCurrentUserFromToken(token)

  return readDb().map((space) => ({
    handle: space.handle,
    name: space.name,
    bio: space.bio,
    status: space.status,
    followers: followerCount(social, space.handle),
    following: social.follows.filter((follow) => follow.from === space.handle).length,
    links: space.links,
    googleFonts: space.googleFonts,
    theme: space.theme,
    fragments: space.fragments,
    followedByMe: viewer ? social.follows.some((follow) => follow.from === viewer.handle && follow.to === space.handle) : false
  }))
}

export function getSpace(handle: string, token?: string) {
  const social = readSocial()
  const viewer = getCurrentUserFromToken(token)
  const space = readDb().find((item) => item.handle === handle)
  if (!space) return undefined

  return {
    ...space,
    followers: followerCount(social, handle),
    following: social.follows.filter((follow) => follow.from === handle).length,
    followedByMe: viewer ? social.follows.some((follow) => follow.from === viewer.handle && follow.to === handle) : false
  }
}

export function saveSpace(handle: string, incoming: Partial<SpaceRecord>) {
  const spaces = readDb()
  const index = spaces.findIndex((space) => space.handle === handle)

  if (index === -1) {
    throw new Error('space_not_found')
  }

  const current = spaces[index]
  const next = normalizeSpaceNodes({
    ...current,
    ...incoming,
    handle: current.handle,
    nodes: incoming.nodes ?? current.nodes,
    fragments: incoming.fragments ?? current.fragments,
    triggers: incoming.triggers ?? current.triggers,
    googleFonts: incoming.googleFonts ?? current.googleFonts,
    theme: incoming.theme ?? current.theme
  })

  spaces[index] = next
  writeDb(spaces)
  cleanupSpaceMedia(handle, next.nodes)
  return next
}

function cleanHandle(handle: string) {
  return handle.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24)
}

function makeSpaceForUser(user: PublicUser): SpaceRecord {
  const nodes = JSON.parse(JSON.stringify(defaultNodes)) as CanvasNode[]
  const profile = nodes.find((node) => node.id === 'user-card')

  if (profile) {
    profile.nickname = user.name || user.handle
    profile.description = user.bio || 'New public canvas.'
    profile.avatar = user.avatar || `https://api.dicebear.com/9.x/shapes/svg?seed=${encodeURIComponent(user.handle)}`
  }

  return {
    ...defaultSpaces[0],
    handle: user.handle,
    name: user.name || user.handle,
    bio: user.bio || 'New public canvas.',
    status: 'building in public',
    followers: 0,
    following: 0,
    links: [],
    googleFonts: [],
    nodes,
    fragments: [],
    triggers: []
  }
}

function publicUser(user: StoredUser): PublicUser {
  return {
    handle: user.handle,
    name: user.name,
    bio: user.bio,
    avatar: user.avatar
  }
}

function followerCount(social: SocialState, handle: string) {
  return social.follows.filter((follow) => follow.to === handle).length
}

function fragmentKey(fragment: CanvasFragment) {
  return `${fragment.handle}:${fragment.id}`
}

function commentsForFragment(social: SocialState, key: string): PostComment[] {
  return social.comments
    .filter((comment) => comment.fragmentKey === key)
    .map((comment) => {
      const user = social.users.find((item) => item.handle === comment.authorHandle)

      return {
        id: comment.id,
        fragmentKey: comment.fragmentKey,
        author: user ? publicUser(user) : {
          handle: comment.authorHandle,
          name: comment.authorHandle
        },
        body: comment.body,
        createdAt: comment.createdAt
      }
    })
}

export function getCurrentUserFromToken(token?: string): AuthUser | null {
  const sessionToken = token || ''
  if (!sessionToken) return null

  const social = readSocial()
  const session = social.sessions.find((item) => item.token === sessionToken)
  const user = session ? social.users.find((item) => item.handle === session.handle) : null

  if (!user) return null

  return {
    ...publicUser(user),
    following: social.follows.filter((follow) => follow.from === user.handle).map((follow) => follow.to)
  }
}

export function registerUser(input: { handle: string; password: string; name?: string }) {
  const handle = cleanHandle(input.handle)
  const name = input.name?.trim() || handle

  if (!handle || handle.length < 2) throw new Error('bad_handle')
  if (input.password.length < 4) throw new Error('bad_password')

  const social = readSocial()
  if (social.users.some((user) => user.handle === handle)) throw new Error('user_exists')

  const password = hashPassword(input.password)
  const user: StoredUser = {
    handle,
    name,
    bio: 'New public canvas.',
    avatar: `https://api.dicebear.com/9.x/shapes/svg?seed=${encodeURIComponent(handle)}`,
    createdAt: new Date().toISOString(),
    ...password
  }

  writeSocial({ ...social, users: [...social.users, user] })

  const spaces = readDb()
  if (!spaces.some((space) => space.handle === handle)) {
    writeDb([...spaces, makeSpaceForUser(user)])
  }

  return createSession(handle)
}

export function loginUser(input: { handle: string; password: string }) {
  const handle = cleanHandle(input.handle)
  const social = readSocial()
  const user = social.users.find((item) => item.handle === handle)

  if (!user) throw new Error('bad_login')

  const attempted = Buffer.from(hashPassword(input.password, user.salt).passwordHash, 'hex')
  const stored = Buffer.from(user.passwordHash, 'hex')
  if (attempted.length !== stored.length || !timingSafeEqual(attempted, stored)) {
    throw new Error('bad_login')
  }

  return createSession(handle)
}

export function createSession(handle: string) {
  const social = readSocial()
  const token = randomBytes(32).toString('hex')
  const sessions = [
    ...social.sessions.filter((session) => session.handle !== handle),
    { token, handle, createdAt: new Date().toISOString() }
  ]
  const user = social.users.find((item) => item.handle === handle)

  if (!user) throw new Error('user_missing')

  writeSocial({ ...social, sessions })

  return {
    token,
    user: {
      ...publicUser(user),
      following: social.follows.filter((follow) => follow.from === handle).map((follow) => follow.to)
    } satisfies AuthUser
  }
}

export function clearSession(token: string) {
  const social = readSocial()
  writeSocial({ ...social, sessions: social.sessions.filter((session) => session.token !== token) })
}

export function toggleFollow(viewerHandle: string, targetHandle: string) {
  if (viewerHandle === targetHandle) throw new Error('self_follow')

  const social = readSocial()
  if (!social.users.some((user) => user.handle === targetHandle)) throw new Error('target_missing')

  const exists = social.follows.some((follow) => follow.from === viewerHandle && follow.to === targetHandle)
  const follows = exists
    ? social.follows.filter((follow) => !(follow.from === viewerHandle && follow.to === targetHandle))
    : [...social.follows, { from: viewerHandle, to: targetHandle }]

  writeSocial({ ...social, follows })

  return {
    following: !exists,
    followers: follows.filter((follow) => follow.to === targetHandle).length
  }
}

export function toggleLike(viewerHandle: string, fragment: { handle: string; id: string }) {
  const social = readSocial()
  const key = `${fragment.handle}:${fragment.id}`
  const spaces = readDb()
  const existsFragment = spaces.some((space) => {
    return space.handle === fragment.handle && space.fragments.some((item) => item.id === fragment.id)
  })

  if (!existsFragment) throw new Error('fragment_missing')

  const exists = social.likes.some((like) => like.from === viewerHandle && like.fragmentKey === key)
  const likes = exists
    ? social.likes.filter((like) => !(like.from === viewerHandle && like.fragmentKey === key))
    : [...social.likes, { from: viewerHandle, fragmentKey: key }]

  writeSocial({ ...social, likes })

  return {
    liked: !exists,
    likes: likes.filter((like) => like.fragmentKey === key).length
  }
}

export function addComment(viewerHandle: string, fragment: { handle: string; id: string }, body: string) {
  const text = body.trim().replace(/\s+/g, ' ').slice(0, 280)
  if (!text) throw new Error('empty_comment')

  const social = readSocial()
  const key = `${fragment.handle}:${fragment.id}`
  const spaces = readDb()
  const existsFragment = spaces.some((space) => {
    return space.handle === fragment.handle && space.fragments.some((item) => item.id === fragment.id)
  })

  if (!existsFragment) throw new Error('fragment_missing')
  if (!social.users.some((user) => user.handle === viewerHandle)) throw new Error('user_missing')

  const comment = {
    id: `comment-${randomBytes(8).toString('hex')}`,
    fragmentKey: key,
    authorHandle: viewerHandle,
    body: text,
    createdAt: new Date().toISOString()
  }
  const comments = [...social.comments, comment]
  const nextSocial = { ...social, comments }

  writeSocial(nextSocial)

  return {
    comment: commentsForFragment(nextSocial, key).find((item) => item.id === comment.id),
    comments: commentsForFragment(nextSocial, key).slice(-3),
    commentCount: comments.filter((item) => item.fragmentKey === key).length
  }
}
