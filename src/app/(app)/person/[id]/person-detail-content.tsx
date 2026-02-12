'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, BookOpen, CheckCircle, Heart } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { BookCard } from '@/components/book-card'

interface PersonProps {
  person: {
    id: string
    name: string
    email: string
    avatarUrl: string | null
    hardcoverConnected: boolean
    hardcoverUsername: string | null
  }
  isCurrentUser: boolean
}

export function PersonDetailContent({ person, isCurrentUser }: PersonProps) {
  const [reading, setReading] = useState<any[]>([])
  const [finished, setFinished] = useState<any[]>([])
  const [wantToRead, setWantToRead] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!person.hardcoverConnected) {
      setLoading(false)
      return
    }

    const baseUrl = isCurrentUser ? '/api/hardcover' : '/api/hardcover/member'
    const memberParam = isCurrentUser ? '' : `&memberId=${person.id}`

    async function fetchBooks() {
      try {
        const [readingRes, finishedRes, wantToReadRes] = await Promise.all([
          fetch(`${baseUrl}?action=reading${memberParam}`),
          fetch(`${baseUrl}?action=finished&limit=20${memberParam}`),
          fetch(`${baseUrl}?action=want-to-read${memberParam}`),
        ])

        const [readingJson, finishedJson, wantToReadJson] = await Promise.all([
          readingRes.json(),
          finishedRes.json(),
          wantToReadRes.json(),
        ])

        setReading(readingJson.data || [])
        setFinished(finishedJson.data || [])
        setWantToRead(wantToReadJson.data || [])
      } catch (error) {
        console.error('Failed to fetch books:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchBooks()
  }, [person.id, person.hardcoverConnected, isCurrentUser])

  const initials = person.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  if (!person.hardcoverConnected) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Link href="/dashboard">
          <Button variant="ghost">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </Link>

        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={person.avatarUrl || undefined} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <h1 className="text-2xl font-bold">{person.name}</h1>
        </div>

        <Card className="p-8 text-center">
          <BookOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            {isCurrentUser
              ? "You haven't connected your Hardcover account yet. Connect it in Settings to see your books here."
              : `${person.name} hasn't connected their Hardcover account yet.`}
          </p>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link href="/dashboard">
        <Button variant="ghost">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
      </Link>

      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16">
          <AvatarImage src={person.avatarUrl || undefined} />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-2xl font-bold">{person.name}</h1>
          {person.hardcoverUsername && (
            <Badge variant="secondary" className="mt-1">
              @{person.hardcoverUsername}
            </Badge>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-6">
          <div className="flex gap-2">
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-10 w-40" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
        </div>
      ) : (
        <Tabs defaultValue="reading">
          <TabsList className="mb-6">
            <TabsTrigger value="reading" className="gap-2">
              <BookOpen className="h-4 w-4" />
              Reading ({reading.length})
            </TabsTrigger>
            <TabsTrigger value="finished" className="gap-2">
              <CheckCircle className="h-4 w-4" />
              Finished ({finished.length})
            </TabsTrigger>
            <TabsTrigger value="want-to-read" className="gap-2">
              <Heart className="h-4 w-4" />
              Want to Read ({wantToRead.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="reading">
            {reading.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">Not currently reading anything.</p>
              </Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {reading.map((ub: any) => {
                  const read = ub.user_book_reads?.[0]
                  return (
                    <Link key={ub.id} href={`/book/${ub.book.id}`} className="block">
                      <BookCard
                        book={ub.book}
                        progress={read?.progress}
                        progressPages={read?.progress_pages}
                        compact
                      />
                    </Link>
                  )
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="finished">
            {finished.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">No recently finished books.</p>
              </Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {finished.map((ub: any) => (
                  <Link key={ub.id} href={`/book/${ub.book.id}`} className="block">
                    <BookCard book={ub.book} rating={ub.rating} compact />
                  </Link>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="want-to-read">
            {wantToRead.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">No books on the want-to-read list.</p>
              </Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {wantToRead.map((ub: any) => (
                  <Link key={ub.id} href={`/book/${ub.book.id}`} className="block">
                    <BookCard book={ub.book} compact />
                  </Link>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
