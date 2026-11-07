import type { CategoryDTO } from "@hoodie/types";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs, ProductListing } from "@/components/shop/product-listing";
import type { SearchParams } from "@/lib/listing";
import { getData } from "@/lib/server-api";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<SearchParams> };

const getCategory = (slug: string) =>
  getData<CategoryDTO>(`/categories/${encodeURIComponent(slug)}`, { revalidate: 300 });

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const category = await getCategory((await params).slug);
  if (!category) return {};
  return {
    title: category.name,
    description: category.description ?? `Shop ${category.name.toLowerCase()}.`,
    alternates: { canonical: `/categories/${category.slug}` },
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const category = await getCategory(slug);
  if (!category) notFound();

  return (
    <ProductListing
      title={category.name}
      description={category.description}
      pathname={`/categories/${slug}`}
      searchParams={await searchParams}
      scope={{ category: slug }}
      breadcrumbs={
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Shop", href: "/shop" },
            { label: category.name },
          ]}
        />
      }
    />
  );
}
