import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import BookDetailContent from "./book-detail-content";

export const dynamic = "force-dynamic";

interface BookPageProps {
  params: Promise<{ id: string }>;
}

export default async function BookPage({ params }: BookPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const { id } = await params;

  // Imported book ids carry a namespace prefix ("isbn:…", "gr:…") and the
  // colon arrives percent-encoded from the path. Decode once here so the id
  // matches what's stored, rather than leaving every caller to guess.
  let bookId = id;
  try {
    bookId = decodeURIComponent(id);
  } catch {
    // Malformed escape — fall back to the raw value
  }

  const firstName = user.name?.split(' ')[0] || user.name || 'You';

  return <BookDetailContent bookId={bookId} userName={firstName} userId={user.id} />;
}
