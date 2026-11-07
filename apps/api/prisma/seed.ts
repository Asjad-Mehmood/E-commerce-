/**
 * Seeds the database. Safe to run repeatedly: every write is an upsert.
 *
 *   pnpm db:seed
 *
 * In production the essentials are seeded (admin, settings, shipping, pages,
 * FAQ), plus the starter catalogue and banners the first time only (while the
 * store has no products), so later edits in the admin are never overwritten.
 * Demo customers, reviews and coupons are development only.
 */
import { PrismaClient } from "@prisma/client";
import { hash } from "argon2";
import {
  banners,
  CARE,
  categories,
  collections,
  coupons,
  faqs,
  pages,
  products,
  retiredCategorySlugs,
  retiredProductSlugs,
  settings,
  unsplash,
  shippingZones,
  demoReviews,
} from "./seed-data";

const prisma = new PrismaClient();
const isProd = process.env.NODE_ENV === "production";

/** Deterministic pseudo-random stock so seeds are reproducible and include edge cases. */
function stockFor(productIndex: number, colorIndex: number, sizeIndex: number): number {
  const n = (productIndex * 31 + colorIndex * 17 + sizeIndex * 7) % 23;
  if (n === 0) return 0; // sold out
  if (n < 4) return n; // low stock
  return n + 5;
}

function colorCode(name: string): string {
  return name
    .replace(/[^a-zA-Z]/g, "")
    .slice(0, 3)
    .toUpperCase();
}

async function seedAdmin() {
  const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@hoodie.local").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password) throw new Error("SEED_ADMIN_PASSWORD must be set");
  if (isProd && password === "ChangeMe123") {
    throw new Error("Refusing to seed production with the example admin password");
  }

  await prisma.user.upsert({
    where: { email },
    update: { role: "SUPER_ADMIN" },
    create: {
      email,
      name: "Store Admin",
      role: "SUPER_ADMIN",
      passwordHash: await hash(password),
      emailVerified: new Date(),
    },
  });
  console.log(`  ✔ super admin: ${email}`);
}

async function seedDemoCustomer() {
  const email = "customer@hoodie.local";
  await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: "Demo Customer",
      phone: "03001234567",
      passwordHash: await hash("Customer123"),
      emailVerified: new Date(),
      addresses: {
        create: {
          fullName: "Demo Customer",
          phone: "03001234567",
          line1: "House 12, Street 4, Gulberg III",
          city: "Lahore",
          state: "Punjab",
          postalCode: "54660",
          isDefault: true,
        },
      },
    },
  });
  console.log(`  ✔ demo customer: ${email} / Customer123`);
}

async function seedSettings() {
  for (const [key, value] of Object.entries(settings)) {
    // Only create: never overwrite settings an admin has already changed.
    await prisma.setting.upsert({
      where: { key },
      update: {},
      create: { key, value: value as never },
    });
  }
  console.log(`  ✔ ${Object.keys(settings).length} settings`);
}

async function seedShipping() {
  for (const zone of shippingZones) {
    const { id, ...data } = zone;
    await prisma.shippingZone.upsert({ where: { id }, update: data, create: zone });
  }
  console.log(`  ✔ ${shippingZones.length} shipping zones`);
}

async function seedContent() {
  for (const page of pages) {
    // Production: only create, never overwrite a page edited in the admin.
    await prisma.page.upsert({
      where: { slug: page.slug },
      update: isProd ? {} : page,
      create: page,
    });
  }
  for (const [position, faq] of faqs.entries()) {
    const { id, ...data } = faq;
    await prisma.faq.upsert({
      where: { id },
      update: { ...data, position },
      create: { ...faq, position },
    });
  }
  console.log(`  ✔ ${pages.length} pages, ${faqs.length} FAQs`);
}

async function seedCatalog() {
  for (const [position, { image, ...c }] of categories.entries()) {
    const imageUrl = unsplash(image, 800);
    await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name, description: c.description, imageUrl, position },
      create: { ...c, imageUrl, position },
    });
  }
  for (const [position, c] of collections.entries()) {
    await prisma.collection.upsert({
      where: { slug: c.slug },
      update: { name: c.name, description: c.description, isFeatured: c.isFeatured, position },
      create: { ...c, position },
    });
  }

  let variantCount = 0;
  for (const [pi, p] of products.entries()) {
    const data = {
      title: p.title,
      description: p.description,
      fit: p.fit,
      fabric: p.fabric,
      careInfo: CARE,
      basePrice: p.basePrice,
      compareAtPrice: p.compareAtPrice ?? null,
      status: p.status,
      isFeatured: p.isFeatured,
      // Sales figures are made up, so only in development.
      soldCount: isProd ? 0 : p.soldCount,
      seoTitle: `${p.title} | Urban Store`,
      seoDescription: p.description.slice(0, 155),
      publishedAt: p.status === "ACTIVE" ? new Date() : null,
      categories: { set: p.categories.map((slug) => ({ slug })) },
      collections: { set: p.collections.map((slug) => ({ slug })) },
    };

    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      update: data,
      create: {
        ...data,
        slug: p.slug,
        categories: { connect: p.categories.map((slug) => ({ slug })) },
        collections: { connect: p.collections.map((slug) => ({ slug })) },
      },
    });

    // Photos: by colour (so the gallery follows the swatch), then extras.
    const images = [
      ...p.colors.flatMap((color) =>
        color.photos.map((id, i) => ({
          url: unsplash(id),
          alt: `${p.title} in ${color.name}${i ? `, photo ${i + 1}` : ""}`,
          color: color.name,
        })),
      ),
      ...(p.extraPhotos ?? []).map((x) => ({ url: unsplash(x.id), alt: x.alt, color: null })),
    ];
    await prisma.productImage.deleteMany({ where: { productId: product.id } });
    await prisma.productImage.createMany({
      data: images.map((img, position) => ({ ...img, productId: product.id, position })),
    });

    for (const [ci, color] of p.colors.entries()) {
      for (const [si, size] of p.sizes.entries()) {
        const sku = `${p.skuPrefix}-${colorCode(color.name)}-${size}`;
        await prisma.productVariant.upsert({
          where: { sku },
          update: { colorHex: color.hex },
          create: {
            productId: product.id,
            sku,
            size,
            color: color.name,
            colorHex: color.hex,
            // Development gets sold-out and low-stock cases; production starts at 20
            // of each (set real stock in Admin → Inventory).
            stock: isProd ? 20 : stockFor(pi, ci, si),
            weightGrams: p.fit === "SLIM" ? 450 : 650,
          },
        });
        variantCount++;
      }
    }
  }
  // Earlier demo products: archive them (orders keep their history).
  const retired = await prisma.product.updateMany({
    where: { slug: { in: retiredProductSlugs }, status: { not: "ARCHIVED" } },
    data: { status: "ARCHIVED", isFeatured: false },
  });
  await prisma.category.deleteMany({
    where: { slug: { in: retiredCategorySlugs }, products: { none: { status: "ACTIVE" } } },
  });
  if (retired.count) console.log(`  ✔ archived ${retired.count} old demo products`);

  console.log(
    `  ✔ ${categories.length} categories, ${collections.length} collections, ${products.length} products, ${variantCount} variants`,
  );
}

async function seedBanners() {
  for (const banner of banners) {
    const { id, ...data } = banner;
    await prisma.banner.upsert({ where: { id }, update: data, create: banner });
  }
  console.log(`  ✔ ${banners.length} banners`);
}

async function seedCoupons() {
  for (const coupon of coupons) {
    await prisma.coupon.upsert({ where: { code: coupon.code }, update: {}, create: coupon });
  }
  console.log(`  ✔ ${coupons.length} coupons`);
}

/** A few approved reviews from demo shoppers, so ratings show up in development. */
async function seedReviews() {
  const reviewers = [
    { email: "ayesha.reviewer@hoodie.local", name: "Ayesha Malik" },
    { email: "bilal.reviewer@hoodie.local", name: "Bilal Ahmed" },
    { email: "sara.reviewer@hoodie.local", name: "Sara Khan" },
  ];
  const users = [];
  for (const r of reviewers) {
    // No password: these accounts only exist to own the demo reviews.
    users.push(
      await prisma.user.upsert({
        where: { email: r.email },
        update: {},
        create: { ...r, emailVerified: new Date() },
      }),
    );
  }
  let created = 0;
  for (const [slug, entries] of Object.entries(demoReviews)) {
    const product = await prisma.product.findUnique({ where: { slug }, select: { id: true } });
    if (!product) continue;
    for (const [i, review] of entries.entries()) {
      const user = users[i % users.length]!;
      const exists = await prisma.review.findUnique({
        where: { productId_userId: { productId: product.id, userId: user.id } },
      });
      if (exists) continue;
      await prisma.review.create({
        data: { ...review, productId: product.id, userId: user.id, isApproved: true },
      });
      created++;
    }
    const agg = await prisma.review.aggregate({
      where: { productId: product.id, isApproved: true },
      _avg: { rating: true },
      _count: { _all: true },
    });
    await prisma.product.update({
      where: { id: product.id },
      data: {
        avgRating: Math.round((agg._avg.rating ?? 0) * 10) / 10,
        reviewCount: agg._count._all,
      },
    });
  }
  console.log(`  ✔ ${created} demo reviews`);
}

async function main() {
  console.log(`🌱 Seeding database (${isProd ? "production: essentials only" : "development"})…`);
  await seedAdmin();
  await seedSettings();
  await seedShipping();
  await seedContent();
  if (!isProd) {
    await seedDemoCustomer();
    await seedCatalog();
    await seedBanners();
    await seedCoupons();
    await seedReviews();
  } else if ((await prisma.product.count()) === 0 || process.env.SEED_CATALOG === "true") {
    // First deploy: start with the Urban Store catalogue. Later runs leave it alone.
    await seedCatalog();
    await seedBanners();
  } else {
    console.log("  • catalogue already exists: left as it is (SEED_CATALOG=true to reseed)");
  }
  console.log("✅ Seed complete");
}

main()
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
