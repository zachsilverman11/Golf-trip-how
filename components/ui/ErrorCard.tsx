import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

interface ErrorCardProps {
  title?: string
  message: string
  backHref: string
  backLabel?: string
}

export function ErrorCard({
  title = 'Something went wrong',
  message,
  backHref,
  backLabel = 'Go Back',
}: ErrorCardProps) {
  return (
    <Card className="p-6 text-center">
      <div className="mb-3 text-3xl opacity-50">!</div>
      <h2 className="mb-2 font-display text-lg font-bold text-text-0">
        {title}
      </h2>
      <p className="mb-4 text-sm text-text-2">{message}</p>
      <Link href={backHref}>
        <Button variant="secondary">{backLabel}</Button>
      </Link>
    </Card>
  )
}
