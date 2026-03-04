import { NextRequest, NextResponse } from 'next/server'
import { runLeadAgent } from '@/agents/lead'

// Protect with a secret so only Vercel Cron or you can trigger it
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true // allow if not configured
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${secret}`
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runLeadAgent()
    return NextResponse.json({ success: true, result }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[/api/lead]', err)
    return NextResponse.json({ error: 'Lead agent failed', detail: message }, { status: 500 })
  }
}
