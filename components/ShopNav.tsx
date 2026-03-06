'use client';

import Link from 'next/link';
import { useCart } from './CartContext';

export default function ShopNav() {
  const { totalItems, openCart } = useCart();

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-black/10"
      style={{ height: '56px' }}
    >
      <div className="max-w-screen-xl mx-auto px-6 h-full flex items-center justify-between">
        {/* Left: Brand */}
        <Link
          href="/"
          className="font-mono text-xs tracking-widest uppercase text-black hover:opacity-60 transition-opacity"
        >
          BLVCKCAT.AI
        </Link>

        {/* Center: Shop link */}
        <Link
          href="/"
          className="font-mono text-xs tracking-widest uppercase text-black hover:opacity-60 transition-opacity"
        >
          SHOP
        </Link>

        {/* Right: Bag icon + count */}
        <button
          onClick={openCart}
          className="relative flex items-center hover:opacity-60 transition-opacity"
          aria-label="Open cart"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
          {totalItems > 0 && (
            <span className="absolute -top-2 -right-2 bg-black text-white font-mono text-[10px] w-4 h-4 flex items-center justify-center">
              {totalItems > 9 ? '9+' : totalItems}
            </span>
          )}
        </button>
      </div>
    </nav>
  );
}
