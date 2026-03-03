export const AVATAR_ICONS = [
  { key: 'cat', label: 'Cat', emoji: '🐱' },
  { key: 'dog', label: 'Dog', emoji: '🐶' },
  { key: 'bird', label: 'Bird', emoji: '🐦' },
  { key: 'fish', label: 'Fish', emoji: '🐟' },
  { key: 'rabbit', label: 'Rabbit', emoji: '🐰' },
  { key: 'turtle', label: 'Turtle', emoji: '🐢' },
  { key: 'butterfly', label: 'Butterfly', emoji: '🦋' },
  { key: 'fox', label: 'Fox', emoji: '🦊' },
  { key: 'owl', label: 'Owl', emoji: '🦉' },
  { key: 'bear', label: 'Bear', emoji: '🐻' },
  { key: 'flower', label: 'Flower', emoji: '🌸' },
  { key: 'tree', label: 'Tree', emoji: '🌳' },
  { key: 'star', label: 'Star', emoji: '⭐' },
  { key: 'moon', label: 'Moon', emoji: '🌙' },
  { key: 'sun', label: 'Sun', emoji: '☀️' },
  { key: 'rocket', label: 'Rocket', emoji: '🚀' },
  { key: 'book', label: 'Book', emoji: '📚' },
  { key: 'music', label: 'Music', emoji: '🎵' },
  { key: 'palette', label: 'Palette', emoji: '🎨' },
  { key: 'coffee', label: 'Coffee', emoji: '☕' },
  { key: 'mountain', label: 'Mountain', emoji: '⛰️' },
  { key: 'anchor', label: 'Anchor', emoji: '⚓' },
  { key: 'crown', label: 'Crown', emoji: '👑' },
  { key: 'sparkles', label: 'Sparkles', emoji: '✨' },
] as const

export type AvatarIconKey = (typeof AVATAR_ICONS)[number]['key']

export const ALLOWED_AVATAR_ICONS: string[] = AVATAR_ICONS.map(i => i.key)

export function getAvatarEmoji(key: string | null | undefined): string | null {
  if (!key) return null
  return AVATAR_ICONS.find(i => i.key === key)?.emoji ?? null
}
