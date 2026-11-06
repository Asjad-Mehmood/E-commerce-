/**
 * Seeds the database. Safe to run repeatedly: every write is an upsert.
 *
 *   pnpm db:seed
 *
 * In production only the essentials are seeded (admin, settings, shipping,
 * pages, FAQ). Demo products, coupons, banners and the demo customer are skipped.
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
  settings,
  shippingZones,
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

function imageUrl(title: string, color: { name: string; hex: string }, view: string): string {
  const bg = color.hex.replace("#", "");
  const fg = ["F5F0E6", "D6C4A8", "9CA3AF", "C8A2C8"].includes(bg.toUpperCase())
    ? "111111"
    : "FFFFFF";
  const text = encodeURIComponent(`${title}\n${color.name} · ${view}`).replace(/%20/g, "+");
  return `https://placehold.co/800x1000/${bg}/${fg}/png?text=${text}`;
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
    await prisma.page.upsert({ where: { slug: page.slug }, update: {}, create: page });
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
  for (const [position, c] of categories.entries()) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name, description: c.description, position },
      create: { ...c, position },
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
      soldCount: p.soldCount,
      seoTitle: `${p.title} | Hoodie Store`,
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

    // Images: two views per colour, ordered by colour then view.
    await prisma.productImage.deleteMany({ where: { productId: product.id } });
    await prisma.productImage.createMany({
      data: p.colors.flatMap((color, ci) =>
        ["Front", "Back"].map((view, vi) => ({
          productId: product.id,
          url: imageUrl(p.title, color, view),
          alt: `${p.title} in ${color.name}, ${view.toLowerCase()} view`,
          color: color.name,
          position: ci * 2 + vi,
        })),
      ),
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
            stock: stockFor(pi, ci, si),
            weightGrams: p.fit === "SLIM" ? 450 : 650,
          },
        });
        variantCount++;
      }
    }
  }
  console.log(
    `  ✔ ${categories.length} categories, ${collections.length} collections, ${products.length} products, ${variantCount} variants`,
  );
}

async function seedPromotions() {
  for (const coupon of coupons) {
    await prisma.coupon.upsert({ where: { code: coupon.code }, update: {}, create: coupon });
  }
  for (const banner of banners) {
    const { id, ...data } = banner;
    await prisma.banner.upsert({ where: { id }, update: data, create: banner });
  }
  console.log(`  ✔ ${coupons.length} coupons, ${banners.length} banners`);
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
    await seedPromotions();
  }
  console.log("✅ Seed complete");
}

main()
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
