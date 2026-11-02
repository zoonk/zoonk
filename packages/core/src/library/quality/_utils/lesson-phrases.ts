import { type SupportedLocale, getSupportedLocaleFromLanguage } from "@zoonk/utils/locale";
import { normalizeString } from "@zoonk/utils/string";

const LESSON_FRAMING: Readonly<Record<SupportedLocale, readonly string[]>> = {
  de: ["in dieser lektion", "in der letzten lektion", "am ende dieser lektion"],
  en: [
    "in this lesson",
    "in today's lesson",
    "in the previous lesson",
    "in the last lesson",
    "by the end of this lesson",
    "let's dive",
  ],
  es: [
    "en esta leccion",
    "en la leccion anterior",
    "al final de esta leccion",
    "vamos a sumergirnos",
  ],
  fr: ["dans cette lecon", "dans la lecon precedente", "a la fin de cette lecon"],
  it: [
    "in questa lezione",
    "nella lezione di oggi",
    "nella lezione precedente",
    "nella scorsa lezione",
    "alla fine di questa lezione",
    "immergiamoci",
    "tuffiamoci",
  ],
  ja: [
    "このレッスンで",
    "今回のレッスンで",
    "本レッスンでは",
    "前回のレッスン",
    "このレッスンの最後に",
  ],
  ko: [
    "이번 레슨에서",
    "이 레슨에서",
    "이번 시간에",
    "지난 레슨에서",
    "이전 레슨에서",
    "이 레슨이 끝나면",
  ],
  pl: [
    "w tej lekcji",
    "na tej lekcji",
    "na dzisiejszej lekcji",
    "w dzisiejszej lekcji",
    "w poprzedniej lekcji",
    "na poprzedniej lekcji",
    "pod koniec tej lekcji",
    "zanurzmy sie",
    "zagłebmy sie",
  ],
  pt: [
    "nesta licao",
    "nessa licao",
    "nesta aula",
    "na licao anterior",
    "na aula anterior",
    "ao final desta licao",
    "vamos mergulhar",
  ],
  tr: [
    "bu derste",
    "bugunku derste",
    "onceki derste",
    "gecen derste",
    "bu dersin sonunda",
    "hadi dalalım",
    "haydi dalalım",
    "konuya dalalım",
  ],
};

const FILLER: Readonly<Record<SupportedLocale, readonly string[]>> = {
  de: ["es ist wichtig zu beachten", "seit anbeginn der zeit", "in der heutigen welt"],
  en: [
    "it is important to note",
    "it's important to note",
    "it is worth noting",
    "it's worth noting",
    "since the dawn of time",
    "in today's world",
    "in today's fast-paced world",
    "as we all know",
    "needless to say",
  ],
  es: [
    "es importante destacar",
    "es importante senalar",
    "cabe destacar",
    "vale la pena destacar",
    "desde tiempos inmemoriales",
    "en el mundo actual",
    "como todos sabemos",
  ],
  fr: [
    "il est important de noter",
    "il convient de noter",
    "depuis la nuit des temps",
    "dans le monde d'aujourd'hui",
  ],
  it: [
    "e importante notare",
    "e importante sottolineare",
    "vale la pena notare",
    "dalla notte dei tempi",
    "nel mondo di oggi",
    "come tutti sappiamo",
  ],
  ja: [
    "言うまでもなく",
    "ご存じのとおり",
    "ご存知のとおり",
    "ご存じの通り",
    "ご存知の通り",
    "現代社会において",
    "太古の昔から人",
  ],
  ko: ["말할 것도 없이", "모두가 알다시피", "오늘날의 세상에서", "태초부터"],
  pl: [
    "warto zauwazyc",
    "nalezy podkreslic",
    "od zarania dziejow",
    "w dzisiejszym swiecie",
    "jak wszyscy wiemy",
  ],
  pt: [
    "e importante ressaltar",
    "e importante destacar",
    "e importante notar",
    "vale ressaltar",
    "vale destacar",
    "desde os primordios",
    "no mundo atual",
    "nos dias de hoje",
    "como todos sabemos",
  ],
  tr: [
    "belirtmek gerekir ki",
    "sunu belirtmek gerekir",
    "unutulmamalıdır ki",
    "hepimizin bildigi gibi",
    "gunumuz dunyasında",
    "cok eski zamanlardan beri",
  ],
};

/**
 * Japanese has no spaces, so a phrase can sit anywhere; Korean writes particles onto the end of its
 * words ("레슨에서는"), so a phrase only has to start a word.
 */
function containsPhrase({
  locale,
  normalizedText,
  phrase,
}: {
  locale: SupportedLocale;
  normalizedText: string;
  phrase: string;
}): boolean {
  if (locale === "ja") {
    return normalizedText.includes(phrase);
  }

  const words = ` ${normalizedText.replaceAll(/[^\p{L}\p{N}'-]+/gu, " ")} `;
  return words.includes(locale === "ko" ? ` ${phrase}` : ` ${phrase} `);
}

export function findLessonPhrases({ language, text }: { language: string; text: string }): {
  filler: string[];
  framing: string[];
} {
  const locale = getSupportedLocaleFromLanguage(language);
  const normalizedText = normalizeString(text.replaceAll("’", "'"));
  const contains = (phrase: string) => containsPhrase({ locale, normalizedText, phrase });

  return {
    filler: FILLER[locale].filter((phrase) => contains(phrase)),
    framing: LESSON_FRAMING[locale].filter((phrase) => contains(phrase)),
  };
}
