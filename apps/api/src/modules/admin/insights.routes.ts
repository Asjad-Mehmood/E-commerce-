import { dashboardQuerySchema, inventoryQuerySchema, reportQuerySchema } from "@hoodie/validation";
import { csvMoney, sendCsv } from "../../lib/csv";
import { ok } from "../../lib/http";
import { defineRoutes, route } from "../../lib/route";
import { getDashboard, getNotifications } from "./dashboard.service";
import { adjustmentHistory, listInventory } from "./inventory.service";
import * as reports from "./reports.service";

export const adminDashboardRouter = defineRoutes("/admin", "Admin: Dashboard & reports", [
  route({
    method: "get",
    path: "/dashboard",
    summary: "KPIs, daily sales, top products, low stock and recent orders",
    description:
      "`days` is 7, 30 or 90. Each KPI includes the same-length period before it. Sales are net of refunds, by order date, in the store's time zone.",
    access: "SUPPORT",
    query: dashboardQuerySchema,
    handler: async ({ query }) => ok(await getDashboard(query.days)),
  }),
  route({
    method: "get",
    path: "/notifications",
    summary: "Counts for the admin top bar (orders to fulfil, new messages, low stock)",
    description: "Polled by the admin panel; `latestOrder` lets it announce new orders.",
    access: "SUPPORT",
    handler: async () => ok(await getNotifications()),
  }),
]);

const fileDate = (r: { from: string; to: string }) => `${r.from}_to_${r.to}`;

export const adminReportsRouter = defineRoutes("/admin/reports", "Admin: Dashboard & reports", [
  route({
    method: "get",
    path: "/sales",
    summary: "Sales by day, week or month (`format=csv` to download)",
    access: "MANAGER",
    query: reportQuerySchema,
    handler: async ({ query, res }) => {
      const report = await reports.salesReport(query);
      if (query.format === "json") return ok(report);
      sendCsv(
        res,
        `sales-${fileDate(report)}.csv`,
        ["Period", "Orders", "Units", "Gross", "Discounts", "Shipping & fees", "Refunds", "Net"],
        report.rows.map((r) => [
          r.period,
          r.orders,
          r.units,
          csvMoney(r.gross),
          csvMoney(r.discounts),
          csvMoney(r.shipping),
          csvMoney(r.refunds),
          csvMoney(r.net),
        ]),
      );
    },
  }),
  route({
    method: "get",
    path: "/products",
    summary: "Best-selling products in a date range",
    access: "MANAGER",
    query: reportQuerySchema,
    handler: async ({ query, res }) => {
      const rows = await reports.productReport(query, 500);
      if (query.format === "json") return ok(rows);
      sendCsv(
        res,
        "products.csv",
        ["Product", "Orders", "Units", "Revenue"],
        rows.map((r) => [r.title, r.orders, r.units, csvMoney(r.revenue)]),
      );
    },
  }),
  route({
    method: "get",
    path: "/categories",
    summary: "Sales by category in a date range",
    access: "MANAGER",
    query: reportQuerySchema,
    handler: async ({ query, res }) => {
      const rows = await reports.categoryReport(query);
      if (query.format === "json") return ok(rows);
      sendCsv(
        res,
        "categories.csv",
        ["Category", "Units", "Revenue"],
        rows.map((r) => [r.name, r.units, csvMoney(r.revenue)]),
      );
    },
  }),
  route({
    method: "get",
    path: "/inventory",
    summary: "Stock on hand and its retail value, per product",
    access: "MANAGER",
    query: reportQuerySchema,
    handler: async ({ query, res }) => {
      const rows = await reports.inventoryValuation();
      if (query.format === "json") return ok(rows);
      sendCsv(
        res,
        "inventory-valuation.csv",
        ["Product", "Status", "Units", "Retail value"],
        rows.map((r) => [r.title, r.status, r.units, csvMoney(r.retailValue)]),
      );
    },
  }),
]);

export const adminInventoryRouter = defineRoutes("/admin/inventory", "Admin: Inventory", [
  route({
    method: "get",
    path: "",
    summary: "Stock per variant (`stock=low|out` to filter)",
    description:
      "Change stock with POST /admin/variants/:id/adjust-stock so every change is recorded with a reason.",
    access: "MANAGER",
    query: inventoryQuerySchema,
    handler: ({ query }) => listInventory(query),
  }),
  route({
    method: "get",
    path: "/:variantId/history",
    summary: "Stock adjustment history of a variant, with who made each change",
    access: "MANAGER",
    handler: async ({ params }) => ok(await adjustmentHistory(params.variantId!)),
  }),
]);
