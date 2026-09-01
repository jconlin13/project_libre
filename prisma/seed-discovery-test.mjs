/**
 * Seed script: gives the test user ("Sarah", from seed-test-user.ts) data that
 * exercises the Phase 7 Household Discovery features:
 *   - Want-to-Read snapshots mirroring 2 of Jack's, so TBR overlap has matches
 *   - Book rankings on books Jack doesn't have, so Household Favorites shows them
 *   - Finished snapshots dated this year, so the Goals tab year count is non-zero
 *
 * Run with:  node prisma/seed-discovery-test.mjs
 * Undo with: node prisma/seed-discovery-test.mjs --undo
 *
 * Idempotent (upserts) and fully reversible (--undo removes only seeded rows).
 * Requires the test user to exist (run seed-test-user.ts first).
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const TEST_USER_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const JACK_USER_ID = '29c0b900-e484-4da9-9064-833995d3a8ba'

// Fake books for Sarah's rankings — ids prefixed so --undo can target them
const RANKED_BOOKS = [
  { id: 'seedtest-1001', title: 'The Remains of the Day', author: 'Kazuo Ishiguro', elo: 1750 },
  { id: 'seedtest-1002', title: 'Cloud Cuckoo Land', author: 'Anthony Doerr', elo: 1650 },
  { id: 'seedtest-1003', title: 'The Overstory', author: 'Richard Powers', elo: 1500 },
  { id: 'seedtest-1004', title: 'Lessons in Chemistry', author: 'Bonnie Garmus', elo: 1400 },
  { id: 'seedtest-1005', title: 'The Midnight Library', author: 'Matt Haig', elo: 1300 },
]
// One manual-override favorite (display score shown verbatim)
const MANUAL_BOOK = { id: 'seedtest-2001', title: 'East of Eden', author: 'John Steinbeck', override: 4.6 }

const FINISHED_BOOKS = [
  { id: 'seedtest-3001', title: 'Tomorrow, and Tomorrow, and Tomorrow', author: 'Gabrielle Zevin' },
  { id: 'seedtest-3002', title: 'Demon Copperhead', author: 'Barbara Kingsolver' },
  { id: 'seedtest-3003', title: 'Trust', author: 'Hernan Diaz' },
]

async function seed() {
  const testUser = await prisma.user.findUnique({ where: { id: TEST_USER_ID } })
  if (!testUser) {
    console.error('Test user not found. Run seed-test-user.ts first.')
    process.exit(1)
  }

  // 1. Mirror 2 of Jack's Want to Read snapshots for Sarah → TBR overlap
  const jackWants = await prisma.snapshot.findMany({
    where: { userId: JACK_USER_ID, statusId: 1 },
    take: 2,
  })
  if (jackWants.length === 0) {
    console.warn('⚠ Jack has no Want to Read snapshots — TBR overlap will be empty. Load the dashboard once to populate snapshots.')
  }
  for (const s of jackWants) {
    await prisma.snapshot.upsert({
      where: { userId_hardcoverBookId: { userId: TEST_USER_ID, hardcoverBookId: s.hardcoverBookId } },
      update: { statusId: 1 },
      create: {
        userId: TEST_USER_ID,
        type: 'user_book',
        hardcoverBookId: s.hardcoverBookId,
        statusId: 1,
        bookTitle: s.bookTitle,
        bookAuthor: s.bookAuthor,
        bookCoverUrl: s.bookCoverUrl,
      },
    })
    console.log(`✓ Sarah also wants: ${s.bookTitle}`)
  }

  // 2. Rankings for Sarah on books Jack doesn't have → Household Favorites
  for (const b of RANKED_BOOKS) {
    await prisma.bookRanking.upsert({
      where: { userId_hardcoverBookId: { userId: TEST_USER_ID, hardcoverBookId: b.id } },
      update: { eloScore: b.elo },
      create: {
        userId: TEST_USER_ID,
        hardcoverBookId: b.id,
        eloScore: b.elo,
        comparisonCount: 5,
        bookTitle: b.title,
        bookAuthor: b.author,
      },
    })
  }
  await prisma.bookRanking.upsert({
    where: { userId_hardcoverBookId: { userId: TEST_USER_ID, hardcoverBookId: MANUAL_BOOK.id } },
    update: { manualOverride: MANUAL_BOOK.override },
    create: {
      userId: TEST_USER_ID,
      hardcoverBookId: MANUAL_BOOK.id,
      eloScore: 1500,
      manualOverride: MANUAL_BOOK.override,
      comparisonCount: 0,
      bookTitle: MANUAL_BOOK.title,
      bookAuthor: MANUAL_BOOK.author,
    },
  })
  console.log(`✓ Seeded ${RANKED_BOOKS.length + 1} rankings for Sarah`)

  // 3. Finished snapshots dated this year → Goals year count
  const year = new Date().getFullYear()
  for (const [i, b] of FINISHED_BOOKS.entries()) {
    await prisma.snapshot.upsert({
      where: { userId_hardcoverBookId: { userId: TEST_USER_ID, hardcoverBookId: b.id } },
      update: { statusId: 3, lastReadDate: new Date(year, i + 1, 15) },
      create: {
        userId: TEST_USER_ID,
        type: 'user_book',
        hardcoverBookId: b.id,
        statusId: 3,
        bookTitle: b.title,
        bookAuthor: b.author,
        lastReadDate: new Date(year, i + 1, 15),
      },
    })
  }
  console.log(`✓ Seeded ${FINISHED_BOOKS.length} finished books for Sarah (read in ${year})`)
}

async function undo() {
  const seedIds = [...RANKED_BOOKS, MANUAL_BOOK, ...FINISHED_BOOKS].map(b => b.id)
  const r = await prisma.bookRanking.deleteMany({
    where: { userId: TEST_USER_ID, hardcoverBookId: { in: seedIds } },
  })
  // Remove ALL of Sarah's snapshots (seeded fake books + mirrored want-to-reads —
  // Sarah has no Hardcover token, so every snapshot she has came from seeding)
  const s = await prisma.snapshot.deleteMany({ where: { userId: TEST_USER_ID } })
  console.log(`✓ Removed ${r.count} rankings and ${s.count} snapshots for Sarah`)
}

const isUndo = process.argv.includes('--undo')
;(isUndo ? undo() : seed())
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
