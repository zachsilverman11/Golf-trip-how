import { Metadata } from 'next'
import { getSpectatorTripInfoAction } from '@/lib/supabase/spectator-actions'
import { SpectatorClient } from './SpectatorClient'

interface Props {
  params: { token: string }
}

// ============================================================================
// Dynamic OG Metadata for Social Sharing
// ============================================================================

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { trip } = await getSpectatorTripInfoAction(params.token)

  const title = trip
    ? `${trip.name} — Live on Press`
    : 'Press — Live Leaderboard'
  const description = trip?.description
    ? `${trip.description} — Follow along live on Press.`
    : 'Follow along live — scores, matches, and drama from the golf trip.'

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: 'Press',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}

// ============================================================================
// Page (Server Component)
// ============================================================================

export default function SpectatorPage({ params }: Props) {
  return <SpectatorClient token={params.token} />
}
