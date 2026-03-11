import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const { copyId, platform } = await req.json()

  if (!copyId || !platform) {
    return NextResponse.json({ error: 'Missing copyId or platform' }, { status: 400 })
  }

  const supabase = createClient()

  // Fetch the marketing copy + product image
  const { data: copy, error } = await supabase
    .from('marketing_copy')
    .select('*, products(design_id, designs(image_url))')
    .eq('id', copyId)
    .single()

  if (error || !copy) {
    return NextResponse.json({ error: 'Copy not found' }, { status: 404 })
  }

  const imageUrl = (copy.products as { designs?: { image_url?: string } } | null)?.designs?.image_url ?? ''

  if (platform === 'x') {
    const apiKey = process.env.TWITTER_API_KEY
    const apiSecret = process.env.TWITTER_API_SECRET
    const accessToken = process.env.TWITTER_ACCESS_TOKEN
    const accessSecret = process.env.TWITTER_ACCESS_SECRET

    if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
      return NextResponse.json({ error: 'X credentials not configured' }, { status: 503 })
    }

    try {
      const { TwitterApi } = await import('twitter-api-v2')
      const client = new TwitterApi({ appKey: apiKey, appSecret: apiSecret, accessToken, accessSecret })
      const tweetCopy = copy.ad_copies?.find((a: { platform: string; copy: string }) => a.platform === 'X/Twitter')?.copy ?? copy.product_title
      const hashtags = (copy.hashtags ?? []).slice(0, 3).join(' ')
      const tweetText = `${tweetCopy}\n\n${hashtags}`
      const mediaId = await client.v1.uploadMedia(imageUrl, { mimeType: 'image/png', target: 'tweet' })
      await client.v2.tweet({ text: tweetText, media: { media_ids: [mediaId] } })
      await supabase.from('marketing_copy').update({ x_posted_at: new Date().toISOString() }).eq('id', copyId)
      return NextResponse.json({ success: true })
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 500 })
    }
  }

  if (platform === 'instagram') {
    const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN
    const accountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID

    if (!accessToken || !accountId) {
      return NextResponse.json({ error: 'Instagram credentials not configured' }, { status: 503 })
    }

    try {
      const igCopy = copy.ad_copies?.find((a: { platform: string; copy: string }) => a.platform === 'Instagram')?.copy ?? copy.product_title
      const hashtags = (copy.hashtags ?? []).join(' ')
      const caption = `${igCopy}\n\n${hashtags}\n\nBlvckcatai.com`

      const containerRes = await fetch(`https://graph.facebook.com/v19.0/${accountId}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: imageUrl, caption, access_token: accessToken }),
      })
      const container = await containerRes.json()
      if (!container.id) throw new Error(`Container failed: ${JSON.stringify(container)}`)

      const publishRes = await fetch(`https://graph.facebook.com/v19.0/${accountId}/media_publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creation_id: container.id, access_token: accessToken }),
      })
      const published = await publishRes.json()
      if (!published.id) throw new Error(`Publish failed: ${JSON.stringify(published)}`)

      await supabase.from('marketing_copy').update({ instagram_posted_at: new Date().toISOString() }).eq('id', copyId)
      return NextResponse.json({ success: true })
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'Invalid platform' }, { status: 400 })
}
