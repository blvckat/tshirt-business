import { NextRequest, NextResponse } from 'next/server'
import { runDesignerAgent } from '@/agents/designer'

export async function POST(req: NextRequest) {
  let theme: string

  try {
    const body = await req.json()
    theme = body?.theme?.trim()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  if (!theme) {
    return NextResponse.json(
      { error: 'Missing required field: theme' },
      { status: 400 }
    )
  }

  if (theme.length > 200) {
    return NextResponse.json(
      { error: 'Theme must be 200 characters or fewer' },
      { status: 400 }
    )
  }

  try {
    const design = await runDesignerAgent(theme)
    return NextResponse.json({ success: true, design }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'

    if (message.includes('content_policy') || message.includes('safety')) {
      return NextResponse.json(
        { error: 'Image generation was blocked by content policy. Try a different theme.' },
        { status: 422 }
      )
    }

    if (message.includes('Supabase')) {
      return NextResponse.json(
        { error: 'Failed to save design to database.', detail: message },
        { status: 500 }
      )
    }

    if (message.includes('DALL-E') || message.includes('OpenAI') || message.includes('No image')) {
      return NextResponse.json(
        { error: 'Image generation failed.', detail: message },
        { status: 502 }
      )
    }

    console.error('[/api/generate-design]', err)
    return NextResponse.json(
      { error: 'Internal server error', detail: message },
      { status: 500 }
    )
  }
}
