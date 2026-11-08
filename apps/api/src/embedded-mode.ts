// Imported first by embedded.ts: the API runs inside the site's Next.js app,
// where no background worker runs, so jobs and emails must not be queued.
process.env.API_EMBEDDED = "true";
