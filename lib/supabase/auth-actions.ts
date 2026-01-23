'use server'

import { createClient } from './server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

export interface AuthResult {
  success: boolean
  error?: string
}

/**
 * Send magic link email for passwordless authentication
 * @param email - User's email address
 * @param redirectTo - Optional path to redirect to after auth (e.g., '/trip/123')
 */
export async function signInWithMagicLink(email: string, redirectTo?: string): Promise<AuthResult> {
  const supabase = createClient()
  const headersList = headers()
  const origin = headersList.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  // Build callback URL with optional redirect
  let callbackUrl = `${origin}/auth/callback`
  if (redirectTo) {
    callbackUrl += `?next=${encodeURIComponent(redirectTo)}`
  }

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: callbackUrl,
    },
  })

  if (error) {
    console.error('Magic link error:', error)
    return { success: false, error: error.message }
  }

  return { success: true }
}

/**
 * Get the current authenticated user
 */
export async function getCurrentUser() {
  const supabase = createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error) {
    console.error('Get user error:', error)
    return null
  }

  return user
}

/**
 * Sign out the current user
 */
export async function signOut() {
  const supabase = createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

/**
 * Check if user is authenticated (for server components)
 */
export async function requireAuth() {
  const user = await getCurrentUser()
  if (!user) {
    redirect('/login')
  }
  return user
}
