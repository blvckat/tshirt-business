import sharp from 'sharp'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const env = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8')
const get = key => env.match(new RegExp(key + '=(.+)'))?.[1]?.trim()

const SUPABASE_URL = get('NEXT_PUBLIC_SUPABASE_URL')
const SUPABASE_KEY = get('NEXT_PUBLIC_SUPABASE_ANON_KEY')

const bebasB64 = fs.readFileSync(path.join(__dirname, 'fonts/BebasNeue.woff2')).toString('base64')
const monoB64  = fs.readFileSync(path.join(__dirname, 'fonts/IBMPlexMono-Regular.woff2')).toString('base64')

const W = 1200
const H = 1500
const CX = W / 2

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <style>
      @font-face {
        font-family: 'BebasNeue';
        src: url('data:font/woff2;base64,${bebasB64}') format('woff2');
      }
      @font-face {
        font-family: 'IBMPlexMono';
        src: url('data:font/woff2;base64,${monoB64}') format('woff2');
      }
    </style>
  </defs>


  <!-- "// input" — small dim monospace, upper area -->
  <text
    x="${CX}" y="420"
    font-family="IBMPlexMono" font-size="32"
    fill="#ffffff" opacity="0.35"
    text-anchor="middle" letter-spacing="6"
  >// input</text>

  <!-- "PROMPT" — massive bold condensed, full width -->
  <text
    x="${CX}" y="780"
    font-family="BebasNeue" font-size="310"
    fill="#ffffff" opacity="1"
    text-anchor="middle"
  >PROMPT</text>

  <!-- "_ awaiting input" — small dim monospace, lower area -->
  <text
    x="${CX}" y="1060"
    font-family="IBMPlexMono" font-size="28"
    fill="#ffffff" opacity="0.35"
    text-anchor="middle" letter-spacing="8"
  >_ awaiting input</text>

</svg>`

async function run() {
  console.log('Rendering PROMPT...')
  const png = await sharp(Buffer.from(svg)).png().toBuffer()
  console.log(`PNG: ${(png.length / 1024).toFixed(0)}KB`)

  const fileName = `prompt-${Date.now()}.png`
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
  const dbRes = await fetch(`${SUPABASE_URL}/rest/v1/designs`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'apikey': SUPABASE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({ title: 'Prompt', image_url: publicUrl, status: 'pending' })
  })
  const db = await dbRes.json()
  console.log('Saved:', db[0]?.id)
  console.log('URL:', publicUrl)
}

run().catch(console.error)
