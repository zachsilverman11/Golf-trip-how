import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') || '/trips'

  // Debug logging for auth callback issues
  console.log('[Auth Callback] Request URL:', request.url)
  console.log('[Auth Callback] Origin:', requestUrl.origin)
  console.log('[Auth Callback] Code present:', !!code)
  console.log('[Auth Callback] Next param:', next)

  if (code) {
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            cookieStore.set({ name, value, ...options })
          },
          remove(name: string, options: CookieOptions) {
            cookieStore.delete(name)
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error('[Auth Callback] Exchange error:', error.message)
    } else {
      const redirectUrl = new URL(next, requestUrl.origin)
      console.log('[Auth Callback] Success! Redirecting to:', redirectUrl.toString())
      return NextResponse.redirect(redirectUrl)
    }
  } else {
    console.warn('[Auth Callback] No code provided in request')
  }

  // If no code or error, redirect to login with error
  console.log('[Auth Callback] Redirecting to login with error')
  return NextResponse.redirect(new URL('/login?error=auth_failed', requestUrl.origin))
}
