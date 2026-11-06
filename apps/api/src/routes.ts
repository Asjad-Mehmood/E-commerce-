import { Router } from "express";
import { accountRouter } from "./modules/account/account.routes";
import { adminProductsRouter, adminVariantsRouter } from "./modules/admin/products.routes";
import { adminCategoriesRouter, adminCollectionsRouter } from "./modules/admin/taxonomy.routes";
import { adminUploadsRouter } from "./modules/admin/uploads.routes";
import { adminContentRouter } from "./modules/admin/content.routes";
import { adminCustomersRouter } from "./modules/admin/customers.routes";
import {
  adminDashboardRouter,
  adminInventoryRouter,
  adminReportsRouter,
} from "./modules/admin/insights.routes";
import { adminCouponsRouter, adminShippingRouter } from "./modules/admin/marketing.routes";
import { adminMessagesRouter } from "./modules/admin/messages.routes";
import {
  adminAuditRouter,
  adminSettingsRouter,
  adminStaffRouter,
} from "./modules/admin/system.routes";
import { authRouter } from "./modules/auth/auth.routes";
import { cartRouter } from "./modules/cart/cart.routes";
import { checkoutRouter } from "./modules/checkout/checkout.routes";
import {
  categoriesRouter,
  collectionsRouter,
  filtersRouter,
  productsRouter,
} from "./modules/catalog/catalog.routes";
import { cmsRouter, formsRouter } from "./modules/cms/cms.routes";
import { healthRouter } from "./modules/health/health.routes";
import { adminOrdersRouter } from "./modules/orders/admin-orders.routes";
import { myOrdersRouter, ordersRouter } from "./modules/orders/orders.routes";
import { paymentsRouter } from "./modules/payments/payments.routes";

/** API v1 router. Admin routes are under /admin and require a staff role. */
export const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/me", accountRouter);
apiRouter.use("/products", productsRouter);
apiRouter.use("/categories", categoriesRouter);
apiRouter.use("/collections", collectionsRouter);
apiRouter.use("/filters", filtersRouter);
apiRouter.use("/cart", cartRouter);
apiRouter.use("/checkout", checkoutRouter);
apiRouter.use("/orders", ordersRouter);
apiRouter.use("/me/orders", myOrdersRouter);
apiRouter.use("/payments", paymentsRouter);
apiRouter.use("/cms", cmsRouter);
apiRouter.use(formsRouter);

apiRouter.use("/admin/products", adminProductsRouter);
apiRouter.use("/admin/variants", adminVariantsRouter);
apiRouter.use("/admin/categories", adminCategoriesRouter);
apiRouter.use("/admin/collections", adminCollectionsRouter);
apiRouter.use("/admin/uploads", adminUploadsRouter);
apiRouter.use("/admin/orders", adminOrdersRouter);
apiRouter.use("/admin/reports", adminReportsRouter);
apiRouter.use("/admin/inventory", adminInventoryRouter);
apiRouter.use("/admin/customers", adminCustomersRouter);
apiRouter.use("/admin/coupons", adminCouponsRouter);
apiRouter.use("/admin/shipping-zones", adminShippingRouter);
apiRouter.use("/admin/messages", adminMessagesRouter);
apiRouter.use("/admin/staff", adminStaffRouter);
apiRouter.use("/admin/settings", adminSettingsRouter);
apiRouter.use("/admin/audit-log", adminAuditRouter);
// Mounted last: these routers own several sub-paths of /admin (dashboard, banners, faq...).
apiRouter.use("/admin", adminDashboardRouter);
apiRouter.use("/admin", adminContentRouter);
