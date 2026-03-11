'use client'

import { useState } from 'react'
import Image from 'next/image'

interface AdCopy {
  platform: string
  copy: string
}

interface MarketingEntry {
  id: string
  product_title: string
  description: string
  bullet_points: string[]
  ad_copies: AdCopy[]
  hashtags: string[]
  x_posted_at: string | null
  instagram_posted_at: string | null
  image_url: string
}

function PostButton({
  copyId,
  platform,
  postedAt,
}: {
  copyId: string
  platform: 'x' | 'instagram'
  postedAt: string | null
}) {
  const [status, setStatus] = useState<'idle' | 'posting' | 'done' | 'error'>(
    postedAt ? 'done' : 'idle'
  )
  const [postedTime, setPostedTime] = useState(postedAt)

  async function handlePost() {
    setStatus('posting')
    try {
      const res = await fetch('/api/post-social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ copyId, platform }),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error)
      }
      setPostedTime(new Date().toISOString())
      setStatus('done')
    } catch (err) {
      console.error(err)
      setStatus('error')
      setTimeout(() => setStatus('idle'), 3000)
    }
  }

  const label = platform === 'x' ? 'Post to X' : 'Post to IG'
  const icon = platform === 'x' ? '𝕏' : '◈'

  if (status === 'done') {
    return (
      <span className="text-xs text-zinc-500 flex items-center gap-1">
        {icon} Posted {postedTime ? new Date(postedTime).toLocaleDateString() : ''}
      </span>
    )
  }

  return (
    <button
      onClick={handlePost}
      disabled={status === 'posting'}
      className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
        status === 'error'
          ? 'border-red-500 text-red-400'
          : 'border-zinc-600 text-zinc-300 hover:border-white hover:text-white disabled:opacity-40'
      }`}
    >
      {status === 'posting' ? 'Posting…' : status === 'error' ? 'Failed' : `${icon} ${label}`}
    </button>
  )
}

function MarketingCard({ entry }: { entry: MarketingEntry }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
      {/* Header row */}
      <div className="flex items-center gap-4 p-4">
        <div className="relative w-14 h-14 shrink-0 rounded-lg overflow-hidden bg-zinc-800">
          <Image src={entry.image_url} alt={entry.product_title} fill className="object-cover" unoptimized />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm truncate">{entry.product_title}</p>
          <div className="flex flex-wrap gap-2 mt-1.5">
            <PostButton copyId={entry.id} platform="x" postedAt={entry.x_posted_at} />
            <PostButton copyId={entry.id} platform="instagram" postedAt={entry.instagram_posted_at} />
          </div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-zinc-500 hover:text-white transition-colors text-sm"
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? '▲' : '▼'}
        </button>
      </div>

      {/* Expanded copy */}
      {expanded && (
        <div className="border-t border-zinc-800 p-4 space-y-5">
          {/* Description */}
          <div>
            <p className="text-zinc-500 text-xs uppercase tracking-widest mb-1">Description</p>
            <p className="text-zinc-300 text-sm leading-relaxed">{entry.description}</p>
          </div>

          {/* Ad copies */}
          <div>
            <p className="text-zinc-500 text-xs uppercase tracking-widest mb-2">Ad Copies</p>
            <div className="space-y-2">
              {entry.ad_copies?.map((ad) => (
                <div key={ad.platform} className="bg-zinc-800 rounded-xl p-3">
                  <p className="text-zinc-400 text-xs uppercase tracking-wider mb-1">{ad.platform}</p>
                  <p className="text-zinc-200 text-sm leading-snug">{ad.copy}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Hashtags */}
          <div>
            <p className="text-zinc-500 text-xs uppercase tracking-widest mb-2">Hashtags</p>
            <div className="flex flex-wrap gap-1.5">
              {entry.hashtags?.map((tag) => (
                <span key={tag} className="text-xs bg-zinc-800 text-zinc-300 px-2 py-1 rounded-lg">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function MarketingPanel({ entries }: { entries: MarketingEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="border border-zinc-800 rounded-2xl p-8 text-center text-zinc-500">
        <p className="text-sm">No marketing copy yet — approve a design to generate copy.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {entries.map((entry) => (
        <MarketingCard key={entry.id} entry={entry} />
      ))}
    </div>
  )
}
