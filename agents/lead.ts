import { Resend } from 'resend'
import { runTrendsAgent, TrendResult } from './trends'
import { runDesignerAgent, DesignRecord } from './designer'
import { runAnalyticsAgent, SalesSummary } from './analytics'
import { buildDailySummaryEmail } from '@/lib/email'
import { createClient } from '@/lib/supabase/server'

export interface LeadAgentResult {
  date: string
  trendsFound: number
  designsCreated: number
  sales: SalesSummary
  emailSent: boolean
  errors: string[]
}

async function updateDailyDesignCount(date: string, count: number) {
  const supabase = createClient()
  await supabase
    .from('daily_summaries')
    .upsert({ date, new_designs: count }, { onConflict: 'date' })
}

async function sendSummaryEmail(
  summary: SalesSummary,
  designs: DesignRecord[]
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL
  const toEmail = process.env.ALERT_EMAIL

  if (!apiKey || !fromEmail || !toEmail ||
      fromEmail === 'your_verified_sender@yourdomain.com') {
    console.warn('[Lead] Resend not configured — skipping email')
    return false
  }

  const resend = new Resend(apiKey)
  const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://tshirt-business.vercel.app'}/dashboard`
  const { subject, html } = buildDailySummaryEmail(summary, designs, dashboardUrl)

  const { error } = await resend.emails.send({
    from: fromEmail,
    to: toEmail,
    subject,
    html,
  })

  if (error) {
    console.error('[Lead] Email send failed:', error)
    return false
  }

  console.log(`[Lead] Daily summary email sent to ${toEmail}`)
  return true
}

export async function runLeadAgent(): Promise<LeadAgentResult> {
  const today = new Date().toISOString().split('T')[0]
  const errors: string[] = []

  console.log(`\n[Lead] ===== Daily Run: ${today} =====`)

  // Step 1: Get today's top 3 trends
  console.log('[Lead] Step 1: Fetching trends...')
  let trends: TrendResult[] = []
  try {
    const allTrends = await runTrendsAgent()
    trends = allTrends.slice(0, 3)
    console.log(`[Lead] Top 3 trends: ${trends.map(t => t.keyword).join(', ')}`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    errors.push(`Trends agent failed: ${msg}`)
    console.error('[Lead] Trends failed:', msg)
  }

  // Step 2: Generate a design for each trend (in parallel)
  console.log('[Lead] Step 2: Generating designs...')
  const designs: DesignRecord[] = []

  await Promise.allSettled(
    trends.map(async (trend) => {
      try {
        const design = await runDesignerAgent(trend.keyword)
        designs.push(design)
        console.log(`[Lead] Design created: "${design.title}"`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`Design failed for "${trend.keyword}": ${msg}`)
        console.error(`[Lead] Design failed for "${trend.keyword}":`, msg)
      }
    })
  )

  // Step 3: Update today's design count in daily_summaries
  if (designs.length > 0) {
    await updateDailyDesignCount(today, designs.length).catch(() => {})
  }

  // Step 4: Run analytics agent (yesterday's sales)
  console.log('[Lead] Step 4: Running analytics...')
  let sales: SalesSummary = {
    date: today,
    salesCount: 0,
    revenue: 0,
    topSellerId: null,
    topSellerTitle: null,
    alerts: [],
  }
  try {
    sales = await runAnalyticsAgent()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    errors.push(`Analytics agent failed: ${msg}`)
    console.error('[Lead] Analytics failed:', msg)
  }

  // Add any lead-level errors as alerts in the email
  if (errors.length > 0) {
    sales.alerts.push(...errors.map(e => `Run error: ${e}`))
  }

  // Step 5: Send daily summary email
  console.log('[Lead] Step 5: Sending email...')
  const emailSent = await sendSummaryEmail(sales, designs)

  const result: LeadAgentResult = {
    date: today,
    trendsFound: trends.length,
    designsCreated: designs.length,
    sales,
    emailSent,
    errors,
  }

  console.log('[Lead] ===== Done =====')
  console.log(`[Lead] Trends: ${result.trendsFound}, Designs: ${result.designsCreated}, Email: ${result.emailSent}`)

  return result
}
