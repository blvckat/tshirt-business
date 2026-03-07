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

// Use Claude to generate a DALL-E 3 prompt for a pure visual/graphic design (no text)
async function buildImagePrompt(theme: string): Promise<{ prompt: string; title: string }> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 300,
    messages: [
      {
        role: 'user',
        content: `You are an art director for BLVCKCAT.AI — an AI-culture streetwear brand. Motto: "Built by algorithms. Worn by real ones."

Given the theme "${theme}", create a DALL-E 3 image prompt for a minimal graphic t-shirt design.

Rules:
- Pure visual/graphic only — NO text, NO words, NO letters, NO numbers in the image
- Black shirt, white or light graphic
- Minimal, clean, high-contrast
- AI/tech/digital aesthetic: circuits, neural nets, glitch art, data visualization, abstract geometry, pixel art, wireframes, code structures, binary patterns
- Think: Supreme-style impact, Fear of God minimal luxury, but with AI aesthetic
- White background for the generated image (the graphic will be placed on a black shirt)

Return ONLY valid JSON:
{"prompt": "...", "title": "short product title (2-4 words)"}`,
      },
    ],
  })

  const block = msg.content[0]
  if (block.type !== 'text') throw new Error('Unexpected response from Claude')
  const match = block.text.trim().match(/\{[\s\S]*\}/)
  if (!match) throw new Error(`Could not parse prompt JSON: ${block.text}`)
  return JSON.parse(match[0]) as { prompt: string; title: string }
}

// Generate image via DALL-E 3 and return the URL
async function generateImage(prompt: string): Promise<string> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const response = await openai.images.generate({
    model: 'dall-e-3',
    prompt,
    n: 1,
    size: '1024x1024',
    quality: 'hd',
    style: 'vivid',
  })

  const url = response.data[0]?.url
  if (!url) throw new Error('No image URL returned from DALL-E 3')
  return url
}

// Download the image from DALL-E's temporary URL and return as Buffer
async function downloadImage(url: string): Promise<Buffer> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to download image: ${res.status}`)
  const arrayBuffer = await res.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

export async function runDesignerAgent(theme: string): Promise<DesignRecord> {
  console.log(`[Designer] Theme: "${theme}"`)

  // Step 1: Generate image prompt via Claude
  const { prompt, title } = await buildImagePrompt(theme)
  console.log(`[Designer] Title: "${title}"`)
  console.log(`[Designer] Prompt: ${prompt}`)

  // Step 2: Generate image via DALL-E 3
  const dalleUrl = await generateImage(prompt)
  console.log(`[Designer] DALL-E URL received`)

  // Step 3: Download before URL expires (DALL-E URLs expire in ~1 hour)
  const imgBuffer = await downloadImage(dalleUrl)
  console.log(`[Designer] Downloaded: ${(imgBuffer.length / 1024).toFixed(0)}KB`)

  // Step 4: Upload to Supabase Storage
  const supabase = createClient()
  const fileName = `${Date.now()}.png`

  const { error: uploadError } = await supabase.storage
    .from('designs')
    .upload(fileName, imgBuffer, { contentType: 'image/png', upsert: false })
  if (uploadError) throw new Error(`Supabase Storage upload failed: ${uploadError.message}`)

  const { data: { publicUrl } } = supabase.storage.from('designs').getPublicUrl(fileName)
  console.log(`[Designer] Stored: ${publicUrl}`)

  // Step 5: Save to designs table
  const { data, error } = await supabase
    .from('designs')
    .insert({
      title,
      image_url: publicUrl,
      status: 'pending',
    })
    .select()
    .single()

  if (error) throw new Error(`Supabase insert failed: ${error.message}`)
  console.log(`[Designer] Saved design: ${data.id}`)

  return data as DesignRecord
}
