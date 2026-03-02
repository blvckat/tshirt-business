import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export interface TrendResult {
  id: string
  keyword: string
  platform: string
  score: number
  discovered_at: string
}

interface ParsedTrend {
  keyword: string
  platform: string
  score: number
}

async function fetchTrends(): Promise<ParsedTrend[]> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    tools: [{ type: 'web_search_20250305' as const, name: 'web_search' }],
    messages: [
      {
        role: 'user',
        content: `Search the web for what's trending RIGHT NOW in gym and fitness culture.
Look for:
- Viral workout trends (e.g. specific exercises going viral on TikTok/Instagram)
- Popular gym quotes and motivational phrases
- Fitness influencer themes and aesthetics
- Trending gym challenges or movements

After searching, return a JSON array of 5-10 trending keywords suitable for gym t-shirt designs.
Each item must have:
- "keyword": the trend (2-5 words, t-shirt friendly)
- "platform": where it's trending (e.g. "TikTok", "Instagram", "YouTube", "Reddit")
- "score": relevance score 1-10 (10 = hottest trend)

Sort by score descending. Return ONLY a valid JSON array, no markdown, no extra text.

Example format:
[
  { "keyword": "180 lb club", "platform": "TikTok", "score": 9 },
  { "keyword": "chest day every day", "platform": "Instagram", "score": 8 }
]`,
      },
    ],
  })

  // Extract the final text block from the response
  const textBlock = message.content.findLast((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response returned from Claude')
  }

  const raw = textBlock.text.trim()

  // Strip markdown code fences if present
  const json = raw.startsWith('```')
    ? raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    : raw

  try {
    const parsed = JSON.parse(json)
    if (!Array.isArray(parsed)) throw new Error('Expected a JSON array')
    return parsed as ParsedTrend[]
  } catch {
    throw new Error(`Failed to parse trends JSON: ${raw}`)
  }
}

export async function runTrendsAgent(): Promise<TrendResult[]> {
  console.log('[Trends] Searching for gym/fitness trends...')

  const trends = await fetchTrends()
  console.log(`[Trends] Found ${trends.length} trends`)

  const supabase = createClient()
  const now = new Date().toISOString()

  const rows = trends.map((t) => ({
    keyword: t.keyword,
    platform: t.platform,
    score: t.score,
    discovered_at: now,
  }))

  const { data, error } = await supabase
    .from('trends')
    .insert(rows)
    .select()

  if (error) throw new Error(`Failed to save trends to Supabase: ${error.message}`)
  console.log(`[Trends] Saved ${data.length} trends to Supabase`)

  return data as TrendResult[]
}
