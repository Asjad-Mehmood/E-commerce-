# Hoodie Store: Full-Stack E-commerce Project Plan

A detailed plan for building a hoodie-selling website with a **customer storefront**, an **admin dashboard**, and a **backend API**.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [System Architecture](#3-system-architecture)
4. [Repository Structure](#4-repository-structure)
5. [User Roles & Permissions](#5-user-roles--permissions)
6. [Client Side (Storefront)](#6-client-side-storefront)
7. [Admin Side (Dashboard)](#7-admin-side-dashboard)
8. [Backend](#8-backend)
9. [Database Design](#9-database-design)
10. [API Endpoints](#10-api-endpoints)
11. [Key Business Flows](#11-key-business-flows)
12. [Security](#12-security)
13. [Performance, SEO & Accessibility](#13-performance-seo--accessibility)
14. [Testing Strategy](#14-testing-strategy)
15. [DevOps & Deployment](#15-devops--deployment)
16. [Development Roadmap (Phases)](#16-development-roadmap-phases)
17. [Task Checklist](#17-task-checklist)
18. [Future Enhancements](#18-future-enhancements)

---

## 1. Project Overview

### 1.1 Goal

An online store that sells hoodies (and later other apparel). Customers can browse, filter, pick size and color, add to cart, check out, pay online or by Cash on Delivery, and track their orders. Admins manage products, stock, orders, customers, discounts and content, and can see sales analytics.

### 1.2 Core Objectives

- A fast, mobile-first storefront with good SEO.
- Hoodie variants: **size × color**, each with its own stock and SKU.
- Secure checkout with several payment methods.
- A full admin panel with role-based access.
- A scalable, maintainable codebase (TypeScript everywhere, one monorepo).

### 1.3 Success Metrics

| Metric                          | Target      |
| ------------------------------- | ----------- |
| Lighthouse performance (mobile) | ≥ 90        |
| Time to Interactive             | < 3 s on 4G |
| Checkout conversion             | ≥ 2.5%      |
| API p95 latency                 | < 300 ms    |
| Uptime                          | 99.9%       |

---

## 2. Tech Stack

| Layer              | Choice                                                                                             | Why                                                         |
| ------------------ | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Language           | **TypeScript**                                                                                     | One language, shared types across apps                      |
| Storefront         | **Next.js 15 (App Router)** + React                                                                | SSR/SSG for SEO, image optimization                         |
| Admin panel        | **Next.js** (separate app) or **React + Vite**                                                     | Kept apart from the storefront for security and bundle size |
| UI                 | **Tailwind CSS** + **shadcn/ui**                                                                   | Fast, consistent design                                     |
| State / data       | **TanStack Query** (server state), **Zustand** (cart/UI state)                                     | Simple and well-tested                                      |
| Forms & validation | **React Hook Form** + **Zod**                                                                      | Zod schemas shared with the backend                         |
| Backend            | **Node.js + Express** (or **NestJS** for more structure)                                           | REST API                                                    |
| ORM                | **Prisma**                                                                                         | Type-safe queries, migrations                               |
| Database           | **PostgreSQL**                                                                                     | Relational data: orders, variants, inventory                |
| Cache / queues     | **Redis** + **BullMQ**                                                                             | Sessions, rate limiting, background jobs (emails)           |
| Auth               | **JWT** (access + refresh tokens in httpOnly cookies), Google OAuth                                | Secure, stateless                                           |
| Payments           | **Stripe** (cards), **Cash on Delivery**, optional local gateways (JazzCash / EasyPaisa / PayFast) | Covers international and local customers                    |
| Images             | **Cloudinary** or **AWS S3 + CloudFront**                                                          | Upload, resize, CDN                                         |
| Email              | **Resend** / **SendGrid** + **React Email** templates                                              | Transactional emails                                        |
| Search             | PostgreSQL full-text search (later **Meilisearch**)                                                | Start simple                                                |
| Monorepo           | **Turborepo** + **pnpm workspaces**                                                                | Shared packages, cached builds                              |
| Testing            | **Vitest**, **Supertest**, **Playwright**                                                          | Unit, API and E2E tests                                     |
| CI/CD              | **GitHub Actions**                                                                                 | Lint, test and deploy on push                               |
| Hosting            | Vercel (frontends), Railway / Render / AWS (API), Neon / Supabase (Postgres), Upstash (Redis)      | Managed, low-ops                                            |
| Monitoring         | **Sentry**, **UptimeRobot**, structured logs (Pino)                                                | Error and uptime tracking                                   |

---

## 3. System Architecture

```
                ┌──────────────────────┐        ┌──────────────────────┐
  Customers ──▶ │  Storefront (Next.js)│        │  Admin (Next.js)     │ ◀── Staff
                │  shop.example.com    │        │  admin.example.com   │
                └──────────┬───────────┘        └──────────┬───────────┘
                           │  HTTPS / JSON (REST)          │
                           └──────────────┬────────────────┘
                                          ▼
                              ┌────────────────────────┐
                              │  Backend API (Express) │  api.example.com
                              │  Auth · Products · Cart│
                              │  Orders · Payments ... │
                              └───┬──────┬──────┬──────┘
                                  │      │      │
                    ┌─────────────┘      │      └──────────────┐
                    ▼                    ▼                     ▼
             ┌────────────┐       ┌────────────┐        ┌──────────────┐
             │ PostgreSQL │       │   Redis    │        │ Worker       │
             │ (Prisma)   │       │ cache/queue│◀──────▶│ (BullMQ jobs)│
             └────────────┘       └────────────┘        └──────┬───────┘
                                                               │
        External services: Stripe (webhooks) · Cloudinary · Email · Courier APIs
```

**Principles**

- The API is the single source of truth. Both frontends talk only to the API.
- Stripe webhooks confirm payments on the server. Never trust the client.
- Slow work (emails, image processing, reports) runs in background jobs.
- Validation schemas live in a shared `packages/validation` package used by the frontends and the API.

---

## 4. Repository Structure

```
E-commerce-/
├── apps/
│   ├── storefront/          # Next.js customer site
│   │   ├── app/             # routes (App Router)
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── lib/             # api client, utils
│   │   └── store/           # Zustand (cart, ui)
│   ├── admin/               # Next.js admin dashboard
│   │   ├── app/
│   │   ├── components/
│   │   └── lib/
│   └── api/                 # Express backend
│       ├── src/
│       │   ├── config/      # env, db, redis, stripe
│       │   ├── modules/     # auth, users, products, cart, orders, ...
│       │   │   └── products/
│       │   │       ├── products.routes.ts
│       │   │       ├── products.controller.ts
│       │   │       ├── products.service.ts
│       │   │       └── products.test.ts
│       │   ├── middleware/  # auth, rbac, error, rateLimit, validate
│       │   ├── jobs/        # BullMQ workers (email, stock alerts)
│       │   ├── utils/
│       │   └── server.ts
│       └── prisma/
│           ├── schema.prisma
│           ├── migrations/
│           └── seed.ts
├── packages/
│   ├── ui/                  # shared React components
│   ├── validation/          # Zod schemas
│   ├── types/               # shared TS types / DTOs
│   ├── config/              # eslint, tsconfig, tailwind presets
│   └── emails/              # React Email templates
├── .github/workflows/       # CI/CD
├── docker-compose.yml       # local Postgres + Redis
├── turbo.json
├── pnpm-workspace.yaml
├── .env.example
├── PLAN.md
└── README.md
```

---

## 5. User Roles & Permissions

| Role                | Access                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------ |
| **Guest**           | Browse, search, cart, guest checkout                                                       |
| **Customer**        | Everything a guest can do, plus account, order history, wishlist, reviews, saved addresses |
| **Support** (admin) | View orders and customers, update order status, reply to messages                          |
| **Manager** (admin) | Products, inventory, categories, coupons, content, plus everything Support can do          |
| **Super Admin**     | Everything, including staff accounts, settings, payment config and analytics               |

RBAC is enforced in API middleware (`requireRole('MANAGER')`) **and** reflected in the admin UI, which hides menu items a role can't use.

---

## 6. Client Side (Storefront)

### 6.1 Pages & Routes

| Route                                                  | Page                 | Key contents                                                                                                           |
| ------------------------------------------------------ | -------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `/`                                                    | Home                 | Hero banner, featured hoodies, new arrivals, best sellers, collections, testimonials, newsletter                       |
| `/shop`                                                | All products         | Grid, filters, sort, pagination / infinite scroll                                                                      |
| `/collections/[slug]`                                  | Collection           | e.g. Oversized, Zip-Up, Pullover, Graphic, Winter                                                                      |
| `/products/[slug]`                                     | Product detail       | Gallery, size and color picker, stock status, size guide, description, fabric and care info, reviews, related products |
| `/search?q=`                                           | Search results       | Full-text search with filters                                                                                          |
| `/cart`                                                | Cart                 | Line items, quantity update, coupon, subtotal, shipping estimate                                                       |
| `/checkout`                                            | Checkout             | Steps: Contact → Shipping → Delivery method → Payment → Review                                                         |
| `/checkout/success`                                    | Order confirmation   | Order number, summary, next steps                                                                                      |
| `/login`, `/register`                                  | Auth                 | Email/password, Google login                                                                                           |
| `/forgot-password`, `/reset-password`                  | Password reset       | Token-based                                                                                                            |
| `/account`                                             | Dashboard            | Overview                                                                                                               |
| `/account/orders`                                      | Order history        | List with status                                                                                                       |
| `/account/orders/[id]`                                 | Order detail         | Items, tracking timeline, invoice download, return request                                                             |
| `/account/addresses`                                   | Address book         | CRUD, set default                                                                                                      |
| `/account/wishlist`                                    | Wishlist             | Saved items, move to cart                                                                                              |
| `/account/profile`                                     | Profile              | Name, email, password, phone                                                                                           |
| `/track-order`                                         | Guest order tracking | Order # + email                                                                                                        |
| `/size-guide`                                          | Size chart           | Measurements per fit (regular / oversized)                                                                             |
| `/about`, `/contact`, `/faq`                           | Content pages        | Contact form goes to the admin inbox                                                                                   |
| `/policies/shipping`, `/returns`, `/privacy`, `/terms` | Legal                | CMS-managed                                                                                                            |
| `404`, `500`                                           | Error pages          | Friendly, with links back                                                                                              |

### 6.2 Hoodie-Specific Features

- **Variant picker**: color swatches change the gallery images. Size buttons are disabled when that size is out of stock.
- **Size guide modal** with a measurement table (chest, length, sleeve) and a "find my size" helper (height/weight → suggested size).
- **Fit info**: Regular / Oversized / Slim, with a model's height and the size they wear.
- **Fabric details**: GSM (e.g. 320 GSM fleece), cotton/poly blend, care instructions.
- **Low stock badge** ("Only 3 left in M").
- **Notify me when back in stock** for sold-out variants.
- _(Optional, Phase 5)_ **Custom hoodie designer**: upload a print or add text, with a live preview.

### 6.3 Filtering & Sorting

- Filters: category, size, color, price range, fit, fabric, in stock only, on sale.
- Sorting: newest, price low→high, price high→low, best selling, top rated.
- Filters are stored in URL query params so they can be shared and are crawlable.

### 6.4 Cart Behavior

- Guests: the cart lives in local storage (Zustand persist) and is mirrored to the server with a `cartToken` cookie.
- On login, the guest cart **merges** into the user's server cart.
- The server re-checks stock and price on every cart change and at checkout.
- Slide-out mini cart drawer with an "Added to cart" confirmation.

### 6.5 Checkout

- Guest checkout allowed, with an optional "create account" at the end.
- Address form with validation (phone format, postal code).
- Delivery options: Standard / Express, with prices from admin shipping rules.
- Payment: Stripe card (Payment Element), Cash on Delivery, and optional local wallets.
- Coupon code and free-shipping threshold banner ("Spend Rs 1,500 more for free shipping").
- Order summary with tax and shipping breakdown.

### 6.6 UI / UX Requirements

- Mobile-first responsive layout (breakpoints: 640 / 768 / 1024 / 1280).
- Sticky header with mega-menu, search and cart icon with item count.
- Skeleton loaders, optimistic UI for cart and wishlist.
- Toast notifications.
- Dark/light mode (optional).
- Accessible components (keyboard navigation, ARIA labels, contrast).

### 6.7 Storefront Components (shared `packages/ui`)

`Header`, `Footer`, `MegaMenu`, `SearchBar`, `ProductCard`, `ProductGrid`, `ProductGallery`, `VariantSelector`, `SizeGuideModal`, `PriceTag`, `RatingStars`, `ReviewList`, `ReviewForm`, `CartDrawer`, `CartItem`, `CouponInput`, `CheckoutStepper`, `AddressForm`, `OrderTimeline`, `Breadcrumbs`, `Pagination`, `FilterSidebar`, `Badge`, `Button`, `Input`, `Modal`, `Toast`, `Skeleton`.

---

## 7. Admin Side (Dashboard)

### 7.1 Layout

Sidebar navigation, top bar (search, notifications, profile), breadcrumbs, and data tables with search, filter, sort, pagination, bulk actions and CSV export.

### 7.2 Modules & Pages

| Module                       | Route                             | Features                                                                                                                                                                                                                                                                                                  |
| ---------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Dashboard**                | `/`                               | KPIs (revenue today/week/month, orders, AOV, new customers, conversion), sales chart, top products, low-stock alerts, recent orders                                                                                                                                                                       |
| **Products**                 | `/products`                       | List, search, filter by status/category, bulk publish/unpublish/delete                                                                                                                                                                                                                                    |
|                              | `/products/new`, `/products/[id]` | Title, slug, description (rich text), category, tags, fit, fabric, price, compare-at price, SEO fields, image upload (drag & drop, reorder), **variant matrix generator** (pick sizes and colors to generate SKUs), per-variant price/stock/SKU/barcode, per-color images, status (draft/active/archived) |
| **Categories & Collections** | `/categories`, `/collections`     | CRUD, nesting, banner image, manual or rule-based collections                                                                                                                                                                                                                                             |
| **Inventory**                | `/inventory`                      | Stock per variant, quick edit, stock adjustment with reason (restock, damage, correction), adjustment history, low-stock threshold                                                                                                                                                                        |
| **Orders**                   | `/orders`                         | List with status filter, date range, payment method, search by #/email/phone                                                                                                                                                                                                                              |
|                              | `/orders/[id]`                    | Customer and address, items, payment status, timeline, change status, add tracking number, internal notes, print invoice / packing slip, refund (full/partial via Stripe), cancel                                                                                                                         |
| **Returns**                  | `/returns`                        | Approve/reject return requests, restock on receipt, issue refund                                                                                                                                                                                                                                          |
| **Customers**                | `/customers`                      | List, profile, order history, lifetime value, block/unblock, notes                                                                                                                                                                                                                                        |
| **Reviews**                  | `/reviews`                        | Moderate (approve/hide), reply                                                                                                                                                                                                                                                                            |
| **Discounts**                | `/coupons`                        | Percentage / fixed / free shipping, min order, usage limit (total and per user), start/end dates, applies to products/categories                                                                                                                                                                          |
| **Shipping**                 | `/settings/shipping`              | Zones (cities/countries), flat or weight-based rates, free-shipping threshold, COD fee                                                                                                                                                                                                                    |
| **Content (CMS)**            | `/content`                        | Homepage banners/sliders, announcement bar, FAQ, policy pages                                                                                                                                                                                                                                             |
| **Messages**                 | `/messages`                       | Contact-form submissions and status                                                                                                                                                                                                                                                                       |
| **Reports**                  | `/reports`                        | Sales by day/product/category, best sellers, inventory valuation, CSV export                                                                                                                                                                                                                              |
| **Staff**                    | `/staff`                          | Invite admin users, assign roles, deactivate                                                                                                                                                                                                                                                              |
| **Settings**                 | `/settings`                       | Store info, currency, tax rate, payment methods toggle, email templates, SEO defaults                                                                                                                                                                                                                     |
| **Activity Log**             | `/audit-log`                      | Who changed what and when                                                                                                                                                                                                                                                                                 |

### 7.3 Admin Notifications

- Real-time new-order notification (polling or Server-Sent Events).
- Daily email digest: sales summary and low stock.

---

## 8. Backend

### 8.1 Modules

Each module has `routes → controller → service → Prisma`. Business logic goes in services.

| Module                       | Responsibility                                                                                  |
| ---------------------------- | ----------------------------------------------------------------------------------------------- |
| `auth`                       | Register, login, logout, refresh token, email verification, forgot/reset password, Google OAuth |
| `users`                      | Profile, addresses, admin user management                                                       |
| `products`                   | Product CRUD, variants, images, slug generation, publish status                                 |
| `categories` / `collections` | Taxonomy                                                                                        |
| `inventory`                  | Stock levels, reservations, adjustments, low-stock alerts                                       |
| `cart`                       | Guest and user carts, merge, price/stock validation                                             |
| `wishlist`                   | Add/remove                                                                                      |
| `checkout`                   | Compute totals (subtotal, discount, shipping, tax), create order and payment intent             |
| `orders`                     | Order lifecycle, status history, invoices                                                       |
| `payments`                   | Stripe intents, webhooks, refunds, COD handling                                                 |
| `shipping`                   | Zones, rates, tracking numbers                                                                  |
| `coupons`                    | Validation and application rules                                                                |
| `reviews`                    | Create (verified buyers only), moderation                                                       |
| `cms`                        | Banners, pages, FAQ                                                                             |
| `notifications`              | Email queue, back-in-stock alerts                                                               |
| `analytics`                  | Dashboard aggregates, reports                                                                   |
| `uploads`                    | Signed upload URLs for Cloudinary/S3                                                            |
| `audit`                      | Log admin actions                                                                               |

### 8.2 Middleware

- `authenticate`: verify JWT from the httpOnly cookie.
- `authorize(...roles)`: RBAC.
- `validate(schema)`: Zod validation of body/query/params.
- `rateLimit`: Redis-backed, stricter on auth and checkout.
- `errorHandler`: consistent error format `{ error: { code, message, details } }`.
- `requestLogger`: Pino with request IDs.
- `helmet`, `cors` (allow only the storefront and admin origins), `compression`.

### 8.3 Background Jobs (BullMQ)

- Send emails (welcome, verify email, order confirmation, shipped, delivered, password reset, abandoned cart).
- Release expired stock reservations.
- Back-in-stock notifications.
- Abandoned cart reminders (1h / 24h).
- Nightly analytics aggregation.

### 8.4 Order Status Lifecycle

```
PENDING_PAYMENT ──▶ PAID / CONFIRMED (COD) ──▶ PROCESSING ──▶ SHIPPED ──▶ DELIVERED
       │                     │                      │
       ▼                     ▼                      ▼
   CANCELLED             CANCELLED              RETURN_REQUESTED ──▶ RETURNED ──▶ REFUNDED
```

Every status change is written to `OrderStatusHistory` and can trigger an email.

---

## 9. Database Design

### 9.1 Entity Relationship Overview

```
User 1─* Address
User 1─* Order 1─* OrderItem *─1 ProductVariant
User 1─1 Cart 1─* CartItem *─1 ProductVariant
User 1─* Review *─1 Product
User 1─* WishlistItem *─1 Product
Product 1─* ProductVariant (size × color)
Product 1─* ProductImage (optionally linked to a color)
Product *─* Category
Product *─* Collection
Order 1─* Payment
Order 1─* OrderStatusHistory
Order *─1 Coupon
ProductVariant 1─* InventoryAdjustment
```

### 9.2 Prisma Schema (draft)

```prisma
enum Role          { CUSTOMER SUPPORT MANAGER SUPER_ADMIN }
enum ProductStatus { DRAFT ACTIVE ARCHIVED }
enum Fit           { REGULAR OVERSIZED SLIM }
enum OrderStatus   { PENDING_PAYMENT CONFIRMED PAID PROCESSING SHIPPED DELIVERED CANCELLED RETURN_REQUESTED RETURNED REFUNDED }
enum PaymentMethod { STRIPE COD JAZZCASH EASYPAISA }
enum PaymentStatus { PENDING SUCCEEDED FAILED REFUNDED PARTIALLY_REFUNDED }
enum DiscountType  { PERCENTAGE FIXED FREE_SHIPPING }

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  passwordHash  String?
  name          String
  phone         String?
  role          Role      @default(CUSTOMER)
  emailVerified DateTime?
  googleId      String?   @unique
  isBlocked     Boolean   @default(false)
  addresses     Address[]
  orders        Order[]
  reviews       Review[]
  wishlist      WishlistItem[]
  cart          Cart?
  refreshTokens RefreshToken[]
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model RefreshToken {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash String   @unique
  expiresAt DateTime
  revokedAt DateTime?
  createdAt DateTime @default(now())
}

model Address {
  id         String  @id @default(cuid())
  userId     String
  user       User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  fullName   String
  phone      String
  line1      String
  line2      String?
  city       String
  state      String?
  postalCode String
  country    String  @default("PK")
  isDefault  Boolean @default(false)
}

model Category {
  id          String     @id @default(cuid())
  name        String
  slug        String     @unique
  description String?
  imageUrl    String?
  parentId    String?
  parent      Category?  @relation("CategoryTree", fields: [parentId], references: [id])
  children    Category[] @relation("CategoryTree")
  products    Product[]
}

model Collection {
  id          String    @id @default(cuid())
  name        String
  slug        String    @unique
  description String?
  bannerUrl   String?
  isFeatured  Boolean   @default(false)
  products    Product[]
}

model Product {
  id              String           @id @default(cuid())
  title           String
  slug            String           @unique
  description     String
  fit             Fit              @default(REGULAR)
  fabric          String?          // e.g. "80% cotton / 20% polyester, 320 GSM"
  careInfo        String?
  basePrice       Int              // stored in minor units (paisa/cents)
  compareAtPrice  Int?
  status          ProductStatus    @default(DRAFT)
  isFeatured      Boolean          @default(false)
  seoTitle        String?
  seoDescription  String?
  categories      Category[]
  collections     Collection[]
  variants        ProductVariant[]
  images          ProductImage[]
  reviews         Review[]
  avgRating       Float            @default(0)
  reviewCount     Int              @default(0)
  soldCount       Int              @default(0)
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt
  @@index([status, createdAt])
}

model ProductVariant {
  id            String   @id @default(cuid())
  productId     String
  product       Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  sku           String   @unique
  size          String   // XS, S, M, L, XL, XXL
  color         String   // "Jet Black"
  colorHex      String?  // "#111111"
  price         Int?     // overrides basePrice if set
  stock         Int      @default(0)
  reserved      Int      @default(0)
  lowStockAt    Int      @default(5)
  weightGrams   Int?
  isActive      Boolean  @default(true)
  adjustments   InventoryAdjustment[]
  @@unique([productId, size, color])
}

model ProductImage {
  id        String  @id @default(cuid())
  productId String
  product   Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  url       String
  alt       String?
  color     String? // links image to a color variant
  position  Int     @default(0)
}

model InventoryAdjustment {
  id         String         @id @default(cuid())
  variantId  String
  variant    ProductVariant @relation(fields: [variantId], references: [id])
  change     Int            // +10 restock, -2 damaged
  reason     String
  adminId    String?
  createdAt  DateTime       @default(now())
}

model Cart {
  id        String     @id @default(cuid())
  userId    String?    @unique
  user      User?      @relation(fields: [userId], references: [id])
  token     String?    @unique // guest cart token
  items     CartItem[]
  updatedAt DateTime   @updatedAt
}

model CartItem {
  id        String @id @default(cuid())
  cartId    String
  cart      Cart   @relation(fields: [cartId], references: [id], onDelete: Cascade)
  variantId String
  quantity  Int
  @@unique([cartId, variantId])
}

model WishlistItem {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  productId String
  createdAt DateTime @default(now())
  @@unique([userId, productId])
}

model Coupon {
  id             String       @id @default(cuid())
  code           String       @unique
  type           DiscountType
  value          Int          // percent or amount in minor units
  minOrderAmount Int?
  maxUses        Int?
  maxUsesPerUser Int?
  usedCount      Int          @default(0)
  startsAt       DateTime?
  endsAt         DateTime?
  isActive       Boolean      @default(true)
  orders         Order[]
}

model Order {
  id              String        @id @default(cuid())
  orderNumber     String        @unique // e.g. HD-10025
  userId          String?
  user            User?         @relation(fields: [userId], references: [id])
  email           String
  phone           String
  shippingAddress Json          // snapshot at order time
  billingAddress  Json?
  status          OrderStatus   @default(PENDING_PAYMENT)
  paymentMethod   PaymentMethod
  subtotal        Int
  discountTotal   Int           @default(0)
  shippingTotal   Int           @default(0)
  taxTotal        Int           @default(0)
  grandTotal      Int
  couponId        String?
  coupon          Coupon?       @relation(fields: [couponId], references: [id])
  shippingMethod  String
  trackingNumber  String?
  courier         String?
  notes           String?       // customer note
  adminNotes      String?
  items           OrderItem[]
  payments        Payment[]
  history         OrderStatusHistory[]
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  @@index([status, createdAt])
}

model OrderItem {
  id          String @id @default(cuid())
  orderId     String
  order       Order  @relation(fields: [orderId], references: [id], onDelete: Cascade)
  variantId   String
  // snapshot fields so historical orders don't change if the product changes
  productTitle String
  size         String
  color        String
  sku          String
  imageUrl     String?
  unitPrice    Int
  quantity     Int
  lineTotal    Int
}

model Payment {
  id              String        @id @default(cuid())
  orderId         String
  order           Order         @relation(fields: [orderId], references: [id])
  method          PaymentMethod
  status          PaymentStatus @default(PENDING)
  amount          Int
  providerRef     String?       // Stripe PaymentIntent id
  refundedAmount  Int           @default(0)
  rawResponse     Json?
  createdAt       DateTime      @default(now())
}

model OrderStatusHistory {
  id        String      @id @default(cuid())
  orderId   String
  order     Order       @relation(fields: [orderId], references: [id], onDelete: Cascade)
  status    OrderStatus
  note      String?
  changedBy String?
  createdAt DateTime    @default(now())
}

model Review {
  id         String   @id @default(cuid())
  productId  String
  product    Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  userId     String
  user       User     @relation(fields: [userId], references: [id])
  rating     Int      // 1-5
  title      String?
  body       String
  images     String[]
  isApproved Boolean  @default(false)
  adminReply String?
  createdAt  DateTime @default(now())
  @@unique([productId, userId])
}

model ShippingZone {
  id                String  @id @default(cuid())
  name              String  // "Lahore", "Rest of Pakistan"
  regions           String[]
  standardRate      Int
  expressRate       Int?
  freeOverAmount    Int?
  codFee            Int     @default(0)
  estimatedDays     String  // "2-4"
}

model Banner      { id String @id @default(cuid()) title String imageUrl String link String? position Int @default(0) isActive Boolean @default(true) }
model Page        { id String @id @default(cuid()) slug String @unique title String content String updatedAt DateTime @updatedAt }
model Faq         { id String @id @default(cuid()) question String answer String position Int @default(0) }
model ContactMessage { id String @id @default(cuid()) name String email String subject String? message String status String @default("NEW") createdAt DateTime @default(now()) }
model StockAlert  { id String @id @default(cuid()) email String variantId String notifiedAt DateTime? createdAt DateTime @default(now()) @@unique([email, variantId]) }
model AuditLog    { id String @id @default(cuid()) adminId String action String entity String entityId String diff Json? createdAt DateTime @default(now()) }
model Setting     { key String @id value Json }
```

> **Money rule:** always store money as integers in minor units (paisa/cents). Never use floats.

---

## 10. API Endpoints

Base URL: `/api/v1`. All responses are JSON. Admin routes are prefixed with `/admin` and need an admin role.

### 10.1 Auth

| Method | Endpoint                                 | Description                             |
| ------ | ---------------------------------------- | --------------------------------------- |
| POST   | `/auth/register`                         | Create account, send verification email |
| POST   | `/auth/login`                            | Set access and refresh cookies          |
| POST   | `/auth/logout`                           | Revoke refresh token                    |
| POST   | `/auth/refresh`                          | Rotate tokens                           |
| GET    | `/auth/me`                               | Current user                            |
| POST   | `/auth/verify-email`                     | Verify with token                       |
| POST   | `/auth/forgot-password`                  | Send reset email                        |
| POST   | `/auth/reset-password`                   | Reset with token                        |
| GET    | `/auth/google` / `/auth/google/callback` | OAuth                                   |

### 10.2 Public Catalog

| Method | Endpoint                              | Description                                                                     |
| ------ | ------------------------------------- | ------------------------------------------------------------------------------- |
| GET    | `/products`                           | List with `?category=&size=&color=&minPrice=&maxPrice=&fit=&sort=&page=&limit=` |
| GET    | `/products/:slug`                     | Detail with variants, images, rating                                            |
| GET    | `/products/:id/related`               | Related products                                                                |
| GET    | `/products/:id/reviews`               | Approved reviews (paginated)                                                    |
| GET    | `/categories`                         | Category tree                                                                   |
| GET    | `/collections` / `/collections/:slug` | Collections                                                                     |
| GET    | `/search?q=`                          | Search                                                                          |
| GET    | `/filters`                            | Available sizes, colors, price range (for the filter UI)                        |
| GET    | `/cms/home`                           | Banners, featured sections                                                      |
| GET    | `/cms/pages/:slug`                    | Policy/content page                                                             |
| GET    | `/cms/faq`                            | FAQ                                                                             |
| POST   | `/contact`                            | Contact form                                                                    |
| POST   | `/stock-alerts`                       | Back-in-stock subscribe                                                         |
| POST   | `/newsletter`                         | Subscribe                                                                       |

### 10.3 Cart & Checkout

| Method | Endpoint                               | Description                                               |
| ------ | -------------------------------------- | --------------------------------------------------------- |
| GET    | `/cart`                                | Get cart (user or guest token)                            |
| POST   | `/cart/items`                          | Add `{ variantId, quantity }`                             |
| PATCH  | `/cart/items/:id`                      | Update quantity                                           |
| DELETE | `/cart/items/:id`                      | Remove                                                    |
| DELETE | `/cart`                                | Empty the cart (guest cart merges automatically on login) |
| POST   | `/cart/coupon` / DELETE `/cart/coupon` | Apply/remove coupon                                       |
| POST   | `/checkout/quote`                      | Totals for address + shipping method                      |
| POST   | `/checkout`                            | Create order. For Stripe, returns `clientSecret`          |
| POST   | `/payments/stripe/webhook`             | Stripe webhook (raw body, signature verified)             |

### 10.4 Customer Account (auth required)

| Method                | Endpoint                        | Description                               |
| --------------------- | ------------------------------- | ----------------------------------------- |
| PATCH                 | `/me`                           | Update profile                            |
| PATCH                 | `/auth/password`                | Change password (signs out other devices) |
| GET/POST/PATCH/DELETE | `/me/addresses[/:id]`           | Address book                              |
| GET                   | `/me/orders` / `/me/orders/:id` | Order history                             |
| POST                  | `/me/orders/:id/cancel`         | Cancel (if not yet shipped)               |
| POST                  | `/me/orders/:id/return`         | Request return                            |
| GET                   | `/me/orders/:id/invoice`        | PDF invoice                               |
| GET/POST/DELETE       | `/me/wishlist[/:productId]`     | Wishlist                                  |
| POST                  | `/products/:id/reviews`         | Write review (verified purchase)          |
| GET                   | `/orders/track?number=&email=`  | Guest tracking (public)                   |

### 10.5 Admin

| Method            | Endpoint                                              | Description                                          |
| ----------------- | ----------------------------------------------------- | ---------------------------------------------------- |
| GET               | `/admin/dashboard`                                    | KPIs and charts data                                 |
| GET/POST          | `/admin/products`                                     | List / create                                        |
| GET/PATCH/DELETE  | `/admin/products/:id`                                 | Read / update / archive                              |
| POST              | `/admin/products/:id/variants/generate`               | Generate size × color matrix                         |
| POST/PATCH/DELETE | `/admin/products/:id/variants`, `/admin/variants/:id` | Add / update (price, SKU, active) / delete a variant |
| POST/GET          | `/admin/variants/:id/adjust-stock`, `/stock-history`  | Adjust stock with a reason; history                  |
| POST              | `/admin/products/bulk`                                | Bulk publish/archive/delete                          |
| POST              | `/admin/uploads/sign`                                 | Signed upload URL                                    |
| CRUD              | `/admin/categories`, `/admin/collections`             | Taxonomy                                             |
| GET               | `/admin/inventory`                                    | Stock list, low-stock filter                         |
| POST              | `/admin/inventory/:variantId/adjust`                  | Adjust with reason                                   |
| GET               | `/admin/orders`                                       | List with filters                                    |
| GET/PATCH         | `/admin/orders/:id`                                   | Detail, update status/tracking/notes                 |
| POST              | `/admin/orders/:id/refund`                            | Full/partial refund                                  |
| GET               | `/admin/orders/:id/packing-slip`                      | PDF                                                  |
| GET               | `/admin/orders/export`                                | CSV                                                  |
| GET/PATCH         | `/admin/returns[/:id]`                                | Return management                                    |
| GET               | `/admin/customers` / `/admin/customers/:id`           | Customer list/detail                                 |
| PATCH             | `/admin/customers/:id/block`                          | Block/unblock                                        |
| GET/PATCH/DELETE  | `/admin/reviews[/:id]`                                | Moderation                                           |
| CRUD              | `/admin/coupons`                                      | Discounts                                            |
| CRUD              | `/admin/shipping-zones`                               | Shipping                                             |
| CRUD              | `/admin/banners`, `/admin/pages`, `/admin/faq`        | CMS                                                  |
| GET/PATCH         | `/admin/messages[/:id]`                               | Contact inbox                                        |
| GET               | `/admin/reports/sales?from=&to=&groupBy=`             | Reports                                              |
| CRUD              | `/admin/staff`                                        | Staff users and roles (Super Admin)                  |
| GET/PATCH         | `/admin/settings`                                     | Store settings                                       |
| GET               | `/admin/audit-log`                                    | Activity log                                         |

### 10.6 Standard Response Shapes

```json
// list
{ "data": [ ... ], "meta": { "page": 1, "limit": 20, "total": 134, "totalPages": 7 } }

// error
{ "error": { "code": "OUT_OF_STOCK", "message": "Size M in Black is out of stock", "details": { "variantId": "..." } } }
```

---

## 11. Key Business Flows

### 11.1 Checkout with Stripe

1. The client sends `POST /checkout` with the cart, address, shipping method and `paymentMethod=STRIPE`.
2. The server, inside a **DB transaction**:
   - re-validates prices, stock and coupon;
   - computes totals on the server;
   - **reserves stock** (`reserved += qty`) for 15 minutes;
   - creates the `Order` (`PENDING_PAYMENT`) and `OrderItems` (snapshots);
   - creates a Stripe PaymentIntent (with an idempotency key) and a `Payment` row.
3. It returns `clientSecret`, and the client confirms payment with the Stripe Payment Element.
4. **Stripe webhook** `payment_intent.succeeded`: mark the order `PAID`, convert the reservation to a sale (`stock -= qty`, `reserved -= qty`), add coupon usage, clear the cart, and queue a confirmation email.
5. `payment_intent.payment_failed` or reservation expiry: release the reserved stock and mark the order `CANCELLED`.

### 11.2 Checkout with Cash on Delivery

Same validation. The order is created as `CONFIRMED`, stock is decremented right away, the COD fee is added, and the confirmation email is sent. An admin can phone-verify before marking it `PROCESSING`.

### 11.3 Preventing Overselling

- Use `UPDATE ... SET reserved = reserved + :q WHERE id = :id AND stock - reserved >= :q` (an atomic conditional update). If 0 rows change, the item is out of stock.
- A scheduled job releases expired reservations every minute.

### 11.4 Returns & Refunds

Customer requests a return within N days of delivery → admin approves → item received → admin marks it returned (optionally restocking it) → refund via Stripe API, or manually for COD → email.

### 11.5 Back-in-Stock

When an admin raises stock on a variant from 0 to more than 0, a job emails everyone in `StockAlert` for that variant.

---

## 12. Security

- Passwords hashed with **argon2** (or bcrypt, cost 12).
- JWT access token (15 min) and refresh token (7–30 days, rotated, stored hashed) in **httpOnly, Secure, SameSite** cookies.
- CSRF protection for cookie auth (SameSite plus a CSRF token on state-changing requests).
- Zod validation on **every** input. Prisma parameterizes queries, which prevents SQL injection.
- Rate limiting: login 5/min/IP, register, forgot-password, checkout, contact form.
- `helmet` security headers and a strict CORS allowlist.
- Stripe webhook signature verification. Prices are **never** trusted from the client.
- The admin app runs on a separate subdomain. Optional 2FA (TOTP) for admins.
- File uploads: type and size checks, upload straight to Cloudinary/S3 via signed URLs.
- Sanitize rich-text HTML (DOMPurify) before rendering.
- Secrets live in environment variables only. `.env` is never committed, and `.env.example` documents the keys.
- Audit log for all admin write actions.
- Run `npm audit` / Dependabot regularly.
- Never store card data. Stripe handles PCI compliance.

---

## 13. Performance, SEO & Accessibility

**Performance**

- SSG/ISR for product and collection pages (revalidate on product update via an on-demand revalidation webhook).
- `next/image` with responsive sizes, AVIF/WebP, lazy loading.
- Redis cache for hot endpoints (home, categories, filters).
- DB indexes on slugs, status, createdAt, foreign keys.
- Code splitting and minimal client JS on the storefront.

**SEO**

- Per-page `<title>`, meta description, Open Graph and Twitter cards.
- `Product`, `BreadcrumbList`, `Organization` and `Review` JSON-LD structured data.
- `sitemap.xml` and `robots.txt` generated automatically.
- Clean slugs (`/products/classic-oversized-black-hoodie`), canonical URLs.

**Accessibility (WCAG 2.1 AA)**

- Semantic HTML, alt text on images, focus states, keyboard-navigable menus and modals, color contrast ≥ 4.5:1, labelled form fields with error messages.

**Analytics**

- Google Analytics 4 / Plausible, Meta Pixel (optional), e-commerce events: `view_item`, `add_to_cart`, `begin_checkout`, `purchase`.

---

## 14. Testing Strategy

| Type              | Tool                                        | Coverage                                                                                                  |
| ----------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Unit              | Vitest                                      | Services: pricing, coupon rules, shipping calc, stock reservation                                         |
| Integration / API | Vitest + Supertest + test Postgres (Docker) | Every endpoint: happy path, validation, auth/RBAC                                                         |
| Component         | React Testing Library                       | VariantSelector, Cart, Checkout forms                                                                     |
| E2E               | Playwright                                  | Browse → add to cart → checkout (Stripe test card + COD), login, admin creates product, admin ships order |
| Load              | k6                                          | Product listing and checkout under load                                                                   |
| Manual QA         | Checklist                                   | Mobile devices, browsers, payment edge cases                                                              |

Target ≥ 80% coverage on backend services. CI blocks merges when tests fail.

---

## 15. DevOps & Deployment

### 15.1 Environments

`local` (Docker Compose: Postgres + Redis) → `staging` (auto-deploy from `develop`) → `production` (deploy from `main` after approval).

### 15.2 Environment Variables (`.env.example`)

```
DATABASE_URL=
REDIS_URL=
JWT_ACCESS_SECRET=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
RESEND_API_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
STOREFRONT_URL=
ADMIN_URL=
NEXT_PUBLIC_API_URL=
SENTRY_DSN=
```

### 15.3 CI/CD (GitHub Actions)

1. On PR: install → lint → typecheck → unit and integration tests → build.
2. On merge to `develop`: deploy to staging, then run Playwright E2E against staging.
3. On merge to `main`: run `prisma migrate deploy`, then deploy the API, storefront and admin.

### 15.4 Operations

- Daily automated DB backups with point-in-time recovery.
- Sentry for frontend and backend errors. Uptime monitoring on `/health`.
- Structured logs with request IDs.
- Git branching: `main` (prod), `develop` (staging), `feature/*` branches with PR reviews.

---

## 16. Development Roadmap (Phases)

Estimated for 1–2 developers. Adjust to your team size.

### Phase 0: Setup & Design (Week 1) ✅ code complete

> Done: monorepo, shared packages, API skeleton with health check and error handling, full Prisma schema + initial migration, idempotent seed (8 hoodies / 90 variants), storefront and admin shells, lint/format/commit hooks, CI. Still open: brand and Figma designs.

- Finalize requirements, brand (logo, colors, fonts), and sitemap.
- Wireframes and UI design in Figma: home, PLP, PDP, cart, checkout, account, admin dashboard, product form, order detail.
- Set up the monorepo (Turborepo + pnpm), ESLint, Prettier, Husky, Docker Compose, CI skeleton.
- Prisma schema v1, migrations, seed script (sample hoodies, sizes, colors, admin user).

**Deliverable:** running empty apps, DB seeded, CI green.

### Phase 1: Backend Core (Weeks 2–3) ✅ complete

> Done: auth (register, login, refresh rotation with theft detection, logout, email verification, password reset/change), profile and address book, RBAC, Redis-backed rate limiting, CSRF origin check, public catalog with filters/search/sort, admin products/variants/stock/categories/collections with audit log, Cloudinary upload signing, guest + user cart with automatic merge on login, OpenAPI docs at `/api/docs`, 120 API tests on an isolated test database.
>
> Changes from the original plan:
>
> - Change password is `PATCH /auth/password` (not `/me/password`): the refresh cookie that identifies "this device" is only sent to `/auth` paths.
> - The guest cart merges automatically on login/register, so there is no separate `/cart/merge` endpoint.
> - Stock adjustments are `POST /admin/variants/:id/adjust-stock` (plus `GET …/stock-history`). Stock cannot be set directly, so every change is recorded.
> - Refresh tokens are opaque random strings stored hashed, so `JWT_REFRESH_SECRET` is not needed.
> - Google OAuth moves to Phase 5 (needs OAuth credentials). API docs live at `/api/docs`.

- Auth (register/login/refresh/logout, email verification, reset password).
- RBAC middleware, error handling, validation, logging, rate limiting.
- Products, variants, images, categories, collections (CRUD and public endpoints with filters).
- Image upload via signed URLs.
- Cart (guest and user, merge).
- API tests for all of the above.

**Deliverable:** documented API (Swagger/OpenAPI at `/docs`).

### Phase 2: Storefront MVP (Weeks 3–5)

- Layout: header, footer, mega-menu, mobile nav.
- Home page, shop/collection page with filters and sorting, product detail with variant picker and size guide.
- Cart drawer and cart page.
- Login/register, account pages (profile, addresses).
- Responsive design and loading/empty/error states.

**Deliverable:** customers can browse and build a cart.

### Phase 3: Checkout, Payments & Orders (Weeks 5–7)

- Shipping zones and rates, coupons, checkout quote.
- Checkout flow (guest and logged in), Stripe Payment Element, COD.
- Webhooks, stock reservation, order creation, order status history.
- Transactional emails (order confirmation, shipped, delivered).
- Customer order history, order detail with timeline, guest tracking, invoice PDF.

**Deliverable:** end-to-end purchase works in Stripe test mode.

### Phase 4: Admin Dashboard (Weeks 7–9)

- Admin auth and layout, role-based menu.
- Products management with variant matrix generator and image manager.
- Inventory management and adjustments.
- Orders management: status updates, tracking, refunds, invoices/packing slips, CSV export.
- Customers, reviews moderation, coupons, shipping settings.
- CMS: banners, pages, FAQ, announcement bar.
- Dashboard KPIs and charts, reports.
- Staff management, settings, audit log.

**Deliverable:** the store can be fully run from the admin panel.

### Phase 5: Engagement Features (Weeks 9–10)

- Reviews and ratings (verified purchases), wishlist.
- Back-in-stock alerts, newsletter, abandoned cart emails.
- Search improvements, related products, "recently viewed".
- Returns and refunds flow.

### Phase 6: Polish, QA & Launch (Weeks 10–12)

- SEO (meta, JSON-LD, sitemap), performance tuning, accessibility audit.
- Full E2E test suite, load testing, security review (OWASP checklist).
- Legal pages, cookie consent, analytics.
- Production infrastructure, domain, SSL, backups, monitoring.
- Switch Stripe to live mode, load real products, soft launch, then public launch.

### Timeline Summary

| Phase               | Weeks | Output                    |
| ------------------- | ----- | ------------------------- |
| 0 Setup & Design    | 1     | Repo, designs, schema     |
| 1 Backend Core      | 2–3   | Auth, catalog, cart API   |
| 2 Storefront MVP    | 3–5   | Browse and cart UI        |
| 3 Checkout & Orders | 5–7   | Payments, orders, emails  |
| 4 Admin Dashboard   | 7–9   | Full store management     |
| 5 Engagement        | 9–10  | Reviews, wishlist, alerts |
| 6 QA & Launch       | 10–12 | Production launch         |

---

## 17. Task Checklist

### Setup (Phase 0 ✅ done)

- [x] Init Turborepo + pnpm workspaces
- [x] Create `apps/storefront`, `apps/admin`, `apps/api`
- [x] Create `packages/ui`, `packages/validation`, `packages/types`, `packages/config`
- [ ] Create `packages/emails` (moved to Phase 3, when transactional emails are built)
- [x] Docker Compose (Postgres, Redis)
- [x] ESLint, Prettier, Husky, lint-staged, commitlint
- [x] GitHub Actions CI
- [x] `.env.example`, README with setup steps
- [ ] Brand identity and Figma designs (logo, palette, fonts, key screens), which need a designer

### Backend

- [x] Prisma schema, migrations, seed
- [x] Express app: helmet, cors, compression, pino, error handler
- [x] Auth module (JWT cookies, refresh rotation, email verify, reset)
- [ ] Google OAuth (moved to Phase 5)
- [x] RBAC middleware
- [x] Rate limiting (Redis) and CSRF origin check
- [x] Profile and address book
- [x] Products / variants / images / categories / collections
- [x] Stock adjustments with history
- [x] Filters and search endpoints
- [x] Upload signing (Cloudinary)
- [x] Cart and merge
- [ ] Coupons
- [ ] Shipping zones and quote
- [ ] Checkout with stock reservation (transaction)
- [ ] Stripe PaymentIntent and webhooks, refunds
- [ ] COD flow
- [ ] Orders and status history, invoice PDF
- [ ] Reviews, wishlist
- [ ] CMS (banners, pages, FAQ), contact, newsletter
- [ ] BullMQ workers: emails, reservation expiry, stock alerts, abandoned cart
- [ ] Admin endpoints: dashboard, reports, customers, staff, settings, audit log
- [x] OpenAPI docs
- [x] API tests (Phase 1 scope; extended each phase)

### Storefront

- [ ] Design system and shared components
- [ ] Header / footer / mega-menu / mobile nav
- [ ] Home page
- [ ] Shop and collection pages with filters/sort/pagination
- [ ] Product detail page (gallery, variant picker, size guide, reviews)
- [ ] Search
- [ ] Cart drawer and cart page
- [ ] Checkout (multi-step) with Stripe and COD
- [ ] Order success page
- [ ] Auth pages
- [ ] Account: dashboard, orders, order detail, addresses, wishlist, profile
- [ ] Guest order tracking
- [ ] Content pages (about, contact, FAQ, policies, size guide)
- [ ] SEO (metadata, JSON-LD, sitemap)
- [ ] Analytics events

### Admin

- [ ] Admin login and protected layout
- [ ] Dashboard KPIs and charts
- [ ] Products list and form (variant matrix, images)
- [ ] Categories and collections
- [ ] Inventory and adjustments
- [ ] Orders list/detail, status, tracking, refunds, PDFs, CSV export
- [ ] Returns
- [ ] Customers
- [ ] Reviews moderation
- [ ] Coupons
- [ ] Shipping settings
- [ ] CMS
- [ ] Messages inbox
- [ ] Reports
- [ ] Staff and roles
- [ ] Store settings
- [ ] Audit log

### Launch

- [ ] E2E tests (Playwright)
- [ ] Lighthouse and accessibility audit
- [ ] Security review
- [ ] Production deploy, domain, SSL
- [ ] Backups and monitoring
- [ ] Stripe live mode
- [ ] Real product data and photos

---

## 18. Future Enhancements

- Custom hoodie designer (upload artwork, text, live mockup preview).
- Loyalty points and referral program.
- Gift cards.
- Multi-currency and multi-language.
- Product bundles ("Buy 2 hoodies, get 10% off").
- Pre-orders and limited drops with countdown timers.
- Courier API integration (TCS, Leopards, M&P, DHL) for auto-generated tracking.
- WhatsApp order notifications.
- Mobile app (React Native / Expo) using the same API.
- AI size recommendation and product recommendations.
- Meilisearch/Algolia for instant search.
