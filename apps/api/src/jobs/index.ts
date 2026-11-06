import { logger } from "../lib/logger";
import { expireUnpaidOrders } from "../modules/orders/lifecycle";

const MINUTE = 60_000;

/**
 * In-process scheduled jobs. Each job is safe to run on several API servers at
 * once (every change is an atomic conditional update), so no lock is needed.
 */
export function startJobs(): () => void {
  const run = async () => {
    try {
      const n = await expireUnpaidOrders();
      if (n) logger.info(`Released stock from ${n} unpaid order(s)`);
    } catch (err) {
      logger.error({ err }, "expireUnpaidOrders failed");
    }
  };
  void run();
  const timer = setInterval(run, MINUTE);
  timer.unref();
  return () => clearInterval(timer);
}
