export type NodeKind = 'profile' | 'text' | 'shape' | 'line' | 'image' | 'video' | 'audio' | 'portal'

export type TriggerType = 'click' | 'hover' | 'load' | 'message'

export type ActionType =
  | 'toggle'
  | 'show'
  | 'hide'
  | 'focus'
  | 'message'
  | 'tint'
  | 'animate'
  | 'set-property'

export type NodeEffect = 'none' | 'shadow' | 'hard-shadow' | 'blur' | 'invert' | 'outline'

export type NodeLayout = 'center' | 'start' | 'end' | 'stretch'

export type NodeAnimation = 'none' | 'pulse' | 'float' | 'spin' | 'breathe' | 'jitter'

export interface CanvasNode {
  id: string
  kind: NodeKind
  label?: string
  x: number
  y: number
  w: number
  h: number
  r?: number
  scale?: number
  z: number
  hidden?: boolean
  locked?: boolean
  interpolate?: boolean
  text?: string
  media?: string
  avatar?: string
  nickname?: string
  description?: string
  tags?: string[]
  showAvatar?: boolean
  showNickname?: boolean
  showDescription?: boolean
  showTags?: boolean
  arrowEnd?: boolean
  arrowHeadStyle?: 'filled' | 'lines'
  lineStartX?: number
  lineStartY?: number
  lineEndX?: number
  lineEndY?: number
  lineBendX?: number
  lineBendY?: number
  color: string
  textColor?: string
  borderColor?: string
  borderWidth?: number
  radius?: number
  padding?: number
  gap?: number
  opacity?: number
  fontFamily?: string
  fontSize?: number
  fontWeight?: number
  layout?: NodeLayout
  effect?: NodeEffect
  effectStrength?: number
  shadowX?: number
  shadowY?: number
  blurAmount?: number
  outlineSize?: number
  tiltX?: number
  tiltY?: number
  perspective?: number
  animation?: NodeAnimation
  animationMs?: number
}

export interface CanvasFragment {
  id: string
  handle: string
  title: string
  caption?: string
  tags?: string[]
  bounds: {
    x: number
    y: number
    w: number
    h: number
  }
}

export interface FeedFragment extends CanvasFragment {
  nodes: CanvasNode[]
  likes?: number
  likedByMe?: boolean
  comments?: PostComment[]
  commentCount?: number
}

export interface PostComment {
  id: string
  fragmentKey: string
  author: PublicUser
  body: string
  createdAt: string
}

export interface PublicUser {
  handle: string
  name: string
  bio?: string
  avatar?: string
}

export interface AuthUser extends PublicUser {
  following: string[]
}

export interface SpaceSummary {
  handle: string
  name: string
  bio?: string
  status?: string
  followers?: number
  following?: number
  links?: string[]
  googleFonts?: string[]
  theme?: SpaceRecord['theme']
  fragments: CanvasFragment[]
  followedByMe?: boolean
}

export interface CanvasAction {
  type: ActionType
  delayMs?: number
  targetId?: string
  fragmentId?: string
  message?: string
  color?: string
  animation?: NodeAnimation
  property?: string
  value?: string | number | boolean
}

export interface CanvasTrigger {
  id: string
  sourceId: string
  type: TriggerType
  message?: string
  actions: CanvasAction[]
}

export interface SpaceRecord {
  handle: string
  name: string
  bio?: string
  status?: string
  followers?: number
  following?: number
  links?: string[]
  googleFonts?: string[]
  theme?: {
    page: string
    ink: string
    muted: string
    line: string
    chrome: string
    accent: string
    grid: boolean
    gridSize: number
    radius: number
    rasterization?: boolean
  }
  nodes: CanvasNode[]
  fragments: CanvasFragment[]
  triggers: CanvasTrigger[]
  followedByMe?: boolean
}
