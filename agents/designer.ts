import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

// Rotating visual styles — prevents repetitive neural net imagery
const VISUAL_STYLES = [
  {
    name: 'glitch portrait',
    description: 'A human face rendered with heavy digital glitch corruption — RGB channel separation pulling the eyes apart, scan lines slicing through the face, pixel fragmentation at the edges. The face is still recognizable but fractured by data errors. Raw and unsettling.',
  },
  {
    name: 'pixel figure',
    description: 'Bold chunky pixel art of a human silhouette or character — 16-bit video game aesthetic, very limited 3-color palette (white, black, one accent), large visible pixels, strong simple pose. Like a video game sprite blown up to poster size.',
  },
  {
    name: 'data body',
    description: 'A human figure or torso dissolving into a dense cloud of data points, particles, and scatter-plot dots — the body is only suggested by the density of particles, more solid at the core and dispersing at the edges into noise.',
  },
  {
    name: 'vintage computer art',
    description: 'A retrofuturist illustration in the style of 1980s computer manuals and early personal computing magazines — dot matrix printing texture, dithered shading, crude line art of a human or machine, CRT monitor color palette. Nostalgic and imperfect.',
  },
  {
    name: 'wireframe human',
    description: 'A human head, torso, or full figure rendered as a clean 3D wireframe mesh — precise white lines on black, the kind of geometry from early 3D CAD or cinema 4D, no fill, just the skeleton of the form in crisp mathematical lines.',
  },
  {
    name: 'corrupted everyday object',
    description: 'A mundane everyday object (coffee cup, sneaker, phone, hand, eye) rendered photorealistically but with severe digital corruption — JPEG artifacts, color banding, missing chunks replaced by solid color blocks, scan line interference. The familiar made strange.',
  },
  {
    name: 'ink meets digital',
    description: 'Bold sumi-e ink brush strokes of a human figure or face, but the ink is interrupted and corrupted by hard digital glitch blocks — the organic flow of ink paint colliding with cold pixel errors. East-meets-algorithm.',
  },
  {
    name: 'hand reaching',
    description: 'A single human hand or arm in a dramatic gesture — reaching upward, pointing, or open-palm — with thin circuit traces running up the veins like technology under skin. Minimal, centered, high contrast. The hand is the focus, no background.',
  },
  {
    name: 'brutalist data poster',
    description: 'Swiss/Bauhaus brutalist design — bold hard-edged geometric shapes (circles, rectangles, diagonal lines) arranged in a stark asymmetric composition. Black and white only, no gradients, graphic design that looks like it could be a protest poster or a Soviet-era geometric art piece.',
  },
  {
    name: 'surveillance aesthetic',
    description: 'Security camera or CCTV footage aesthetic — a human figure viewed from above or a face viewed through a surveillance lens, timestamp and camera ID overlaid, grainy low-resolution texture, wide-angle distortion at the edges. The feeling of being watched.',
  },
]

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

  // Pick a random visual style for this run
  const style = VISUAL_STYLES[Math.floor(Math.random() * VISUAL_STYLES.length)]

  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 400,
    messages: [
      {
        role: 'user',
        content: `You are an art director for BLVCKCAT.AI — an AI-culture streetwear brand. Motto: "Built by algorithms. Worn by real ones."

Theme: "${theme}"
Visual style to use: "${style.name}" — ${style.description}

Create a DALL-E 3 image prompt for a minimal graphic t-shirt design using EXACTLY the visual style described above. Do not default to neural networks or circuit boards unless that is the specified style.

Rules:
- Use the specified visual style — this is mandatory
- Pure visual/graphic only — NO text, NO words, NO letters, NO numbers in the image
- White or light-colored graphic designed to sit on a black shirt
- High contrast, minimal, bold — Supreme-level graphic impact
- White background for the generated image
- The composition should be centered, roughly 60-70% of the frame

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

  const url = response.data?.[0]?.url
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
