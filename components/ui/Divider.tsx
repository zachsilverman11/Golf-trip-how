import { cn } from '@/lib/utils'

interface DividerProps {
  className?: string
  spacing?: 'sm' | 'md' | 'lg'
}

export function Divider({ className, spacing = 'md' }: DividerProps) {
  const spacingStyles = {
    sm: 'my-2',
    md: 'my-4',
    lg: 'my-6',
  }

  return (
    <hr
      className={cn(
        'border-0 border-t border-stroke/40 h-px',
        spacingStyles[spacing],
        className
      )}
    />
  )
}
