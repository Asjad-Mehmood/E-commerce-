import { deliverMail } from "../lib/mailer";
import { sendCartReminders } from "../modules/engagement/abandoned-carts";
import { sendDailyDigest } from "../modules/engagement/digest";
import { notifyBackInStock } from "../modules/engagement/stock-alerts";
import { sendDueReviewRequests } from "../modules/reviews/review-request";
import { expireUnpaidOrders } from "../modules/orders/lifecycle";
import type { JobData, JobName } from "./queue";

/** What each background job does. Handlers throw to have BullMQ retry them. */
export const handlers: { [N in JobName]: (data: JobData[N]) => Promise<unknown> } = {
  email: (mail) => deliverMail(mail),
  "expire-orders": () => expireUnpaidOrders(),
  "abandoned-carts": () => sendCartReminders(),
  "daily-digest": () => sendDailyDigest(),
  "stock-alerts": ({ variantIds }) => notifyBackInStock(variantIds),
  "review-requests": () => sendDueReviewRequests(),
};
