import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'

async function fetchSummary() {
  const supabase = createClient()

  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const weekAgoDate = weekAgo.toISOString().split('T')[0]

  const [summariesRes, productsRes] = await Promise.all([
    supabase
      .from('daily_summaries')
      .select('sales_count, revenue, top_seller')
      .gte('date', weekAgoDate),
    supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .not('shopify_id', 'is', null),
  ])

  const summaries = summariesRes.data ?? []
  const totalOrders = summaries.reduce((sum, r) => sum + (r.sales_count ?? 0), 0)
  const totalRevenue = summaries.reduce((sum, r) => sum + Number(r.revenue ?? 0), 0)
  const activeProducts = productsRes.count ?? 0

  // Find the top_seller product ID that appears most frequently this week
  const tally: Record<string, number> = {}
  for (const row of summaries) {
    if (row.top_seller) tally[row.top_seller] = (tally[row.top_seller] ?? 0) + 1
  }
  const topSellerId = Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0] ?? null

  let bestSeller: { title: string; image_url: string } | null = null
  if (topSellerId) {
    const { data } = await supabase
      .from('products')
      .select('design_id, designs(title, image_url)')
      .eq('id', topSellerId)
      .single()

    const design = data?.designs as unknown as { title: string; image_url: string } | null
    if (design) bestSeller = design
  }

  return { totalOrders, totalRevenue, activeProducts, bestSeller }
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-1">
      <p className="text-zinc-400 text-xs uppercase tracking-widest">{label}</p>
      <p className="text-white text-2xl font-bold">{value}</p>
    </div>
  )
}

export default async function SalesSummary() {
  const { totalOrders, totalRevenue, activeProducts, bestSeller } = await fetchSummary()

  return (
    <section className="mb-10">
      <h2 className="text-lg font-semibold text-white mb-4">This Week</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Orders" value={totalOrders.toLocaleString()} />
        <StatCard
          label="Revenue"
          value={`$${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        />
        <StatCard label="Active Products" value={activeProducts.toLocaleString()} />

        {/* Best seller spans last column — or full row on mobile */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex items-center gap-3 col-span-2 lg:col-span-1">
          {bestSeller ? (
            <>
              <div className="relative w-12 h-12 shrink-0 rounded-lg overflow-hidden bg-zinc-800">
                <Image
                  src={bestSeller.image_url}
                  alt={bestSeller.title}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
              <div className="min-w-0">
                <p className="text-zinc-400 text-xs uppercase tracking-widest mb-0.5">Best Seller</p>
                <p className="text-white text-sm font-semibold truncate">{bestSeller.title}</p>
              </div>
            </>
          ) : (
            <div>
              <p className="text-zinc-400 text-xs uppercase tracking-widest mb-0.5">Best Seller</p>
              <p className="text-zinc-600 text-sm">No data yet</p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
