import { cn } from '@/lib/utils'

interface LayoutContainerProps {
  children: React.ReactNode
  className?: string
}

export function LayoutContainer({ children, className }: LayoutContainerProps) {
  return (
    <div className={cn('mx-auto max-w-content px-4 sm:px-6', className)}>
      {children}
    </div>
  )
}
