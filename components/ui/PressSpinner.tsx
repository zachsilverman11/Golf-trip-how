import { cn } from '@/lib/utils'

interface PressSpinnerProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export function PressSpinner({ className, size = 'md' }: PressSpinnerProps) {
  const sizes = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-4xl',
  }

  return (
    <div className={cn('flex flex-col items-center justify-center gap-4', className)}>
      <div className="relative">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-accent/20 border-t-accent" />
      </div>
      <span className={cn('font-display font-extrabold tracking-widest text-text-0', sizes[size])}>
        PRESS
      </span>
    </div>
  )
}
