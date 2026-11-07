/**
 * Vercel entry point (apps/api/api/index.js re-exports this bundle). Vercel
 * calls the Express app as a request handler; there is no server to start and
 * no background worker (scheduled jobs come from Vercel Cron instead).
 */
import { createApp } from "./app";

export default createApp();
