export type DragonRajaSurface = 'welcome' | 'opening' | 'story' | 'settings'
export type DragonRajaOverlay = 'codex' | 'map' | 'menu' | 'rollback' | 'exit' | null

export interface OpeningChoiceGroup {
  id: string
  title: string
  instruction: string
  options: readonly string[]
  selectionMode?: 'single' | 'multiple'
  minSelections?: number
  maxSelections?: number
}

export interface OpeningSelection {
  groupId: string
  groupTitle: string
  option: string
}

export interface DerivedStatus {
  key: string
  value: string
}

/** One on-stage character, from `[角色N…]` markers. Every field is optional: the UI hides blanks. */
export interface DerivedCharacter {
  slot: number
  name: string
  title: string
  relation: string
  blood: string
  spirit: string
  equipment: string
  trait: string
  description: string
  characterLine: string
  playerLine: string
  profile: string
  portraitUrl: string
}

/** `[选项N标题=…]` is the label shown; `[选项N=…]` is the text injected into the composer. */
export interface DerivedOption {
  slot: number
  label: string
  text: string
}

export interface DerivedForumReply {
  slot: number
  handle: string
  text: string
}

export interface DerivedForum {
  headlines: readonly string[]
  threadAuthor: string
  threadBody: string
  replies: readonly DerivedForumReply[]
}

/**
 * A whole-snapshot dossier. Only the most recent assistant message carrying any reserved marker
 * defines it; earlier messages are ignored outright rather than merged, so partial repeats can
 * never compose a character out of two different people.
 */
export interface DerivedDossier {
  time: string
  characters: readonly DerivedCharacter[]
  options: readonly DerivedOption[]
  forum: DerivedForum | null
  statuses: readonly DerivedStatus[]
  hasContent: boolean
}
