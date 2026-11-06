import type { CategoryDTO, HomeContentDTO, ProductCardDTO } from "@hoodie/types";
import { Card, Container } from "@hoodie/ui";
import Image from "next/image";
import Link from "next/link";
import { RefreshIcon, ShieldIcon, TruckIcon } from "@/components/icons";
import { ProductGrid } from "@/components/product/product-card";
import { getData, getDataSafe, getList } from "@/lib/server-api";

const perks = [
  {
    icon: TruckIcon,
    title: "Fast nationwide delivery",
    body: "1-2 days in Lahore, 2-5 days across Pakistan.",
  },
  { icon: RefreshIcon, title: "14-day free exchanges", body: "Wrong size? Swap it for free." },
  { icon: ShieldIcon, title: "Secure checkout", body: "Pay by card or Cash on Delivery." },
];

const TILE_TONES = ["bg-[#1E3A5F]", "bg-[#36454F]", "bg-[#8B7355]", "bg-[#111111]"];

function Section({
  title,
  href,
  linkLabel,
  children,
}: {
  title: string;
  href: string;
  linkLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <Container className="py-14">
        <div className="mb-6 flex items-end justify-between gap-4">
          <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
          <Link href={href} className="text-sm font-medium underline">
            {linkLabel}
          </Link>
        </div>
        {children}
      </Container>
    </section>
  );
}

export default async function HomePage() {
  const [home, categories, newArrivals, bestSellers] = await Promise.all([
    getDataSafe<HomeContentDTO | null>("/cms/home", null, { revalidate: 300 }),
    getData<CategoryDTO[]>("/categories", { revalidate: 300 }),
    getList<ProductCardDTO>("/products?collection=new-arrivals&sort=newest&limit=4"),
    getList<ProductCardDTO>("/products?sort=best_selling&limit=4"),
  ]);
  const hero = home?.banners[0];

  return (
    <>
      <section className="bg-ink text-white">
        <Container className="grid items-center gap-10 py-14 md:grid-cols-2 md:py-20">
          <div>
            <p className="text-brand-500 text-sm font-semibold uppercase tracking-widest">
              New season
            </p>
            <h1 className="mt-4 text-balance text-4xl font-black tracking-tight sm:text-6xl">
              {hero?.title ?? "Heavyweight hoodies, built to last."}
            </h1>
            <p className="mt-6 max-w-md text-lg text-white/70">
              {hero?.subtitle ??
                "320–400 GSM cotton fleece in pullover, zip-up and oversized fits."}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={hero?.link ?? "/shop"}
                className="text-ink inline-flex h-12 items-center rounded-lg bg-white px-6 font-semibold hover:bg-white/90"
              >
                {hero?.ctaLabel ?? "Shop all hoodies"}
              </Link>
              <Link
                href="/shop"
                className="inline-flex h-12 items-center rounded-lg border border-white/30 px-6 font-semibold hover:bg-white/10"
              >
                Browse everything
              </Link>
            </div>
          </div>
          {hero && (
            <div className="relative hidden aspect-[16/9] overflow-hidden rounded-2xl md:block">
              <Image
                src={hero.imageUrl}
                alt=""
                fill
                priority
                sizes="50vw"
                className="object-cover"
              />
            </div>
          )}
        </Container>
      </section>

      {categories && categories.length > 0 && (
        <section>
          <Container className="pt-14">
            <h2 className="text-2xl font-bold tracking-tight">Shop by style</h2>
            <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
              {categories.map((c, i) => (
                <Link
                  key={c.id}
                  href={`/categories/${c.slug}`}
                  className={`${TILE_TONES[i % TILE_TONES.length]} group flex aspect-[4/3] flex-col justify-end rounded-xl p-5 text-white`}
                >
                  <span className="text-lg font-bold group-hover:underline">{c.name}</span>
                  <span className="text-sm text-white/70">
                    {c.productCount} {c.productCount === 1 ? "style" : "styles"}
                  </span>
                </Link>
              ))}
            </div>
          </Container>
        </section>
      )}

      {newArrivals.data.length > 0 && (
        <Section title="New arrivals" href="/collections/new-arrivals" linkLabel="See all new">
          <ProductGrid products={newArrivals.data} />
        </Section>
      )}

      <section>
        <Container className="grid gap-4 md:grid-cols-3">
          {perks.map(({ icon: Icon, title, body }) => (
            <Card key={title} className="flex gap-4">
              <Icon className="text-brand-600 shrink-0" />
              <div>
                <h3 className="font-semibold">{title}</h3>
                <p className="text-muted mt-1 text-sm">{body}</p>
              </div>
            </Card>
          ))}
        </Container>
      </section>

      {bestSellers.data.length > 0 && (
        <Section
          title="Best sellers"
          href="/collections/best-sellers"
          linkLabel="See all best sellers"
        >
          <ProductGrid products={bestSellers.data} />
        </Section>
      )}
    </>
  );
}
