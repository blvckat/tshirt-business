import Anthropic from '@anthropic-ai/sdk'
import sharp from 'sharp'
import fs from 'fs'
import path from 'path'
import { createClient } from '@/lib/supabase/server'

export interface DesignRecord {
  id: string
  title: string
  image_url: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  approved_at: string | null
}

interface TextElements {
  human: string
  machine: string
  qualifier: string
}

// Load fonts once as base64 (works on Vercel — files included in deployment)
function loadFonts() {
  const fontsDir = path.join(process.cwd(), 'lib/fonts')
  return {
    dancing: fs.readFileSync(path.join(fontsDir, 'DancingScript-Regular.woff2')).toString('base64'),
    mono:    fs.readFileSync(path.join(fontsDir, 'IBMPlexMono-Regular.woff2')).toString('base64'),
    bebas:   fs.readFileSync(path.join(fontsDir, 'BebasNeue.woff2')).toString('base64'),
  }
}

// Use Claude to generate the three text elements for the contrast design
async function buildTextElements(theme: string): Promise<TextElements> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 120,
    messages: [
      {
        role: 'user',
        content: `You are a copywriter for BLVCKCAT.AI — an AI-culture streetwear brand. Motto: "Built by algorithms. Worn by real ones."

Given the theme "${theme}", generate three text elements for a contrast t-shirt design:

1. "human" — short lowercase warm phrase (2–4 words), handwritten feel. e.g. "still human", "kind of here", "i remember this"
2. "machine" — cold ALL-CAPS monospace reframe (1–3 words). e.g. "FOR NOW", "UPDATING...", "DEPRECATED"
3. "qualifier" — one small lowercase word of doubt or irony. e.g. "probably", "mostly", "pending"

Return ONLY valid JSON: {"human": "...", "machine": "...", "qualifier": "..."}`,
      },
    ],
  })

  const block = msg.content[0]
  if (block.type !== 'text') throw new Error('Unexpected response from Claude')
  const match = block.text.trim().match(/\{[\s\S]*\}/)
  if (!match) throw new Error(`Could not parse text elements: ${block.text}`)
  return JSON.parse(match[0]) as TextElements
}

// Render the contrast design using Sharp + SVG (guaranteed correct spelling)
async function renderDesign(elements: TextElements): Promise<Buffer> {
  const { dancing, mono } = loadFonts()

  const W = 1200
  const H = 1500
  const CX = W / 2

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs>
      <style>
        @font-face {
          font-family: 'DancingScript';
          src: url('data:font/woff2;base64,${dancing}') format('woff2');
        }
        @font-face {
          font-family: 'IBMPlexMono';
          src: url('data:font/woff2;base64,${mono}') format('woff2');
        }
      </style>
    </defs>

    <!-- Transparent background — sits cleanly on any shirt color -->

    <!-- Human phrase — warm handwritten script -->
    <text
      x="${CX}" y="610"
      font-family="DancingScript" font-size="148"
      fill="#e8e0d0" text-anchor="middle"
    >${elements.human}</text>

    <!-- Thin rule -->
    <line
      x1="${CX - 130}" y1="658"
      x2="${CX + 130}" y2="658"
      stroke="#e8e0d0" stroke-width="1.2" opacity="0.6"
    />

    <!-- Machine phrase — cold spaced monospace -->
    <text
      x="${CX}" y="728"
      font-family="IBMPlexMono" font-size="28"
      fill="#e8e0d0" text-anchor="middle"
      letter-spacing="14" opacity="0.9"
    >${elements.machine}</text>

    <!-- Qualifier — small italic -->
    <text
      x="${CX}" y="800"
      font-family="DancingScript" font-size="72"
      fill="#e8e0d0" text-anchor="middle" opacity="0.75"
    >${elements.qualifier}</text>
  </svg>`

  return sharp(Buffer.from(svg)).png().toBuffer()
}

// Generate a title from the text elements
function buildTitle(elements: TextElements): string {
  return `${elements.human} / ${elements.machine}`
}

export async function runDesignerAgent(theme: string): Promise<DesignRecord> {
  console.log(`[Designer] Theme: "${theme}"`)

  // Step 1: Generate text elements via Claude
  const elements = await buildTextElements(theme)
  console.log(`[Designer] Text: "${elements.human}" / "${elements.machine}" / "${elements.qualifier}"`)

  // Step 2: Render design with Sharp (guaranteed spelling)
  const imgBuffer = await renderDesign(elements)
  console.log(`[Designer] Rendered PNG: ${(imgBuffer.length / 1024).toFixed(0)}KB`)

  // Step 3: Upload to Supabase Storage
  const supabase = createClient()
  const fileName = `${Date.now()}.png`

  const { error: uploadError } = await supabase.storage
    .from('designs')
    .upload(fileName, imgBuffer, { contentType: 'image/png', upsert: false })
  if (uploadError) throw new Error(`Supabase Storage upload failed: ${uploadError.message}`)

  const { data: { publicUrl } } = supabase.storage.from('designs').getPublicUrl(fileName)
  console.log(`[Designer] Stored: ${publicUrl}`)

  // Step 4: Save to designs table
  const { data, error } = await supabase
    .from('designs')
    .insert({
      title: buildTitle(elements),
      image_url: publicUrl,
      status: 'pending',
    })
    .select()
    .single()

  if (error) throw new Error(`Supabase insert failed: ${error.message}`)
  console.log(`[Designer] Saved design: ${data.id}`)

  return data as DesignRecord
}
