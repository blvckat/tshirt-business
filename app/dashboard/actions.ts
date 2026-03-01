'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { runProcurementAgent } from '@/agents/procurement'
import { DesignRecord } from '@/agents/designer'

export async function approveDesign(design: DesignRecord) {
  const supabase = createClient()

  const { error } = await supabase
    .from('designs')
    .update({ status: 'approved', approved_at: new Date().toISOString() })
    .eq('id', design.id)

  if (error) throw new Error(`Failed to approve design: ${error.message}`)

  await runProcurementAgent(design)

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
