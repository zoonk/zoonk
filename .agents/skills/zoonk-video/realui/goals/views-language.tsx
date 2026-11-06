import { type Lang } from "../story";
import { CallFeedback, CallLive, SpeakingResult } from "./lang-call";
import { Essay } from "./lang-essay";
import { Pattern } from "./lang-pattern";
import { LanguageUnit } from "./lang-unit";

export type View = (p: { lang: Lang; state: string; q: URLSearchParams }) => any;

export const views: Record<string, View> = {
  "language-unit": ({ lang, q }) => <LanguageUnit lang={lang} q={q} />,
  call: ({ lang }) => <CallLive lang={lang} />,
  "call-feedback": ({ lang, state }) => <CallFeedback lang={lang} state={state} />,
  speaking: ({ lang, state }) => <SpeakingResult lang={lang} state={state} />,
  pattern: ({ lang }) => <Pattern lang={lang} />,
  /** The Enem essay is pt's story; en renders the same grade in English UI. */
  essay: ({ q }) => <Essay q={q} />,
};
