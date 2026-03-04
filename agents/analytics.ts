import { createClient } from '@/lib/supabase/server'

export interface SalesSummary {
  date: string
  salesCount: number
  revenue: number
  topSellerId: string | null
  topSellerTitle: string | null
  alerts: string[]
}

async function fetchShopifyOrders(date: string): Promise<{ count: number; revenue: number; topProductId: string | null }> {
  const storeUrl = process.env.SHOPIFY_STORE_URL
  const accessToken = process.env.SHOPIFY_ACCESS_TOKEN

  if (!storeUrl || !accessToken || storeUrl === 'your-store.myshopify.com') {
    console.warn('[Analytics] Shopify credentials not configured — using zero values')
    return { count: 0, revenue: 0, topProductId: null }
  }

  const start = `${date}T00:00:00Z`
  const end = `${date}T23:59:59Z`

  const res = await fetch(
    `https://${storeUrl}/admin/api/2024-01/orders.json?status=any&created_at_min=${start}&created_at_max=${end}&limit=250`,
    {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    }
  )

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Shopify API error ${res.status}: ${text}`)
  }

  const { orders } = await res.json()

  const revenue = orders.reduce(
    (sum: number, o: { total_price: string }) => sum + parseFloat(o.total_price),
    0
  )

  // Tally which product variant appeared most in line items
  const tally: Record<string, number> = {}
  for (const order of orders) {
    for (const item of order.line_items ?? []) {
      const pid = String(item.product_id)
      tally[pid] = (tally[pid] ?? 0) + item.quantity
    }
  }
  const topShopifyId = Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0] ?? null

  return { count: orders.length, revenue, topProductId: topShopifyId }
}

export async function runAnalyticsAgent(): Promise<SalesSummary> {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const date = yesterday.toISOString().split('T')[0]

  console.log(`[Analytics] Pulling sales for ${date}...`)

  const supabase = createClient()
  const alerts: string[] = []

  const { count, revenue, topProductId } = await fetchShopifyOrders(date)
  console.log(`[Analytics] Orders: ${count}, Revenue: $${revenue.toFixed(2)}`)

  // Resolve top seller product from Supabase using Shopify product ID
  let topSellerId: string | null = null
  let topSellerTitle: string | null = null

  if (topProductId) {
    const { data } = await supabase
      .from('products')
      .select('id, designs(title)')
      .eq('shopify_id', topProductId)
      .single()

    if (data) {
      topSellerId = data.id
      topSellerTitle = (data.designs as unknown as { title: string } | null)?.title ?? null
    }
  }

  // Check margins on all active products
  const { data: products } = await supabase
    .from('products')
    .select('id, price, cost, designs(title)')
    .not('shopify_id', 'is', null)

  for (const p of products ?? []) {
    const margin = ((p.price - p.cost) / p.price) * 100
    if (margin < 40) {
      const title = (p.designs as unknown as { title: string } | null)?.title ?? p.id
      alerts.push(`Low margin alert: "${title}" is at ${margin.toFixed(0)}% margin`)
    }
  }

  if (count === 0) alerts.push(`No sales recorded for ${date}`)

  // Upsert daily summary
  const { error } = await supabase.from('daily_summaries').upsert(
    {
      date,
      sales_count: count,
      revenue,
      new_designs: 0, // updated by lead agent after designs are generated
      top_seller: topSellerId,
    },
    { onConflict: 'date' }
  )

  if (error) throw new Error(`Failed to save daily summary: ${error.message}`)
  console.log(`[Analytics] Summary saved for ${date}`)

  return { date, salesCount: count, revenue, topSellerId, topSellerTitle, alerts }
}
