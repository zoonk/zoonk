import { LanguageUnitScreen } from "@repo/packages/learn/src/language/unit/language-unit-screen.tsx";
import { AskTutor } from "@repo/packages/player/src/questions/ask-tutor.tsx";
// The language goal's unit page (/content/units/[chapterId]) for story.language.units[0].
import { Link } from "../learn/common";
import { story, type Lang } from "../story";
import { AppFrame, DEFAULT_BUDDY_VIEW, NOOP_ASYNC } from "./shell";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

export const FAKE_TUTOR = {
  buddy: DEFAULT_BUDDY_VIEW,
  canAsk: true,
  connection: { apiUrl: "http://localhost", getHeaders: async () => ({}) },
  navigation: {
    linkComponent: Link,
    loginHref: "/login",
    renderMemoryUpdate: () => null,
    subscriptionHref: "/subscription",
  },
} as any;

export function unitView(lang: Lang, index = 0) {
  const language = story[lang].language;
  const [title, objective] = language.units[index];

  return {
    canTestOut: false,
    conversation: {
      character: { name: language.call.character, role: language.call.role },
      defaultMinutes: 5,
      limit: null,
      minutes: [3, 5, 10],
      paused: false,
      plusMinutes: [],
    },
    goalId: id(1),
    grammarTips: [],
    lessons: [],
    mistakes: [],
    pattern: { id: id(2), kind: "pattern", title: language.pattern.title },
    pronunciation: { count: 1, words: [language.word.word] },
    summaries: [],
    unit: {
      chapterId: id(3),
      description: objective,
      levelRange: "A1–A2",
      objectives: [objective],
      position: index + 1,
      title,
    },
    words: { count: language.call.words.length, sample: [...language.call.words] },
  } as any;
}

export function LanguageUnit({ lang, q }: { lang: Lang; q: URLSearchParams }) {
  const index = Number(q.get("unit") ?? 0);
  const unit = unitView(lang, index);

  return (
    <AppFrame goal="language" lang={lang} tab="journey" topBar={false}>
      <LanguageUnitScreen
        actions={{ startConversation: NOOP_ASYNC, startTestOut: NOOP_ASYNC }}
        ask={
          <AskTutor
            size="bar"
            target={{ chapterId: unit.unit.chapterId, kind: "chapter" } as any}
            tutor={FAKE_TUTOR}
          />
        }
        hrefs={{
          back: "/plan",
          lesson: (lessonId: string) => `/learn/${lessonId}`,
          pattern: (patternId: string) => `/pattern/${patternId}`,
          pronunciation: "/pronunciation",
        }}
        renderLessonText={(text: string) => <p>{text}</p>}
        unit={unit}
        upNext
      />
    </AppFrame>
  );
}
