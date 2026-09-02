import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/encryption'

/**
 * The token to use for looking up *book facts* — titles, covers, page counts,
 * descriptions — as opposed to a specific person's shelves.
 *
 * A user's own token is preferred when they have one. Otherwise an optional
 * app-level `HARDCOVER_SERVICE_TOKEN` lets people who have never heard of
 * Hardcover still get real book data after importing a CSV, which is the whole
 * point of the import path.
 *
 * Hardcover's terms allow book/edition facts in a personal project; a person's
 * reviews, ratings and lists are theirs and are never read with this token.
 */
export async function getBookLookupToken(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { hardcoverApiToken: true },
  })

  if (user?.hardcoverApiToken) {
    try {
      return decrypt(user.hardcoverApiToken)
    } catch {
      // Fall through to the service token rather than failing the request
    }
  }

  const serviceToken = process.env.HARDCOVER_SERVICE_TOKEN?.trim()
  return serviceToken || null
}

export function hasServiceToken(): boolean {
  return !!process.env.HARDCOVER_SERVICE_TOKEN?.trim()
}
