import sharp from 'sharp'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const env = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8')
const get = key => env.match(new RegExp(key + '=(.+)'))?.[1]?.trim()

const SUPABASE_URL = get('NEXT_PUBLIC_SUPABASE_URL')
const SUPABASE_KEY = get('NEXT_PUBLIC_SUPABASE_ANON_KEY')

// Load fonts as base64
const dancingB64 = fs.readFileSync(path.join(__dirname, 'fonts/DancingScript-Regular.woff2')).toString('base64')
const monoB64    = fs.readFileSync(path.join(__dirname, 'fonts/IBMPlexMono-Regular.woff2')).toString('base64')

const WIDTH  = 1200
const HEIGHT = 1500

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <style>
      @font-face {
        font-family: 'DancingScript';
        src: url('data:font/woff2;base64,${dancingB64}') format('woff2');
      }
      @font-face {
        font-family: 'IBMPlexMono';
        src: url('data:font/woff2;base64,${monoB64}') format('woff2');
      }
    </style>
  </defs>


  <!-- "still human" — handwritten script -->
  <text
    x="${WIDTH / 2}" y="610"
    font-family="DancingScript"
    font-size="148"
    fill="#e8e0d0"
    text-anchor="middle"
    dominant-baseline="auto"
  >still human</text>

  <!-- thin rule -->
  <line
    x1="${WIDTH / 2 - 130}" y1="660"
    x2="${WIDTH / 2 + 130}" y2="660"
    stroke="#e8e0d0" stroke-width="1.2" opacity="0.6"
  />

  <!-- "FOR NOW" — spaced monospace -->
  <text
    x="${WIDTH / 2}" y="730"
    font-family="IBMPlexMono"
    font-size="28"
    fill="#e8e0d0"
    text-anchor="middle"
    letter-spacing="14"
    opacity="0.9"
  >FOR NOW</text>

  <!-- "probably" — italic script -->
  <text
    x="${WIDTH / 2}" y="800"
    font-family="DancingScript"
    font-size="72"
    fill="#e8e0d0"
    text-anchor="middle"
    opacity="0.75"
  >probably</text>
</svg>`

async function run() {
  console.log('Rendering SVG → PNG...')
  const png = await sharp(Buffer.from(svg)).png().toBuffer()
  console.log(`PNG size: ${(png.length / 1024).toFixed(0)}KB`)

  // Upload to Supabase Storage
  const fileName = `still-human-${Date.now()}.png`
  const upRes = await fetch(`${SUPABASE_URL}/storage/v1/object/designs/${fileName}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'apikey': SUPABASE_KEY,
      'Content-Type': 'image/png',
    },
    body: png
  })
  if (!upRes.ok) { console.error('Upload failed:', await upRes.text()); process.exit(1) }

  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/designs/${fileName}`

  // Save to designs table
  const dbRes = await fetch(`${SUPABASE_URL}/rest/v1/designs`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'apikey': SUPABASE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({ title: 'Still Human For Now', image_url: publicUrl, status: 'pending' })
  })
  const db = await dbRes.json()
  console.log('Saved design:', db[0]?.id)
  console.log('URL:', publicUrl)
}

run().catch(console.error)
