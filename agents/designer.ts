import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export interface DesignRecord {
  id: string
  title: string
  image_url: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  approved_at: string | null
}

// Use Claude to generate the three text elements for the contrast design
async function buildTextElements(theme: string): Promise<{ human: string; machine: string; qualifier: string }> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 120,
    messages: [
      {
        role: 'user',
        content: `You are a copywriter for BLVCKCAT.AI — an AI-culture streetwear brand. Motto: "Built by algorithms. Worn by real ones."

Given the theme "${theme}", generate three text elements for a contrast t-shirt design:

1. "human" — a short lowercase, warm, human-feeling phrase (2–4 words). Handwritten feel. Something emotionally honest. e.g. "still human", "kind of here", "i remember this"
2. "machine" — a cold ALL-CAPS monospace response or reframe (1–3 words). Clinical, algorithmic. e.g. "FOR NOW", "UPDATING...", "DEPRECATED"
3. "qualifier" — one small lowercase italic word of doubt or irony at the bottom. e.g. "probably", "mostly", "pending", "maybe"

Return ONLY a JSON object: {"human": "...", "machine": "...", "qualifier": "..."}`,
      },
    ],
  })

  const block = msg.content[0]
  if (block.type !== 'text') throw new Error('Unexpected response from Claude')

  const raw = block.text.trim()
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) throw new Error(`Could not parse text elements JSON: ${raw}`)
  return JSON.parse(match[0])
}

// Use Claude to craft a detailed, high-quality DALL-E prompt from a raw theme
async function buildImagePrompt(theme: string): Promise<string> {
  const { human, machine, qualifier } = await buildTextElements(theme)

  return `T-shirt graphic design, print-ready, white canvas background.

Layout from top to bottom, centered:
1. The phrase "${human}" in loose casual handwritten script, warm and imperfect, white text
2. A thin horizontal rule (hairline) spanning the full width
3. The text "${machine}" in ultra-bold condensed cold monospace ALL CAPS, much larger than the script above, white text
4. The word "${qualifier}" in small delicate italic, bottom center, white text

Style: human warmth meets machine coldness — the contrast between the handwritten script and the stark monospace IS the concept. Black background fills the design area. White background border around design for printing. No graphics, no icons, no decorations — pure typography only. Print-ready for screen printing.`
}

// Generate a short title for the design from the theme
function buildTitle(theme: string): string {
  return theme
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export async function runDesignerAgent(theme: string): Promise<DesignRecord> {
  console.log(`[Designer] Theme: "${theme}"`)

  // Step 1: Build a detailed prompt via Claude
  const imagePrompt = await buildImagePrompt(theme)
  console.log(`[Designer] Prompt: ${imagePrompt}`)

  // Step 2: Generate image with DALL-E 3
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const imageResponse = await openai.images.generate({
    model: 'dall-e-3',
    prompt: imagePrompt,
    n: 1,
    size: '1024x1024',
    quality: 'standard',
    style: 'vivid',
  })

  const dalleUrl = imageResponse.data?.[0]?.url
  if (!dalleUrl) throw new Error('No image URL returned from DALL-E')
  console.log(`[Designer] Image generated: ${dalleUrl}`)

  // Step 3: Download image and upload to Supabase Storage (DALL-E URLs expire in ~2h)
  const supabase = createClient()
  const imgRes = await fetch(dalleUrl)
  if (!imgRes.ok) throw new Error(`Failed to download DALL-E image: ${imgRes.status}`)
  const imgBuffer = Buffer.from(await imgRes.arrayBuffer())
  const fileName = `${Date.now()}.png`

  const { error: uploadError } = await supabase.storage
    .from('designs')
    .upload(fileName, imgBuffer, { contentType: 'image/png', upsert: false })
  if (uploadError) throw new Error(`Supabase Storage upload failed: ${uploadError.message}`)

  const { data: { publicUrl } } = supabase.storage.from('designs').getPublicUrl(fileName)
  console.log(`[Designer] Image stored: ${publicUrl}`)

  // Step 4: Save to Supabase
  const { data, error } = await supabase
    .from('designs')
    .insert({
      title: buildTitle(theme),
      image_url: publicUrl,
      status: 'pending',
    })
    .select()
    .single()

  if (error) throw new Error(`Supabase insert failed: ${error.message}`)
  console.log(`[Designer] Saved design: ${data.id}`)

  return data as DesignRecord
}
