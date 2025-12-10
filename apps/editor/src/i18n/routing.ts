import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  defaultLocale: "en",
  localePrefix: "never",
  locales: ["en", "pt", "es"],
});
