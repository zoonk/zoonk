import { SubjectScreen } from "@repo/packages/learn/src/syllabus/subject-screen.tsx";
import { type ComponentProps } from "react";
import { actions } from "../learn/common";
import { story, type Lang } from "../story";
import { examSyllabus } from "./plan";
import { AppFrame } from "./shell";

type Props = ComponentProps<typeof SubjectScreen>;

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

const STATUSES = [
  "studied",
  "inProgress",
  "toStudy",
  "toStudy",
  "toStudy",
  "toStudy",
  "toStudy",
] as const;

export function examSubject(lang: Lang, index: number): Props["subject"] {
  const subjects = story[lang].exam.subjects;
  const at = Math.min(index, subjects.length - 1);
  const subject = subjects[at] ?? subjects[0];
  const base = examSyllabus(lang).subjects[at];
  if (!base) throw new Error(`no subject ${at}`);
  const often = subject.often.map((name) => ({ frequency: "high" as const, name }));
  const others = (OTHER_TOPICS[lang][at] ?? []).map((name) => ({
    frequency: "medium" as const,
    name,
  }));
  const ordered = [often[0], others[0], others[1], often[1], ...others.slice(2)].filter(
    (topic) => topic !== undefined,
  );

  return {
    ...base,
    topics: ordered.map((topic, i) => ({
      chapters: [],
      frequency: topic.frequency,
      heading: null,
      name: topic.name,
      nextDate: STATUSES[i] === "studied" ? null : "2026-11-04",
      notPlannedReason: null,
      status: STATUSES[i] ?? "toStudy",
    })),
    topicsKnown: 0,
    topicsStudied: 1,
  };
}

export function ExamSubject({ lang, q }: { lang: Lang; q: URLSearchParams }) {
  const index = Number(q.get("subject") ?? (lang === "en" ? 1 : 3));
  const subject = examSubject(lang, index);

  return (
    <AppFrame goal="exam" lang={lang} tab="journey" topBar={false}>
      <SubjectScreen
        actions={actions<Props["actions"]>({})}
        hrefs={{
          adjust: "/plan",
          back: "/plan",
          chapter: (id: string) => `/content/chapters/${id}`,
          essay: (id) => `/essay/${id}`,
        }}
        subject={subject}
        syllabus={examSyllabus(lang)}
      />
    </AppFrame>
  );
}
