'use client';

import { useState } from 'react';
import { useCart } from '@/components/CartContext';

const SIZES = ['S', 'M', 'L', 'XL', '2XL', '3XL'] as const;

interface Props {
  productId: string;
  printifyId: string;
  title: string;
  imageUrl: string;
  price: number; // cents
}

export default function AddToCartSection({
  productId,
  printifyId,
  title,
  imageUrl,
  price,
}: Props) {
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const { dispatch, openCart } = useCart();

  function handleAdd() {
    if (!selectedSize) return;
    dispatch({
      type: 'ADD',
      item: {
        id: productId,
        printifyId,
        title,
        imageUrl,
        size: selectedSize,
        price,
        quantity: 1,
      },
    });
    setAdded(true);
    openCart();
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <div className="space-y-6">
      {/* Size selector */}
      <div>
        <p className="font-mono text-xs tracking-widest uppercase text-black/50 mb-3">
          SIZE
        </p>
        <div className="flex flex-wrap gap-2">
          {SIZES.map((size) => (
            <button
              key={size}
              onClick={() => setSelectedSize(size)}
              className={`font-mono text-xs tracking-widest uppercase px-4 py-2 border transition-colors ${
                selectedSize === size
                  ? 'bg-black text-white border-black'
                  : 'bg-white text-black border-black/20 hover:border-black'
              }`}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      {/* Add to cart button */}
      <button
        onClick={handleAdd}
        disabled={!selectedSize}
        className={`w-full font-mono text-xs tracking-widest uppercase py-4 transition-colors ${
          !selectedSize
            ? 'bg-black/20 text-white cursor-not-allowed'
            : added
            ? 'bg-black/70 text-white'
            : 'bg-black text-white hover:bg-black/80'
        }`}
      >
        {added ? 'ADDED TO BAG' : 'ADD TO BAG'}
      </button>

      {!selectedSize && (
        <p className="font-mono text-[10px] tracking-widest uppercase text-black/40">
          SELECT A SIZE TO CONTINUE
        </p>
      )}
    </div>
  );
}
