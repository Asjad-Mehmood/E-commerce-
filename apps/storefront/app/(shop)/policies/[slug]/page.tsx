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

/**
 * Page content is plain text: blank lines separate blocks, "## " starts a
 * heading and lines starting with "- " form a list.
 */
function PlainText({ content, nested }: { content: string; nested?: boolean }) {
  return (
    <div className={nested ? "space-y-4" : "mt-8 space-y-4 leading-relaxed"}>
      {content.split(/\n{2,}/).map((block, i) => {
        const lines = block.trim().split("\n");
        if (lines.length === 1 && lines[0]!.startsWith("## ")) {
          return (
            <h2 key={i} className="pt-4 text-xl font-semibold tracking-tight">
              {lines[0]!.slice(3)}
            </h2>
          );
        }
        if (lines[0]!.startsWith("## ")) {
          return (
            <div key={i} className="space-y-4">
              <h2 className="pt-4 text-xl font-semibold tracking-tight">{lines[0]!.slice(3)}</h2>
              <PlainText nested content={lines.slice(1).join("\n")} />
            </div>
          );
        }
        if (lines.every((l) => l.startsWith("- "))) {
          return (
            <ul key={i} className="list-disc space-y-1 pl-6">
              {lines.map((l, j) => (
                <li key={j}>{l.slice(2)}</li>
              ))}
            </ul>
          );
        }
        return <p key={i}>{block.trim()}</p>;
      })}
    </div>
  );
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
      <PlainText content={page.content} />
    </Container>
  );
}
