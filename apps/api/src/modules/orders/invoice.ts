import { formatMoney, ORDER_STATUS_LABEL, type OrderAddressDTO } from "@hoodie/types";
import PDFDocument from "pdfkit";
import { shippingLabel, type FullOrder } from "./order.mapper";

const STORE = { name: "Hoodie Store", email: "support@hoodie.local" };

/** Renders an A4 invoice PDF for an order. */
export function renderInvoice(order: FullOrder): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
      info: { Title: `Invoice ${order.orderNumber}` },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const address = order.shippingAddress as unknown as OrderAddressDTO;
    const right = 545;

    doc.font("Helvetica-Bold").fontSize(20).text(STORE.name.toUpperCase(), 50, 50);
    doc.font("Helvetica").fontSize(9).fillColor("#666").text(STORE.email);
    doc
      .fillColor("#111")
      .font("Helvetica-Bold")
      .fontSize(16)
      .text("INVOICE", 350, 50, { width: 195, align: "right" });
    doc
      .font("Helvetica")
      .fontSize(10)
      .text(`Order ${order.orderNumber}`, 350, 72, { width: 195, align: "right" })
      .text(order.placedAt.toLocaleDateString("en-PK", { dateStyle: "long" }), {
        width: 195,
        align: "right",
      })
      .text(`Status: ${ORDER_STATUS_LABEL[order.status]}`, { width: 195, align: "right" });

    doc.font("Helvetica-Bold").fontSize(10).text("Ship to", 50, 130);
    doc
      .font("Helvetica")
      .text(
        [
          address.fullName,
          address.line1,
          address.line2,
          `${address.city}${address.state ? `, ${address.state}` : ""} ${address.postalCode}`,
          address.phone,
          order.email,
        ]
          .filter(Boolean)
          .join("\n"),
      );

    let y = 230;
    const row = (cells: [string, string, string, string], bold = false) => {
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(10);
      doc.text(cells[0], 50, y, { width: 270 });
      doc.text(cells[1], 330, y, { width: 50, align: "right" });
      doc.text(cells[2], 390, y, { width: 70, align: "right" });
      doc.text(cells[3], 470, y, { width: 75, align: "right" });
      y = Math.max(doc.y, y + 14) + 6;
    };
    row(["Item", "Qty", "Price", "Total"], true);
    doc
      .moveTo(50, y - 3)
      .lineTo(right, y - 3)
      .strokeColor("#ddd")
      .stroke();
    for (const i of order.items) {
      row([
        `${i.productTitle}\n${i.color} / ${i.size} · ${i.sku}`,
        String(i.quantity),
        formatMoney(i.unitPrice),
        formatMoney(i.lineTotal),
      ]);
    }
    doc.moveTo(50, y).lineTo(right, y).stroke();
    y += 10;

    const total = (label: string, amount: number, bold = false) => {
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 12 : 10);
      doc.text(label, 330, y, { width: 130, align: "right" });
      doc.text(formatMoney(amount), 470, y, { width: 75, align: "right" });
      y += bold ? 20 : 16;
    };
    total("Subtotal", order.subtotal);
    if (order.discountTotal)
      total(`Discount${order.couponCode ? ` (${order.couponCode})` : ""}`, -order.discountTotal);
    total(shippingLabel(order.shippingMethod), order.shippingTotal);
    if (order.codFee) total("Cash on Delivery fee", order.codFee);
    if (order.taxTotal) total("Tax", order.taxTotal);
    total("Total", order.grandTotal, true);

    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#666")
      .text(
        `Payment: ${order.paymentMethod === "COD" ? "Cash on Delivery" : "Card"}. Prices include applicable taxes.`,
        50,
        y + 20,
      )
      .text("Thank you for shopping with us. Exchanges are free within 14 days of delivery.");
    doc.end();
  });
}
