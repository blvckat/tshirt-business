import { NextResponse } from 'next/server'
import { runTrendsAgent } from '@/agents/trends'

export async function POST() {
  try {
    const trends = await runTrendsAgent()
    return NextResponse.json({ success: true, count: trends.length, trends }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[/api/trends]', err)
    return NextResponse.json({ error: 'Failed to fetch trends', detail: message }, { status: 500 })
  }
}

export async function GET() {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = createClient()

  const { data, error } = await supabase
    .from('trends')
    .select('*')
    .order('score', { ascending: false })
    .order('discovered_at', { ascending: false })
    .limit(50)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ trends: data })
}
