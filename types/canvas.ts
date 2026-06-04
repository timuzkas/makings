export type NodeKind = 'profile' | 'text' | 'shape' | 'line' | 'image' | 'video' | 'audio' | 'portal' | 'guestbook'
export type NodeMediaMode = 'upload' | 'embed'
export type NodeMediaKind = 'image' | 'audio' | 'video'
export type NodeMediaProvider = 'direct' | 'youtube' | 'vimeo'

export type TriggerType = 'click' | 'hover' | 'load' | 'message'

export type ActionType =
  | 'toggle'
  | 'show'
  | 'hide'
  | 'toggle-audio'
  | 'toggle-video'
  | 'focus'
  | 'message'
  | 'tint'
  | 'animate'
  | 'set-property'
  | 'set-state'
  | 'toggle-state'
  | 'increment-state'

export type StateScope = 'visitor' | 'global'
export type StateValue = string | number | boolean
export type StateOperator = 'equals' | 'not-equals' | 'greater-than' | 'less-than' | 'truthy' | 'falsy'

export type NodeEffect = 'none' | 'shadow' | 'hard-shadow' | 'blur' | 'invert' | 'outline'

export type NodeLayout = 'center' | 'start' | 'end' | 'stretch'

export type NodeAnimation = 'none' | 'pulse' | 'float' | 'spin' | 'breathe' | 'jitter'

export interface NodeMediaRef {
  id?: string
  mode: NodeMediaMode
  kind: NodeMediaKind
  src: string
  provider: NodeMediaProvider
  mimeType?: string
  bytes?: number
  width?: number
  height?: number
  durationMs?: number
  originalName?: string
  posterSrc?: string
}

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
  groupId?: string
  interpolate?: boolean
  text?: string
  media?: NodeMediaRef | string
  avatar?: string
  nickname?: string
  description?: string
  tags?: string[]
  portalTargetSpaceHandle?: string
  portalTargetFragmentId?: string
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
  guestbookPrompt?: string
  guestbookMaxEntries?: number
  soundZoneEnabled?: boolean
  soundZoneRadius?: number
  soundZoneFalloff?: number
  soundZoneMaxVolume?: number
}

export interface CanvasStateVariable {
  key: string
  label: string
  initialValue: StateValue
  scope: StateScope
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
  googleFonts?: string[]
  stateVariables?: CanvasStateVariable[]
  theme?: SpaceRecord['theme']
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

export type SpaceLink = string | {
  label?: string
  url: string
}

export interface SpaceSummary {
  handle: string
  name: string
  bio?: string
  status?: string
  followers?: number
  following?: number
  links?: SpaceLink[]
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
  stateKey?: string
}

export interface CanvasTrigger {
  id: string
  sourceId: string
  type: TriggerType
  message?: string
  conditions?: Array<{
    stateKey: string
    operator: StateOperator
    value?: StateValue
  }>
  actions: CanvasAction[]
}

export interface GuestbookEntry {
  id: string
  spaceHandle: string
  nodeId: string
  author: PublicUser
  body: string
  createdAt: string
  canDelete?: boolean
}

export interface SpaceRecord {
  handle: string
  name: string
  bio?: string
  status?: string
  followers?: number
  following?: number
  links?: SpaceLink[]
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
  stateVariables: CanvasStateVariable[]
  followedByMe?: boolean
}
