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
        content: `You are a fitness brand copywriter for a gym apparel company. Generate marketing copy for a t-shirt with this theme: "${theme}".

Return a JSON object with exactly this structure:
{
  "product_title": "A compelling gym-tone title, max 60 characters",
  "description": "A 150-word benefits-focused, SEO-optimized product description for a gym t-shirt. Mention comfort, quality, and the motivational message.",
  "bullet_points": [
    "Feature bullet 1",
    "Feature bullet 2",
    "Feature bullet 3",
    "Feature bullet 4",
    "Feature bullet 5"
  ],
  "ad_copies": [
    { "platform": "Facebook", "copy": "Facebook ad copy, 2-3 sentences, conversational, includes a call to action" },
    { "platform": "Instagram", "copy": "Instagram caption with energy and attitude, under 150 chars" },
    { "platform": "Instagram Story", "copy": "Short punchy story copy, max 80 chars, direct CTA" }
  ],
  "hashtags": ["#hashtag1", "#hashtag2", "#hashtag3", "#hashtag4", "#hashtag5"]
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

export async function runMarketingAgent(
  theme: string,
  productId: string
): Promise<MarketingCopy> {
  console.log(`[Marketing] Generating copy for: "${theme}" (product: ${productId})`)

  const copy = await generateCopy(theme)
  console.log(`[Marketing] Generated title: "${copy.product_title}"`)

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
    })
    .select()
    .single()

  if (error) throw new Error(`Failed to save marketing copy: ${error.message}`)
  console.log(`[Marketing] Saved copy: ${data.id}`)

  return data as MarketingCopy
}
