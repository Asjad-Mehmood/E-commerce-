// Vercel serverless function: every request is rewritten here (vercel.json).
// The API is bundled to dist/ by `tsup` during the build.
export { default } from "../dist/vercel.js";
