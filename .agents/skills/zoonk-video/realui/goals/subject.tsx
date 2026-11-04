// An exam subject's page (/plan/[subject]): its topics, the often-asked ones tagged "Appears a lot".
import { SubjectScreen } from "@repo/packages/learn/src/syllabus/subject-screen.tsx";
import { story, type Lang } from "../story";
import { examSyllabus } from "./plan";
import { AppFrame, NOOP_ASYNC } from "./shell";

/** The subjects' other topics, from the real syllabi (the story only names the often-asked ones). */
const OTHER_TOPICS: Record<Lang, string[][]> = {
  en: [
    ["Central ideas and details", "Command of evidence", "Boundaries", "Rhetorical synthesis"],
    ["Systems of linear equations", "Quadratic equations", "Ratios and rates", "Right triangles"],
  ],
  pt: [
    ["Gêneros textuais", "Variação linguística", "Arte e literatura"],
    ["Brasil Colônia", "Revolução Industrial", "Geopolítica"],
    ["Genética", "Funções orgânicas", "Ondulatória"],
    ["Geometria plana", "Estatística", "Probabilidade"],
  ],
};

const STATUSES = ["studied", "inProgress", "toStudy", "toStudy", "toStudy", "toStudy", "toStudy"];

export function examSubject(lang: Lang, index: number) {
  const subjects = story[lang].exam.subjects;
  const at = Math.min(index, subjects.length - 1);
  const subject = subjects[at];
  const base = examSyllabus(lang).subjects[at];
  const often = subject.often.map((name) => ({ frequency: "high", name }));
  const others = (OTHER_TOPICS[lang][at] ?? []).map((name) => ({ frequency: "medium", name }));
  const ordered = [often[0], others[0], others[1], often[1], ...others.slice(2)].filter(Boolean);

  return {
    ...base,
    topics: ordered.map((topic, i) => ({
      chapters: [],
      frequency: topic.frequency,
      heading: null,
      name: topic.name,
      nextDate: STATUSES[i] === "studied" ? null : "2026-11-04",
      notPlannedReason: null,
      status: STATUSES[i],
    })),
    topicsKnown: 0,
    topicsStudied: 1,
  } as any;
}

export function ExamSubject({ lang, q }: { lang: Lang; q: URLSearchParams }) {
  const index = Number(q.get("subject") ?? (lang === "en" ? 1 : 3));
  const subject = examSubject(lang, index);

  return (
    <AppFrame goal="exam" lang={lang} tab="journey" topBar={false}>
      <SubjectScreen
        actions={{ restore: NOOP_ASYNC, setWrittenCadence: NOOP_ASYNC } as any}
        hrefs={{
          adjust: "/plan",
          back: "/plan",
          chapter: (id: string) => `/content/chapters/${id}`,
        }}
        subject={subject}
        syllabus={
          {
            examDocument: "notice",
            fromMaterial: false,
            kind: "notice",
            knownTopicsReturn: "practice",
            questionsSource: null,
            writtenPractice: null,
          } as any
        }
      />
    </AppFrame>
  );
}
