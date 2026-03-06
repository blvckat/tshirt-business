import { createClient } from '@/lib/supabase/server';
import Image from 'next/image';
import Link from 'next/link';

interface Product {
  id: string;
  printify_id: string;
  price: number;
  designs: {
    title: string;
    image_url: string;
  };
}

export default async function ShopPage() {
  const supabase = createClient();

  const { data: products } = await supabase
    .from('products')
    .select('id, printify_id, price, designs!inner(title, image_url, status)')
    .not('printify_id', 'is', null)
    .eq('designs.status', 'approved');

  const items = (products ?? []) as unknown as Product[];

  return (
    <section className="max-w-screen-xl mx-auto px-6 py-12">
      {/* Header */}
      <div className="mb-12">
        <h1 className="font-mono text-xs tracking-widest uppercase text-black/40">
          ALL PRODUCTS
        </h1>
      </div>

      {items.length === 0 ? (
        <p className="font-mono text-xs tracking-widest uppercase text-black/30 text-center py-24">
          NO PRODUCTS AVAILABLE
        </p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-px bg-black/10">
          {items.map((product, idx) => {
            const code = `TS-${String(idx + 1).padStart(2, '0')}`;
            const price = `$${(product.price / 100).toFixed(2)}`;
            return (
              <Link
                key={product.id}
                href={`/products/${product.id}`}
                className="bg-white group block"
              >
                {/* Image */}
                <div className="relative aspect-square bg-white overflow-hidden">
                  {product.designs?.image_url ? (
                    <Image
                      src={product.designs.image_url}
                      alt={product.designs?.title ?? code}
                      fill
                      className="object-contain transition-opacity duration-200 group-hover:opacity-80"
                      sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    />
                  ) : (
                    <div className="w-full h-full bg-black/5" />
                  )}
                </div>

                {/* Info */}
                <div className="px-3 py-4 border-t border-black/10">
                  <p className="font-mono text-xs tracking-widest uppercase text-black/40">
                    {code}
                  </p>
                  <p className="font-mono text-xs tracking-widest uppercase mt-1">
                    {price}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
