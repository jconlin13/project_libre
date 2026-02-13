# Product Manager Agent — Stress Test Report

## Executive Summary

The Libre application has a solid foundation with consistent auth checks across all API routes and proper Hardcover token encryption. However, several areas need hardening before expanding to a larger user base. The most critical issues are: (1) no rate limiting on API routes that proxy Hardcover calls, risking 60 req/min limit violations; (2) the rating/status/progress endpoints use an expensive 3-fetch pattern to find a user_book by book ID; (3) network search on the "All" tab can cascade into many Hardcover API calls per household member, amplifying the rate limit risk. Security-wise, there are no authorization bypasses — every route checks `getCurrentUser()` and household membership is verified where needed.

The search feature is well-built but has edge cases around rapid tab switching (race conditions with stale results), missing query sanitization for very long inputs, and the author search's reliance on client-side name matching could miss transliterated names. Overall the app is in good shape for a family-scale deployment but needs rate limiting and caching improvements before scaling.

## Critical Issues (Must Fix)

### C1. No Rate Limiting on Hardcover API Calls
- **Where:** All routes that call `hardcoverQuery()` in `src/lib/hardcover.ts`
- **Risk:** Hardcover API has a 60 req/min limit. A single search on the "All" tab triggers: `fetchAllUserBooks(user)` + `searchBooks()` + per-member: `fetchCurrentlyReading()` + `fetchFinishedBooks()` + `fetchWantToRead()`. With 3 household members, that's 2 + (3 × 3) = 11 Hardcover API calls per search. Rapid searches could easily exceed 60/min.
- **Fix:** Add a rate limiter (in-memory token bucket or sliding window) to `hardcoverQuery()`.

### C2. Rating/Status Endpoints Fetch ALL Books to Find One
- **Where:** `src/app/api/hardcover/rating/route.ts:25-31`, `status/route.ts:27-33`
- **Risk:** To update a rating or status, the API fetches ALL currently reading, finished, AND want-to-read books just to find the `userBook.id` for a single book. For heavy readers this is 3 API calls and hundreds of books scanned per update.
- **Fix:** Accept `userBookId` directly from the client (it's already available in the book detail page state), or add a dedicated lookup function.

### C3. Search Tab Parameter Not Validated
- **Where:** `src/app/api/search/route.ts:37`
- **Risk:** `const tab = (searchParams.get('tab') || 'all') as SearchTab` — this casts any string to `SearchTab` without validation. An unexpected tab value like `tab=admin` wouldn't crash but would return empty results silently, which could confuse debugging.
- **Fix:** Validate against the set of valid tabs before proceeding.

## High Priority Issues

### H1. Network Search Cascading API Calls
- **Where:** `src/app/api/search/route.ts:170-209`
- **Risk:** For the "All" tab, the code fetches reading + finished + wantToRead for EVERY household member in parallel. Each member = 3 Hardcover API calls. With 5 household members = 15 additional API calls per search, all using the current user's... wait, no — it uses each member's own token (`hm.user.hardcoverApiToken`). This means each member's rate limit is separate, but if one member's token is expired/invalid, the error is silently swallowed (good), but the user gets no indication why results are incomplete.
- **Improvement:** Cache member book lists (use the `Snapshot` model) and add a "last refreshed" indicator.

### H2. Local Auth Session Cookie Not Signed
- **Where:** `src/lib/auth.ts:8-9`
- **Risk:** The `local-session` cookie contains a raw user ID. If someone crafts a cookie with another user's UUID, they become that user. In local/development mode this is acceptable, but it should be documented as a known limitation.
- **Fix:** Use HMAC-signed cookies or JWT for local sessions.

### H3. Feedback Route Logs User Content to Console
- **Where:** `src/app/api/feedback/route.ts:33`
- **Risk:** `console.log([Feedback] ${type} from ${user.name}..., details)` — feedback content goes to server logs. Could contain sensitive info from users.
- **Fix:** Store in DB or send via email service; don't log raw content.

### H4. `perPage` Parameter Not Bounded
- **Where:** `src/app/api/search/route.ts:38`
- **Risk:** `parseInt(searchParams.get('perPage') || '10', 10)` — a client could send `perPage=10000`, causing massive Hardcover API requests and GraphQL queries.
- **Fix:** Clamp to `Math.min(Math.max(perPage, 1), 50)`.

## Medium Priority Issues

### M1. No Search Query Length Limit
- **Where:** `src/app/api/search/route.ts:36`
- **Risk:** A very long query string (thousands of characters) gets passed directly to Typesense and used in substring matching on local books. Could cause performance issues.
- **Fix:** Truncate query to 200 chars max.

### M2. GraphQL Query String Interpolation
- **Where:** `src/lib/hardcover.ts:165-167` (fetchBookById), `:230-233` (searchBooks), `:272-275` (searchByAuthor)
- **Risk:** Book IDs from Typesense are interpolated directly into GraphQL query strings: `books(where: {id: {_in: [${bookIds.join(',')}]}})`. While these are numeric IDs from a trusted API, this pattern is fragile. If any ID contained non-numeric characters, it could break the query.
- **Fix:** Use GraphQL variables instead of string interpolation for IDs.

### M3. Household GET Exposes `hardcoverConnected` for All Members
- **Where:** `src/app/api/households/route.ts:34`
- **Risk:** The response includes `hardcoverConnected: !!hm.user.hardcoverApiToken` for every member. While it doesn't expose the token itself, it reveals whether each member has connected their account.
- **Severity:** Low — this is household-internal info and probably intended.

### M4. Delete Plus-One Doesn't Verify Existence First
- **Where:** `src/app/api/plus-ones/route.ts:74-80`
- **Risk:** `prisma.plusOne.delete()` will throw if the record doesn't exist. The error is caught by the generic handler, but returns a vague 500 instead of a clear 404.
- **Fix:** Use `deleteMany` (returns count) or check existence first.

### M5. Search Race Condition on Rapid Tab Switching
- **Where:** `src/components/search-command.tsx` (client-side)
- **Risk:** If user rapidly switches tabs (All → Books → Authors), multiple API calls fire and results may arrive out of order, showing stale results from an earlier tab. The debounce helps but doesn't prevent this.
- **Fix:** Add an AbortController or request ID to discard stale responses.

## Low Priority / Nice to Have

### L1. Missing Error Boundary Components
- No React Error Boundaries wrap the main content areas. A component crash would white-screen the entire app.

### L2. No Loading Skeletons on /search Page
- The /search page shows a spinner but no skeleton layout. The search dialog has better loading UX than the full page.

### L3. Author Search May Miss Non-ASCII Names
- `searchByAuthor()` uses `toLowerCase()` for matching, which doesn't handle Unicode normalization. Names like "García Márquez" might not match "garcia marquez".

### L4. Book Placeholder Image Not Preloaded
- `/book-placeholder.svg` is referenced in multiple components but not preloaded, causing a flash when covers fail to load.

### L5. Invite Code Brute-Force
- Invite codes are 8 hex chars (4 bytes = ~4 billion combinations). For a family app this is fine, but there's no rate limiting on the join endpoint.

## Recommendations Summary

1. **Add rate limiting to `hardcoverQuery()`** — token bucket, 50 req/min safety margin
2. **Fix rating/status endpoints** — accept `userBookId` from client instead of fetching all books
3. **Validate and bound search params** — tab validation, perPage clamping, query length limit
4. **Add AbortController to search client** — prevent stale results on rapid tab switching
5. **Cache household member book lists** — use Snapshot model, refresh periodically
6. **Sign local auth session cookies** — HMAC or JWT
7. **Use GraphQL variables** — instead of string interpolation for IDs
8. **Add React Error Boundaries** — wrap main content areas
9. **Remove console.log from feedback route** — store/email instead
10. **Add integration tests for API routes** — current tests only test pure logic, not actual routes
