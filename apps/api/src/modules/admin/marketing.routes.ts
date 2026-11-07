import {
  createCouponSchema,
  createShippingZoneSchema,
  updateCouponSchema,
  updateShippingZoneSchema,
} from "@hoodie/validation";
import { audit } from "../../lib/audit";
import { ok } from "../../lib/http";
import { defineRoutes, route } from "../../lib/route";
import * as marketing from "./marketing.service";

export const adminCouponsRouter = defineRoutes("/admin/coupons", "Admin: Coupons & shipping", [
  route({
    method: "get",
    path: "",
    summary: "List coupons with their usage and current state",
    access: "MANAGER",
    handler: async () => ok(await marketing.listCoupons()),
  }),
  route({
    method: "post",
    path: "",
    summary: "Create a coupon",
    description:
      "`value` is a percentage (1-100) for PERCENTAGE, an amount in minor units for FIXED, and ignored for FREE_SHIPPING.",
    access: "MANAGER",
    body: createCouponSchema,
    status: 201,
    handler: async ({ req, body }) => {
      const coupon = await marketing.createCoupon(body);
      await audit(req, "coupon.create", "Coupon", coupon.id, body);
      return ok(coupon);
    },
  }),
  route({
    method: "patch",
    path: "/:id",
    summary: "Update a coupon",
    access: "MANAGER",
    body: updateCouponSchema,
    handler: async ({ req, params, body }) => {
      const coupon = await marketing.updateCoupon(params.id!, body);
      await audit(req, "coupon.update", "Coupon", coupon.id, { code: coupon.code, ...body });
      return ok(coupon);
    },
  }),
  route({
    method: "delete",
    path: "/:id",
    summary: "Delete a coupon that was never used on an order",
    access: "MANAGER",
    handler: async ({ req, params }) => {
      await marketing.deleteCoupon(params.id!);
      await audit(req, "coupon.delete", "Coupon", params.id!);
    },
  }),
]);

export const adminShippingRouter = defineRoutes(
  "/admin/shipping-zones",
  "Admin: Coupons & shipping",
  [
    route({
      method: "get",
      path: "",
      summary: "List shipping zones",
      access: "MANAGER",
      handler: async () => ok(await marketing.listZones()),
    }),
    route({
      method: "post",
      path: "",
      summary: "Create a shipping zone",
      description:
        "`regions` are lower-case city names; `*` is the fallback zone for everywhere else. A city can belong to one active zone only.",
      access: "MANAGER",
      body: createShippingZoneSchema,
      status: 201,
      handler: async ({ req, body }) => {
        const zone = await marketing.createZone(body);
        await audit(req, "shipping-zone.create", "ShippingZone", zone.id, body);
        return ok(zone);
      },
    }),
    route({
      method: "patch",
      path: "/:id",
      summary: "Update a shipping zone",
      access: "MANAGER",
      body: updateShippingZoneSchema,
      handler: async ({ req, params, body }) => {
        const zone = await marketing.updateZone(params.id!, body);
        await audit(req, "shipping-zone.update", "ShippingZone", zone.id, body);
        return ok(zone);
      },
    }),
    route({
      method: "delete",
      path: "/:id",
      summary: "Delete a shipping zone",
      access: "MANAGER",
      handler: async ({ req, params }) => {
        await marketing.deleteZone(params.id!);
        await audit(req, "shipping-zone.delete", "ShippingZone", params.id!);
      },
    }),
  ],
);
