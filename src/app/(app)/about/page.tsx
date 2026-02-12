import { BookOpen } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function AboutPage() {
  return (
    <div className="max-w-2xl mx-auto py-12">
      <div className="text-center mb-8">
        <BookOpen className="h-12 w-12 mx-auto mb-4 text-primary" />
        <h1 className="text-3xl font-bold mb-2">Family Book Club</h1>
        <p className="text-muted-foreground">A private overlay for Hardcover</p>
      </div>

      <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
        <p>
          Family Book Club is a private reading companion that brings your family&apos;s reading activity
          together. It syncs with your Hardcover account to show what everyone is reading, track progress,
          share recommendations, and discover new books together.
        </p>

        <div>
          <h2 className="text-base font-semibold text-foreground mb-2">What you can do</h2>
          <ul className="list-disc list-inside space-y-1.5">
            <li>See what your family members are reading right now</li>
            <li>Track your reading progress and update it from the dashboard</li>
            <li>Rate and review books</li>
            <li>Recommend books to family members</li>
            <li>Find books at your local library through Libby</li>
          </ul>
        </div>

        <div>
          <h2 className="text-base font-semibold text-foreground mb-2">Built with</h2>
          <p>
            Next.js, SQLite, and the Hardcover GraphQL API. Designed to be lightweight, private,
            and run locally without any third-party hosting required.
          </p>
        </div>
      </div>

      <div className="mt-10 text-center">
        <Link href="/dashboard">
          <Button variant="outline">Back to Dashboard</Button>
        </Link>
      </div>
    </div>
  )
}
