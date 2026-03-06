'use client';

import Image from 'next/image';
import { useCart } from './CartContext';

export default function CartDrawer() {
  const { items, dispatch, subtotal, isOpen, closeCart } = useCart();

  const fmt = (cents: number) =>
    `$${(cents / 100).toFixed(2)}`;

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/20"
          onClick={closeCart}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 z-50 h-full w-full max-w-sm bg-white flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-black/10">
          <span className="font-mono text-xs tracking-widest uppercase">
            YOUR BAG
          </span>
          <button
            onClick={closeCart}
            className="hover:opacity-60 transition-opacity"
            aria-label="Close cart"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="font-mono text-xs tracking-widest uppercase text-black/40">
                YOUR BAG IS EMPTY
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-black/10">
              {items.map((item) => (
                <li
                  key={`${item.id}-${item.size}`}
                  className="flex gap-4 px-6 py-5"
                >
                  {/* Thumbnail */}
                  <div className="relative w-20 h-20 flex-shrink-0 bg-white border border-black/10">
                    <Image
                      src={item.imageUrl}
                      alt={item.title}
                      fill
                      className="object-contain"
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-xs tracking-wider uppercase truncate">
                      {item.title}
                    </p>
                    <p className="font-mono text-xs text-black/50 mt-0.5 uppercase tracking-wider">
                      SIZE: {item.size}
                    </p>
                    <p className="font-mono text-xs mt-1 tracking-wider">
                      {fmt(item.price)}
                    </p>

                    {/* Qty controls */}
                    <div className="flex items-center gap-3 mt-3">
                      <button
                        onClick={() =>
                          dispatch({
                            type: 'UPDATE_QTY',
                            id: item.id,
                            size: item.size,
                            quantity: item.quantity - 1,
                          })
                        }
                        className="w-6 h-6 flex items-center justify-center border border-black/20 font-mono text-xs hover:bg-black hover:text-white transition-colors"
                        aria-label="Decrease quantity"
                      >
                        −
                      </button>
                      <span className="font-mono text-xs w-4 text-center">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() =>
                          dispatch({
                            type: 'UPDATE_QTY',
                            id: item.id,
                            size: item.size,
                            quantity: item.quantity + 1,
                          })
                        }
                        className="w-6 h-6 flex items-center justify-center border border-black/20 font-mono text-xs hover:bg-black hover:text-white transition-colors"
                        aria-label="Increase quantity"
                      >
                        +
                      </button>

                      <button
                        onClick={() =>
                          dispatch({
                            type: 'REMOVE',
                            id: item.id,
                            size: item.size,
                          })
                        }
                        className="ml-auto font-mono text-xs text-black/40 hover:text-black transition-colors uppercase tracking-wider"
                      >
                        REMOVE
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-black/10 px-6 py-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs tracking-widest uppercase">
              SUBTOTAL
            </span>
            <span className="font-mono text-xs tracking-wider">
              {fmt(subtotal)}
            </span>
          </div>
          <button
            disabled
            className="w-full bg-black/30 text-white font-mono text-xs tracking-widest uppercase py-4 cursor-not-allowed"
          >
            CHECKOUT — COMING SOON
          </button>
        </div>
      </div>
    </>
  );
}
