'use client'

import { useState } from 'react'
import Image from 'next/image'
import { approveDesign, rejectDesign } from './actions'
import { DesignRecord } from '@/agents/designer'

export default function DesignCard({ design }: { design: DesignRecord }) {
  const [status, setStatus] = useState<'idle' | 'approving' | 'rejecting' | 'done'>('idle')

  if (status === 'done') return null

  const handleApprove = async () => {
    setStatus('approving')
    try {
      await approveDesign(design)
      setStatus('done')
    } catch (err) {
      console.error(err)
      setStatus('idle')
    }
  }

  const handleReject = async () => {
    setStatus('rejecting')
    try {
      await rejectDesign(design.id)
      setStatus('done')
    } catch (err) {
      console.error(err)
      setStatus('idle')
    }
  }

  const createdAt = new Date(design.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const busy = status === 'approving' || status === 'rejecting'

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col">
      <div className="relative aspect-square w-full bg-zinc-950">
        <Image
          src={design.image_url}
          alt={design.title}
          fill
          className="object-cover"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          unoptimized // DALL-E URLs are signed and external
        />
      </div>

      <div className="p-4 flex flex-col gap-3 flex-1">
        <div>
          <h2 className="text-white font-semibold text-base leading-snug">{design.title}</h2>
          <p className="text-zinc-500 text-xs mt-1">{createdAt}</p>
        </div>

        <div className="flex gap-2 mt-auto">
          <button
            onClick={handleApprove}
            disabled={busy}
            className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
          >
            {status === 'approving' ? 'Approving…' : 'Approve'}
          </button>
          <button
            onClick={handleReject}
            disabled={busy}
            className="flex-1 bg-red-700 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
          >
            {status === 'rejecting' ? 'Rejecting…' : 'Reject'}
          </button>
        </div>
      </div>
    </div>
  )
}
