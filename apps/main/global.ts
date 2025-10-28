// biome-ignore-all lint/style/useNamingConvention: external module declaration

import type { formats } from "@/i18n/request";
import messages from "./messages/en.json" with { type: "json" };

declare module "next-intl" {
  interface AppConfig {
    Locale: string;
    Messages: typeof messages;
    Formats: typeof formats;
  }
}
