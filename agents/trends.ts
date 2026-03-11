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
        content: `Search the web for what's trending RIGHT NOW at the intersection of AI, tech culture, and human identity.

Search across X/Twitter, Reddit (r/artificial, r/singularity, r/MachineLearning, r/ChatGPT), TikTok, GitHub trending, and tech newsletters.

Look for trends in these specific categories — aim for variety across all of them:
1. HUMAN FEELINGS about AI — anxiety, wonder, alienation, dependency, loss of identity ("i let the AI decide", "who am i without google", "outsourcing my thoughts")
2. DEV/BUILDER CULTURE — viral phrases from the builder/indie hacker scene, shipping culture, vibe coding, AI-assisted work ("built this in 3 hours with claude", "prompt engineer", "ship it or skip it")
3. POP CULTURE x AI — moments where AI intersects with music, fashion, sports, memes ("ai generated my outfit", "my playlist knows me better than i do")
4. EXISTENTIAL/PHILOSOPHICAL — questions about consciousness, authenticity, what makes us human in the age of AI
5. SPECIFIC AI TOOLS GOING VIRAL — reactions to specific products, features, or capabilities crossing into mainstream culture

Return 8 trending themes suitable for minimal streetwear graphic tees from BLVCKCAT.AI.
Each keyword should feel like something a real person would wear — not a tech whitepaper title.
Avoid generic terms like "machine learning" or "neural network". Think cultural phrases, not tech jargon.

Each item must have:
- "keyword": the theme (2-6 words, evocative, wearable)
- "platform": where it's trending
- "score": relevance score 1-10

Sort by score descending. Return ONLY a valid JSON array, no markdown, no extra text.

Example of GOOD keywords: "i think therefore i prompt", "trained on everything i've ever said", "running out of context window", "ghost in the machine learning"
Example of BAD keywords: "neural network", "machine learning trends", "AI technology"

Format:
[
  { "keyword": "trained on everything i've ever said", "platform": "X/Twitter", "score": 9 },
  { "keyword": "ghost in the machine learning", "platform": "Reddit", "score": 8 }
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
  console.log('[Trends] Searching for AI-culture trends...')

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
