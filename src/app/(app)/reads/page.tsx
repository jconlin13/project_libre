import { redirect } from 'next/navigation'

// Articles now live as a tab inside My Books; keep this path working for
// existing links and bookmarks.
export default function ReadsPage() {
  redirect('/books?tab=articles')
}
