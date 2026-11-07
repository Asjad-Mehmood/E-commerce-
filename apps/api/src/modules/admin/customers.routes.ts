import {
  blockCustomerSchema,
  customerListQuerySchema,
  updateCustomerSchema,
} from "@hoodie/validation";
import { audit } from "../../lib/audit";
import { ok } from "../../lib/http";
import { defineRoutes, route } from "../../lib/route";
import * as customers from "./customers.service";

export const adminCustomersRouter = defineRoutes("/admin/customers", "Admin: Customers", [
  route({
    method: "get",
    path: "",
    summary: "List customer accounts with order count and lifetime value",
    description: "Lifetime value is the total of their orders, net of refunds.",
    access: "SUPPORT",
    query: customerListQuerySchema,
    handler: ({ query }) => customers.listCustomers(query),
  }),
  route({
    method: "get",
    path: "/:id",
    summary: "Customer profile, addresses, stats and orders",
    access: "SUPPORT",
    handler: async ({ params }) => ok(await customers.getCustomer(params.id!)),
  }),
  route({
    method: "patch",
    path: "/:id",
    summary: "Update the private staff note about a customer",
    access: "SUPPORT",
    body: updateCustomerSchema,
    handler: async ({ req, params, body }) => {
      const customer = await customers.updateCustomerNote(params.id!, body.adminNote);
      await audit(req, "customer.note", "User", params.id!, { email: customer.email });
      return ok(customer);
    },
  }),
  route({
    method: "patch",
    path: "/:id/block",
    summary: "Block or unblock a customer",
    description: "A blocked customer is signed out everywhere and cannot sign in or check out.",
    access: "MANAGER",
    body: blockCustomerSchema,
    handler: async ({ req, params, body }) => {
      const customer = await customers.setBlocked(params.id!, body.isBlocked);
      await audit(req, body.isBlocked ? "customer.block" : "customer.unblock", "User", params.id!, {
        email: customer.email,
      });
      return ok(customer);
    },
  }),
]);
