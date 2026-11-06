/**
 * Demo catalogue + store content used by `pnpm db:seed`.
 * Prices are in minor units (paisa): 349900 = Rs 3,499.
 */
import type { Fit, ProductStatus } from "@prisma/client";

export const categories = [
  {
    slug: "pullover",
    name: "Pullover Hoodies",
    description: "Classic hooded sweatshirts with a kangaroo pocket.",
  },
  { slug: "zip-up", name: "Zip-Up Hoodies", description: "Full-zip hoodies for easy layering." },
  {
    slug: "oversized",
    name: "Oversized Hoodies",
    description: "Dropped shoulders and a relaxed, boxy fit.",
  },
  { slug: "graphic", name: "Graphic Hoodies", description: "Printed and embroidered designs." },
] as const;

export const collections = [
  {
    slug: "new-arrivals",
    name: "New Arrivals",
    description: "Fresh drops this season.",
    isFeatured: true,
  },
  {
    slug: "best-sellers",
    name: "Best Sellers",
    description: "Our most-loved hoodies.",
    isFeatured: true,
  },
  {
    slug: "winter-essentials",
    name: "Winter Essentials",
    description: "Heavyweight fleece for cold days.",
    isFeatured: false,
  },
] as const;

interface ColorDef {
  name: string;
  hex: string;
}

export interface ProductDef {
  slug: string;
  title: string;
  skuPrefix: string;
  description: string;
  fit: Fit;
  fabric: string;
  basePrice: number;
  compareAtPrice?: number;
  status: ProductStatus;
  isFeatured: boolean;
  categories: string[];
  collections: string[];
  sizes: string[];
  colors: ColorDef[];
  soldCount: number;
}

const CARE = "Machine wash cold, inside out. Do not bleach. Tumble dry low. Do not iron on print.";

const ALL_SIZES = ["XS", "S", "M", "L", "XL", "XXL"];
const CORE_SIZES = ["S", "M", "L", "XL", "XXL"];

export const products: ProductDef[] = [
  {
    slug: "classic-pullover-hoodie",
    title: "Classic Pullover Hoodie",
    skuPrefix: "CPH",
    description:
      "Our everyday hoodie. Soft brushed-back fleece, a double-lined hood with flat drawcords, ribbed cuffs and a roomy kangaroo pocket.",
    fit: "REGULAR",
    fabric: "80% cotton / 20% polyester, 320 GSM brushed fleece",
    basePrice: 349900,
    status: "ACTIVE",
    isFeatured: true,
    categories: ["pullover"],
    collections: ["best-sellers", "winter-essentials"],
    sizes: ALL_SIZES,
    colors: [
      { name: "Jet Black", hex: "#111111" },
      { name: "Heather Grey", hex: "#9CA3AF" },
      { name: "Navy", hex: "#1E3A5F" },
    ],
    soldCount: 412,
  },
  {
    slug: "oversized-heavyweight-hoodie",
    title: "Oversized Heavyweight Hoodie",
    skuPrefix: "OHH",
    description:
      "A boxy, dropped-shoulder silhouette cut from extra-heavy 400 GSM fleece. Size down for a closer fit.",
    fit: "OVERSIZED",
    fabric: "100% cotton, 400 GSM heavyweight fleece",
    basePrice: 449900,
    compareAtPrice: 549900,
    status: "ACTIVE",
    isFeatured: true,
    categories: ["oversized", "pullover"],
    collections: ["new-arrivals", "best-sellers"],
    sizes: CORE_SIZES,
    colors: [
      { name: "Jet Black", hex: "#111111" },
      { name: "Sand", hex: "#D6C4A8" },
      { name: "Olive", hex: "#556B2F" },
    ],
    soldCount: 298,
  },
  {
    slug: "essential-zip-up-hoodie",
    title: "Essential Zip-Up Hoodie",
    skuPrefix: "EZH",
    description:
      "A clean full-zip hoodie with a metal YKK zipper, split kangaroo pockets and a lined hood. Layers over anything.",
    fit: "REGULAR",
    fabric: "80% cotton / 20% polyester, 320 GSM fleece",
    basePrice: 399900,
    status: "ACTIVE",
    isFeatured: false,
    categories: ["zip-up"],
    collections: ["winter-essentials"],
    sizes: ALL_SIZES,
    colors: [
      { name: "Jet Black", hex: "#111111" },
      { name: "Charcoal", hex: "#36454F" },
    ],
    soldCount: 156,
  },
  {
    slug: "midnight-city-graphic-hoodie",
    title: "Midnight City Graphic Hoodie",
    skuPrefix: "MCG",
    description:
      "An oversized hoodie with a puff-printed city skyline across the back and a small embroidered logo on the chest.",
    fit: "OVERSIZED",
    fabric: "100% cotton, 380 GSM fleece, puff print",
    basePrice: 429900,
    status: "ACTIVE",
    isFeatured: true,
    categories: ["graphic", "oversized"],
    collections: ["new-arrivals"],
    sizes: CORE_SIZES,
    colors: [
      { name: "Jet Black", hex: "#111111" },
      { name: "Off-White", hex: "#F5F0E6" },
    ],
    soldCount: 187,
  },
  {
    slug: "sherpa-lined-zip-hoodie",
    title: "Sherpa-Lined Zip Hoodie",
    skuPrefix: "SLZ",
    description:
      "Our warmest hoodie. A full sherpa lining in the body and hood keeps the cold out on the chilliest nights.",
    fit: "REGULAR",
    fabric: "Shell: 80% cotton / 20% polyester. Lining: 100% polyester sherpa",
    basePrice: 599900,
    compareAtPrice: 699900,
    status: "ACTIVE",
    isFeatured: false,
    categories: ["zip-up"],
    collections: ["winter-essentials"],
    sizes: CORE_SIZES,
    colors: [
      { name: "Chocolate", hex: "#6B4F3A" },
      { name: "Jet Black", hex: "#111111" },
    ],
    soldCount: 94,
  },
  {
    slug: "slim-fit-tech-hoodie",
    title: "Slim Fit Tech Hoodie",
    skuPrefix: "STH",
    description:
      "A lightweight, four-way-stretch hoodie with thumbholes and a zipped phone pocket. Made for the gym and the commute.",
    fit: "SLIM",
    fabric: "88% polyester / 12% elastane, 260 GSM stretch knit",
    basePrice: 379900,
    status: "ACTIVE",
    isFeatured: false,
    categories: ["pullover"],
    collections: ["best-sellers"],
    sizes: ALL_SIZES,
    colors: [
      { name: "Jet Black", hex: "#111111" },
      { name: "Steel Blue", hex: "#4682B4" },
    ],
    soldCount: 221,
  },
  {
    slug: "cropped-boxy-hoodie",
    title: "Cropped Boxy Hoodie",
    skuPrefix: "CBH",
    description:
      "A cropped length with a wide, boxy body and raw-edge hem. Pairs well with high-waisted bottoms.",
    fit: "OVERSIZED",
    fabric: "100% cotton, 340 GSM fleece",
    basePrice: 299900,
    status: "ACTIVE",
    isFeatured: false,
    categories: ["oversized", "pullover"],
    collections: ["new-arrivals"],
    sizes: ["XS", "S", "M", "L"],
    colors: [
      { name: "Lilac", hex: "#C8A2C8" },
      { name: "Jet Black", hex: "#111111" },
    ],
    soldCount: 63,
  },
  {
    slug: "varsity-embroidered-hoodie",
    title: "Varsity Embroidered Hoodie",
    skuPrefix: "VEH",
    description: "Coming soon: chenille varsity lettering on a heavyweight pullover.",
    fit: "REGULAR",
    fabric: "100% cotton, 380 GSM fleece, chenille patch",
    basePrice: 479900,
    status: "DRAFT",
    isFeatured: false,
    categories: ["graphic"],
    collections: [],
    sizes: CORE_SIZES,
    colors: [{ name: "Forest Green", hex: "#228B22" }],
    soldCount: 0,
  },
];

export { CARE };

export const shippingZones = [
  {
    id: "zone_lahore",
    name: "Lahore",
    regions: ["lahore"],
    standardRate: 15000,
    expressRate: 30000,
    freeOverAmount: 500000,
    codFee: 5000,
    estimatedDays: "1-2",
    position: 0,
  },
  {
    id: "zone_major_cities",
    name: "Karachi & Islamabad / Rawalpindi",
    regions: ["karachi", "islamabad", "rawalpindi"],
    standardRate: 25000,
    expressRate: 45000,
    freeOverAmount: 500000,
    codFee: 5000,
    estimatedDays: "2-3",
    position: 1,
  },
  {
    id: "zone_rest_pk",
    name: "Rest of Pakistan",
    regions: ["*"],
    standardRate: 30000,
    expressRate: null,
    freeOverAmount: 700000,
    codFee: 10000,
    estimatedDays: "3-5",
    position: 2,
  },
];

export const coupons = [
  {
    code: "WELCOME10",
    description: "10% off your first order",
    type: "PERCENTAGE" as const,
    value: 10,
    minOrderAmount: 250000,
    maxUsesPerUser: 1,
  },
  {
    code: "FREESHIP",
    description: "Free shipping on orders over Rs 3,000",
    type: "FREE_SHIPPING" as const,
    value: 0,
    minOrderAmount: 300000,
  },
  {
    code: "WINTER500",
    description: "Rs 500 off orders over Rs 6,000",
    type: "FIXED" as const,
    value: 50000,
    minOrderAmount: 600000,
    maxUses: 200,
  },
];

export const banners = [
  {
    id: "banner_winter_drop",
    title: "The Winter Drop",
    subtitle: "Heavyweight fleece built for cold nights.",
    imageUrl: "https://placehold.co/1600x700/111111/F5F0E6/png?text=The+Winter+Drop",
    link: "/collections/winter-essentials",
    ctaLabel: "Shop winter",
    position: 0,
  },
  {
    id: "banner_oversized",
    title: "Go Oversized",
    subtitle: "Boxy fits in 400 GSM cotton.",
    imageUrl: "https://placehold.co/1600x700/D6C4A8/111111/png?text=Go+Oversized",
    link: "/collections/oversized",
    ctaLabel: "Shop oversized",
    position: 1,
  },
];

export const pages = [
  {
    slug: "shipping",
    title: "Shipping Policy",
    content:
      "We ship nationwide. Orders placed before 2 PM are dispatched the same day. Delivery takes 1-2 working days in Lahore and 2-5 working days elsewhere. Free shipping applies above the threshold shown at checkout.",
  },
  {
    slug: "returns",
    title: "Returns & Exchanges",
    content:
      "Unworn items with tags attached can be returned or exchanged within 14 days of delivery. Request a return from your account's order page. Refunds are issued to the original payment method, or by bank transfer for Cash on Delivery orders.",
  },
  {
    slug: "privacy",
    title: "Privacy Policy",
    content:
      "We only collect the information needed to process your order and improve our store. We never sell your data. Card payments are processed by Stripe, and we never see or store your card details.",
  },
  {
    slug: "terms",
    title: "Terms of Service",
    content:
      "By using this website you agree to these terms. Prices and availability can change without notice. We reserve the right to cancel orders that look fraudulent.",
  },
];

export const faqs = [
  {
    id: "faq_sizing",
    category: "Sizing",
    question: "How do your hoodies fit?",
    answer:
      "Regular fits are true to size. Oversized styles are cut roomy, so size down if you prefer a closer fit. Check the size guide on each product for exact measurements.",
  },
  {
    id: "faq_cod",
    category: "Payments",
    question: "Do you offer Cash on Delivery?",
    answer:
      "Yes, Cash on Delivery is available across Pakistan. A small COD fee is added at checkout.",
  },
  {
    id: "faq_delivery",
    category: "Shipping",
    question: "How long does delivery take?",
    answer: "1-2 working days in Lahore and 2-5 working days for the rest of Pakistan.",
  },
  {
    id: "faq_exchange",
    category: "Returns",
    question: "Can I exchange for a different size?",
    answer:
      "Yes. Exchanges are free within 14 days of delivery, as long as the item is unworn with tags attached.",
  },
  {
    id: "faq_care",
    category: "Care",
    question: "How should I wash my hoodie?",
    answer:
      "Wash cold, inside out, and tumble dry low. This keeps the fleece soft and the prints sharp.",
  },
];

export const settings: Record<string, unknown> = {
  "store.name": "Hoodie Store",
  "store.email": "support@hoodie.local",
  "store.phone": "+92 300 0000000",
  "store.currency": "PKR",
  "store.locale": "en-PK",
  "tax.rate": 0,
  "tax.inclusive": true,
  "payments.card.enabled": true,
  "payments.cod.enabled": true,
  "orders.numberPrefix": "HD-",
  "returns.windowDays": 14,
  "announcement.text": "Free shipping on orders over Rs 5,000 in Lahore, Karachi & Islamabad",
  "announcement.enabled": true,
};
