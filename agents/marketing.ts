import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export interface MarketingCopy {
  id: string
  product_id: string
  product_title: string
  description: string
  bullet_points: string[]
  ad_copies: { platform: string; copy: string }[]
  hashtags: string[]
  x_posted_at: string | null
  instagram_posted_at: string | null
  created_at: string
}

interface GeneratedCopy {
  product_title: string
  description: string
  bullet_points: string[]
  ad_copies: { platform: string; copy: string }[]
  hashtags: string[]
}

async function generateCopy(theme: string): Promise<GeneratedCopy> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `You are a copywriter for BLVCKCAT.AI — a minimal AI-culture streetwear brand. Motto: "Built by algorithms. Worn by real ones." Generate marketing copy for a t-shirt with this theme: "${theme}".

Tone: cold, precise, self-aware, minimal. Not hype. Not gym bro. Think dev culture meets streetwear.

Return a JSON object with exactly this structure:
{
  "product_title": "A minimal, sharp title — max 60 characters. No exclamation marks.",
  "description": "A 100-word product description. Minimal, dry, slightly ironic. Reference AI culture. Mention the black tee, clean print, and the brand motto.",
  "bullet_points": [
    "Feature bullet 1",
    "Feature bullet 2",
    "Feature bullet 3",
    "Feature bullet 4",
    "Feature bullet 5"
  ],
  "ad_copies": [
    { "platform": "X/Twitter", "copy": "Tweet-style copy, dry wit, under 280 chars, no hashtags inline" },
    { "platform": "Instagram", "copy": "Caption with cold energy, under 150 chars, 1-2 relevant emojis max" },
    { "platform": "Instagram Story", "copy": "Short punchy story copy, max 80 chars, direct CTA" }
  ],
  "hashtags": ["#BLVCKCATAI", "#AIFashion", "#hashtag3", "#hashtag4", "#hashtag5"]
}

Return ONLY valid JSON, no markdown, no extra text.`,
      },
    ],
  })

  const block = message.content[0]
  if (block.type !== 'text') throw new Error('Unexpected response type from Claude')

  try {
    return JSON.parse(block.text.trim()) as GeneratedCopy
  } catch {
    throw new Error(`Failed to parse Claude response as JSON: ${block.text}`)
  }
}

// Post to X (Twitter) using API v2 with OAuth 1.0a
async function postToX(copy: GeneratedCopy, imageUrl: string): Promise<boolean> {
  const apiKey = process.env.TWITTER_API_KEY
  const apiSecret = process.env.TWITTER_API_SECRET
  const accessToken = process.env.TWITTER_ACCESS_TOKEN
  const accessSecret = process.env.TWITTER_ACCESS_SECRET

  if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
    console.warn('[Marketing] X credentials not configured — skipping X post')
    return false
  }

  try {
    const { TwitterApi } = await import('twitter-api-v2')
    const client = new TwitterApi({ appKey: apiKey, appSecret: apiSecret, accessToken, accessSecret })

    const tweetCopy = copy.ad_copies.find(a => a.platform === 'X/Twitter')?.copy ?? copy.product_title
    const hashtags = copy.hashtags.slice(0, 3).join(' ')
    const tweetText = `${tweetCopy}\n\n${hashtags}`

    // Upload image then tweet with media
    const mediaId = await client.v1.uploadMedia(imageUrl, { mimeType: 'image/png', target: 'tweet' })
    await client.v2.tweet({ text: tweetText, media: { media_ids: [mediaId] } })

    console.log('[Marketing] Posted to X successfully')
    return true
  } catch (err) {
    console.error('[Marketing] X post failed:', err)
    return false
  }
}

// Post to Instagram via Graph API (requires Business account)
async function postToInstagram(copy: GeneratedCopy, imageUrl: string): Promise<boolean> {
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN
  const accountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID

  if (!accessToken || !accountId) {
    console.warn('[Marketing] Instagram credentials not configured — skipping Instagram post')
    return false
  }

  try {
    const igCopy = copy.ad_copies.find(a => a.platform === 'Instagram')?.copy ?? copy.product_title
    const hashtags = copy.hashtags.join(' ')
    const caption = `${igCopy}\n\n${hashtags}\n\nBlvckcatai.com`

    // Step 1: Create media container
    const containerRes = await fetch(
      `https://graph.facebook.com/v19.0/${accountId}/media`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: imageUrl, caption, access_token: accessToken }),
      }
    )
    const container = await containerRes.json()
    if (!container.id) throw new Error(`Container creation failed: ${JSON.stringify(container)}`)

    // Step 2: Publish
    const publishRes = await fetch(
      `https://graph.facebook.com/v19.0/${accountId}/media_publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creation_id: container.id, access_token: accessToken }),
      }
    )
    const published = await publishRes.json()
    if (!published.id) throw new Error(`Publish failed: ${JSON.stringify(published)}`)

    console.log('[Marketing] Posted to Instagram successfully')
    return true
  } catch (err) {
    console.error('[Marketing] Instagram post failed:', err)
    return false
  }
}

export async function runMarketingAgent(
  theme: string,
  productId: string,
  imageUrl?: string
): Promise<MarketingCopy> {
  console.log(`[Marketing] Generating copy for: "${theme}" (product: ${productId})`)

  const copy = await generateCopy(theme)
  console.log(`[Marketing] Generated title: "${copy.product_title}"`)

  // Post to socials (both run in parallel, failures are non-fatal)
  const url = imageUrl ?? ''
  const [xPosted, igPosted] = await Promise.all([
    url ? postToX(copy, url) : Promise.resolve(false),
    url ? postToInstagram(copy, url) : Promise.resolve(false),
  ])

  const now = new Date().toISOString()
  const supabase = createClient()
  const { data, error } = await supabase
    .from('marketing_copy')
    .insert({
      product_id: productId,
      product_title: copy.product_title,
      description: copy.description,
      bullet_points: copy.bullet_points,
      ad_copies: copy.ad_copies,
      hashtags: copy.hashtags,
      x_posted_at: xPosted ? now : null,
      instagram_posted_at: igPosted ? now : null,
    })
    .select()
    .single()

  if (error) throw new Error(`Failed to save marketing copy: ${error.message}`)
  console.log(`[Marketing] Saved copy: ${data.id}`)

  return data as MarketingCopy
}
