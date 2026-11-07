import { Container } from "@hoodie/ui";
import type { Metadata } from "next";
import { ContactForm } from "@/components/content/contact-form";

export const metadata: Metadata = {
  title: "Contact us",
  description: "Questions about an order, sizing or returns? Send us a message.",
};

export default function ContactPage() {
  return (
    <Container className="grid max-w-5xl gap-12 py-12 md:grid-cols-[1fr_1.4fr]">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Contact us</h1>
        <p className="text-muted mt-3">We usually reply within one working day.</p>
        <dl className="mt-8 space-y-4 text-sm">
          <div>
            <dt className="font-semibold">Email</dt>
            <dd className="text-muted">support@urbanstore.pk</dd>
          </div>
          <div>
            <dt className="font-semibold">Hours</dt>
            <dd className="text-muted">Mon–Sat, 10am–7pm PKT</dd>
          </div>
        </dl>
      </div>
      <ContactForm />
    </Container>
  );
}
