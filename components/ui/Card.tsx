import { cn } from '@/lib/utils'

interface CardProps {
  variant?: 'primary' | 'secondary'
  elevated?: boolean
  children: React.ReactNode
  className?: string
}

export function Card({
  variant = 'primary',
  elevated = false,
  children,
  className,
}: CardProps) {
  const variants = {
    primary: 'bg-bg-1 rounded-card border border-stroke',
    secondary: 'bg-bg-2 rounded-card-sm',
  }

  return (
    <div
      className={cn(
        variants[variant],
        elevated && 'shadow-lg shadow-black/20',
        className
      )}
    >
      {children}
    </div>
  )
}
