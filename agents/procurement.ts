import { getShopId, uploadImage, createProduct, publishProduct, getProduct } from '@/lib/printify'
import { createClient } from '@/lib/supabase/server'
import { DesignRecord } from './designer'
import { runMarketingAgent } from './marketing'

// Unisex Softstyle T-Shirt (Gildan 64000) via Monster Digital
const BLUEPRINT_ID = 145
const PRINT_PROVIDER_ID = 29
const RETAIL_PRICE = 2999  // $29.99 in cents
const COST = 1200          // ~$12.00 in cents

// Black variants: S, M, L, XL, 2XL, 3XL
const BLACK_VARIANT_IDS = [38164, 38178, 38192, 38206, 38220, 42122]

export async function runProcurementAgent(design: DesignRecord): Promise<void> {
  console.log(`[Procurement] Starting for design: "${design.title}" (${design.id})`)

  const shopId = await getShopId()

  // Step 1: Upload the design image to Printify
  console.log(`[Procurement] Uploading image to Printify...`)
  const uploaded = await uploadImage({
    file_name: `${design.id}.png`,
    url: design.image_url,
  })
  const printifyImageId: string = uploaded.id
  console.log(`[Procurement] Image uploaded: ${printifyImageId}`)

  // Step 2: Create the product on Printify
  console.log(`[Procurement] Creating Printify product...`)
  const product = await createProduct(shopId, {
    title: design.title,
    description: `${design.title} — gym-ready graphic tee. Bold design, dark background, motivational energy.`,
    blueprint_id: BLUEPRINT_ID,
    print_provider_id: PRINT_PROVIDER_ID,
    variants: BLACK_VARIANT_IDS.map(id => ({
      id,
      price: RETAIL_PRICE,
      is_enabled: true,
    })),
    print_areas: [
      {
        variant_ids: BLACK_VARIANT_IDS,
        placeholders: [
          {
            position: 'front',
            images: [
              {
                id: printifyImageId,
                x: 0.5,
                y: 0.5,
                scale: 1,
                angle: 0,
              },
            ],
          },
        ],
      },
    ],
  })
  const printifyProductId: string = product.id
  console.log(`[Procurement] Printify product created: ${printifyProductId}`)

  // Step 3: Fetch mockup images from the created product
  console.log(`[Procurement] Fetching mockups...`)
  const fullProduct = await getProduct(shopId, printifyProductId)
  const mockupUrl: string | null = fullProduct.images?.[0]?.src ?? null
  console.log(`[Procurement] Mockup URL: ${mockupUrl}`)

  // Step 4: Publish product to Shopify
  console.log(`[Procurement] Publishing to Shopify...`)
  await publishProduct(shopId, printifyProductId)
  console.log(`[Procurement] Published to Shopify`)

  // Step 5: Fetch product again to get the Shopify external ID
  const publishedProduct = await getProduct(shopId, printifyProductId)
  const shopifyProductId: string | null = publishedProduct.external?.id ?? null
  console.log(`[Procurement] Shopify product ID: ${shopifyProductId}`)

  // Step 6: Save to Supabase products table
  const supabase = createClient()
  const { error } = await supabase.from('products').insert({
    design_id: design.id,
    printify_id: printifyProductId,
    shopify_id: shopifyProductId,
    price: RETAIL_PRICE / 100,
    cost: COST / 100,
  })

  if (error) throw new Error(`Failed to save product to Supabase: ${error.message}`)

  const savedProduct = await supabase
    .from('products')
    .select('id')
    .eq('printify_id', printifyProductId)
    .single()

  if (savedProduct.data?.id) {
    console.log(`[Procurement] Running marketing agent...`)
    await runMarketingAgent(design.title, savedProduct.data.id)
  }

  console.log(`[Procurement] All done for "${design.title}".`)
}
