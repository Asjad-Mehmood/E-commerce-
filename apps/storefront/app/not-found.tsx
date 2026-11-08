import { ShopChrome } from "@/components/layout/shop-chrome";
import ShopNotFound from "./(shop)/not-found";

/** Addresses that match no page at all get the shop's 404, with its header and footer. */
export default function NotFound() {
  return (
    <ShopChrome>
      <ShopNotFound />
    </ShopChrome>
  );
}
