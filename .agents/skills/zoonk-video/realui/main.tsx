import "@repo/packages/player/src/_test-utils/browser.css";
import mainEn from "@repo/apps/main/messages/en.po";
import mainPt from "@repo/apps/main/messages/pt.po";
import { mergeMessages } from "@repo/apps/main/src/i18n/merge-messages.ts";
import { learnMessages } from "@repo/packages/learn/src/messages.ts";
import { playerMessages } from "@repo/packages/player/src/messages.ts";
import { NextIntlClientProvider } from "next-intl";
import { createRoot } from "react-dom/client";
import { TODAY } from "./story";

type View = (p: { lang: "en" | "pt"; state: string; q: URLSearchParams }) => any;

// A module that no longer compiles against the app only loses its own views.
const modules = import.meta.glob<{ views: Record<string, View> }>([
  "./player.tsx",
  "./art.tsx",
  "./*/index.tsx",
]);
const loaded = await Promise.allSettled(Object.values(modules).map((load) => load()));
const views: Record<string, View> = {};
for (const result of loaded) {
  if (result.status === "fulfilled") Object.assign(views, result.value.views);
  else console.error(result.reason);
}

const q = new URLSearchParams(location.search);
const lang = q.get("lang") === "pt" ? "pt" : "en";
const messages = mergeMessages(
  await playerMessages(lang),
  await learnMessages(lang),
  lang === "pt" ? mainPt : mainEn,
);
const View =
  views[q.get("view") ?? ""] ?? (() => <pre>{Object.keys(views).sort().join("\n")}</pre>);

createRoot(document.getElementById("root")!).render(
  <NextIntlClientProvider
    locale={lang === "pt" ? "pt-BR" : "en-US"}
    messages={messages}
    now={new Date(TODAY)}
    timeZone="America/Sao_Paulo"
  >
    <View lang={lang} state={q.get("state") ?? "answering"} q={q} />
  </NextIntlClientProvider>,
);
