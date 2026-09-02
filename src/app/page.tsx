import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { BookOpen, Users, Heart, Library } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <BookOpen className="h-6 w-6" />
            <span className="text-xl font-semibold">Libre</span>
          </div>
          <Link href="/login">
            <Button>Sign In</Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4">
        <section className="flex flex-col items-center justify-center py-24 text-center">
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
            For Reading Together
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
            A private space for your group&apos;s reading — bring your library from Goodreads or
            Hardcover, share recommendations, see what everyone&apos;s reading, and find your next
            great book.
          </p>
          <div className="mt-10 flex gap-4">
            <Link href="/login">
              <Button size="lg">Get Started</Button>
            </Link>
          </div>
        </section>

        <section className="grid gap-8 pb-24 sm:grid-cols-2 lg:grid-cols-4">
          <FeatureCard
            icon={<Users className="h-8 w-8" />}
            title="Group Dashboard"
            description="See what everyone in your group is reading, finishing, and rating."
          />
          <FeatureCard
            icon={<Heart className="h-8 w-8" />}
            title="Recommendations"
            description="Sponsor books to group members and see if they add it to their list."
          />
          <FeatureCard
            icon={<BookOpen className="h-8 w-8" />}
            title="+1 Wishlist"
            description="Add recommended books to your wishlist with a single tap."
          />
          <FeatureCard
            icon={<Library className="h-8 w-8" />}
            title="Libby Links"
            description="Instantly search your local library for any book via Libby."
          />
        </section>
      </main>
    </div>
  )
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="rounded-xl border bg-card p-6 text-card-foreground">
      <div className="mb-4 text-primary">{icon}</div>
      <h3 className="mb-2 font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  )
}
