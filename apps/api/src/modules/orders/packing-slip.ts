import type { OrderAddressDTO } from "@hoodie/types";
import PDFDocument from "pdfkit";
import type { StoreInfo } from "../../lib/settings";
import { shippingLabel, type FullOrder } from "./order.mapper";

/**
 * A4 packing slip: what to pack and where it goes. No prices, so it can travel
 * inside the parcel. Cash on Delivery orders show the amount to collect.
 */
export function renderPackingSlip(order: FullOrder, store: StoreInfo): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
      info: { Title: `Packing slip ${order.orderNumber}` },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const address = order.shippingAddress as unknown as OrderAddressDTO;

    doc
      .font("Helvetica-Bold")
      .fontSize(20)
      .fillColor("#111")
      .text(store.name.toUpperCase(), 50, 50);
    doc.font("Helvetica").fontSize(9).fillColor("#666").text("Packing slip");
    doc
      .fillColor("#111")
      .font("Helvetica-Bold")
      .fontSize(16)
      .text(order.orderNumber, 350, 50, { width: 195, align: "right" });
    doc
      .font("Helvetica")
      .fontSize(10)
      .text(order.placedAt.toLocaleDateString("en-PK", { dateStyle: "long" }), {
        width: 195,
        align: "right",
      })
      .text(shippingLabel(order.shippingMethod), { width: 195, align: "right" });

    doc.font("Helvetica-Bold").fontSize(11).text("Ship to", 50, 120);
    doc
      .font("Helvetica")
      .fontSize(12)
      .text(
        [
          address.fullName,
          address.line1,
          address.line2,
          `${address.city}${address.state ? `, ${address.state}` : ""} ${address.postalCode}`,
          `Phone: ${address.phone}`,
        ]
          .filter(Boolean)
          .join("\n"),
      );

    if (order.paymentMethod === "COD" && order.status !== "DELIVERED") {
      const amount = new Intl.NumberFormat("en-PK", {
        style: "currency",
        currency: order.currency,
        maximumFractionDigits: 0,
      }).format(order.grandTotal / 100);
      doc
        .roundedRect(350, 120, 195, 60, 6)
        .lineWidth(2)
        .strokeColor("#111")
        .stroke()
        .font("Helvetica-Bold")
        .fontSize(10)
        .text("CASH ON DELIVERY", 360, 130, { width: 175, align: "center" })
        .fontSize(16)
        .text(`Collect ${amount}`, 360, 148, { width: 175, align: "center" });
    }

    let y = 240;
    const row = (cells: [string, string, string, string], bold = false) => {
      doc
        .font(bold ? "Helvetica-Bold" : "Helvetica")
        .fontSize(10)
        .fillColor("#111");
      doc.text(cells[0], 50, y, { width: 20 });
      doc.text(cells[1], 80, y, { width: 290 });
      doc.text(cells[2], 380, y, { width: 115 });
      doc.text(cells[3], 500, y, { width: 45, align: "right" });
      y = Math.max(doc.y, y + 14) + 8;
    };
    row(["", "Item", "SKU", "Qty"], true);
    doc
      .moveTo(50, y - 4)
      .lineTo(545, y - 4)
      .lineWidth(1)
      .strokeColor("#ddd")
      .stroke();
    for (const item of order.items) {
      doc
        .rect(52, y + 1, 9, 9)
        .lineWidth(1)
        .strokeColor("#111")
        .stroke();
      row([
        "",
        `${item.productTitle}\n${item.color} / ${item.size}`,
        item.sku,
        String(item.quantity),
      ]);
    }
    doc.moveTo(50, y).lineTo(545, y).strokeColor("#ddd").stroke();
    const units = order.items.reduce((n, i) => n + i.quantity, 0);
    doc
      .font("Helvetica-Bold")
      .text(`${units} item${units === 1 ? "" : "s"}`, 380, y + 8, { width: 165, align: "right" });

    if (order.customerNote) {
      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .text("Customer note", 50, y + 40)
        .font("Helvetica")
        .text(order.customerNote, { width: 495 });
    }

    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#666")
      .text(
        `Questions? ${[store.email, store.phone].filter(Boolean).join(" · ")}. Exchanges are free within 14 days of delivery.`,
        50,
        760,
        { width: 495, align: "center" },
      );
    doc.end();
  });
}
