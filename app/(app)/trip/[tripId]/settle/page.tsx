import Link from 'next/link'
import { LayoutContainer } from '@/components/ui/LayoutContainer'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

export default function SettlePage() {
  return (
    <LayoutContainer className="py-6">
      <h1 className="mb-6 font-display text-2xl font-bold text-text-0">
        Settle Up
      </h1>

      <Card className="p-8 text-center">
        <div className="mb-4 text-4xl opacity-50">
          <span role="img" aria-label="money">💰</span>
        </div>
        <h2 className="mb-2 font-display text-xl font-bold text-text-0">
          Coming Soon
        </h2>
        <p className="mb-4 text-text-2">
          Settlement calculations and payment tracking will be available in a future update.
        </p>
      </Card>
    </LayoutContainer>
  )
}
