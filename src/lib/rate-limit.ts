// In-memory sliding window rate limiter
const windows = new Map<string, { count: number; windowStart: number }>()

// Clean up stale entries periodically
const CLEANUP_INTERVAL = 5 * 60 * 1000 // 5 minutes
let lastCleanup = Date.now()

function cleanup(windowMs: number) {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now
  for (const [key, entry] of windows) {
    if (now - entry.windowStart > windowMs * 2) {
      windows.delete(key)
    }
  }
}

/**
 * Check if a request is rate limited.
 * Returns true if the request SHOULD BE BLOCKED, false if allowed.
 */
export function isRateLimited(key: string, maxRequests: number, windowMs: number): boolean {
  cleanup(windowMs)
  const now = Date.now()
  const entry = windows.get(key)

  if (!entry || now - entry.windowStart > windowMs) {
    // New window
    windows.set(key, { count: 1, windowStart: now })
    return false
  }

  if (entry.count >= maxRequests) {
    return true
  }

  entry.count++
  return false
}
