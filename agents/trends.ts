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
        content: `Search the web for what's trending RIGHT NOW in AI and tech culture.
Look for:
- Viral AI concepts, tools, or memes (e.g. prompting, agents, LLMs going viral)
- Popular phrases in the AI/developer/builder community
- Trending ideas around AI autonomy, machine learning, the future of tech
- Cultural moments at the intersection of AI and human identity

After searching, return a JSON array of 5-10 trending keywords suitable for AI-themed minimal streetwear t-shirt designs.
Each item must have:
- "keyword": the trend (2-5 words, t-shirt friendly)
- "platform": where it's trending (e.g. "X/Twitter", "Reddit", "GitHub", "LinkedIn", "YouTube")
- "score": relevance score 1-10 (10 = hottest trend)

Sort by score descending. Return ONLY a valid JSON array, no markdown, no extra text.

Example format:
[
  { "keyword": "agents all the way down", "platform": "X/Twitter", "score": 9 },
  { "keyword": "trust the algorithm", "platform": "Reddit", "score": 8 }
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

  // Extract JSON array — handles raw JSON, or JSON wrapped in markdown code fences
  // with or without preceding text
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  const arrayMatch = raw.match(/(\[[\s\S]*\])/)
  const json = fenceMatch ? fenceMatch[1].trim() : arrayMatch ? arrayMatch[1].trim() : raw

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
