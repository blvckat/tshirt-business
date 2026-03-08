import { NextRequest, NextResponse } from 'next/server'
import { runTrendsAgent } from '@/agents/trends'
import { runDesignerAgent } from '@/agents/designer'

const DESIGNS_PER_RUN = 3

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${secret}`
}

// Vercel Cron sends GET; keep POST for manual triggers
export const GET = POST
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Step 1: Fetch trending themes
    console.log('[DailyDesigns] Fetching trends...')
    const trends = await runTrendsAgent()

    // Pick the top N by score
    const topTrends = trends
      .sort((a, b) => b.score - a.score)
      .slice(0, DESIGNS_PER_RUN)

    console.log(`[DailyDesigns] Top themes: ${topTrends.map(t => t.keyword).join(', ')}`)

    // Step 2: Generate a design for each theme (sequentially to avoid rate limits)
    const designs = []
    for (const trend of topTrends) {
      console.log(`[DailyDesigns] Generating design for: "${trend.keyword}"`)
      const design = await runDesignerAgent(trend.keyword)
      designs.push(design)
    }

    console.log(`[DailyDesigns] Done — ${designs.length} designs created`)
    return NextResponse.json({ success: true, count: designs.length, designs }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[/api/daily-designs]', err)
    return NextResponse.json({ error: 'Daily designs failed', detail: message }, { status: 500 })
  }
}
