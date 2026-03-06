import { CartProvider } from '@/components/CartContext';
import ShopNav from '@/components/ShopNav';
import CartDrawer from '@/components/CartDrawer';

export default function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CartProvider>
      <div className="bg-white min-h-screen">
        <ShopNav />
        <CartDrawer />
        <main style={{ paddingTop: '56px' }}>{children}</main>
      </div>
    </CartProvider>
  );
}
