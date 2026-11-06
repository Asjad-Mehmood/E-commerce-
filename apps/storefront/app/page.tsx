import { Card, Container, cn } from "@hoodie/ui";
import Link from "next/link";
import { RefreshIcon, ShieldIcon, TruckIcon } from "@/components/icons";

// Phase 2 replaces these with data from GET /cms/home and GET /collections.
const shopByFit = [
  { title: "Pullover", href: "/collections/pullover", tone: "bg-[#1E3A5F]" },
  { title: "Zip-Up", href: "/collections/zip-up", tone: "bg-[#36454F]" },
  { title: "Oversized", href: "/collections/oversized", tone: "bg-[#D6C4A8] text-ink" },
  { title: "Graphic", href: "/collections/graphic", tone: "bg-[#111111]" },
];

const perks = [
  {
    icon: TruckIcon,
    title: "Fast nationwide delivery",
    body: "1-2 days in Lahore, 2-5 days across Pakistan.",
  },
  {
    icon: RefreshIcon,
    title: "14-day free exchanges",
    body: "Wrong size? Swap it for free, no questions asked.",
  },
  { icon: ShieldIcon, title: "Secure checkout", body: "Pay by card or Cash on Delivery." },
];

export default function HomePage() {
  return (
    <>
      <section className="bg-ink text-white">
        <Container className="grid items-center gap-10 py-20 md:grid-cols-2 md:py-28">
          <div>
            <p className="text-brand-500 text-sm font-semibold uppercase tracking-widest">
              The winter drop
            </p>
            <h1 className="mt-4 text-balance text-4xl font-black tracking-tight sm:text-6xl">
              Heavyweight hoodies, built to last.
            </h1>
            <p className="mt-6 max-w-md text-lg text-white/70">
              320–400 GSM cotton fleece in pullover, zip-up and oversized fits. Designed for
              everyday comfort.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/shop"
                className="text-ink inline-flex h-12 items-center rounded-lg bg-white px-6 font-semibold hover:bg-white/90"
              >
                Shop all hoodies
              </Link>
              <Link
                href="/collections/new-arrivals"
                className="inline-flex h-12 items-center rounded-lg border border-white/30 px-6 font-semibold hover:bg-white/10"
              >
                New arrivals
              </Link>
            </div>
          </div>
          <div
            aria-hidden
            className="from-brand-600 to-brand-700 hidden aspect-[4/5] rounded-2xl bg-gradient-to-br md:block"
          />
        </Container>
      </section>

      <section>
        <Container className="py-16">
          <h2 className="text-2xl font-bold tracking-tight">Shop by fit</h2>
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {shopByFit.map((c) => (
              <Link
                key={c.href}
                href={c.href}
                className={cn(
                  "group flex aspect-[4/5] items-end rounded-xl p-5 text-white",
                  c.tone,
                )}
              >
                <span className="text-lg font-bold group-hover:underline">{c.title}</span>
              </Link>
            ))}
          </div>
        </Container>
      </section>

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
    </>
  );
}
