// The Mistakes notebook (/mistakes) with story.exam.mistakes and their causes.
import { MistakesNotebook } from "@repo/packages/learn/src/mistakes/mistakes-notebook.tsx";
import { story, type Lang } from "../story";
import { useTapOnMount } from "./plan";
import { AppFrame } from "./shell";

/** The story's cause hints, as core names them (MistakeCause). */
const CAUSE: Record<string, string> = {
  contentGap: "gap",
  guessed: "guess",
  misread: "misread",
  time: "time",
  trap: "trap",
};

/** Per story mistake: the skill it practices, the learner's answer and the right one. */
const DETAILS: Record<Lang, [string, string, string][]> = {
  en: [
    ["Linear equations", "7", "5"],
    [
      "Central ideas and details",
      "The city should build more roads.",
      "Traffic grows to fill the roads a city builds.",
    ],
    ["Percentages", "$48", "$50"],
    ["Transitions", "However,", "As a result,"],
    ["Words in context", "fictional", "new"],
  ],
  pt: [
    ["Porcentagem e juros", "R$ 105,00", "R$ 100,00"],
    [
      "Interpretação de texto",
      "O texto elogia o consumo.",
      "O autor critica o consumo sem reflexão.",
    ],
    ["Porcentagem e juros", "20%", "19%"],
    ["Pontuação", "Separar o vocativo.", "Isolar o aposto."],
    ["Interpretação de texto", "eterno", "passageiro"],
  ],
};

const DAYS_AGO = [1, 1, 2, 4, 6];

function notebook(lang: Lang) {
  const mistakes = story[lang].exam.mistakes.map(([question, hint], index) => {
    const [skill, answer, correctAnswer] = DETAILS[lang][index];
    const created = new Date("2026-11-03T12:00:00-03:00");
    created.setDate(created.getDate() - DAYS_AGO[index]);

    return {
      cause: CAUSE[hint],
      createdAt: created,
      fixedAt: null,
      id: `mistake-${index}`,
      itemId: `item-${index}`,
      lesson: { id: `lesson-${index}`, title: skill },
      practiceAvailable: true,
      practiceAvailableTomorrow: false,
      skill: { id: `skill-${skill}`, name: skill },
      snapshot: { answer, correctAnswer, question },
      status: "open",
    };
  });

  const byCause = { gap: 0, guess: 0, misread: 0, time: 0, trap: 0, unsorted: 0 } as Record<
    string,
    number
  >;
  for (const mistake of mistakes) byCause[mistake.cause] += 1;

  return {
    availability: { ready: mistakes.length, tomorrow: 0 },
    counts: { byCause, fixed: 3, open: mistakes.length },
    hasMore: false,
    mistakes,
    status: "ready",
    trueFalseLabels: { false: "False", true: "True" },
  } as any;
}

/** `open=<n>` opens the skill of the story's mistake n (0-based), as a tap on its row does. */
export function Mistakes({ lang, q }: { lang: Lang; q: URLSearchParams }) {
  const open = q.get("open");
  const skill = open === null ? null : DETAILS[lang][Number(open)]?.[0];
  useTapOnMount(
    skill
      ? `[aria-controls="mistakes-skill-skill-${CSS.escape(skill)}"][aria-expanded="false"]`
      : null,
  );

  return (
    <AppFrame goal="exam" lang={lang} tab="today" topBar={false}>
      <MistakesNotebook
        filters={{ nextOffset: null, status: "open" }}
        goalTitle={story[lang].exam.title}
        hrefs={{
          back: "/today",
          lesson: "/learn",
          notebook: "/mistakes",
          pattern: "/pattern",
          practice: "/mistakes/practice",
        }}
        notebook={notebook(lang)}
        pattern={null}
      />
    </AppFrame>
  );
}
