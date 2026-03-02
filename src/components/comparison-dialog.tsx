'use client'

import { useState, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Loader2, Star, Equal, Trophy } from 'lucide-react'
import { toast } from 'sonner'
import Image from 'next/image'

interface RankedBook {
  hardcoverBookId: string
  displayScore: number | null
  bookTitle: string | null
  bookAuthor: string | null
  bookCoverUrl: string | null
}

interface ComparisonBook {
  hardcoverBookId: string
  eloScore: number
  bookTitle: string | null
  bookAuthor: string | null
  bookCoverUrl: string | null
}

interface ComparisonDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bookId: string
  bookTitle: string
  bookAuthor: string
  bookCoverUrl: string | null
  isRerank?: boolean
  onComplete?: (displayScore: number, rankedList: RankedBook[]) => void
}

type Step = 'impression' | 'comparing' | 'result'

const BUCKETS = [
  { key: 'loved', label: 'Loved it', emoji: '1' },
  { key: 'liked', label: 'Liked it', emoji: '2' },
  { key: 'okay', label: 'It was okay', emoji: '3' },
  { key: 'disliked', label: "Didn't like it", emoji: '4' },
] as const

export function ComparisonDialog({
  open,
  onOpenChange,
  bookId,
  bookTitle,
  bookAuthor,
  bookCoverUrl,
  isRerank = false,
  onComplete,
}: ComparisonDialogProps) {
  const [step, setStep] = useState<Step>(isRerank ? 'comparing' : 'impression')
  const [loading, setLoading] = useState(false)
  const [comparison, setComparison] = useState<ComparisonBook | null>(null)
  const [totalComparisons, setTotalComparisons] = useState(0)
  const [comparisonsCompleted, setComparisonsCompleted] = useState(0)
  const [alreadyCompared, setAlreadyCompared] = useState<string[]>([])
  const [rankedList, setRankedList] = useState<RankedBook[]>([])
  const [currentScore, setCurrentScore] = useState<number | null>(null)
  const [initializing, setInitializing] = useState(false)

  // Reset state when dialog opens
  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (newOpen) {
      setStep(isRerank ? 'comparing' : 'impression')
      setLoading(false)
      setComparison(null)
      setTotalComparisons(0)
      setComparisonsCompleted(0)
      setAlreadyCompared([])
      setRankedList([])
      setCurrentScore(null)
      setInitializing(false)

      // For rerank, start the session immediately
      if (isRerank) {
        startRerank()
      }
    }
    onOpenChange(newOpen)
  }, [isRerank, onOpenChange])

  async function startRerank() {
    setInitializing(true)
    try {
      const res = await fetch('/api/rankings/rerank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hardcoverBookId: bookId }),
      })
      const { data } = await res.json()
      if (!res.ok) throw new Error('Failed to start rerank')

      setTotalComparisons(data.totalComparisons)
      setComparisonsCompleted(0)
      if (data.nextComparison) {
        setComparison(data.nextComparison)
        setStep('comparing')
      } else {
        // No books to compare against
        await fetchFinalRankings()
      }
    } catch {
      toast.error('Failed to start reranking')
      onOpenChange(false)
    } finally {
      setInitializing(false)
    }
  }

  async function handleBucketSelect(bucket: string) {
    setLoading(true)
    try {
      const res = await fetch('/api/rankings/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hardcoverBookId: bookId,
          bucket,
          bookTitle,
          bookAuthor,
          bookCoverUrl,
        }),
      })
      const { data } = await res.json()
      if (!res.ok) throw new Error('Failed to initialize ranking')

      setTotalComparisons(data.totalComparisons)
      setComparisonsCompleted(0)

      if (data.nextComparison && data.totalComparisons > 0) {
        setComparison(data.nextComparison)
        setStep('comparing')
      } else {
        // No other books to compare against — go straight to result
        await fetchFinalRankings()
      }
    } catch {
      toast.error('Failed to initialize rating')
    } finally {
      setLoading(false)
    }
  }

  async function handleComparison(winnerId: string | null) {
    if (!comparison) return
    setLoading(true)
    try {
      const newCompared = [...alreadyCompared, comparison.hardcoverBookId]
      const res = await fetch('/api/rankings/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookAId: bookId,
          bookBId: comparison.hardcoverBookId,
          winnerId,
          currentBookId: bookId,
          alreadyCompared: newCompared,
          totalComparisons,
        }),
      })
      const { data } = await res.json()
      if (!res.ok) throw new Error('Failed to record comparison')

      setAlreadyCompared(newCompared)
      setComparisonsCompleted(data.comparisonsCompleted)

      if (data.nextComparison && data.comparisonsCompleted < data.totalComparisons) {
        setComparison(data.nextComparison)
      } else {
        // All comparisons done — show result
        setRankedList(data.rankedList)
        const myScore = data.rankedList.find(
          (r: RankedBook) => r.hardcoverBookId === String(bookId)
        )?.displayScore ?? null
        setCurrentScore(myScore)
        setStep('result')
      }
    } catch {
      toast.error('Failed to record comparison')
    } finally {
      setLoading(false)
    }
  }

  async function fetchFinalRankings() {
    try {
      const res = await fetch('/api/rankings')
      const { data } = await res.json()
      if (data) {
        setRankedList(data)
        const myScore = data.find(
          (r: RankedBook) => r.hardcoverBookId === String(bookId)
        )?.displayScore ?? null
        setCurrentScore(myScore)
      }
    } catch {
      // Non-critical
    }
    setStep('result')
  }

  function handleDone() {
    if (currentScore !== null) {
      onComplete?.(currentScore, rankedList)
    }
    onOpenChange(false)
  }

  // Find the current book's position in the ranked list
  const currentRank = rankedList.findIndex(
    r => r.hardcoverBookId === String(bookId)
  ) + 1

  // Get nearby books for context (2 above, 2 below)
  const nearbyStart = Math.max(0, currentRank - 3)
  const nearbyEnd = Math.min(rankedList.length, currentRank + 2)
  const nearbyBooks = rankedList.slice(nearbyStart, nearbyEnd)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md" showCloseButton={step !== 'comparing'}>
        {step === 'impression' && (
          <>
            <DialogHeader>
              <DialogTitle>You finished &ldquo;{bookTitle}&rdquo;!</DialogTitle>
              <DialogDescription>How was it overall?</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center gap-4 py-4">
              {bookCoverUrl && (
                <Image
                  src={bookCoverUrl}
                  alt={bookTitle}
                  width={120}
                  height={180}
                  className="rounded-md shadow-md object-cover"
                  style={{ height: 180 }}
                />
              )}
              <div className="grid grid-cols-2 gap-2 w-full">
                {BUCKETS.map(b => (
                  <Button
                    key={b.key}
                    variant="outline"
                    className="h-12 text-sm cursor-pointer"
                    onClick={() => handleBucketSelect(b.key)}
                    disabled={loading}
                  >
                    {b.label}
                  </Button>
                ))}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground cursor-pointer"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Skip rating
              </Button>
              {loading && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
          </>
        )}

        {step === 'comparing' && (
          <>
            <DialogHeader>
              <DialogTitle>Which did you enjoy more?</DialogTitle>
              <DialogDescription>
                Comparison {comparisonsCompleted + 1} of {totalComparisons}
              </DialogDescription>
            </DialogHeader>
            {(initializing || !comparison) ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="py-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {/* Current book */}
                  <button
                    onClick={() => handleComparison(String(bookId))}
                    disabled={loading}
                    className="flex flex-col items-center gap-2 p-3 rounded-lg border border-transparent hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {bookCoverUrl ? (
                      <Image
                        src={bookCoverUrl}
                        alt={bookTitle}
                        width={100}
                        height={150}
                        className="rounded-md shadow-sm object-cover"
                        style={{ height: 150 }}
                      />
                    ) : (
                      <div className="w-[100px] h-[150px] bg-muted rounded-md flex items-center justify-center text-xs text-muted-foreground px-2 text-center">
                        {bookTitle}
                      </div>
                    )}
                    <div className="text-center">
                      <p className="text-sm font-medium line-clamp-2">{bookTitle}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{bookAuthor}</p>
                    </div>
                  </button>

                  {/* Comparison book */}
                  <button
                    onClick={() => handleComparison(comparison.hardcoverBookId)}
                    disabled={loading}
                    className="flex flex-col items-center gap-2 p-3 rounded-lg border border-transparent hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {comparison.bookCoverUrl ? (
                      <Image
                        src={comparison.bookCoverUrl}
                        alt={comparison.bookTitle || 'Book'}
                        width={100}
                        height={150}
                        className="rounded-md shadow-sm object-cover"
                        style={{ height: 150 }}
                      />
                    ) : (
                      <div className="w-[100px] h-[150px] bg-muted rounded-md flex items-center justify-center text-xs text-muted-foreground px-2 text-center">
                        {comparison.bookTitle}
                      </div>
                    )}
                    <div className="text-center">
                      <p className="text-sm font-medium line-clamp-2">{comparison.bookTitle}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{comparison.bookAuthor}</p>
                    </div>
                  </button>
                </div>

                {/* "vs" divider */}
                <div className="flex items-center justify-center">
                  <span className="text-xs text-muted-foreground font-medium">vs</span>
                </div>

                {/* About equal button */}
                <Button
                  variant="outline"
                  className="w-full cursor-pointer"
                  onClick={() => handleComparison(null)}
                  disabled={loading}
                >
                  <Equal className="h-4 w-4 mr-2" />
                  About equal
                </Button>

                {loading && (
                  <div className="flex items-center justify-center">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}

                {/* Progress indicator */}
                <div className="w-full bg-muted rounded-full h-1.5">
                  <div
                    className="bg-primary h-1.5 rounded-full transition-all"
                    style={{ width: `${((comparisonsCompleted) / totalComparisons) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </>
        )}

        {step === 'result' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                Rating Complete
              </DialogTitle>
              <DialogDescription>
                &ldquo;{bookTitle}&rdquo; has been ranked
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              {/* Score display */}
              <div className="flex items-center justify-center gap-3">
                {bookCoverUrl && (
                  <Image
                    src={bookCoverUrl}
                    alt={bookTitle}
                    width={60}
                    height={90}
                    className="rounded-md shadow-sm object-cover"
                    style={{ height: 90 }}
                  />
                )}
                <div className="text-center">
                  <div className="flex items-center gap-2">
                    <PrecisionStars score={currentScore ?? 0} size="lg" />
                    <span className="text-2xl font-bold">{currentScore?.toFixed(1) ?? '—'}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {currentRank > 0 ? `#${currentRank} of ${rankedList.length} books` : ''}
                  </p>
                </div>
              </div>

              {/* Nearby rankings */}
              {nearbyBooks.length > 1 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Nearby rankings</p>
                  <div className="space-y-0.5">
                    {nearbyBooks.map((rb, i) => {
                      const rank = nearbyStart + i + 1
                      const isCurrent = rb.hardcoverBookId === String(bookId)
                      return (
                        <div
                          key={rb.hardcoverBookId}
                          className={`flex items-center gap-2 py-1.5 px-2 rounded text-sm ${
                            isCurrent ? 'bg-primary/10 font-medium' : ''
                          }`}
                        >
                          <span className="text-muted-foreground w-6 text-right text-xs">{rank}.</span>
                          <span className="flex-1 truncate">{rb.bookTitle}</span>
                          <span className="text-muted-foreground text-xs">{rb.displayScore?.toFixed(1)}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {rankedList.length <= 3 && (
                <p className="text-xs text-muted-foreground text-center italic">
                  Your ratings will improve as you rate more books.
                </p>
              )}

              <Button
                onClick={handleDone}
                className="w-full cursor-pointer"
              >
                Done
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

/**
 * Inline precision star display for the result screen.
 * Renders 5 stars with proportional fill based on the score (0-5, 0.1 precision).
 */
function PrecisionStars({ score, size = 'md' }: { score: number; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = size === 'sm' ? 'h-3 w-3' : size === 'md' ? 'h-4 w-4' : 'h-5 w-5'

  return (
    <div className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(star => {
        const fillPct = Math.min(1, Math.max(0, score - (star - 1))) * 100

        return (
          <span key={star} className="relative inline-flex">
            <Star className={`${sizeClass} text-muted-foreground/30`} />
            {fillPct > 0 && (
              <span
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${fillPct}%` }}
              >
                <Star className={`${sizeClass} fill-yellow-500 text-yellow-500`} />
              </span>
            )}
          </span>
        )
      })}
    </div>
  )
}
