import { requireAuth } from '@/lib/supabase/auth-actions'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // This will redirect to login if not authenticated
  await requireAuth()

  return (
    <div className="flex min-h-[100dvh] flex-col bg-bg-0">
      <div className="flex-1">
        {children}
      </div>
    </div>
  )
}
