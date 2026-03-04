import { NextRequest, NextResponse } from 'next/server'
import { runProcurementAgent } from '@/agents/procurement'
import { DesignRecord } from '@/agents/designer'

export const maxDuration = 300 // 5 minutes — allows full Printify + marketing flow

export async function POST(req: NextRequest) {
  const design: DesignRecord = await req.json()

  try {
    await runProcurementAgent(design)
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[/api/procurement]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
