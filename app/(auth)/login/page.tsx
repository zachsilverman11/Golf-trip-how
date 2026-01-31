'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { signInWithMagicLink } from '@/lib/supabase/auth-actions'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { LayoutContainer } from '@/components/ui/LayoutContainer'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Pass redirect path so user returns to their intended page after auth
    const result = await signInWithMagicLink(email, redirect || undefined)

    if (result.success) {
      setSent(true)
    } else {
      setError(result.error || 'Failed to send magic link')
    }

    setLoading(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-0 px-4">
      <LayoutContainer>
        <div className="mx-auto max-w-sm">
          <div className="mb-8 text-center">
            <h1 className="mb-2 font-display text-3xl font-extrabold tracking-widest text-accent">
              PRESS
            </h1>
            <p className="text-text-2">
              Always pressing.
            </p>
          </div>

          <Card className="p-6">
            {sent ? (
              <div className="text-center">
                <div className="mb-4 text-4xl">
                  <span role="img" aria-label="email">✉️</span>
                </div>
                <h2 className="mb-2 font-display text-xl font-bold text-text-0">
                  Check your email
                </h2>
                <p className="mb-4 text-text-2">
                  We sent a magic link to <span className="text-accent">{email}</span>
                </p>
                <p className="text-sm text-text-2">
                  Click the link in the email to sign in.
                </p>
                <button
                  onClick={() => {
                    setSent(false)
                    setEmail('')
                  }}
                  className="mt-4 text-sm text-accent hover:underline"
                >
                  Use a different email
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <label className="mb-2 block text-sm font-medium text-text-1">
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                  className="mb-4 w-full rounded-button border border-stroke bg-bg-2 px-4 py-3 text-text-0 placeholder:text-text-2 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />

                {error && (
                  <p className="mb-4 text-sm text-bad">{error}</p>
                )}

                <Button
                  type="submit"
                  loading={loading}
                  disabled={!email}
                  className="w-full"
                  size="large"
                >
                  Send Magic Link
                </Button>

                <p className="mt-4 text-center text-xs text-text-2">
                  No password needed. We&apos;ll email you a secure link.
                </p>
              </form>
            )}
          </Card>
        </div>
      </LayoutContainer>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-bg-0">
          <div className="text-text-2">Loading...</div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
