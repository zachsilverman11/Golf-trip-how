import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Root route - redirect based on auth status
  if (request.nextUrl.pathname === '/') {
    if (user) {
      return NextResponse.redirect(new URL('/trips', request.url))
    } else {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  // Protected routes - redirect to login if not authenticated
  const isProtectedRoute = request.nextUrl.pathname.startsWith('/trips') ||
    request.nextUrl.pathname.startsWith('/trip/') ||
    request.nextUrl.pathname.startsWith('/courses') ||
    request.nextUrl.pathname.startsWith('/course/')

  if (isProtectedRoute && !user) {
    const redirectUrl = new URL('/login', request.url)
    redirectUrl.searchParams.set('redirect', request.nextUrl.pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // Auth routes - redirect to trips if already authenticated
  const isAuthRoute = request.nextUrl.pathname === '/login'
  if (isAuthRoute && user) {
    return NextResponse.redirect(new URL('/trips', request.url))
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match only specific routes that need auth checking.
     * Exclude all static files, API routes, and public routes.
     */
    '/((?!_next|favicon.ico|api|spectator|.*\\.).*)',
  ],
}
