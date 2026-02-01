/**
 * Press email templates — dark theme, gold accent
 * Brand: #0A0A0A bg, #F59E0B gold, #10B981 green
 */

const BRAND = {
  bg: '#0A0A0A',
  card: '#141414',
  gold: '#F59E0B',
  green: '#10B981',
  text: '#E5E5E5',
  muted: '#737373',
}

function baseLayout(content: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:${BRAND.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
        <tr><td style="padding:0 0 24px;text-align:center;">
          <span style="font-size:28px;font-weight:800;letter-spacing:4px;color:${BRAND.gold};">PRESS</span>
        </td></tr>
        <tr><td style="background:${BRAND.card};border-radius:12px;padding:32px;">
          ${content}
        </td></tr>
        <tr><td style="padding:24px 0 0;text-align:center;">
          <span style="font-size:12px;color:${BRAND.muted};">Always pressing. 🏌️</span>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export function tripInviteEmail(params: {
  inviterName: string
  tripName: string
  startDate: string
  inviteUrl: string
}): { subject: string; html: string } {
  return {
    subject: `${params.inviterName} invited you to ${params.tripName}`,
    html: baseLayout(`
      <h2 style="margin:0 0 8px;color:${BRAND.text};font-size:20px;">You're in.</h2>
      <p style="color:${BRAND.muted};margin:0 0 24px;font-size:15px;">
        <strong style="color:${BRAND.text};">${params.inviterName}</strong> invited you to join
        <strong style="color:${BRAND.gold};">${params.tripName}</strong>
      </p>
      <p style="color:${BRAND.muted};margin:0 0 24px;font-size:14px;">
        📅 ${params.startDate}
      </p>
      <a href="${params.inviteUrl}" style="display:inline-block;background:${BRAND.gold};color:${BRAND.bg};font-weight:700;padding:14px 32px;border-radius:8px;text-decoration:none;font-size:15px;">
        Join Trip
      </a>
    `),
  }
}

export function settlementEmail(params: {
  tripName: string
  playerName: string
  netAmount: number
  breakdown: Array<{ opponent: string; amount: number }>
}): { subject: string; html: string } {
  const isUp = params.netAmount > 0
  const amountColor = isUp ? BRAND.green : '#EF4444'
  const sign = isUp ? '+' : ''

  const rows = params.breakdown
    .map(b => `
      <tr>
        <td style="padding:8px 0;color:${BRAND.text};font-size:14px;border-bottom:1px solid #222;">${b.opponent}</td>
        <td style="padding:8px 0;text-align:right;color:${b.amount > 0 ? BRAND.green : '#EF4444'};font-size:14px;font-weight:600;border-bottom:1px solid #222;">
          ${b.amount > 0 ? '+' : ''}$${Math.abs(b.amount).toFixed(0)}
        </td>
      </tr>`)
    .join('')

  return {
    subject: `${params.tripName} — Settlement: ${sign}$${Math.abs(params.netAmount).toFixed(0)}`,
    html: baseLayout(`
      <h2 style="margin:0 0 4px;color:${BRAND.text};font-size:20px;">${params.tripName}</h2>
      <p style="color:${BRAND.muted};margin:0 0 24px;font-size:14px;">Final settlement for ${params.playerName}</p>
      <div style="text-align:center;padding:20px 0;margin:0 0 24px;background:${BRAND.bg};border-radius:8px;">
        <span style="font-size:36px;font-weight:800;color:${amountColor};">
          ${sign}$${Math.abs(params.netAmount).toFixed(0)}
        </span>
        <br>
        <span style="font-size:13px;color:${BRAND.muted};">${isUp ? 'You collect' : 'You owe'}</span>
      </div>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:8px 0;color:${BRAND.muted};font-size:12px;text-transform:uppercase;letter-spacing:1px;">Player</td>
          <td style="padding:8px 0;text-align:right;color:${BRAND.muted};font-size:12px;text-transform:uppercase;letter-spacing:1px;">Amount</td>
        </tr>
        ${rows}
      </table>
    `),
  }
}

export function magicLinkEmail(params: {
  magicLinkUrl: string
}): { subject: string; html: string } {
  return {
    subject: 'Sign in to Press',
    html: baseLayout(`
      <h2 style="margin:0 0 8px;color:${BRAND.text};font-size:20px;">Sign in to Press</h2>
      <p style="color:${BRAND.muted};margin:0 0 24px;font-size:15px;">
        Tap below to sign in. This link expires in 1 hour.
      </p>
      <a href="${params.magicLinkUrl}" style="display:inline-block;background:${BRAND.gold};color:${BRAND.bg};font-weight:700;padding:14px 32px;border-radius:8px;text-decoration:none;font-size:15px;">
        Sign In
      </a>
      <p style="color:${BRAND.muted};margin:24px 0 0;font-size:12px;">
        If you didn't request this, you can safely ignore this email.
      </p>
    `),
  }
}
