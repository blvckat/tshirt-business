import { DesignRecord } from '@/agents/designer'
import { SalesSummary } from '@/agents/analytics'

export function buildDailySummaryEmail(
  summary: SalesSummary,
  designs: DesignRecord[],
  dashboardUrl: string
): { subject: string; html: string } {
  const date = new Date(summary.date).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })

  const subject = `Your Daily Business Update - ${date}`

  const alertsHtml = summary.alerts.length
    ? `
      <div style="background:#7f1d1d;border-left:4px solid #ef4444;padding:12px 16px;border-radius:6px;margin:16px 0">
        <p style="color:#fca5a5;font-weight:700;margin:0 0 8px">⚠️ Alerts</p>
        ${summary.alerts.map(a => `<p style="color:#fca5a5;margin:4px 0;font-size:14px">• ${a}</p>`).join('')}
      </div>`
    : ''

  const designsHtml = designs.length
    ? `
      <h2 style="color:#f4f4f5;font-size:18px;margin:32px 0 12px">🎨 New Designs Awaiting Approval (${designs.length})</h2>
      <div style="display:flex;flex-wrap:wrap;gap:16px">
        ${designs.map(d => `
          <div style="background:#27272a;border-radius:10px;overflow:hidden;width:160px">
            <img src="${d.image_url}" width="160" height="160" style="display:block;object-fit:cover" alt="${d.title}" />
            <div style="padding:10px">
              <p style="color:#f4f4f5;font-size:13px;font-weight:600;margin:0">${d.title}</p>
            </div>
          </div>`).join('')}
      </div>`
    : '<p style="color:#71717a">No new designs were generated today.</p>'

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px">

    <!-- Header -->
    <div style="margin-bottom:32px">
      <h1 style="color:#f4f4f5;font-size:24px;font-weight:700;margin:0">Daily Business Update</h1>
      <p style="color:#71717a;margin:4px 0 0;font-size:14px">${date}</p>
    </div>

    <!-- Sales Summary -->
    <h2 style="color:#f4f4f5;font-size:18px;margin:0 0 12px">📊 Yesterday's Sales</h2>
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:8px">
      <div style="background:#27272a;border-radius:10px;padding:16px 20px;min-width:120px">
        <p style="color:#71717a;font-size:11px;text-transform:uppercase;letter-spacing:.08em;margin:0 0 4px">Orders</p>
        <p style="color:#f4f4f5;font-size:28px;font-weight:700;margin:0">${summary.salesCount}</p>
      </div>
      <div style="background:#27272a;border-radius:10px;padding:16px 20px;min-width:120px">
        <p style="color:#71717a;font-size:11px;text-transform:uppercase;letter-spacing:.08em;margin:0 0 4px">Revenue</p>
        <p style="color:#f4f4f5;font-size:28px;font-weight:700;margin:0">$${summary.revenue.toFixed(2)}</p>
      </div>
      ${summary.topSellerTitle ? `
      <div style="background:#27272a;border-radius:10px;padding:16px 20px;flex:1;min-width:160px">
        <p style="color:#71717a;font-size:11px;text-transform:uppercase;letter-spacing:.08em;margin:0 0 4px">Best Seller</p>
        <p style="color:#f4f4f5;font-size:16px;font-weight:700;margin:0">${summary.topSellerTitle}</p>
      </div>` : ''}
    </div>

    ${alertsHtml}
    ${designsHtml}

    <!-- CTA -->
    <div style="margin:32px 0">
      <a href="${dashboardUrl}"
         style="display:inline-block;background:#22c55e;color:#fff;font-weight:700;font-size:15px;padding:14px 28px;border-radius:10px;text-decoration:none">
        Review & Approve Designs →
      </a>
    </div>

    <!-- Footer -->
    <p style="color:#3f3f46;font-size:12px;margin-top:40px">
      Sent by your T-Shirt Business automation · ${new Date().getFullYear()}
    </p>
  </div>
</body>
</html>`

  return { subject, html }
}
