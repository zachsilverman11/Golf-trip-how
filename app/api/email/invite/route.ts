import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/resend'
import { tripInviteEmail } from '@/lib/email/templates'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { tripId, email, inviterName } = await req.json()

  const { data: trip } = await supabase
    .from('trips')
    .select('name, start_date')
    .eq('id', tripId)
    .single()

  if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://golf-trip-hq.vercel.app'
  const inviteUrl = `${appUrl}/login?redirect=/trip/${tripId}`

  const { subject, html } = tripInviteEmail({
    inviterName: inviterName || 'Someone',
    tripName: trip.name,
    startDate: trip.start_date || 'TBD',
    inviteUrl,
  })

  const result = await sendEmail({ to: email, subject, html })
  return NextResponse.json(result)
}
