import { cn } from '@/lib/utils'

interface PressLogoProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export function PressLogo({ className, size = 'md' }: PressLogoProps) {
  const sizes = {
    sm: 'h-6',
    md: 'h-8',
    lg: 'h-12',
  }

  return (
    <svg
      viewBox="0 0 280 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(sizes[size], 'w-auto', className)}
      aria-label="Press"
    >
      <text
        x="0"
        y="46"
        fill="currentColor"
        fontFamily="system-ui, -apple-system, 'SF Pro Display', sans-serif"
        fontWeight="800"
        fontSize="52"
        letterSpacing="4"
      >
        PRESS
      </text>
    </svg>
  )
}
