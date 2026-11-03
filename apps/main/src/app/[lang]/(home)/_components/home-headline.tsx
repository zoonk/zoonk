import { type SupportedLocale } from "@zoonk/utils/locale";
import { getExtracted } from "next-intl/server";
import { type ReactNode } from "react";
import { getLocaleExampleSet } from "./locale-example-sets";

type RenderChunks = (chunks: ReactNode) => ReactNode;

export async function getHomeHeadline({
  line,
  locale,
  more,
}: {
  line: RenderChunks;
  locale: SupportedLocale;
  more: RenderChunks;
}): Promise<ReactNode> {
  const t = await getExtracted({ locale });
  const { exam, move } = getLocaleExampleSet(locale);

  return t.rich({
    description:
      "The landing's headline: the goals people come with, one per line, then a line for any other goal. Each line must fit on one line of a phone at a very large size, so keep every line as short as {exam} and in the same form: {exam} is the first goal, already written for your country, such as “Passar no Enem” or “共通テスト対策”. Keep the language branches as they are: the page suggests a language other than its own. In Brazilian Portuguese: “<line>{exam}.</line> <line>Falar inglês.</line> <line>Mudar de carreira.</line> <more>Ou o que quiser.</more>”",
    message:
      "<line>{exam}.</line> <line>{language, select, spanish {Speak Spanish.} other {Speak English.}}</line> <line>Switch careers.</line> <more>Or anything else.</more>",
    values: {
      exam: exam.headline,
      language: move === "mexico-city" ? "spanish" : "english",
      line,
      more,
    },
  });
}
