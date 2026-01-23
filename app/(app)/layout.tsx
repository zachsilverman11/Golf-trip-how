import { requireAuth } from '@/lib/supabase/auth-actions'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // This will redirect to login if not authenticated
  await requireAuth()

  return (
    <div className="min-h-screen bg-bg-0 pb-16">
      {children}
    </div>
  )
}
