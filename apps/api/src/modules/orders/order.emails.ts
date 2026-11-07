import { formatMoney } from "@hoodie/types";
import { emailLayout, esc } from "../../lib/email-layout";
import type { Mail } from "../../lib/mailer";
import { orderLink } from "./order-access";
import { shippingLabel, type FullOrder } from "./order.mapper";

function summary(o: FullOrder) {
  const rows = o.items
    .map(
      (i) =>
        `<tr><td style="padding:6px 0">${esc(i.productTitle)}<br><span style="color:#666;font-size:13px">${esc(i.color)} · ${esc(i.size)} × ${i.quantity}</span></td><td style="text-align:right;vertical-align:top;padding:6px 0">${formatMoney(i.lineTotal)}</td></tr>`,
    )
    .join("");
  const line = (label: string, amount: number, bold = false) =>
    `<tr><td style="padding:4px 0;${bold ? "font-weight:700" : "color:#555"}">${label}</td><td style="text-align:right;padding:4px 0;${bold ? "font-weight:700" : ""}">${formatMoney(amount)}</td></tr>`;
  return `<table role="presentation" style="width:100%;border-collapse:collapse;margin:16px 0;border-top:1px solid #eee;border-bottom:1px solid #eee">${rows}</table>
<table role="presentation" style="width:100%;border-collapse:collapse">
${line("Subtotal", o.subtotal)}
${o.discountTotal ? line(`Discount${o.couponCode ? ` (${esc(o.couponCode)})` : ""}`, -o.discountTotal) : ""}
${line(shippingLabel(o.shippingMethod), o.shippingTotal)}
${o.codFee ? line("Cash on Delivery fee", o.codFee) : ""}
${o.taxTotal ? line("Tax", o.taxTotal) : ""}
${line("Total", o.grandTotal, true)}
</table>`;
}

const textItems = (o: FullOrder) =>
  o.items
    .map(
      (i) =>
        `- ${i.productTitle} (${i.color}, ${i.size}) x${i.quantity}: ${formatMoney(i.lineTotal)}`,
    )
    .join("\n");

export function confirmationEmail(o: FullOrder): Mail {
  const url = orderLink(o.orderNumber, o.id);
  const cod = o.paymentMethod === "COD";
  const intro = cod
    ? `Thanks for your order! Please keep <strong>${formatMoney(o.grandTotal)}</strong> ready to pay in cash on delivery.`
    : "Thanks for your order! Your payment was successful.";
  return {
    to: o.email,
    subject: `Order ${o.orderNumber} confirmed`,
    text: `Thanks for your order ${o.orderNumber}!\n\n${textItems(o)}\n\nTotal: ${formatMoney(o.grandTotal)}${cod ? " (pay cash on delivery)" : ""}\n\nView your order: ${url}\n`,
    html: emailLayout(
      `Order ${o.orderNumber} confirmed`,
      `<p>${intro}</p>${summary(o)}<p style="color:#555">We'll email you again when it ships.</p>`,
      {
        label: "View your order",
        url,
      },
    ),
  };
}

export function shippedEmail(o: FullOrder): Mail {
  const url = orderLink(o.orderNumber, o.id);
  const tracking = o.trackingNumber
    ? `${o.courier ? `${o.courier} ` : ""}tracking number: ${o.trackingNumber}`
    : "";
  return {
    to: o.email,
    subject: `Order ${o.orderNumber} has shipped`,
    text: `Good news: order ${o.orderNumber} is on its way.\n${tracking}\n\nTrack it: ${url}\n`,
    html: emailLayout(
      "Your order is on its way",
      `<p>Good news: order <strong>${esc(o.orderNumber)}</strong> has shipped.</p>${tracking ? `<p>${esc(tracking)}</p>` : ""}`,
      { label: "Track your order", url },
    ),
  };
}

export function deliveredEmail(o: FullOrder): Mail {
  const url = orderLink(o.orderNumber, o.id);
  return {
    to: o.email,
    subject: `Order ${o.orderNumber} was delivered`,
    text: `Order ${o.orderNumber} was delivered. Enjoy your new hoodie! Wrong size? Exchanges are free for 14 days.\n${url}\n`,
    html: emailLayout(
      "Delivered!",
      `<p>Order <strong>${esc(o.orderNumber)}</strong> was delivered. Enjoy your new hoodie!</p><p style="color:#555">Wrong size? Exchanges are free for 14 days.</p>`,
      { label: "View your order", url },
    ),
  };
}

export function cancelledEmail(o: FullOrder, reason: string): Mail {
  const url = orderLink(o.orderNumber, o.id);
  return {
    to: o.email,
    subject: `Order ${o.orderNumber} was cancelled`,
    text: `Order ${o.orderNumber} was cancelled. ${reason}\n${url}\n`,
    html: emailLayout(
      "Your order was cancelled",
      `<p>Order <strong>${esc(o.orderNumber)}</strong> was cancelled. ${esc(reason)}</p>`,
      {
        label: "View order",
        url,
      },
    ),
  };
}

export function refundEmail(o: FullOrder, amount: number, manual: boolean): Mail {
  const url = orderLink(o.orderNumber, o.id);
  const how = manual
    ? "Our team will return the money to you directly."
    : "It goes back to the card you paid with and usually shows within 5-10 working days.";
  return {
    to: o.email,
    subject: `Refund for order ${o.orderNumber}`,
    text: `We've refunded ${formatMoney(amount)} for order ${o.orderNumber}. ${how}\n${url}\n`,
    html: emailLayout(
      "Your refund is on its way",
      `<p>We've refunded <strong>${formatMoney(amount)}</strong> for order <strong>${esc(o.orderNumber)}</strong>.</p><p style="color:#555">${how}</p>`,
      { label: "View order", url },
    ),
  };
}
