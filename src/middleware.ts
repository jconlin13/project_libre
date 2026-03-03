import { type NextRequest, NextResponse } from 'next/server'

// Public paths that don't require authentication
const PUBLIC_PATHS = ['/', '/login']
const PUBLIC_PREFIXES = ['/api/auth']

function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true
  return PUBLIC_PREFIXES.some(prefix => pathname.startsWith(prefix))
}

export async function middleware(request: NextRequest) {
  const session = request.cookies.get('local-session')
  const { pathname } = request.nextUrl

  // Redirect logged-in users away from login page
  if (pathname === '/login' && session) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // All non-public routes require auth
  if (!isPublicRoute(pathname) && !session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
