// Comparative Rating System — Elo-based with percentile display mapping
// Inspired by Beli's pairwise comparison approach

export const K_FACTOR = 32
export const INITIAL_ELO = 1500
export const TARGET_MEAN = 2.75
export const TARGET_STD = 0.8

// Initial Elo values based on broad impression buckets
export const BUCKET_ELO: Record<string, number> = {
  loved: 1700,
  liked: 1550,
  okay: 1400,
  disliked: 1250,
}

export interface RankingEntry {
  hardcoverBookId: string
  eloScore: number
  manualOverride: number | null
  comparisonCount: number
  bookTitle: string | null
  bookAuthor: string | null
  bookCoverUrl: string | null
}

/**
 * Calculate Elo score updates for a pairwise comparison.
 * Returns [newWinnerElo, newLoserElo].
 * For draws, both scores adjust toward each other.
 */
export function calculateEloUpdate(
  winnerElo: number,
  loserElo: number,
  isDraw: boolean,
  K: number = K_FACTOR
): [number, number] {
  const expectedWinner = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400))
  const expectedLoser = 1 - expectedWinner

  if (isDraw) {
    const newWinner = winnerElo + K * (0.5 - expectedWinner)
    const newLoser = loserElo + K * (0.5 - expectedLoser)
    return [newWinner, newLoser]
  }

  const newWinner = winnerElo + K * (1 - expectedWinner)
  const newLoser = loserElo + K * (0 - expectedLoser)
  return [newWinner, newLoser]
}

/**
 * Calculate display scores (0.5-5.0) from Elo distribution using percentile mapping.
 * Manual overrides are returned as-is.
 */
export function calculateDisplayScores(
  rankings: RankingEntry[]
): Map<string, number> {
  const result = new Map<string, number>()
  if (rankings.length === 0) return result

  // Separate manual overrides from Elo-based rankings
  const eloBooks = rankings.filter(r => r.manualOverride === null)
  const manualBooks = rankings.filter(r => r.manualOverride !== null)

  // Return manual overrides directly
  for (const r of manualBooks) {
    result.set(r.hardcoverBookId, r.manualOverride!)
  }

  if (eloBooks.length === 0) return result

  // Single book: return the target mean
  if (eloBooks.length === 1) {
    // Map single book based on its bucket position relative to INITIAL_ELO
    const elo = eloBooks[0].eloScore
    const bucketOffset = (elo - INITIAL_ELO) / 200 // rough scaling
    const score = Math.round(Math.min(5.0, Math.max(0.5, TARGET_MEAN + bucketOffset * TARGET_STD)) * 10) / 10
    result.set(eloBooks[0].hardcoverBookId, score)
    return result
  }

  // Calculate mean and standard deviation of Elo scores
  const meanElo = eloBooks.reduce((sum, r) => sum + r.eloScore, 0) / eloBooks.length
  const variance = eloBooks.reduce((sum, r) => sum + (r.eloScore - meanElo) ** 2, 0) / eloBooks.length
  const stdElo = Math.sqrt(variance)

  for (const r of eloBooks) {
    const zScore = stdElo > 0 ? (r.eloScore - meanElo) / stdElo : 0
    const displayScore = Math.round(
      Math.min(5.0, Math.max(0.5, TARGET_MEAN + zScore * TARGET_STD)) * 10
    ) / 10
    result.set(r.hardcoverBookId, displayScore)
  }

  return result
}

/**
 * Select the next book to compare against using binary search logic.
 * Picks the ranked book closest to the current Elo estimate that hasn't been compared yet.
 */
export function selectNextComparison(
  currentElo: number,
  candidates: RankingEntry[],
  alreadyCompared: Set<string>
): RankingEntry | null {
  const available = candidates.filter(c => !alreadyCompared.has(c.hardcoverBookId))
  if (available.length === 0) return null

  // Sort by distance from current Elo and pick the closest
  available.sort((a, b) =>
    Math.abs(a.eloScore - currentElo) - Math.abs(b.eloScore - currentElo)
  )

  return available[0]
}

/**
 * Get initial Elo score from impression bucket.
 */
export function initialEloFromBucket(bucket: string): number {
  return BUCKET_ELO[bucket] ?? INITIAL_ELO
}

/**
 * Calculate how many comparisons to perform for a rating session.
 * min(5, max(2, ceil(log2(rankedBookCount))))
 * Returns 0 if there are no existing ranked books.
 */
export function getComparisonCount(totalRanked: number): number {
  if (totalRanked === 0) return 0
  if (totalRanked === 1) return 1
  return Math.min(5, Math.max(2, Math.ceil(Math.log2(totalRanked))))
}

/**
 * Round a display score to the nearest 0.5 for Hardcover sync.
 */
export function roundToHalfStar(score: number): number {
  return Math.round(score * 2) / 2
}
