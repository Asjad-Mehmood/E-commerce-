import { RETURN_REASON_LABEL, type ReturnDTO } from "@hoodie/types";
import { emailLayout, esc } from "../../lib/email-layout";
import type { Mail } from "../../lib/mailer";
import type { StoreInfo } from "../../lib/settings";
import { orderLink } from "../orders/order-access";

interface OrderRef {
  id: string;
  orderNumber: string;
  email: string;
}

const itemList = (r: ReturnDTO) =>
  `<ul style="padding-left:20px">${r.items.map((i) => `<li>${esc(i.title)} (${esc(i.color)}, ${esc(i.size)}) × ${i.quantity}</li>`).join("")}</ul>`;
const textItems = (r: ReturnDTO) =>
  r.items.map((i) => `- ${i.title} (${i.color}, ${i.size}) x${i.quantity}`).join("\n");

export function returnRequestedEmail(o: OrderRef, r: ReturnDTO): Mail {
  const url = orderLink(o.orderNumber, o.id);
  return {
    to: o.email,
    subject: `We got your return request for ${o.orderNumber}`,
    text: `We got your return request for order ${o.orderNumber}:\n${textItems(r)}\nReason: ${RETURN_REASON_LABEL[r.reason] ?? r.reason}\n\nWe'll email you within 2 working days with what happens next. Please don't send anything back until then.\n${url}\n`,
    html: emailLayout(
      "We got your return request",
      `<p>Thanks. We've received your request to return these items from order <strong>${esc(o.orderNumber)}</strong>:</p>${itemList(r)}<p style="color:#555">We'll email you within 2 working days with what happens next. Please don't send anything back until then.</p>`,
      { label: "View your order", url },
    ),
  };
}

export function returnApprovedEmail(o: OrderRef, r: ReturnDTO, store: StoreInfo): Mail {
  const url = orderLink(o.orderNumber, o.id);
  const address = store.address || `${store.name} (contact ${store.email} for the address)`;
  return {
    to: o.email,
    subject: `Your return for ${o.orderNumber} is approved`,
    text: `Your return for order ${o.orderNumber} is approved.\n\nPlease pack these items, write ${o.orderNumber} on the parcel, and send them to:\n${address}\n\n${textItems(r)}\n${r.adminNote ? `\nNote from us: ${r.adminNote}\n` : ""}\nWe'll refund you once they arrive.\n${url}\n`,
    html: emailLayout(
      "Your return is approved",
      `<p>Please pack these items, write <strong>${esc(o.orderNumber)}</strong> on the parcel, and send them to:</p><p style="white-space:pre-line;background:#f6f6f7;padding:12px;border-radius:8px">${esc(address)}</p>${itemList(r)}${r.adminNote ? `<p><strong>Note from us:</strong> ${esc(r.adminNote)}</p>` : ""}<p style="color:#555">We'll refund you once they arrive.</p>`,
      { label: "View your order", url },
    ),
  };
}

export function returnRejectedEmail(o: OrderRef, r: ReturnDTO): Mail {
  const url = orderLink(o.orderNumber, o.id);
  return {
    to: o.email,
    subject: `About your return for ${o.orderNumber}`,
    text: `We're sorry, we can't accept the return for order ${o.orderNumber}.\n${r.adminNote ? `\n${r.adminNote}\n` : ""}\nReply to this email if you have questions.\n${url}\n`,
    html: emailLayout(
      "We can't accept this return",
      `<p>We're sorry, we can't accept the return for order <strong>${esc(o.orderNumber)}</strong>.</p>${r.adminNote ? `<p>${esc(r.adminNote)}</p>` : ""}<p style="color:#555">Reply to this email if you have questions.</p>`,
      { label: "View your order", url },
    ),
  };
}

export function returnReceivedEmail(o: OrderRef, r: ReturnDTO): Mail {
  const url = orderLink(o.orderNumber, o.id);
  return {
    to: o.email,
    subject: `We received your return for ${o.orderNumber}`,
    text: `Your returned items for order ${o.orderNumber} arrived. Your refund is being processed and we'll email you when it's done.\n${url}\n`,
    html: emailLayout(
      "Your return arrived",
      `<p>The items you sent back from order <strong>${esc(o.orderNumber)}</strong> arrived:</p>${itemList(r)}<p style="color:#555">Your refund is being processed. We'll email you when it's done.</p>`,
      { label: "View your order", url },
    ),
  };
}
