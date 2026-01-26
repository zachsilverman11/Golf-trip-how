import Link from 'next/link'
import { cn } from '@/lib/utils'

interface BackButtonProps {
  href: string
  label?: string
  className?: string
}

export function BackButton({ href, label = 'Back', className }: BackButtonProps) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex items-center gap-1 text-sm text-text-2 hover:text-text-1 transition-colors',
        className
      )}
    >
      <ChevronLeftIcon />
      {label}
    </Link>
  )
}

function ChevronLeftIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
    </svg>
  )
}
