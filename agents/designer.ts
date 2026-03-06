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

  // Build a short, exact text phrase (≤4 words) for the shirt — Claude picks it
  const phraseMsg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 50,
    messages: [
      {
        role: 'user',
        content: `You are a gym apparel copywriter. Given the theme "${theme}", write ONE short, punchy phrase for a t-shirt (2–4 words, ALL CAPS). No punctuation. Return only the phrase.`,
      },
    ],
  })
  const phraseBlock = phraseMsg.content[0]
  if (phraseBlock.type !== 'text') throw new Error('Unexpected response from Claude')
  const exactText = phraseBlock.text.trim().toUpperCase().replace(/[^A-Z0-9 ]/g, '')
  const spelled = exactText.split('').join('-')

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 400,
    messages: [
      {
        role: 'user',
        content: `You are a graphic designer specializing in gym and fitness apparel.
Create a detailed DALL-E 3 image generation prompt for a t-shirt graphic based on this theme: "${theme}".

The ONLY text on the shirt must be the exact phrase: "${exactText}"
Spell it out letter by letter in your prompt like this: ${spelled}
DALL-E must render this text with PERFECT spelling — include the letter-by-letter spelling in the prompt.

Requirements:
- The exact text "${exactText}" as the bold typographic centerpiece, spelled ${spelled}
- Dark background (black or very dark grey)
- Gym/fitness aesthetic (strong, raw, athletic energy)
- High contrast, print-ready style
- No photorealistic humans — graphic/illustrative style only
- Suitable for screen printing on a t-shirt
- Minimal decorative elements so text is readable

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
