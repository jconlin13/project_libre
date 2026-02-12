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

  return <BookDetailContent bookId={id} />;
}
