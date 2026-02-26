/**
 * Seed script: Creates a test household member for the current (only) user.
 *
 * This adds a fake "Test User" to Jack's household so the recommend dialog,
 * recommendation search integration, and other multi-user features can be tested.
 *
 * Run with:  npx tsx prisma/seed-test-user.ts
 * Undo with: npx tsx prisma/seed-test-user.ts --undo
 *
 * Safe to run multiple times — uses upsert to avoid duplicates.
 * The test user has no Hardcover API token, so they won't appear in network
 * book searches, but WILL appear in the recommend dialog member picker.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Fixed IDs so the script is idempotent and reversible
const TEST_USER_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const TEST_USER_EMAIL = 'testuser@test.local'
const TEST_USER_NAME = 'Sarah'

// Jack's existing household
const JACK_USER_ID = '29c0b900-e484-4da9-9064-833995d3a8ba'
const HOUSEHOLD_ID = '565b3bd3-cf56-4de7-8587-53c7a4d61886'

async function seed() {
  // Create the test user
  const user = await prisma.user.upsert({
    where: { email: TEST_USER_EMAIL },
    update: { name: TEST_USER_NAME },
    create: {
      id: TEST_USER_ID,
      name: TEST_USER_NAME,
      email: TEST_USER_EMAIL,
      supabaseAuthId: `local-test-${TEST_USER_ID}`,
    },
  })
  console.log(`✓ Test user created: ${user.name} (${user.id})`)

  // Add test user to Jack's household
  const membership = await prisma.householdMember.upsert({
    where: {
      householdId_userId: {
        householdId: HOUSEHOLD_ID,
        userId: TEST_USER_ID,
      },
    },
    update: {},
    create: {
      householdId: HOUSEHOLD_ID,
      userId: TEST_USER_ID,
      role: 'member',
    },
  })
  console.log(`✓ Added to household: ${HOUSEHOLD_ID} (role: ${membership.role})`)

  // Create a sample recommendation FROM the test user TO Jack
  // so the "Recommended for You" search section can be tested
  const existingRec = await prisma.recommendation.findFirst({
    where: {
      fromUserId: TEST_USER_ID,
      toUserId: JACK_USER_ID,
      hardcoverBookId: '258834', // The Great Gatsby (popular Hardcover ID)
    },
  })

  if (!existingRec) {
    const rec = await prisma.recommendation.create({
      data: {
        fromUserId: TEST_USER_ID,
        toUserId: JACK_USER_ID,
        hardcoverBookId: '258834',
        bookTitle: 'The Great Gatsby',
        bookAuthor: 'F. Scott Fitzgerald',
        bookCoverUrl: 'https://assets.literal.club/4/ckhrnlbfg1544721epjlxf32iq.jpg',
        note: 'You have to read this one!',
        status: 'pending',
      },
    })
    console.log(`✓ Sample recommendation created: "${rec.bookTitle}" (${rec.id})`)
  } else {
    console.log(`✓ Sample recommendation already exists (skipped)`)
  }

  console.log('\nDone! Test user "Sarah" is now in your household.')
  console.log('→ Open the Recommend dialog on any book to see her in the member list')
  console.log('→ Search "Gatsby" in ⌘K to see the "Recommended for You" section')
}

async function undo() {
  // Delete recommendation
  const recs = await prisma.recommendation.deleteMany({
    where: {
      OR: [
        { fromUserId: TEST_USER_ID },
        { toUserId: TEST_USER_ID },
      ],
    },
  })
  console.log(`✓ Deleted ${recs.count} recommendation(s)`)

  // Remove from household
  const memberships = await prisma.householdMember.deleteMany({
    where: { userId: TEST_USER_ID },
  })
  console.log(`✓ Removed ${memberships.count} household membership(s)`)

  // Delete user
  const users = await prisma.user.deleteMany({
    where: { id: TEST_USER_ID },
  })
  console.log(`✓ Deleted ${users.count} test user(s)`)

  console.log('\nDone! Test data removed. Only real users remain.')
}

const isUndo = process.argv.includes('--undo')

;(isUndo ? undo() : seed())
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
