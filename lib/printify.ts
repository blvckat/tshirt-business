const BASE_URL = 'https://api.printify.com/v1'

async function printifyFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${process.env.PRINTIFY_API_TOKEN}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Printify API error ${res.status}: ${error}`)
  }

  return res.json()
}

// Get the shop ID — uses env var, falls back to API
export async function getShopId(): Promise<string> {
  if (process.env.PRINTIFY_SHOP_ID) return process.env.PRINTIFY_SHOP_ID
  const shops = await printifyFetch('/shops.json')
  if (!shops.length) throw new Error('No Printify shops found')
  return shops[0].id
}

// List all products in the shop
export async function listProducts(shopId: string) {
  return printifyFetch(`/shops/${shopId}/products.json`)
}

// Create a new product
export async function createProduct(shopId: string, payload: {
  title: string
  description: string
  blueprint_id: number
  print_provider_id: number
  variants: { id: number; price: number; is_enabled: boolean }[]
  print_areas: Record<string, unknown>[]
}) {
  return printifyFetch(`/shops/${shopId}/products.json`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

// Upload an image by URL or base64
export async function uploadImage(payload: {
  file_name: string
  url?: string          // public image URL
  contents?: string     // base64-encoded image (alternative to url)
}) {
  return printifyFetch('/uploads/images.json', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

// Get order status
export async function getOrderStatus(shopId: string, orderId: string) {
  return printifyFetch(`/shops/${shopId}/orders/${orderId}.json`)
}
