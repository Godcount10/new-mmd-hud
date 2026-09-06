import { portraitFor } from './characterPortraits'
import type { DerivedCharacter, DerivedDossier, DerivedForum, DerivedForumReply, DerivedOption, DerivedStatus } from './types'

/**
 * Matches one `[key=value]` marker. Keys may not contain `=` or `]`; values may not contain `]`,
 * which keeps a run of adjacent markers from being swallowed as a single match.
 */
export const MARKER_PATTERN = /\[([^\]=]+)=([^\]]*)\]/g

const MAX_CHARACTERS = 6
const MAX_OPTIONS = 3
const MAX_HEADLINES = 3
const MAX_REPLIES = 3

/** Reserved character field suffixes, in the order the panel lists them. */
const CHARACTER_FIELDS = ['姓名', '身份', '关系', '血统', '言灵', '装备', '特质', '描述', '台词', '我方台词', '侧写'] as const
type CharacterField = (typeof CHARACTER_FIELDS)[number]

const CHARACTER_KEY = /^角色([1-9]\d*)(.+)$/
const OPTION_LABEL_KEY = /^选项([1-9]\d*)标题$/
const OPTION_TEXT_KEY = /^选项([1-9]\d*)$/
const HEADLINE_KEY = /^头条([1-9]\d*)$/
const REPLY_HANDLE_KEY = /^回复([1-9]\d*)昵称$/
const REPLY_TEXT_KEY = /^回复([1-9]\d*)$/
const FORUM_SINGLETONS = new Set(['帖子作者', '帖子正文'])
const SCENE_KEYS = new Set(['时间'])

/** Every key the dossier owns. Anything else falls through to the free-form status list. */
export function isReservedKey(key: string): boolean {
  const name = key.trim()
  if (SCENE_KEYS.has(name) || FORUM_SINGLETONS.has(name)) return true
  if (OPTION_LABEL_KEY.test(name) || OPTION_TEXT_KEY.test(name)) return true
  if (HEADLINE_KEY.test(name) || REPLY_HANDLE_KEY.test(name) || REPLY_TEXT_KEY.test(name)) return true
  const character = CHARACTER_KEY.exec(name)
  return character !== null && (CHARACTER_FIELDS as readonly string[]).includes(character[2] as string)
}

/**
 * True when the text carries any `[key=value]` marker, reserved or free-form. Used to pick the one
 * message that defines the panel, so a turn carrying only free-form pairs still counts.
 */
export function hasDerivedMarkers(text: string): boolean {
  for (const [, value] of readMarkers(text)) {
    if (value) return true
  }
  return false
}

/**
 * Parses one message's markers into a dossier. Values are treated as plain text throughout - no
 * HTML is produced or interpreted here, so generated content cannot introduce markup or scripts.
 */
export function parseDerivedMarkers(text: string): DerivedDossier {
  const characterFields = new Map<number, Map<string, string>>()
  const optionLabels = new Map<number, string>()
  const optionTexts = new Map<number, string>()
  const headlines = new Map<number, string>()
  const replyHandles = new Map<number, string>()
  const replyTexts = new Map<number, string>()
  const statuses = new Map<string, string>()
  let time = ''
  let threadAuthor = ''
  let threadBody = ''

  for (const [key, value] of readMarkers(text)) {
    if (!value) continue

    if (SCENE_KEYS.has(key)) { time = value; continue }
    if (key === '帖子作者') { threadAuthor = value; continue }
    if (key === '帖子正文') { threadBody = value; continue }

    const character = CHARACTER_KEY.exec(key)
    if (character && (CHARACTER_FIELDS as readonly string[]).includes(character[2] as string)) {
      const slot = Number(character[1])
      if (slot <= MAX_CHARACTERS) {
        const fields = characterFields.get(slot) ?? new Map<string, string>()
        fields.set(character[2] as string, value)
        characterFields.set(slot, fields)
      }
      continue
    }

    if (assignIndexed(OPTION_LABEL_KEY, key, value, optionLabels, MAX_OPTIONS)) continue
    if (assignIndexed(OPTION_TEXT_KEY, key, value, optionTexts, MAX_OPTIONS)) continue
    if (assignIndexed(HEADLINE_KEY, key, value, headlines, MAX_HEADLINES)) continue
    if (assignIndexed(REPLY_HANDLE_KEY, key, value, replyHandles, MAX_REPLIES)) continue
    if (assignIndexed(REPLY_TEXT_KEY, key, value, replyTexts, MAX_REPLIES)) continue

    statuses.set(key, value)
  }

  const characters = [...characterFields.keys()]
    .sort((a, b) => a - b)
    .map((slot) => toCharacter(slot, characterFields.get(slot) as Map<string, string>))
    // A character with no name has nothing to label its tab with, so it is not on stage.
    .filter((character) => character.name.length > 0)

  // An option needs text to inject; the label falls back to that text when only one is given.
  const options: DerivedOption[] = [...optionTexts.keys()]
    .sort((a, b) => a - b)
    .map((slot) => ({ slot, label: optionLabels.get(slot) || (optionTexts.get(slot) as string), text: optionTexts.get(slot) as string }))

  const replies: DerivedForumReply[] = [...replyTexts.keys()]
    .sort((a, b) => a - b)
    .map((slot) => ({ slot, handle: replyHandles.get(slot) || '匿名专员', text: replyTexts.get(slot) as string }))

  const orderedHeadlines = [...headlines.keys()].sort((a, b) => a - b).map((slot) => headlines.get(slot) as string)
  const forum: DerivedForum | null = orderedHeadlines.length || threadBody || replies.length
    ? { headlines: orderedHeadlines, threadAuthor, threadBody, replies }
    : null

  const statusList: DerivedStatus[] = [...statuses].map(([key, value]) => ({ key, value }))

  return {
    time,
    characters,
    options,
    forum,
    statuses: statusList,
    hasContent: Boolean(time) || characters.length > 0 || options.length > 0 || forum !== null || statusList.length > 0,
  }
}

function assignIndexed(pattern: RegExp, key: string, value: string, target: Map<number, string>, limit: number): boolean {
  const match = pattern.exec(key)
  if (!match) return false
  const slot = Number(match[1])
  if (slot <= limit) target.set(slot, value)
  return true
}

function toCharacter(slot: number, fields: Map<string, string>): DerivedCharacter {
  const read = (field: CharacterField): string => fields.get(field) || ''
  const name = read('姓名')
  return {
    slot,
    name,
    title: read('身份'),
    relation: read('关系'),
    blood: read('血统'),
    spirit: read('言灵'),
    equipment: read('装备'),
    trait: read('特质'),
    description: read('描述'),
    characterLine: read('台词'),
    playerLine: read('我方台词'),
    profile: read('侧写'),
    portraitUrl: portraitFor(name),
  }
}

function* readMarkers(text: string): Generator<[string, string]> {
  MARKER_PATTERN.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = MARKER_PATTERN.exec(text)) !== null) {
    const key = match[1]?.trim()
    const value = match[2]?.trim()
    if (key) yield [key, value ?? '']
  }
}
