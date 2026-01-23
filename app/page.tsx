import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Root route handler - redirects to /trips or /login based on auth status.
 * Note: This is primarily handled by middleware, but serves as a fallback.
 */
export default async function RootPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/trips')
  } else {
    redirect('/login')
  }
}
