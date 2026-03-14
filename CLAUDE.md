# BLVCKCAT.AI — Project Instructions

## Stack
- Next.js 14 (App Router), TypeScript, Tailwind CSS
- Supabase (Postgres DB + file storage)
- Package manager: **npm**

## Project Root
`/Users/blvckcat/Projects/tshirt-business`

## Key Files
- `agents/designer.ts` — DALL-E 3 image generation, uploads to Supabase Storage
- `agents/trends.ts` — Claude web search for AI-culture trend keywords
- `agents/procurement.ts` — Printify product creation + Shopify publish
- `agents/marketing.ts` — Claude copy generation + X/Instagram posting
- `agents/analytics.ts` — Shopify sales pull, margin alerts, daily summary
- `agents/lead.ts` — Orchestrator: runs all agents, sends daily email
- `app/api/daily-designs/route.ts` — Cron endpoint: trends → 3 designs at 7 AM
- `app/api/generate-design/route.ts` — Manual design generation
- `app/api/procurement/route.ts` — Triggered on design approval
- `app/api/post-social/route.ts` — Manual social post trigger
- `app/dashboard/` — Internal dashboard (pending designs, sales, marketing copy)
- `app/(shop)/` — Customer-facing storefront
- `components/CartContext.tsx` — Cart state (localStorage-persisted)
- `components/ShopNav.tsx` — Fixed top nav with bag icon
- `components/CartDrawer.tsx` — Slide-in cart panel
- `lib/supabase/client.ts` — Browser Supabase client
- `lib/supabase/server.ts` — Server Supabase client (cookie-based)
- `lib/fonts/` — DancingScript, IBMPlexMono, BebasNeue (woff2, for Sharp rendering)
- `vercel.json` — Cron schedule (7 AM daily)

## Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
OPENAI_API_KEY
ANTHROPIC_API_KEY
PRINTIFY_API_TOKEN
SHOPIFY_STORE_URL
SHOPIFY_ACCESS_TOKEN
RESEND_API_KEY
RESEND_FROM_EMAIL
ALERT_EMAIL
TWITTER_API_KEY
TWITTER_API_SECRET
TWITTER_ACCESS_TOKEN
TWITTER_ACCESS_SECRET
INSTAGRAM_ACCESS_TOKEN
INSTAGRAM_BUSINESS_ACCOUNT_ID
CRON_SECRET
NEXT_PUBLIC_APP_URL
```

## Brand
- Name: BLVCKCAT.AI
- Motto: "Built by algorithms. Worn by real ones."
- Aesthetic: Fear of God ESSENTIALS — minimal luxury streetwear
- Product: Black Gildan 64000 tee, white graphic, $29.99
- Printify blueprint 145, provider 29 (Monster Digital)
- Black variant IDs: `[38164, 38178, 38192, 38206, 38220, 42122]`

## Design Pipeline
1. Trends agent searches for AI-culture keywords (8 results, 5 angle categories)
2. Designer agent picks 1 of 10 rotating visual styles, writes DALL-E 3 prompt (NO text in image), generates + saves PNG
3. Designs sit as `pending` until approved in `/dashboard`
4. On approval → Procurement agent (Printify + Shopify) → Marketing agent (copy + social posts)

## Visual Styles (designer.ts rotation)
glitch portrait · pixel figure · data body · vintage computer art · wireframe human · corrupted everyday object · ink meets digital · hand reaching · brutalist data poster · surveillance aesthetic

## Coding Conventions
- Always use `createClient()` from `@/lib/supabase/server` in server components/routes
- Always use `createBrowserClient()` from `@/lib/supabase/client` in client components
- Price stored in DB as **dollars** (29.99), not cents
- All agent functions are named `run[Name]Agent()`
- Cron routes export both `GET` and `POST` (Vercel sends GET)
