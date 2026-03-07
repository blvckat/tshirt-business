import { createClient } from '@/lib/supabase/server';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import AddToCartSection from './AddToCartSection';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProductPage({ params }: Props) {
  const { id } = await params;
  const supabase = createClient();

  // Fetch product + design
  const { data: product } = await supabase
    .from('products')
    .select('id, printify_id, price, designs(id, title, image_url, theme)')
    .eq('id', id)
    .single();

  if (!product || !product.printify_id) notFound();

  // Fetch marketing copy
  const { data: copy } = await supabase
    .from('marketing_copy')
    .select('product_title, description, bullet_points')
    .eq('product_id', id)
    .maybeSingle();

  const design = product.designs as unknown as {
    id: string;
    title: string;
    image_url: string;
    theme: string;
  };

  const title = copy?.product_title ?? design?.title ?? 'BLVCKCAT TEE';
  const price = product.price ?? 29.99;
  const imageUrl = design?.image_url ?? '';
  const description = copy?.description ?? '';
  const bullets: string[] = Array.isArray(copy?.bullet_points)
    ? copy.bullet_points
    : [];

  return (
    <div className="max-w-screen-xl mx-auto px-6 py-12">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-20">
        {/* Image */}
        <div className="relative aspect-square bg-white border border-black/10">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={title}
              fill
              className="object-contain"
              sizes="(max-width: 768px) 100vw, 50vw"
              priority
            />
          ) : (
            <div className="w-full h-full bg-black/5" />
          )}
        </div>

        {/* Info */}
        <div className="flex flex-col justify-center space-y-8">
          {/* Title + price */}
          <div>
            <h1 className="font-mono text-sm tracking-widest uppercase leading-relaxed">
              {title}
            </h1>
            <p className="font-mono text-sm tracking-widest uppercase mt-2">
              ${Number(price).toFixed(2)}
            </p>
          </div>

          {/* Description */}
          {description && (
            <p className="text-sm text-black/70 leading-relaxed font-sans">
              {description}
            </p>
          )}

          {/* Bullet points */}
          {bullets.length > 0 && (
            <ul className="space-y-2">
              {bullets.map((b, i) => (
                <li
                  key={i}
                  className="font-mono text-xs tracking-wider text-black/60 flex gap-2"
                >
                  <span>—</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}

          {/* Add to cart */}
          <AddToCartSection
            productId={product.id}
            printifyId={product.printify_id}
            title={title}
            imageUrl={imageUrl}
            price={price}
          />
        </div>
      </div>
    </div>
  );
}
