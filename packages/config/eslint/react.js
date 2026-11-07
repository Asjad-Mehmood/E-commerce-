import globals from "globals";
import base from "./base.js";

/** Shared ESLint config for React component libraries (e.g. @hoodie/ui). */
export default [...base, { languageOptions: { globals: { ...globals.browser } } }];
