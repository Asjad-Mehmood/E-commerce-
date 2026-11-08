import type { CollectionDTO } from "@hoodie/types";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs, ProductListing } from "@/components/shop/product-listing";
import type { SearchParams } from "@/lib/listing";
import { getData } from "@/lib/server-api";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<SearchParams> };

const getCollection = (slug: string) =>
  getData<CollectionDTO>(`/collections/${encodeURIComponent(slug)}`, { revalidate: 300 });

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const collection = await getCollection((await params).slug);
  if (!collection) return {};
  return {
    title: collection.name,
    description: collection.description ?? `Shop the ${collection.name} collection.`,
    alternates: { canonical: `/collections/${collection.slug}` },
  };
}

export default async function CollectionPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const collection = await getCollection(slug);
  if (!collection) notFound();

  return (
    <ProductListing
      title={collection.name}
      description={collection.description}
      pathname={`/collections/${slug}`}
      searchParams={await searchParams}
      scope={{ collection: slug }}
      breadcrumbs={
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Shop", href: "/shop" },
            { label: collection.name },
          ]}
        />
      }
    />
  );
}
