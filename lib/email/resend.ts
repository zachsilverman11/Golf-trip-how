/**
 * Resend email integration for Press
 * Used for transactional emails: trip invites, settlement receipts, round recaps
 */

const RESEND_API_URL = 'https://api.resend.com/emails'

interface SendEmailParams {
  to: string | string[]
  subject: string
  html: string
  text?: string
  from?: string
  replyTo?: string
}

interface ResendResponse {
  id: string
}

export async function sendEmail(params: SendEmailParams): Promise<{ success: boolean; id?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.error('RESEND_API_KEY not set')
    return { success: false, error: 'Email service not configured' }
  }

  // Default sender — update when domain is verified
  const from = params.from || process.env.RESEND_FROM_EMAIL || 'Press <onboarding@resend.dev>'

  try {
    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: Array.isArray(params.to) ? params.to : [params.to],
        subject: params.subject,
        html: params.html,
        text: params.text,
        reply_to: params.replyTo,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Resend API error:', error)
      return { success: false, error: `Email send failed: ${response.status}` }
    }

    const data: ResendResponse = await response.json()
    return { success: true, id: data.id }
  } catch (err) {
    console.error('Resend send error:', err)
    return { success: false, error: 'Email send failed' }
  }
}
