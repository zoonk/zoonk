import { unstable_extractMessages } from "next-intl/extractor";

await unstable_extractMessages({
  messages: { format: "po", locales: "infer", path: "./messages", sourceLocale: "en" },
  srcPath: "./src",
});
