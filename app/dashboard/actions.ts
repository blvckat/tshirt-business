'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { DesignRecord } from '@/agents/designer'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://tshirt-business.vercel.app'

export async function approveDesign(design: DesignRecord) {
  const supabase = createClient()

  const { error } = await supabase
    .from('designs')
    .update({ status: 'approved', approved_at: new Date().toISOString() })
    .eq('id', design.id)

  if (error) throw new Error(`Failed to approve design: ${error.message}`)

  // Fire procurement as a background request — don't await so the dashboard
  // responds immediately. The API route runs with maxDuration = 300s.
  fetch(`${APP_URL}/api/procurement`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(design),
  }).catch((err) => console.error('[approveDesign] Procurement trigger failed:', err))

  revalidatePath('/dashboard')
}

export async function rejectDesign(id: string) {
  const supabase = createClient()

  const { error } = await supabase
    .from('designs')
    .update({ status: 'rejected' })
    .eq('id', id)

  if (error) throw new Error(`Failed to reject design: ${error.message}`)

  revalidatePath('/dashboard')
}
