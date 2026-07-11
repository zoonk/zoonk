import { NEXT_INTL_PO_FORMAT } from "@zoonk/i18n/next-intl/po-format";
import { unstable_extractMessages } from "next-intl/extractor";

await unstable_extractMessages({
  messages: {
    format: NEXT_INTL_PO_FORMAT,
    locales: "infer",
    path: "./messages",
    sourceLocale: "en",
  },
  srcPath: "./src",
});
