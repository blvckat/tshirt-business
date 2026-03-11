import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { DesignRecord } from '@/agents/designer'
import DesignCard from './DesignCard'
import SalesSummary from './SalesSummary'
import MarketingPanel from './MarketingPanel'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = createClient()

  const [{ data: designs, error }, { data: marketingRaw }] = await Promise.all([
    supabase
      .from('designs')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),
    supabase
      .from('marketing_copy')
      .select('id, product_title, description, bullet_points, ad_copies, hashtags, x_posted_at, instagram_posted_at, products(design_id, designs(image_url))')
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  type RawMarketing = {
    id: string; product_title: string; description: string
    bullet_points: string[]; ad_copies: { platform: string; copy: string }[]
    hashtags: string[]; x_posted_at: string | null; instagram_posted_at: string | null
    products: { designs: { image_url: string } | null } | null
  }
  const marketingEntries = (marketingRaw as unknown as RawMarketing[] ?? []).map((m) => ({
    id: m.id,
    product_title: m.product_title,
    description: m.description,
    bullet_points: m.bullet_points,
    ad_copies: m.ad_copies,
    hashtags: m.hashtags,
    x_posted_at: m.x_posted_at,
    instagram_posted_at: m.instagram_posted_at,
    image_url: m.products?.designs?.image_url ?? '',
  }))

  if (error) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <p className="text-red-400">Failed to load designs: {error.message}</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold tracking-tight mb-8">Dashboard</h1>

        <Suspense fallback={<SalesSummarySkeleton />}>
          <SalesSummary />
        </Suspense>

        <div className="mb-4">
          <h2 className="text-lg font-semibold text-white">Design Review</h2>
          <p className="text-zinc-400 mt-1 text-sm">
            {designs.length === 0
              ? 'No pending designs.'
              : `${designs.length} design${designs.length !== 1 ? 's' : ''} awaiting review`}
          </p>
        </div>

        {designs.length === 0 ? (
          <div className="border border-zinc-800 rounded-2xl p-12 text-center text-zinc-500">
            <p className="text-lg">All caught up</p>
            <p className="text-sm mt-1">Generate new designs to see them here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {designs.map((design) => (
              <DesignCard key={design.id} design={design as DesignRecord} />
            ))}
          </div>
        )}

        {/* Marketing Copy */}
        <div className="mt-12 mb-4">
          <h2 className="text-lg font-semibold text-white">Marketing Copy</h2>
          <p className="text-zinc-400 mt-1 text-sm">Ad copy, post to X and Instagram directly from here.</p>
        </div>
        <MarketingPanel entries={marketingEntries} />
      </div>
    </main>
  )
}

function SalesSummarySkeleton() {
  return (
    <section className="mb-10">
      <div className="h-5 w-24 bg-zinc-800 rounded mb-4 animate-pulse" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 h-20 animate-pulse" />
        ))}
      </div>
    </section>
  )
}
