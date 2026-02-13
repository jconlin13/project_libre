# Code Quality Agent — Static Analysis Report

## Executive Summary

The codebase is well-structured for a project of this stage — consistent Next.js App Router patterns, proper separation of concerns, and solid auth checks. The primary quality issues are: heavy use of `any` types (30+ instances), duplicated interfaces and utility functions across 3 files, and test coverage that validates logic but doesn't test actual API routes. The error handling is consistent across all API routes (try/catch + 500 responses), though the error response format varies slightly. No security-critical issues found beyond those noted in the PM report.

## TypeScript Quality Score: C+

### `any` Usage Inventory (30+ instances)
**Hardcover lib (`src/lib/hardcover.ts`):**
- Line 229: `hits.map((hit: any) => hit.document.id)` — searchBooks
- Line 259: `hits.filter((hit: any) => ...` — searchByAuthor
- Line 271: `authorHits.map((hit: any) => ...` — searchByAuthor

**Book detail (`src/app/(app)/book/[id]/book-detail-content.tsx`):**
- Line 39: `useState<any>(null)` — book state
- Line 44: `useState<any[]>([])` — bookActivity state
- Line 81: `allUserBooks.find((ub: any) => ...`
- Line 95: `readingBooks.find((ub: any) => ...`
- Line 104: `const activityItems: any[] = []`
- Line 106: `reads.forEach((read: any) => ...`

**Person detail (`src/app/(app)/person/[id]/person-detail-content.tsx`):**
- Lines 27-29: `useState<any[]>([])` — reading, finished, wantToRead states
- Line 166: `reading.map((ub: any) => ...`
- Line 190: `finished.map((ub: any) => ...`
- Line 206: `wantToRead.map((ub: any) => ...`

**Dashboard (`src/app/(app)/dashboard/dashboard-content.tsx`):**
- Line 49: `reading: Array<{ id: number; book: any; ... }>`
- Line 50: `finished: Array<{ id: number; book: any; ... }>`
- Line 51: `wantToRead: Array<{ id: number; book: any }>`
- Line 82: `useState<any[]>([])` — activity state
- Lines 364, 396, 419, 608, 628, 658: `.map((ub: any) => ...` or `(item: any) =>`

**Recommendations (`src/app/(app)/recommendations/recommendations-content.tsx`):**
- Line 43: `useState<any[]>([])` — searchResults
- Line 45: `useState<any>(null)` — selectedBook
- Line 48: `useState<any[]>([])` — members
- Lines 76-77: `.flatMap((h: any) => h.members).filter((m: any) => ...`
- Line 203: `searchResults.map((book: any) => ...`

**API routes:**
- `hardcover/status/route.ts:34`: `allBooks.find((ub: any) => ...`
- `hardcover/progress/route.ts:31`: `reading.find((ub: any) => ...`
- `hardcover/rating/route.ts:32`: `allBooks.find((ub: any) => ...`

**Books category (`src/app/(app)/books/[category]/page.tsx`):**
- Line 13: `VALID_CATEGORIES.includes(category as any)` — type assertion

### Recommendation
Create shared types in `src/lib/types.ts`:
- `HardcoverBook` and `UserBook` already exist in `hardcover.ts` — export and reuse everywhere
- Create `ActivityItem`, `RecommendationWithUsers`, `MemberProfile` types
- Replace all `any` with proper types using the existing `HardcoverBook` and `UserBook` interfaces

## Code Duplication Report

### Shared Interfaces Defined Multiple Times (3 locations)
| Interface | Files |
|-----------|-------|
| `BookType` | `search-command.tsx:22`, `search-content.tsx:23` |
| `SearchResult` | `search-command.tsx:30`, `search-content.tsx:33` |
| `getBookCover()` | `search-command.tsx:60`, `search-content.tsx:63` |
| `getAuthor()` | `search-command.tsx:64`, `search-content.tsx:67`, `books-content.tsx:55` |

**Already exists centrally:**
- `getBookCoverUrl()` in `src/lib/hardcover.ts:378`
- `getAuthorName()` in `src/lib/hardcover.ts:383`

**Fix:** Delete the duplicates in component files and import from `hardcover.ts`. For `BookType` and `SearchResult`, create a shared types file or export from `hardcover.ts`.

### Duplicated Fetch-All-Books-To-Find-One Pattern
Used in 3 API routes:
- `hardcover/rating/route.ts:25-31`
- `hardcover/status/route.ts:27-33`
- `hardcover/progress/route.ts:30-31`

All three fetch multiple lists and then `.find()` for a single book. Should be extracted into a shared helper like `findUserBookByBookId(token, bookId)`.

### Duplicated Household Member Lookup
The pattern of fetching household memberships and then finding members appears in:
- `src/app/api/search/route.ts:136-154`
- `src/app/api/activity/route.ts:13-23`
- `src/lib/auth.ts:71-92` (already extracted as `getHouseholdMembers()`)

The search and activity routes duplicate the household lookup instead of using `getHouseholdMembers()`.

## Error Handling Score: B+

### API Route Coverage — All routes have try/catch ✅
| Route | Auth Check | Try/Catch | Input Validation |
|-------|-----------|-----------|-----------------|
| `/api/user` | ✅ | ✅ | N/A (no input) |
| `/api/search` | ✅ | ✅ | ✅ (q length, tab) |
| `/api/hardcover` (GET) | ✅ | ✅ | ✅ (action, bookId, q) |
| `/api/hardcover` (POST) | ✅ | ✅ | ✅ (action, bookId) |
| `/api/hardcover/rating` | ✅ | ✅ | ✅ (bookId, rating range) |
| `/api/hardcover/status` | ✅ | ✅ | ✅ (bookId, valid statusId) |
| `/api/hardcover/progress` | ✅ | ✅ | ✅ (bookId, progress/pages) |
| `/api/hardcover/member` | ✅ | ✅ | ✅ (memberId, household check) |
| `/api/recommendations` | ✅ | ✅ | ✅ (toUserId, bookId, household check) |
| `/api/plus-ones` | ✅ | ✅ | ✅ (hardcoverBookId) |
| `/api/activity` | ✅ | ✅ | N/A |
| `/api/households` | ✅ | ✅ | ✅ (name type check) |
| `/api/households/join` | ✅ | ✅ | ✅ (inviteCode, duplicate check) |
| `/api/settings/hardcover` | ✅ | ✅ | ✅ (token validation) |
| `/api/feedback` | ✅ | ✅ | ✅ (type, details) |

### Response Format Inconsistency
Most routes return `{ data: ... }` on success, but some deviate:
- `/api/settings/hardcover` POST → `{ success: true, username: ... }`
- `/api/settings/hardcover` DELETE → `{ success: true }`
- `/api/plus-ones` DELETE → `{ success: true }`
- `/api/households/join` → `{ success: true, householdName: ... }`
- `/api/feedback` → `{ success: true }` or `{ mailto: ..., message: ... }`

**Fix:** Standardize on `{ data: ... }` for all success responses.

## Performance Findings

### N+1 Patterns
1. **Rating/Status update** — Fetches 3 book lists (reading + finished + wantToRead) just to find one `userBookId`. This is effectively an N+1 where N=3.
2. **Network search** — For each household member, makes 3 parallel Hardcover API calls. With M members, that's 3M calls.

### Missing Pagination
- `fetchAllUserBooks()` — Fetches ALL user books with no limit. Heavy readers could have hundreds.
- `fetchWantToRead()` — No limit clause.
- `fetchCurrentlyReading()` — No limit clause (though typically small).
- Network search fetches up to 100 finished books per member.

### Caching
- `hardcoverQuery()` uses `next: { revalidate: 300 }` (5-minute cache) — good baseline
- But mutations (rating, status, progress updates) don't invalidate this cache, so stale data can appear for up to 5 minutes after an update
- The `Snapshot` model exists but is unused — intended for caching member data

## Consistency Issues

### Naming
- GraphQL fields use `snake_case` (from Hardcover API): `status_id`, `date_added`, `user_book_reads`
- TypeScript interfaces mix: `HardcoverBook` (PascalCase), `UserBook` (PascalCase), but `cached_image`, `cached_contributors` (snake_case from API)
- Component files use kebab-case: `book-detail-content.tsx`, `search-command.tsx` ✅
- API routes are RESTful: `/api/hardcover/rating`, `/api/households/join` ✅

### Component Export Patterns
Mixed but acceptable:
- Most use `export function ComponentName` (named exports)
- Some default export in page.tsx files

## Security Findings

### Authentication — Strong ✅
- Every API route calls `getCurrentUser()` as its first action
- Household membership verified for cross-user operations (recommendations, member data)
- Hardcover tokens encrypted at rest with AES-256-GCM

### Data Exposure
- Hardcover tokens never sent to client (decrypted only server-side)
- Household API exposes `hardcoverConnected` boolean but not the token ✅
- Error messages are generic — don't leak stack traces or internal details ✅

### Input Handling
- GraphQL queries use string interpolation for book IDs (see PM report M2) — low risk since IDs come from Hardcover, but not ideal
- No XSS risk — Next.js auto-escapes JSX output
- Search query is used in `.toLowerCase().includes()` — safe from injection

## Test Coverage Assessment

### Currently Tested (4 test files)
| File | Tests | What It Covers |
|------|-------|---------------|
| `encryption.test.ts` | 7 tests | Encrypt/decrypt round-trip, special chars, long strings, invalid format, tampering |
| `hardcover.test.ts` | 6 tests | `getLibbySearchUrl`, `getBookCoverUrl`, `getAuthorName` — **Note: tests redefine functions locally instead of importing them** |
| `recommendations.test.ts` | 4 tests | Status validation, recommendation field validation, self-recommendation check |
| `plus-one.test.ts` | 3 tests | Field validation, deduplication logic |

**Total: 20 tests, all unit tests on pure logic.**

### Critical Gaps
1. **No API route tests** — None of the 15 API routes have integration tests
2. **No auth tests** — `getCurrentUser()` and session handling untested
3. **No search tests** — The most complex feature has zero tests
4. **No client component tests** — No React Testing Library tests
5. **`hardcover.test.ts` tests local copies** — The test file redefines `getBookCoverUrl` and `getAuthorName` locally instead of importing from `src/lib/hardcover.ts`. If the source functions change, tests still pass.

### Recommended Test Additions (Priority Order)
1. Fix `hardcover.test.ts` to import actual functions
2. Add API route tests for: search, recommendations, hardcover (status/rating/progress)
3. Add auth tests (mock cookies/supabase)
4. Add search integration test (mock Hardcover API)

## Tech Debt Inventory

### TODO Comments (9 instances, all Phase 3)
All are the commented-out "Recommended" search placeholders — intentional and well-documented.

### Accumulated Shortcuts
1. **`any` types everywhere** — 30+ instances, mostly in component state and API response handling
2. **Duplicated utility functions** — `getBookCover`/`getAuthor` in 3 files when they exist in `hardcover.ts`
3. **Duplicated interfaces** — `BookType` and `SearchResult` defined in 2 files each
4. **Test functions are local copies** — `hardcover.test.ts` doesn't import actual source functions
5. **Unused Snapshot model** — Created but never read or written to
6. **Feedback route logs to console** — No real email/storage integration

## Top 15 Priority Items

| # | Item | Impact | Effort |
|---|------|--------|--------|
| 1 | Extract shared types to `src/lib/types.ts` | Prevents type drift, enables refactoring | Small |
| 2 | Replace `any` with proper types in components | Type safety, IDE support, bug prevention | Medium |
| 3 | Delete duplicate `getBookCover`/`getAuthor` — import from `hardcover.ts` | DRY, single source of truth | Small |
| 4 | Delete duplicate `BookType`/`SearchResult` — share from types file | DRY | Small |
| 5 | Fix `hardcover.test.ts` to import actual functions | Tests currently don't validate source code | Small |
| 6 | Extract `findUserBookByBookId()` helper | Eliminates 3-fetch pattern in rating/status/progress | Small |
| 7 | Add API route integration tests (search, recommendations) | Catch regressions | Medium |
| 8 | Standardize API response format to `{ data: ... }` | Consistency | Small |
| 9 | Add `perPage` bounds checking in search route | Prevent abuse | Small |
| 10 | Use `getHouseholdMembers()` in search/activity routes | DRY, reduces duplication | Small |
| 11 | Add AbortController to search client components | Fix race conditions | Small |
| 12 | Add React Error Boundaries | Prevent white-screen crashes | Small |
| 13 | Implement Snapshot caching for member books | Reduce Hardcover API calls | Large |
| 14 | Use GraphQL variables instead of string interpolation | Safer query construction | Medium |
| 15 | Add pagination to `fetchAllUserBooks()` | Performance for heavy readers | Medium |
