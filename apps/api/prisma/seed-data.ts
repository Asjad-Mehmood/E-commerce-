/**
 * Demo catalogue + store content used by `pnpm db:seed`.
 * Prices are in minor units (paisa): 349900 = Rs 3,499.
 */
import type { Fit, ProductStatus } from "@prisma/client";

/**
 * Photo on Unsplash's CDN (free to use commercially under the Unsplash
 * License). `id` is the part after "photo-" in an images.unsplash.com URL.
 */
export const unsplash = (id: string, width = 1200) =>
  `https://images.unsplash.com/photo-${id}?w=${width}&q=80&auto=format&fit=crop`;

export const categories = [
  {
    slug: "pullover",
    image: "1677538537484-324385aff147",
    name: "Pullover Hoodies",
    description: "Classic hooded sweatshirts with a kangaroo pocket.",
  },
  {
    slug: "zip-up",
    image: "1647771746277-eac927afab2c",
    name: "Zip-Up Hoodies",
    description: "Full-zip hoodies for easy layering.",
  },
  {
    slug: "oversized",
    image: "1611817757591-c3f345024273",
    name: "Oversized Hoodies",
    description: "Dropped shoulders and a relaxed, boxy fit.",
  },
  {
    slug: "custom",
    image: "1688111421205-a0a85415b224",
    name: "Custom Hoodies",
    description: "Your name, initials or a short word, embroidered for you.",
  },
  {
    slug: "women",
    image: "1618333272197-2ee791c42963",
    name: "Women's Hoodies",
    description: "Cropped and relaxed fits cut for women.",
  },
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
    description: "Heavyweight fleece and sherpa for cold days.",
    isFeatured: false,
  },
] as const;

interface ColorDef {
  name: string;
  hex: string;
  /** Unsplash photo ids, first one is the main photo for the colour. */
  photos: string[];
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
  /** Extra photos not tied to one colour. */
  extraPhotos?: { id: string; alt: string }[];
  soldCount: number;
}

const CARE = "Machine wash cold, inside out. Do not bleach. Tumble dry low. Do not iron on print.";

const ALL_SIZES = ["XS", "S", "M", "L", "XL", "XXL"];
const CORE_SIZES = ["S", "M", "L", "XL", "XXL"];

/** Prices are in paisa and in line with Pakistani streetwear brands (Rs 2,500 to 6,500). */
export const products: ProductDef[] = [
  {
    slug: "urban-essential-pullover-hoodie",
    title: "Urban Essential Pullover Hoodie",
    skuPrefix: "UEP",
    description:
      "Our everyday hoodie. Soft brushed-back fleece, a double-lined hood with flat drawcords, ribbed cuffs and a roomy kangaroo pocket. Made in Lahore.",
    fit: "REGULAR",
    fabric: "80% cotton / 20% polyester, 320 GSM brushed fleece",
    basePrice: 299900,
    compareAtPrice: 399900,
    status: "ACTIVE",
    isFeatured: true,
    categories: ["pullover"],
    collections: ["best-sellers", "winter-essentials"],
    sizes: ALL_SIZES,
    colors: [
      {
        name: "Jet Black",
        hex: "#111111",
        photos: ["1677538537484-324385aff147", "1513789181297-6f2ec112c0bc"],
      },
      {
        name: "Heather Grey",
        hex: "#9CA3AF",
        photos: ["1601063476271-a159c71ab0b3", "1556821840-3a63f95609a7"],
      },
      {
        name: "White",
        hex: "#F4F4F2",
        photos: ["1620799140188-3b2a02fd9a77", "1738486260590-23c954cf29b8"],
      },
      { name: "Navy", hex: "#2B3A67", photos: ["1739384994765-d44f7af12029"] },
    ],
    soldCount: 412,
  },
  {
    slug: "oversized-drop-shoulder-hoodie",
    title: "Oversized Drop-Shoulder Hoodie",
    skuPrefix: "ODS",
    description:
      "A boxy, dropped-shoulder silhouette in heavy cotton fleece with a wide hood. Size down for a closer fit.",
    fit: "OVERSIZED",
    fabric: "100% cotton, 380 GSM fleece",
    basePrice: 349900,
    status: "ACTIVE",
    isFeatured: true,
    categories: ["oversized", "pullover"],
    collections: ["new-arrivals", "best-sellers"],
    sizes: CORE_SIZES,
    colors: [
      { name: "Mocha", hex: "#7B5E4B", photos: ["1611817757591-c3f345024273"] },
      { name: "Sand", hex: "#D6C4A8", photos: ["1564557287817-3785e38ec1f5"] },
      {
        name: "Cream",
        hex: "#EFE6D2",
        photos: ["1685328403732-64be6bb9d112", "1592485641225-bdbadeaa601e"],
      },
    ],
    soldCount: 298,
  },
  {
    slug: "zip-up-fleece-hoodie",
    title: "Zip-Up Fleece Hoodie",
    skuPrefix: "ZFH",
    description:
      "A clean full-zip hoodie with a metal zipper, two front pockets and a lined hood. Layers over anything.",
    fit: "REGULAR",
    fabric: "80% cotton / 20% polyester, 320 GSM fleece",
    basePrice: 379900,
    status: "ACTIVE",
    isFeatured: false,
    categories: ["zip-up"],
    collections: ["winter-essentials"],
    sizes: ALL_SIZES,
    colors: [
      { name: "Cream", hex: "#EFE6D2", photos: ["1647771746277-eac927afab2c"] },
      { name: "Jet Black", hex: "#111111", photos: ["1607807722648-2b1ecf58a104"] },
    ],
    soldCount: 156,
  },
  {
    slug: "sherpa-zip-hoodie",
    title: "Sherpa Zip Hoodie",
    skuPrefix: "SZH",
    description:
      "Our warmest hoodie. Thick teddy-sherpa fleece inside and out keeps the cold out on the chilliest nights in Islamabad and Murree.",
    fit: "REGULAR",
    fabric: "100% polyester sherpa fleece",
    basePrice: 549900,
    compareAtPrice: 649900,
    status: "ACTIVE",
    isFeatured: false,
    categories: ["zip-up"],
    collections: ["winter-essentials"],
    sizes: CORE_SIZES,
    colors: [{ name: "Maroon", hex: "#6D1F2A", photos: ["1776135524169-7677f2965582"] }],
    soldCount: 94,
  },
  {
    slug: "heavyweight-street-hoodie",
    title: "Heavyweight Street Hoodie",
    skuPrefix: "HSH",
    description:
      "Extra-heavy 450 GSM fleece that holds its shape, with a deep hood and dropped shoulders. Built for winter evenings.",
    fit: "OVERSIZED",
    fabric: "100% cotton, 450 GSM heavyweight fleece",
    basePrice: 429900,
    status: "ACTIVE",
    isFeatured: true,
    categories: ["oversized", "pullover"],
    collections: ["new-arrivals", "winter-essentials"],
    sizes: CORE_SIZES,
    colors: [
      { name: "Jet Black", hex: "#111111", photos: ["1647797819874-f51a8a8fc5c0"] },
      { name: "Dark Teal", hex: "#1F4E4F", photos: ["1579572331145-5e53b299c64e"] },
      { name: "Camel", hex: "#B07F57", photos: ["1578768079052-aa76e52ff62e"] },
    ],
    soldCount: 221,
  },
  {
    slug: "pastel-relaxed-hoodie",
    title: "Pastel Relaxed Hoodie",
    skuPrefix: "PRH",
    description:
      "A soft, relaxed-fit pullover in washed pastel shades. Light enough for spring evenings, warm enough for winter mornings.",
    fit: "REGULAR",
    fabric: "70% cotton / 30% polyester, 300 GSM fleece",
    basePrice: 279900,
    status: "ACTIVE",
    isFeatured: false,
    categories: ["pullover", "women"],
    collections: ["new-arrivals"],
    sizes: ALL_SIZES,
    colors: [
      { name: "Mint", hex: "#A8D5BA", photos: ["1618333272197-2ee791c42963"] },
      { name: "Blush Pink", hex: "#F2C4CE", photos: ["1516195851888-6f1a981a862e"] },
    ],
    extraPhotos: [{ id: "1699275303942-47957eea44b1", alt: "Pastel hoodies on hangers" }],
    soldCount: 63,
  },
  {
    slug: "custom-embroidered-hoodie",
    title: "Custom Embroidered Hoodie",
    skuPrefix: "CEH",
    description:
      "Make it yours: we embroider your name, initials or a short word (up to 12 characters) on the chest. Write the text in the order note at checkout. Made to order and dispatched in 3-5 working days. Personalised hoodies can't be returned unless faulty.",
    fit: "REGULAR",
    fabric: "80% cotton / 20% polyester, 320 GSM fleece, thread embroidery",
    basePrice: 399900,
    status: "ACTIVE",
    isFeatured: true,
    categories: ["custom", "pullover"],
    collections: ["best-sellers"],
    sizes: ALL_SIZES,
    colors: [
      { name: "White", hex: "#F4F4F2", photos: ["1688111421205-a0a85415b224"] },
      { name: "Jet Black", hex: "#111111", photos: ["1746971054333-8b9610b397a5"] },
      { name: "Heather Grey", hex: "#9CA3AF", photos: ["1578470507807-3fc541d5f544"] },
    ],
    soldCount: 187,
  },
  {
    slug: "womens-cropped-hoodie",
    title: "Women's Cropped Hoodie",
    skuPrefix: "WCH",
    description:
      "A cropped length with a wide, relaxed body and a soft brushed lining. Pairs well with high-waisted jeans and trousers.",
    fit: "OVERSIZED",
    fabric: "100% cotton, 320 GSM fleece",
    basePrice: 269900,
    status: "ACTIVE",
    isFeatured: false,
    categories: ["women", "oversized"],
    collections: ["new-arrivals"],
    sizes: ["XS", "S", "M", "L"],
    colors: [
      { name: "Heather Grey", hex: "#9CA3AF", photos: ["1594656375376-64d56e2f3ed1"] },
      { name: "White", hex: "#F4F4F2", photos: ["1526476148966-98bd039463ea"] },
    ],
    soldCount: 71,
  },
  {
    slug: "varsity-letter-hoodie",
    title: "Varsity Letter Hoodie",
    skuPrefix: "VLH",
    description: "Coming soon: chenille varsity lettering on a heavyweight pullover.",
    fit: "REGULAR",
    fabric: "100% cotton, 380 GSM fleece, chenille patch",
    basePrice: 479900,
    status: "DRAFT",
    isFeatured: false,
    categories: ["custom"],
    collections: [],
    sizes: CORE_SIZES,
    colors: [{ name: "Forest Green", hex: "#228B22", photos: [] }],
    soldCount: 0,
  },
];

/** Products from earlier demo catalogues, archived when the seed runs. */
export const retiredProductSlugs = [
  "classic-pullover-hoodie",
  "oversized-heavyweight-hoodie",
  "essential-zip-up-hoodie",
  "midnight-city-graphic-hoodie",
  "sherpa-lined-zip-hoodie",
  "slim-fit-tech-hoodie",
  "cropped-boxy-hoodie",
  "varsity-embroidered-hoodie",
];
/** Categories from earlier demo catalogues, hidden when the seed runs. */
export const retiredCategorySlugs = ["graphic"];

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
    subtitle: "Heavyweight fleece and sherpa, built for cold nights.",
    imageUrl: `${unsplash("1556821840-3a63f95609a7", 1600)}&h=700`,
    link: "/collections/winter-essentials",
    ctaLabel: "Shop winter",
    position: 0,
  },
  {
    id: "banner_oversized",
    title: "Go Oversized",
    subtitle: "Boxy fits in 380-450 GSM cotton, from Rs 3,499.",
    imageUrl: `${unsplash("1564557287817-3785e38ec1f5", 1600)}&h=700`,
    link: "/categories/oversized",
    ctaLabel: "Shop oversized",
    position: 1,
  },
  {
    id: "banner_custom",
    title: "Make It Yours",
    subtitle: "Your name or initials, embroidered on the chest.",
    imageUrl: `${unsplash("1688111421205-a0a85415b224", 1600)}&h=700`,
    link: "/products/custom-embroidered-hoodie",
    ctaLabel: "Personalise yours",
    position: 2,
  },
];

/**
 * Store pages. Plain text: blank lines separate paragraphs, "## " starts a
 * heading and lines starting with "- " make a list. Edit them in Admin → Content.
 */
export const pages = [
  {
    slug: "shipping",
    title: "Shipping Policy",
    seoDescription: "Delivery times, charges and Cash on Delivery across Pakistan.",
    content: `We deliver to every city in Pakistan through our courier partners. Every parcel gets a tracking number once it ships.

## Delivery times
- Lahore: 1-2 working days
- Karachi, Islamabad and Rawalpindi: 2-3 working days
- Rest of Pakistan: 3-5 working days

Orders placed before 2 PM on a working day are packed the same day. Custom embroidered hoodies are made to order and ship within 3-5 working days.

## Delivery charges
Delivery charges depend on your city and are shown at checkout before you place the order. Delivery is free on orders over Rs 5,000 in Lahore, Karachi, Islamabad and Rawalpindi, and over Rs 7,000 elsewhere.

## Cash on Delivery
Pay in cash when your parcel arrives. A small Cash on Delivery fee (Rs 50 in major cities, Rs 100 elsewhere) is added at checkout. Please keep the exact amount ready and check that the parcel is sealed before paying.

## Tracking
Track your order at any time from the Track Order page with your order number and email address, or from your account.`,
  },
  {
    slug: "returns",
    title: "Returns & Exchanges",
    seoDescription: "Free size exchanges and easy returns within 14 days of delivery.",
    content: `Wrong size? No problem. You can return or exchange items within 14 days of delivery.

## Conditions
- Items must be unworn and unwashed, with the original tags attached.
- Custom embroidered hoodies can only be returned if they are faulty or the embroidery is wrong.
- Sale items can be exchanged for a different size.

## How to return
- Signed in: open the order in your account and choose "Request a return".
- Guest orders: open the link to your order (from the order confirmation page) or contact us with your order number.

We review requests within one working day and send you the return address. Once we receive and check the items, refunds for Cash on Delivery orders are sent by bank transfer or JazzCash / Easypaisa within 5 working days.

## Exchanges
Size exchanges are free: we deliver the new size at no extra charge once we receive the original. If the size you want is sold out, we refund you instead.

## Faulty or wrong items
If something arrives damaged or isn't what you ordered, contact us within 48 hours with a photo and we will replace it at our cost.`,
  },
  {
    slug: "privacy",
    title: "Privacy Policy",
    seoDescription: "What information Urban Store collects and how it is used.",
    content: `Urban Store respects your privacy. This policy explains what we collect and why.

## What we collect
- Your name, phone number, email and delivery address, to deliver your order and contact you about it.
- Your order history and wishlist, if you create an account.
- Basic, anonymous usage statistics that help us improve the website.

## How we use it
We use your details only to process and deliver orders, provide customer support, and, if you subscribe, send our newsletter. We share your name, phone number and address with our courier partner only to deliver your parcel.

We never sell or rent your personal information.

## Payments
Orders are paid by Cash on Delivery. We do not collect or store card details.

## Your choices
You can update your details in your account at any time, unsubscribe from emails with the link in every email, or ask us to delete your account by contacting us.

## Cookies
We use essential cookies to keep you signed in and remember your cart. We don't use advertising cookies.`,
  },
  {
    slug: "terms",
    title: "Terms of Service",
    seoDescription: "The terms for shopping at Urban Store.",
    content: `By using this website and placing an order you agree to these terms.

## Orders
An order is confirmed when you receive an order number on screen. We may cancel an order if an item is out of stock, the price was shown incorrectly, or the order looks fraudulent. If we cancel, we will contact you and you will not be charged.

## Prices
All prices are in Pakistani Rupees and include applicable taxes. Delivery and Cash on Delivery charges are shown at checkout. Prices and availability can change without notice, but never after your order is confirmed.

## Cash on Delivery
Please only place an order if you can receive and pay for it. Repeatedly refused deliveries may lead to Cash on Delivery being turned off for your phone number.

## Product photos
We try to show colours accurately, but they can look slightly different on different screens.

## Contact
Questions about these terms? Contact us through the Contact page.`,
  },
];

export const faqs = [
  {
    id: "faq_sizing",
    category: "Sizing",
    question: "How do your hoodies fit?",
    answer:
      "Regular fits are true to size. Oversized styles are cut roomy, so size down if you prefer a closer fit. Each product has a size guide with exact chest and length measurements.",
  },
  {
    id: "faq_cod",
    category: "Payments",
    question: "How do I pay?",
    answer:
      "All orders are Cash on Delivery: you pay the rider in cash when your parcel arrives. A small COD fee (Rs 50 in major cities, Rs 100 elsewhere) is added at checkout.",
  },
  {
    id: "faq_delivery",
    category: "Shipping",
    question: "How long does delivery take?",
    answer:
      "1-2 working days in Lahore, 2-3 in Karachi, Islamabad and Rawalpindi, and 3-5 working days for the rest of Pakistan.",
  },
  {
    id: "faq_exchange",
    category: "Returns",
    question: "Can I exchange for a different size?",
    answer:
      "Yes. Size exchanges are free within 14 days of delivery, as long as the item is unworn with tags attached.",
  },
  {
    id: "faq_custom",
    category: "Custom hoodies",
    question: "How do I order a custom embroidered hoodie?",
    answer:
      "Choose the colour and size, then write your name, initials or a short word (up to 12 characters) in the order note at checkout. We embroider it on the chest and ship within 3-5 working days.",
  },
  {
    id: "faq_track",
    category: "Shipping",
    question: "How do I track my order?",
    answer:
      "Use the Track Order page with your order number and email address, or open the order in your account.",
  },
  {
    id: "faq_care",
    category: "Care",
    question: "How should I wash my hoodie?",
    answer:
      "Wash cold, inside out, and tumble dry low. This keeps the fleece soft and the embroidery sharp.",
  },
];

export const settings: Record<string, unknown> = {
  "store.name": "Urban Store",
  "store.email": "support@urbanstore.pk",
  "store.phone": "+92 300 0000000",
  "store.currency": "PKR",
  "store.locale": "en-PK",
  "tax.rate": 0,
  "tax.inclusive": true,
  "payments.card.enabled": false,
  "payments.cod.enabled": true,
  "orders.numberPrefix": "US-",
  "returns.windowDays": 14,
  "reviews.autoApprove": false,
  "notifications.dailyDigest": true,
  "announcement.text": "Free shipping on orders over Rs 5,000 in Lahore, Karachi & Islamabad",
  "announcement.enabled": true,
};

/** Demo reviews by product slug (development only, never seeded in production). */
export const demoReviews: Record<string, { rating: number; title: string; body: string }[]> = {
  "urban-essential-pullover-hoodie": [
    {
      rating: 5,
      title: "My go-to hoodie",
      body: "Thick, soft inside and the hood actually keeps its shape. True to size; I'm 5'10\" and the M fits perfectly.",
    },
    {
      rating: 4,
      title: "Great, slightly long sleeves",
      body: "Really comfortable and warm for Lahore winters. Sleeves run a bit long but nothing a cuff can't fix.",
    },
    {
      rating: 5,
      title: "Survived ten washes",
      body: "Washed it inside out on cold as suggested and it still looks new. No pilling so far.",
    },
  ],
  "oversized-drop-shoulder-hoodie": [
    {
      rating: 5,
      title: "Proper oversized",
      body: "Exactly the boxy fit I wanted and the mocha colour is lovely. Size down if you want it less roomy.",
    },
    {
      rating: 3,
      title: "Nice but very big",
      body: "Quality is good but even the S is huge on me. Check the size guide before ordering.",
    },
  ],
  "zip-up-fleece-hoodie": [
    {
      rating: 4,
      title: "Smooth zip",
      body: "The zip is solid metal and doesn't snag. Good everyday layer for Islamabad evenings.",
    },
  ],
  "custom-embroidered-hoodie": [
    {
      rating: 5,
      title: "Perfect gift",
      body: "Ordered one with my brother's initials. The embroidery is neat and it arrived in four days.",
    },
  ],
};
