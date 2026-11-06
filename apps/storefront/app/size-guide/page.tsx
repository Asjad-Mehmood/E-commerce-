import { FITS } from "@hoodie/types";
import { Container } from "@hoodie/ui";
import type { Metadata } from "next";
import { SizeFinder, SizeTable } from "@/components/product/size-guide";
import { FIT_DESCRIPTION, FIT_LABEL } from "@/lib/size-guide";

export const metadata: Metadata = {
  title: "Size guide",
  description: "Hoodie measurements for our regular, oversized and slim fits, plus a size finder.",
};

export default function SizeGuidePage() {
  return (
    <Container className="max-w-3xl py-12">
      <h1 className="text-3xl font-bold tracking-tight">Size guide</h1>
      <p className="text-muted mt-3">
        Measure around the fullest part of your chest, under your arms, then use the finder or the
        tables below.
      </p>
      <div className="mt-10 space-y-12">
        {FITS.map((fit) => (
          <section key={fit} aria-labelledby={`fit-${fit}`}>
            <h2 id={`fit-${fit}`} className="text-xl font-semibold">
              {FIT_LABEL[fit]}
            </h2>
            <p className="text-muted mb-4 mt-1 text-sm">{FIT_DESCRIPTION[fit]}</p>
            <SizeTable fit={fit} />
            <div className="mt-4">
              <SizeFinder fit={fit} />
            </div>
          </section>
        ))}
      </div>
    </Container>
  );
}
