'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Upload, FileText, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { parseGoodreadsCsv, summarize, type ParsedBook } from '@/lib/goodreads-csv'

type Stage = 'choose' | 'preview' | 'importing' | 'resolving' | 'enriching' | 'done'

interface ImportResult {
  imported: number
  updated: number
  ranked: number
  failed: number
}

const MAX_FILE_BYTES = 10 * 1024 * 1024

export function ImportLibraryDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [stage, setStage] = useState<Stage>('choose')
  const [books, setBooks] = useState<ParsedBook[]>([])
  const [skipped, setSkipped] = useState<Array<{ row: number; reason: string }>>([])
  const [fileName, setFileName] = useState('')
  const [result, setResult] = useState<ImportResult | null>(null)
  const [coversFound, setCoversFound] = useState(0)
  const [matched, setMatched] = useState(0)
  const [unmatched, setUnmatched] = useState(0)
  const [coversLeft, setCoversLeft] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  function reset() {
    setStage('choose')
    setBooks([])
    setSkipped([])
    setFileName('')
    setResult(null)
    setCoversFound(0)
    setCoversLeft(0)
    setMatched(0)
    setUnmatched(0)
    if (inputRef.current) inputRef.current.value = ''
  }

  function handleClose(o: boolean) {
    if (!o) reset()
    onOpenChange(o)
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > MAX_FILE_BYTES) {
      toast.error('That file is larger than 10MB.')
      return
    }

    try {
      const text = await file.text()
      const parsed = parseGoodreadsCsv(text)

      if (parsed.books.length === 0) {
        const reason = parsed.skipped[0]?.reason || 'No books found in that file.'
        toast.error(reason)
        return
      }

      setFileName(file.name)
      setBooks(parsed.books)
      setSkipped(parsed.skipped)
      setStage('preview')
    } catch {
      toast.error('Could not read that file.')
    }
  }

  /**
   * Match imported ISBNs to real Hardcover books, which gives them proper
   * titles, covers, descriptions and page counts — and a working detail page,
   * since they stop being ISBN-only records.
   */
  async function runResolution() {
    setStage('resolving')
    let guard = 0
    try {
      for (;;) {
        const res = await fetch('/api/import/resolve', { method: 'POST' })
        if (!res.ok) break
        const { data } = await res.json()
        if (data.unavailable) break // No Hardcover token available at all
        setMatched(prev => prev + (data.resolved || 0))
        setUnmatched(data.unmatched || 0)
        if (data.done) break
        if (++guard > 40) break
      }
    } catch {
      // Best effort — the import itself already succeeded
    }
  }

  /**
   * Cover lookup needs a network round trip per book, so it runs after the
   * import in small batches rather than blocking it. Progress is shown, and
   * closing the dialog early just leaves the rest for next time.
   */
  async function runEnrichment() {
    setStage('enriching')
    let guard = 0
    try {
      for (;;) {
        const res = await fetch('/api/import/enrich', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
        if (!res.ok) break
        const { data } = await res.json()
        setCoversFound(prev => prev + (data.found || 0))
        setCoversLeft(data.remaining ?? 0)
        if (data.done || data.processed === 0) break
        // Safety valve so a bad response can't spin forever
        if (++guard > 400) break
      }
    } catch {
      // Enrichment is best-effort; the import itself already succeeded
    } finally {
      setStage('done')
    }
  }

  async function runImport() {
    setStage('importing')
    try {
      const res = await fetch('/api/import/goodreads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ books }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Import failed')
        setStage('preview')
        return
      }
      setResult(data.data)
      setCoversLeft(data.data.imported + data.data.updated)
      // Hardcover first — a matched book arrives with full metadata, so only
      // the leftovers need a cover looked up elsewhere.
      await runResolution()
      await runEnrichment()
    } catch {
      toast.error('Import failed')
      setStage('preview')
    }
  }

  const stats = books.length > 0 ? summarize(books) : null

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import Your Library</DialogTitle>
          <DialogDescription>
            {stage === 'choose' && 'Bring your books over from Goodreads with a CSV export.'}
            {stage === 'preview' && 'Review what we found before importing.'}
            {stage === 'importing' && 'Importing your books…'}
            {stage === 'done' && 'Import complete.'}
          </DialogDescription>
        </DialogHeader>

        {stage === 'choose' && (
          <div className="space-y-4 pt-2">
            <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1.5">
              <p className="font-medium">How to get your file</p>
              <ol className="list-decimal list-inside text-muted-foreground space-y-1 text-xs">
                <li>On Goodreads, go to My Books → Import and Export</li>
                <li>Click &ldquo;Export Library&rdquo; and wait for the file</li>
                <li>Download the .csv and upload it here</li>
              </ol>
            </div>

            <button
              onClick={() => inputRef.current?.click()}
              className="w-full rounded-lg border-2 border-dashed p-8 text-center hover:bg-muted/40 hover:border-primary/40 transition-colors cursor-pointer"
            >
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium">Choose a CSV file</p>
              <p className="text-xs text-muted-foreground mt-0.5">Goodreads library export</p>
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFile}
              className="hidden"
            />
          </div>
        )}

        {stage === 'preview' && stats && (
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium truncate">{fileName}</span>
            </div>

            <div className="rounded-lg border divide-y">
              <div className="flex items-center justify-between p-3">
                <span className="text-sm font-medium">{stats.total} books found</span>
                <span className="text-xs text-muted-foreground">{stats.rated} rated</span>
              </div>
              <div className={`grid ${stats.didNotFinish > 0 ? 'grid-cols-4' : 'grid-cols-3'} divide-x text-center`}>
                <div className="p-3">
                  <p className="text-xl font-bold">{stats.currentlyReading}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Reading</p>
                </div>
                <div className="p-3">
                  <p className="text-xl font-bold">{stats.read}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Read</p>
                </div>
                <div className="p-3">
                  <p className="text-xl font-bold">{stats.wantToRead}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Want to Read</p>
                </div>
                {stats.didNotFinish > 0 && (
                  <div className="p-3">
                    <p className="text-xl font-bold">{stats.didNotFinish}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">DNF</p>
                  </div>
                )}
              </div>
            </div>

            <div className="max-h-32 overflow-y-auto rounded-lg border divide-y text-xs">
              {books.slice(0, 6).map(b => (
                <div key={b.bookId} className="flex items-center justify-between gap-2 px-3 py-1.5">
                  <span className="truncate">{b.title}</span>
                  <span className="text-muted-foreground flex-shrink-0">
                    {b.rating ? `${b.rating}★` : b.shelf}
                  </span>
                </div>
              ))}
              {books.length > 6 && (
                <p className="px-3 py-1.5 text-muted-foreground">
                  …and {books.length - 6} more
                </p>
              )}
            </div>

            {(skipped.length > 0 || stats.withoutIsbn > 0) && (
              <div className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 text-xs">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-muted-foreground space-y-0.5">
                  {skipped.length > 0 && <p>{skipped.length} rows skipped ({skipped[0].reason.toLowerCase()}).</p>}
                  {stats.withoutIsbn > 0 && <p>{stats.withoutIsbn} books have no ISBN, so they won&apos;t have cover art.</p>}
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Ratings become starting scores in your rankings, which you can refine later.
              Importing again updates these books rather than duplicating them.
            </p>

            <div className="flex gap-2">
              <Button variant="outline" onClick={reset} className="flex-1">Choose another file</Button>
              <Button onClick={runImport} className="flex-1">Import {stats.total} books</Button>
            </div>
          </div>
        )}

        {stage === 'importing' && (
          <div className="py-10 text-center">
            <Loader2 className="h-8 w-8 mx-auto mb-3 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Importing {books.length} books — this can take a moment.
            </p>
          </div>
        )}

        {stage === 'resolving' && (
          <div className="py-10 text-center">
            <Loader2 className="h-8 w-8 mx-auto mb-3 animate-spin text-primary" />
            <p className="text-sm font-medium">Your books are in — matching them to full book data</p>
            <p className="text-sm text-muted-foreground mt-1">{matched} matched</p>
          </div>
        )}

        {stage === 'enriching' && (
          <div className="py-10 text-center">
            <Loader2 className="h-8 w-8 mx-auto mb-3 animate-spin text-primary" />
            <p className="text-sm font-medium">Your books are in — finding cover art</p>
            <p className="text-sm text-muted-foreground mt-1">
              {coversFound} found{coversLeft > 0 && `, ${coversLeft} to go`}
            </p>
            <p className="text-xs text-muted-foreground mt-3 max-w-xs mx-auto">
              You can close this — anything left is picked up next time you import.
            </p>
          </div>
        )}

        {stage === 'done' && result && (
          <div className="space-y-4 pt-2">
            <div className="py-6 text-center">
              <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-green-600 dark:text-green-400" />
              <p className="text-lg font-semibold">
                {result.imported} {result.imported === 1 ? 'book' : 'books'} added
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {result.updated > 0 && `${result.updated} updated · `}
                {result.ranked} added to your rankings
                {result.failed > 0 && ` · ${result.failed} failed`}
              </p>
              {matched > 0 && (
                <p className="text-sm text-muted-foreground mt-1">
                  {matched} matched to full book data
                  {unmatched > 0 && ` · ${unmatched} kept basic details`}
                </p>
              )}
              {coversFound > 0 && (
                <p className="text-sm text-muted-foreground mt-1">
                  {coversFound} covers found separately
                </p>
              )}
            </div>
            <Button onClick={() => { handleClose(false); window.location.href = '/books' }} className="w-full">
              See your library
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
