"use client";

import { cn } from "@hoodie/ui";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useMe } from "@/hooks/use-auth";
import { useToggleWishlist, useWishlistIds } from "@/hooks/use-wishlist";
import { HeartIcon } from "../icons";

/** Heart toggle. Guests are sent to sign in first (and come back here). */
export function WishlistButton({
  productId,
  title,
  variant = "overlay",
  withText = false,
  className,
}: {
  productId: string;
  title: string;
  variant?: "overlay" | "button";
  /** Show "Save to wishlist" next to the heart (button variant). */
  withText?: boolean;
  className?: string;
}) {
  const me = useMe();
  const ids = useWishlistIds();
  const toggle = useToggleWishlist();
  const router = useRouter();
  const pathname = usePathname();
  const saved = ids.data?.includes(productId) ?? false;

  const onClick = () => {
    if (!me.data) {
      toast("Sign in to save hoodies to your wishlist");
      router.push(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    toggle.mutate(
      { productId, saved: !saved },
      {
        onSuccess: () =>
          toast.success(saved ? "Removed from your wishlist" : "Saved to your wishlist"),
        onError: () => toast.error("Couldn't update your wishlist. Please try again."),
      },
    );
  };

  const label = saved ? `Remove ${title} from wishlist` : `Save ${title} to wishlist`;
  if (variant === "button") {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={saved}
        aria-label={withText ? undefined : label}
        className={cn(
          "border-line hover:border-ink flex h-12 shrink-0 items-center justify-center gap-2 rounded-lg border text-sm font-medium transition",
          withText ? "px-4" : "w-12",
          className,
        )}
      >
        <HeartIcon className={cn("size-5", saved && "fill-danger stroke-danger")} />
        {withText && (saved ? "Saved to your wishlist" : "Save to wishlist")}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={saved}
      aria-label={label}
      className={cn(
        "bg-canvas/90 hover:bg-canvas absolute right-2.5 top-2.5 z-10 flex size-9 items-center justify-center rounded-full shadow-sm transition",
        className,
      )}
    >
      <HeartIcon className={cn("size-[18px]", saved && "fill-danger stroke-danger")} />
    </button>
  );
}
