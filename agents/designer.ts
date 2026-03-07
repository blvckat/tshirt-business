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

// Use Claude to craft a detailed, high-quality DALL-E prompt from a raw theme
async function buildImagePrompt(theme: string): Promise<string> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  // Pick ONE single power word for the shirt — DALL-E renders single words reliably
  const wordMsg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 20,
    messages: [
      {
        role: 'user',
        content: `You are a minimal streetwear designer for an AI-culture brand. Given the theme "${theme}", choose ONE single word for a t-shirt (ALL CAPS, max 8 letters — e.g. NEURAL, AGENT, MODEL, LOGIC, PROMPT, TOKEN, HUMAN, THINK). The word should feel AI/tech-native and culturally sharp. Return only the single word, nothing else.`,
      },
    ],
  })
  const wordBlock = wordMsg.content[0]
  if (wordBlock.type !== 'text') throw new Error('Unexpected response from Claude')
  const exactText = wordBlock.text.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
  const spelled = exactText.split('').join('-')

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 400,
    messages: [
      {
        role: 'user',
        content: `You are a minimal streetwear graphic designer for an AI-culture brand. Motto: "Built by algorithms. Worn by real ones."
Create a DALL-E 3 image generation prompt for a t-shirt graphic based on this theme: "${theme}".

The ONLY text on the shirt is the single word: "${exactText}" (spelled: ${spelled})

Requirements:
- The single word "${exactText}" (${spelled}) — clean, stark, ultra-minimal sans-serif or monospace type
- Pure black background
- No gradients, no effects, no decorative elements — just the word and maybe one subtle geometric or circuit-like accent
- Cold, precise, machine aesthetic — think terminal output, not grunge
- High contrast white or light grey text on black
- No other words, no humans, no photorealistic elements
- Suitable for screen printing on a black t-shirt
- Minimalism is the point — empty space is intentional

Return ONLY the image prompt, nothing else.`,
      },
    ],
  })

  const block = message.content[0]
  if (block.type !== 'text') throw new Error('Unexpected response from Claude')
  return block.text.trim()
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
