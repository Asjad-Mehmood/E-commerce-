import type { ProductCardDTO, ProductDetailDTO } from "@hoodie/types";
import { toMajor } from "@hoodie/types";
import { Container } from "@hoodie/ui";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductGrid } from "@/components/product/product-card";
import { ProductView } from "@/components/product/product-view";
import { Breadcrumbs } from "@/components/shop/product-listing";
import { siteConfig } from "@/lib/config";
import { getData, getDataSafe } from "@/lib/server-api";
import { FIT_DESCRIPTION } from "@/lib/size-guide";

type Props = { params: Promise<{ slug: string }> };

const getProduct = (slug: string) =>
  getData<ProductDetailDTO>(`/products/${encodeURIComponent(slug)}`);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getProduct((await params).slug);
  if (!product) return {};
  const image = product.images[0];
  return {
    title: product.seoTitle ?? product.title,
    description: product.seoDescription ?? product.description.slice(0, 155),
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      type: "website",
      title: product.title,
      images: image ? [{ url: image.url, alt: image.alt ?? product.title }] : [],
    },
  };
}

/** schema.org Product data so search engines can show price and stock. */
function productJsonLd(p: ProductDetailDTO) {
  const url = `${siteConfig.url}/products/${p.slug}`;
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.title,
    description: p.description,
    image: p.images.map((i) => i.url),
    sku: p.variants[0]?.sku,
    brand: { "@type": "Brand", name: siteConfig.name },
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: siteConfig.currency,
      lowPrice: toMajor(Math.min(...p.variants.map((v) => v.price), p.price)),
      highPrice: toMajor(Math.max(...p.variants.map((v) => v.price), p.price)),
      offerCount: p.variants.length,
      availability: p.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url,
    },
    ...(p.reviewCount > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: p.avgRating,
            reviewCount: p.reviewCount,
          },
        }
      : {}),
  };
}

function Details({ product }: { product: ProductDetailDTO }) {
  const sections = [
    { title: "Description", body: product.description },
    { title: "Fit", body: FIT_DESCRIPTION[product.fit] },
    product.fabric && { title: "Fabric", body: product.fabric },
    product.careInfo && { title: "Care", body: product.careInfo },
    {
      title: "Delivery & returns",
      body: "Delivered in 1-2 working days in Lahore and 2-5 working days elsewhere. Free exchanges within 14 days of delivery.",
    },
  ].filter(Boolean) as { title: string; body: string }[];

  return (
    <div className="divide-line border-line mt-12 max-w-3xl divide-y border-y">
      {sections.map((s, i) => (
        <details key={s.title} open={i === 0} className="group py-4">
          <summary className="flex cursor-pointer list-none items-center justify-between font-semibold">
            {s.title}
            <span
              aria-hidden
              className="text-muted text-xl transition-transform group-open:rotate-45"
            >
              +
            </span>
          </summary>
          <p className="text-muted mt-3 leading-relaxed">{s.body}</p>
        </details>
      ))}
    </div>
  );
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();
  const related = await getDataSafe<ProductCardDTO[]>(
    `/products/${encodeURIComponent(slug)}/related`,
    [],
  );
  const category = product.categories[0];

  return (
    <Container className="py-8 sm:py-12">
      <script
        type="application/ld+json"
        // JSON.stringify output is safe here apart from "<", which is escaped.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(productJsonLd(product)).replace(/</g, "\\u003c"),
        }}
      />
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          category
            ? { label: category.name, href: `/categories/${category.slug}` }
            : { label: "Shop", href: "/shop" },
          { label: product.title },
        ]}
      />
      <ProductView product={product} />
      <Details product={product} />

      {related.length > 0 && (
        <section className="mt-20">
          <h2 className="mb-6 text-2xl font-bold tracking-tight">You may also like</h2>
          <ProductGrid products={related.slice(0, 4)} />
        </section>
      )}
    </Container>
  );
}
