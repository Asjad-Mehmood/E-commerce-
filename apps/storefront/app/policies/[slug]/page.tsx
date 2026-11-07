import type { PageDTO } from "@hoodie/types";
import { Container } from "@hoodie/ui";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getData } from "@/lib/server-api";

type Props = { params: Promise<{ slug: string }> };

const getPage = (slug: string) =>
  getData<PageDTO>(`/cms/pages/${encodeURIComponent(slug)}`, { revalidate: 300 });

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await getPage((await params).slug);
  return page ? { title: page.title, description: page.seoDescription ?? undefined } : {};
}

export default async function PolicyPage({ params }: Props) {
  const page = await getPage((await params).slug);
  if (!page) notFound();

  return (
    <Container className="max-w-3xl py-12">
      <h1 className="text-3xl font-bold tracking-tight">{page.title}</h1>
      <p className="text-muted mt-2 text-sm">
        Last updated {new Date(page.updatedAt).toLocaleDateString("en-PK", { dateStyle: "long" })}
      </p>
      {/* Content is plain text with blank-line paragraphs (rich text arrives with the admin CMS). */}
      <div className="mt-8 space-y-4 leading-relaxed">
        {page.content.split(/\n{2,}/).map((para, i) => (
          <p key={i}>{para}</p>
        ))}
      </div>
    </Container>
  );
}
