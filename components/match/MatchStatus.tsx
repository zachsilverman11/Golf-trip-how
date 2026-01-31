'use client'

import { cn } from '@/lib/utils'

interface MatchStatusProps {
  lead: number // positive = up, negative = down
  label?: string // Optional label like "Main" or "status" (legacy)
  dormie?: boolean // Show DORMIE badge instead of UP/DN
  size?: 'default' | 'large'
  className?: string
}

/**
 * Display match status badge: "2 UP", "1 DN", "A/S", or "DORMIE"
 */
export function MatchStatus({
  lead,
  label,
  dormie,
  size = 'default',
  className,
}: MatchStatusProps) {
  // Dormie variant: show DORMIE when dormie=true and lead !== 0
  const isDormieDisplay = dormie && lead !== 0

  // Format the status text
  const getStatusText = () => {
    if (isDormieDisplay) return 'DORMIE'
    if (lead === 0) return 'A/S'
    const absLead = Math.abs(lead)
    if (lead > 0) return `${absLead} UP`
    return `${absLead} DN`
  }

  // Get variant based on lead
  const getVariant = () => {
    if (isDormieDisplay) return 'dormie'
    if (lead > 0) return 'positive'
    if (lead < 0) return 'negative'
    return 'neutral'
  }

  const statusText = getStatusText()
  const variant = getVariant()

  const variants = {
    positive: 'bg-good/15 text-good border-good/30',
    negative: 'bg-bad/15 text-bad border-bad/30',
    neutral: 'bg-bg-2 text-text-1 border-stroke',
    dormie: 'bg-gold/20 text-gold border-gold/40 animate-pulse',
  }

  const sizes = {
    default: 'px-2 py-0.5 text-xs font-bold',
    large: 'px-3 py-1 text-sm font-bold',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border',
        variants[variant],
        sizes[size],
        className
      )}
    >
      {label && <span className="opacity-60 mr-1">{label}:</span>}
      {statusText}
    </span>
  )
}

interface PressStatusProps {
  pressNumber: number
  lead: number
  startingHole?: number // Optional: show "P1 from 8" instead of just "P1"
  size?: 'default' | 'large'
  className?: string
}

/**
 * Display press status badge: "P1 from 8: 1 DN"
 */
export function PressStatus({
  pressNumber,
  lead,
  startingHole,
  size = 'default',
  className,
}: PressStatusProps) {
  const getStatusText = () => {
    if (lead === 0) return 'A/S'
    const absLead = Math.abs(lead)
    if (lead > 0) return `${absLead} UP`
    return `${absLead} DN`
  }

  const getVariant = () => {
    if (lead > 0) return 'positive'
    if (lead < 0) return 'negative'
    return 'neutral'
  }

  const statusText = getStatusText()
  const variant = getVariant()

  const variants = {
    positive: 'bg-good/10 text-good/90',
    negative: 'bg-bad/10 text-bad/90',
    neutral: 'bg-bg-2 text-text-2',
  }

  const sizes = {
    default: 'px-2 py-0.5 text-xs font-medium',
    large: 'px-3 py-1 text-sm font-medium',
  }

  // Build label: "P1" or "P1 from 8"
  const label = startingHole ? `P${pressNumber} from ${startingHole}` : `P${pressNumber}`

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full',
        variants[variant],
        sizes[size],
        className
      )}
    >
      <span className="opacity-70 mr-1">{label}:</span>
      {statusText}
    </span>
  )
}
