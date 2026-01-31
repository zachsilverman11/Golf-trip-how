'use client'

import { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'

interface ShareButtonProps {
  title: string
  text: string
  url?: string
  className?: string
  variant?: 'icon' | 'button'
}

export function ShareButton({
  title,
  text,
  url,
  className,
  variant = 'icon',
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleShare = useCallback(async () => {
    // Try native Web Share API first (works on iOS Safari, Android Chrome)
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title,
          text,
          url: url || (typeof window !== 'undefined' ? window.location.href : undefined),
        })
        return
      } catch (err) {
        // User cancelled or share failed — fall through to clipboard
        if ((err as Error)?.name === 'AbortError') return
      }
    }

    // Fallback: copy to clipboard
    const shareText = url ? `${text}\n${url}` : text
    try {
      await navigator.clipboard.writeText(shareText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Last resort: prompt
      if (typeof window !== 'undefined') {
        window.prompt('Copy this:', shareText)
      }
    }
  }, [title, text, url])

  if (variant === 'button') {
    return (
      <button
        onClick={handleShare}
        className={cn(
          'inline-flex items-center gap-2 rounded-button border border-stroke bg-bg-1 px-4 min-h-button',
          'text-sm font-medium text-text-1 transition-all hover:bg-bg-2 hover:text-text-0',
          'active:scale-[0.98]',
          className
        )}
      >
        <ShareIcon className="h-4 w-4" />
        {copied ? 'Copied!' : 'Share'}
      </button>
    )
  }

  return (
    <button
      onClick={handleShare}
      className={cn(
        'inline-flex h-9 w-9 items-center justify-center rounded-full',
        'text-text-2 transition-all hover:bg-bg-2 hover:text-text-1',
        'active:scale-[0.95]',
        copied && 'text-good',
        className
      )}
      title={copied ? 'Copied!' : 'Share'}
    >
      {copied ? (
        <CheckIcon className="h-4 w-4" />
      ) : (
        <ShareIcon className="h-4 w-4" />
      )}
    </button>
  )
}

function ShareIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z"
      />
    </svg>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4.5 12.75l6 6 9-13.5"
      />
    </svg>
  )
}
