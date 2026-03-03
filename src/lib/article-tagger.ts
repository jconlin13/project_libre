import { anthropic } from '@/lib/anthropic'

/**
 * Auto-generate 1-3 category tags for an article using Claude Haiku.
 * Returns [] on failure or if no API key is configured.
 */
export async function generateArticleTags(
  title: string,
  description: string | null
): Promise<string[]> {
  if (!process.env.ANTHROPIC_API_KEY) return []

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-20250414',
      max_tokens: 100,
      system: `You are a content classifier. Given an article title and description, return 1-3 tags that categorize the article. Return ONLY a JSON array of strings, nothing else. Choose from common categories like: News, Politics, Technology, AI, Science, Health, Sports, Culture, Entertainment, Business, Finance, Food, Travel, Opinion, Humor, Parenting, Books, Education, Environment, History. You may create a new tag if none fit, but keep it to one or two words.`,
      messages: [
        {
          role: 'user',
          content: `Title: ${title}\nDescription: ${description || 'N/A'}`,
        },
      ],
    })

    const text = response.content[0]?.type === 'text' ? response.content[0].text : ''
    const tags = JSON.parse(text.trim())

    if (!Array.isArray(tags)) return []
    return tags
      .filter((t: unknown) => typeof t === 'string' && t.length > 0)
      .slice(0, 3)
      .map((t: string) => t.trim())
  } catch (error) {
    console.error('Article tagging error:', error)
    return []
  }
}
