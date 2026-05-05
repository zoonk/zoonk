import { SUPPORTED_LOCALES } from "@zoonk/utils/locale";
import { unstable_extractMessages } from "next-intl/extractor";

await unstable_extractMessages({
  extract: { locales: SUPPORTED_LOCALES, sourceLocale: "en", srcPath: "./src" },
  messages: {
    format: { codec: "../next/src/i18n/next-intl-codec.ts", extension: ".po" },
    path: "./messages",
  },
});
