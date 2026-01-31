import { signOut } from '@/lib/supabase/auth-actions'
import { PressLogo } from '@/components/ui/PressLogo'

interface DashboardHeaderProps {
  userEmail?: string | null
}

export function DashboardHeader({ userEmail }: DashboardHeaderProps) {
  // Extract first name from email for greeting
  const name = userEmail
    ? userEmail.split('@')[0].charAt(0).toUpperCase() + userEmail.split('@')[0].slice(1)
    : null

  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-accent">
          <PressLogo size="sm" />
        </h1>
        {name && (
          <p className="text-sm text-text-2 mt-1">
            Hey {name} 👋
          </p>
        )}
      </div>
      <form action={signOut}>
        <button
          type="submit"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-stroke bg-bg-1 text-text-2 hover:bg-bg-2 hover:text-text-1 transition-colors duration-tap"
          title="Sign out"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
          </svg>
        </button>
      </form>
    </div>
  )
}
