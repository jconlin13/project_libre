# Junior Engineer Agent — Phase 3 Foundation Report

## Existing Code Inventory

### Recommendation API (`src/app/api/recommendations/route.ts`)
**Already fully functional with 3 endpoints:**
- `GET` — Fetches received and sent recommendations for current user. Returns `{ received, sent }` with full fromUser/toUser includes.
- `POST` — Creates a recommendation. Requires `toUserId` and `hardcoverBookId`. Validates recipient is in same household via `getHouseholdMembers()`. Accepts optional `bookTitle`, `bookAuthor`, `bookCoverUrl`, `note`.
- `PATCH` — Updates recommendation status. Validates the recommendation belongs to the current user (recipient only). Accepts `status: 'accepted' | 'dismissed'`.

**What's working:** Full CRUD for recommendations. Authorization checks are solid — only household members can receive recommendations, only recipients can update status.

### Plus-One API (`src/app/api/plus-ones/route.ts`)
**Fully functional with 3 endpoints:**
- `GET` — Lists user's plus-ones (books they've endorsed)
- `POST` — Adds a plus-one via upsert (prevents duplicates using `userId_hardcoverBookId` unique constraint)
- `DELETE` — Removes a plus-one by `bookId` query param

### Activity API (`src/app/api/activity/route.ts`)
**Fully functional, already aggregates social activity:**
- Fetches recent recommendations and plus-ones from all household members
- Merges both into a unified `activity` array, sorted by `createdAt` desc, limited to 30 items
- Returns normalized objects with `type: 'recommendation' | 'plus_one'`, user info, book info, timestamps

**Gap:** Only tracks recommendation and plus-one events. Doesn't include reading status changes (started, finished, rated) — these live in Hardcover, not local DB.

### Prisma Schema Assessment
- `Recommendation` model: Complete for current needs. Fields: `fromUserId`, `toUserId`, `hardcoverBookId`, `bookTitle`, `bookAuthor`, `bookCoverUrl`, `note`, `status` (pending/accepted/dismissed), `createdAt`.
- `PlusOne` model: Simple endorsement model. Unique on `userId + hardcoverBookId`.
- `Snapshot` model: Exists but appears unused in current code. Has `userId`, `type`, `hardcoverBookId`, `rating`, `progressPct`, `updatedAt`. Designed for caching Hardcover data locally.

### Recommendations Page UI (`src/app/(app)/recommendations/`)
The page exists with `recommendations-content.tsx` — a full client component with:
- Search for books (uses `/api/hardcover?action=search&q=...`)
- Recipient picker (fetches household members from `/api/households`)
- Send recommendation form (optional note)
- Received/Sent tabs with accept/dismiss actions
- Book cover display and member list

**This is already a working recommendations page.** The placeholder Recommend buttons on book detail, card view, and shelf view just need to connect to this flow.

### Book Detail Recommend Button
- Located in `src/app/(app)/book/[id]/book-detail-content.tsx`
- Currently a disabled placeholder: `<Button variant="ghost" size="sm" disabled>`
- Has ThumbsUp icon + "Recommend" text

### Search Placeholders (Phase 3 TODOs)
Found in 3 files — all consistent:
- `src/app/api/search/route.ts` — Commented-out `recommendedBooks` variable, Prisma query, and response field
- `src/components/search-command.tsx` — Commented-out `hasRecommended` check, "Recommended for You" section with ThumbsUp icon
- `src/app/(app)/search/search-content.tsx` — Same pattern for full-page search

### Dashboard (`src/app/(app)/dashboard/dashboard-content.tsx`)
- Has an `activity` state (line 82): `useState<any[]>([])` — fetches from `/api/activity`
- Activity renders at the bottom of the dashboard (around line 658) showing recommendations and plus-ones
- Already shows book covers, user names, and action descriptions

## Recommendation Flow — Proposed Design

### Current State
The recommendation infrastructure is **90% built**. The API, DB models, and recommendations page all work. What's missing is:
1. A way to trigger "Recommend" from the book detail page (currently disabled button)
2. A compact dialog/modal (vs navigating to the full /recommendations page)

### Proposed User Journey
1. User is on a book detail page → clicks "Recommend" button
2. A dialog opens showing household members as selectable avatars/names
3. User picks a recipient, optionally adds a note
4. Clicks "Send" → POST to `/api/recommendations`
5. Toast confirmation: "Recommended to {name}!"
6. Button text changes to "Recommended ✓" (or shows who it was sent to)

### Component Architecture
```
book-detail-content.tsx
  └─ RecommendDialog (new component)
       ├─ Fetches household members from /api/households
       ├─ Member picker (avatar + name grid)
       ├─ Optional note textarea
       └─ Submit → POST /api/recommendations
```

### API Calls
- **No new API endpoints needed.** `POST /api/recommendations` already handles everything.
- Need to pass: `toUserId`, `hardcoverBookId` (from book.id), `bookTitle`, `bookAuthor`, `bookCoverUrl`, `note`

### State Management
- Track `recommendedTo: Set<string>` (user IDs) to show who the book was already recommended to
- On mount, optionally fetch `GET /api/recommendations?bookId=X` to check existing recommendations (requires adding a filter to the GET endpoint)

## Search Integration — Detailed Plan

### Data Flow
The commented-out placeholders use `prisma.recommendation.findMany({ where: { recipientId: user.id } })`. However, the Recommendation model uses `toUserId` not `recipientId` — this needs to be corrected when uncommenting.

Correct query:
```typescript
const recommendations = await prisma.recommendation.findMany({
  where: { toUserId: user.id, status: 'pending' }, // Only show unacted recommendations
})
```

### Key Design Decision
The Recommendation model stores `bookTitle`, `bookAuthor`, `bookCoverUrl` as denormalized strings — no need to fetch from Hardcover. This means the search integration can be purely local DB queries, which is fast.

### Query Design
```typescript
const recommendedBooks = recommendations
  .filter(r => {
    const title = r.bookTitle?.toLowerCase() || ''
    const author = r.bookAuthor?.toLowerCase() || ''
    return title.includes(qLower) || author.includes(qLower)
  })
  .map(r => ({
    id: parseInt(r.hardcoverBookId),
    title: r.bookTitle || '',
    author: r.bookAuthor || '',
    coverUrl: r.bookCoverUrl,
    recommendedBy: r.fromUser.name,
  }))
```

### UI Rendering
- Show after "My Books", before "Books" catalog
- Each result shows: cover, title, author, "Recommended by {name}" badge
- Clicking navigates to `/book/{id}`

## Activity Feed — Architecture Proposal

### Current State
The activity feed already works on the dashboard, showing recommendations and plus-ones. Phase 3 wants to add reading status changes (started, finished, rated).

### Event Types to Add
1. **Started reading** — Member begins a new book
2. **Finished reading** — Member completes a book
3. **Rated a book** — Member gives a rating
4. **Progress milestone** — Member hits 50%, 75% (stretch goal)

### Data Source Challenge
Reading events live in Hardcover, not the local DB. Two approaches:

**Option A: Poll and Cache (Recommended)**
- Periodically fetch each household member's books via Hardcover API
- Compare against cached `Snapshot` records to detect changes
- Write new `Snapshot` rows when status/progress changes
- Activity feed reads from Snapshots + Recommendations + PlusOnes

**Option B: Real-time Fetch**
- On each dashboard load, fetch all member books and diff against Snapshots
- More current but uses many API calls

### Caching Strategy Using Snapshots
The `Snapshot` model already exists with the right fields:
```prisma
model Snapshot {
  userId          String
  type            String       // "status_change", "rating", "progress"
  hardcoverBookId String
  rating          Float?
  progressPct     Float?
  updatedAt       DateTime
}
```

**Missing fields needed:**
- `statusId` (Int?) — to track what status changed to
- `bookTitle`, `bookAuthor`, `bookCoverUrl` (String?) — for display without re-fetching
- `previousValue` (String?) — to show "changed from X to Y"

### Proposed Schema Addition
```prisma
model ActivityEvent {
  id              String   @id @default(uuid())
  userId          String   @map("user_id")
  type            String   // "started_reading", "finished", "rated", "recommendation_sent", "plus_one"
  hardcoverBookId String?  @map("hardcover_book_id")
  bookTitle       String?  @map("book_title")
  bookAuthor      String?  @map("book_author")
  bookCoverUrl    String?  @map("book_cover_url")
  metadata        String?  // JSON: {rating: 4.5, previousStatus: 1, newStatus: 3}
  createdAt       DateTime @default(now()) @map("created_at")

  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@map("activity_events")
}
```

This unifies all activity into one table, replacing the current merge-and-sort approach in the activity API.

### UI Components
- Activity feed widget on dashboard (already exists, just needs more event types)
- Optional dedicated `/activity` page for full history
- Member profile page could show that member's recent activity

## "Who's Read This?" — Design

### Data Source
For a given book, query all household members' Hardcover accounts for that book ID.

### API Endpoint
Add to existing `src/app/api/hardcover/member/route.ts` or create new:
```
GET /api/hardcover/readers?bookId=12345
```
Returns: `[{ memberId, memberName, memberAvatar, statusId, rating }]`

### Implementation
1. Get all household member IDs (existing `getHouseholdMembers()`)
2. For each member with a Hardcover token, fetch their `user_books` and check if `bookId` matches
3. Use cached Snapshots if available to avoid API calls

### UI Component
- Small section on book detail page below the action buttons
- Shows avatars of members who have read/are reading the book
- Tooltip or inline text: "Mom has read this (★★★★½)" / "Dad is reading this (45%)"

## Schema Changes Needed

### Current Schema — Adequate for Most of Phase 3
The existing Recommendation, PlusOne, and Snapshot models cover the core use cases. Minimal changes needed:

### Recommended Changes
1. **Add `ActivityEvent` model** (see above) — unifies activity tracking
2. **Add fields to Snapshot** — `statusId`, `bookTitle`, `bookAuthor`, `bookCoverUrl` for display
3. **Add `User.activityEvents` relation** — `ActivityEvent[]`
4. **Optional: Add index on Recommendation** — `@@index([toUserId, status])` for efficient pending queries

### Migration Sequence
1. `npx prisma migrate dev --name add-activity-events` — create ActivityEvent table
2. Update Snapshot model with new fields
3. Update User model with new relation

## Implementation Order (Recommended)

### Step 1: Wire Up Recommend Button (Easiest Win)
- Create `RecommendDialog` component
- Connect book detail page button to open it
- Uses existing API — no backend changes
- **Dependency:** None
- **Effort:** Small

### Step 2: Integrate Recommendations into Search
- Uncomment Phase 3 placeholders
- Fix the Prisma query (use `toUserId` not `recipientId`)
- Add `fromUser` include to get recommender name
- **Dependency:** Recommendations must be working (Step 1 or existing page)
- **Effort:** Small

### Step 3: Add "Who's Read This?" to Book Detail
- New API endpoint or extend member route
- Small UI component on book detail page
- Use Snapshots for caching
- **Dependency:** None (can parallel with Step 1)
- **Effort:** Medium

### Step 4: Schema Migration for Activity Events
- Create `ActivityEvent` model
- Migrate existing recommendations/plus-ones into activity events
- Update activity API to read from unified table
- **Dependency:** None
- **Effort:** Medium

### Step 5: Activity Feed Enhancement
- Background job/cron to poll Hardcover for member status changes
- Write ActivityEvent records for detected changes
- Update dashboard activity widget to show new event types
- **Dependency:** Step 4
- **Effort:** Large

### Step 6: Cached Member Activity Snapshots
- Implement Snapshot update logic (compare old vs new)
- Use snapshots in "Who's Read This?" and network search
- Reduce Hardcover API calls by reading from cache first
- **Dependency:** Steps 4, 5
- **Effort:** Large

## Open Questions for Product Owner

1. **Recommend from search results?** Should the "Add to Want to Read" bookmark in search results also offer a "Recommend" option?
2. **Duplicate recommendations?** Can user A recommend the same book to user B twice? Currently the API allows it — should there be a unique constraint?
3. **Self-recommendation?** The API doesn't prevent recommending a book to yourself. The test file (`recommendations.test.ts`) validates against it, but the actual route doesn't. Should it?
4. **Activity polling frequency?** How often should we check Hardcover for member status changes? Every dashboard load? Every 30 minutes? Only on demand?
5. **Notification mechanism?** When someone receives a recommendation, how should they be notified? Badge on nav icon? Toast on next login? Both?
6. **Recommendation expiry?** Should pending recommendations expire after X days?
