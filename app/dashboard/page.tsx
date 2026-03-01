import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { DesignRecord } from '@/agents/designer'
import DesignCard from './DesignCard'
import SalesSummary from './SalesSummary'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = createClient()

  const { data: designs, error } = await supabase
    .from('designs')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

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
