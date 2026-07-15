/**
 * Server-side Open Graph metadata extraction from URLs.
 * Fetches only the HTML <head> to extract title, description, image, and source.
 * Works with paywalled sites since OG tags are in the <head>, not behind the paywall.
 */

export interface OGMetadata {
  title: string | null
  description: string | null
  imageUrl: string | null
  source: string | null
}

/**
 * Extract Open Graph metadata from a URL.
 * Fetches the first ~50KB of the page and parses meta tags.
 * Falls back to <title> tag and URL slug parsing.
 */
export async function extractOGMetadata(url: string): Promise<OGMetadata> {
  const result: OGMetadata = {
    title: null,
    description: null,
    imageUrl: null,
    source: null,
  }

  // Extract source domain from URL
  try {
    const parsed = new URL(url)
    result.source = parsed.hostname.replace(/^www\./, '')
  } catch {
    // Invalid URL — still try to use it
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LibreBot/1.0; +https://github.com)',
        'Accept': 'text/html',
      },
      redirect: 'follow',
    })

    clearTimeout(timeout)

    if (!response.ok) {
      return fallbackFromUrl(url, result)
    }

    // Read only the first ~50KB to avoid downloading huge pages
    const reader = response.body?.getReader()
    if (!reader) return fallbackFromUrl(url, result)

    let html = ''
    const decoder = new TextDecoder()
    const maxBytes = 50_000

    while (html.length < maxBytes) {
      const { done, value } = await reader.read()
      if (done) break
      html += decoder.decode(value, { stream: true })
      // Stop early if we've passed </head>
      if (html.includes('</head>')) break
    }

    reader.cancel().catch(() => {})

    // Extract OG tags
    result.title = extractMeta(html, 'og:title')
      || extractMeta(html, 'twitter:title')
      || extractTag(html, 'title')

    result.description = extractMeta(html, 'og:description')
      || extractMeta(html, 'twitter:description')
      || extractMeta(html, 'description')

    result.imageUrl = extractMeta(html, 'og:image')
      || extractMeta(html, 'twitter:image')

    const siteName = extractMeta(html, 'og:site_name')
    if (siteName) result.source = siteName

  } catch {
    // Network error, timeout, etc. — use URL-based fallback
    return fallbackFromUrl(url, result)
  }

  // Final fallback: derive title from URL path
  if (!result.title) {
    return fallbackFromUrl(url, result)
  }

  return result
}

/**
 * Extract a meta tag value by property or name attribute.
 */
function extractMeta(html: string, key: string): string | null {
  // Match <meta property="key" content="value"> or <meta name="key" content="value">
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escapeRegex(key)}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escapeRegex(key)}["']`, 'i'),
  ]

  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match?.[1]) return decodeHtmlEntities(match[1].trim())
  }

  return null
}

/**
 * Extract the content of an HTML tag like <title>...</title>.
 */
function extractTag(html: string, tag: string): string | null {
  const match = html.match(new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`, 'i'))
  return match?.[1] ? decodeHtmlEntities(match[1].trim()) : null
}

/**
 * Fallback: derive title from URL path slug.
 * e.g., /business/tariffs-automobile-industry.html → "Tariffs Automobile Industry"
 */
// Matches UUIDs (with or without hyphens) and other hex-heavy ID strings
const UUID_PATTERN = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i
const HEX_ID_PATTERN = /^[0-9a-f]{16,}$/i

function isIdSegment(s: string): boolean {
  return UUID_PATTERN.test(s) || HEX_ID_PATTERN.test(s) || /^\d+$/.test(s)
}

function fallbackFromUrl(url: string, result: OGMetadata): OGMetadata {
  if (result.title) return result

  try {
    const parsed = new URL(url)
    const path = parsed.pathname
    // Get the last path segment, remove extension, convert slugs to words
    const segments = path.split('/').filter(Boolean)

    // Walk segments from last to first, skip IDs/UUIDs
    let slug = ''
    for (let i = segments.length - 1; i >= 0; i--) {
      const candidate = segments[i].replace(/\.\w+$/, '') // remove extension
      if (candidate && !isIdSegment(candidate)) {
        slug = candidate
        break
      }
    }

    if (slug) {
      result.title = slug
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase())
        .trim()
    }
  } catch {
    // Can't parse URL
  }

  return result
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
}
