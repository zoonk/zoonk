import { type Prisma, type StepKind } from "../../../../generated/prisma/client";
import { type SeedLanguage, localizeObject } from "../_utils/localize";
import { type SeedLesson, type SeedSkill, type SeedStep } from "./types";

type ScreenKind = "activity" | "application" | "check" | "explanation" | "hook" | "workedExample";

/** How the lesson spec names each teaching step; summaries and language drills aren't screens. */
const SCREEN_BY_KIND: Partial<Record<StepKind, ScreenKind>> = {
  activity: "activity",
  check: "check",
  explanation: "explanation",
  hook: "hook",
  spokenAnswer: "application",
  typedAnswer: "application",
  workedExample: "workedExample",
};

const BRIEF_FIELDS = ["title", "question", "problem", "prompt", "text"] as const;
const MAX_BRIEF_LENGTH = 160;

function stepBrief(content: Prisma.InputJsonObject): string {
  const text = BRIEF_FIELDS.map((field) => content[field]).find(
    (value): value is string => typeof value === "string",
  );

  return (text ?? "").slice(0, MAX_BRIEF_LENGTH);
}

function toScreen({
  language,
  lesson,
  step,
}: {
  language: SeedLanguage;
  lesson: SeedLesson;
  step: SeedStep;
}) {
  const kind = step.screen ?? SCREEN_BY_KIND[step.kind];

  if (!kind) {
    return [];
  }

  const content = localizeObject(step.content, language);
  const skillIndex = step.skill ? lesson.skills.indexOf(step.skill) : 0;

  return [
    {
      activityTemplate: typeof content.template === "string" ? content.template : null,
      brief: stepBrief(content),
      kind,
      skills: [Math.max(skillIndex, 0)],
      visual: null,
    },
  ];
}

/**
 * The spec a written lesson was built from: its skills and screen plan. Seeded lessons are
 * written by hand, so the spec is read back from their steps, in the shape the lesson writer uses.
 */
export function buildLessonSpec({
  language,
  lesson,
  skills,
}: {
  language: SeedLanguage;
  lesson: SeedLesson;
  skills: readonly SeedSkill[];
}): Prisma.InputJsonObject {
  const lessonSkills = lesson.skills.flatMap((key) => skills.filter((skill) => skill.key === key));

  return {
    canDo: lesson.canDo?.in(language) ?? "",
    description: lesson.description.in(language),
    estimatedMinutes: lesson.minutes,
    screens: (lesson.steps ?? []).flatMap((step) => toScreen({ language, lesson, step })),
    skills: lessonSkills.map((skill) => ({
      description: skill.description.in(language),
      example: skill.example?.in(language) ?? "",
      hard: skill.hard ?? false,
      name: skill.name.in(language),
      topic: skill.name.in(language),
      useCase: skill.useCase?.in(language) ?? "",
    })),
    supportMode: lesson.supportMode ?? "explanationFirst",
    title: lesson.title.in(language),
  };
}
