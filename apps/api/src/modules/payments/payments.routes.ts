import { demoPaymentSchema } from "@hoodie/validation";
import { ok } from "../../lib/http";
import { prisma } from "../../lib/prisma";
import { defineRoutes, route } from "../../lib/route";
import { AppError } from "../../utils/app-error";
import { applyPaymentEvent } from "../orders/lifecycle";
import { DemoProvider, getPaymentProvider, StripeProvider } from "./index";

export const paymentsRouter = defineRoutes("/payments", "Payments", [
  route({
    method: "post",
    path: "/stripe/webhook",
    summary: "Stripe webhook (payment_intent.succeeded / payment_failed)",
    description:
      "Called by Stripe, not by browsers. The signature is verified against STRIPE_WEBHOOK_SECRET and each event is applied once.",
    access: "public",
    handler: async ({ req }) => {
      const provider = getPaymentProvider();
      if (!(provider instanceof StripeProvider)) throw AppError.notFound();
      const event = provider.parseWebhook(
        (req as { rawBody?: Buffer }).rawBody ?? Buffer.from(""),
        req.get("stripe-signature"),
      );
      const result = event ? await applyPaymentEvent(event, "stripe") : "ignored";
      return ok({ received: true, result });
    },
  }),
  route({
    method: "post",
    path: "/demo/confirm",
    summary: "Demo mode: pay with a Stripe test card",
    description:
      "Only available when no Stripe keys are configured. Accepts Stripe's public test cards only (4242 4242 4242 4242 succeeds, 4000 0000 0000 0002 is declined…). No money moves.",
    access: "public",
    rateLimit: "forms",
    body: demoPaymentSchema,
    handler: async ({ body }) => {
      const provider = getPaymentProvider();
      if (!(provider instanceof DemoProvider)) throw AppError.notFound();
      const intentId = provider.verifyClientSecret(body.clientSecret);
      if (!intentId) throw AppError.badRequest("Invalid payment session");

      const event = provider.charge(intentId, { number: body.cardNumber, expiry: body.expiry });
      await applyPaymentEvent(event, "demo");
      const payment = await prisma.payment.findUnique({
        where: { providerRef: intentId },
        include: { order: true },
      });
      if (!payment) throw AppError.notFound("Payment");

      const paid = payment.order.status === "PAID";
      return ok({
        status: paid ? "succeeded" : "failed",
        message: paid
          ? null
          : (event.failureReason ??
            (payment.order.status === "CANCELLED" ? "This order has expired" : "Payment failed")),
        orderStatus: payment.order.status,
      });
    },
  }),
]);
