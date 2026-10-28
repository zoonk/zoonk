import "server-only";
import { type LessonSpec } from "@zoonk/ai/tasks/v2/lesson-spec/rules";
import { type WriteLessonDraftParams } from "@zoonk/ai/tasks/v2/lesson-writer";
import { type StepKind, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { libraryRowsVisibleTo } from "../../_utils/library-visibility";
import { CURRENT_STEPS } from "../lesson-versions";
import { parseStoredLessonSpec } from "./stored-lesson-spec";
import { toSummaryIdeas } from "./summary-ideas";

export type ChapterLesson = NonNullable<WriteLessonDraftParams["chapterLessons"]>[number];

const MAX_EXAMPLES = 6;

const EXAMPLE_FIELDS: Partial<Record<StepKind, readonly string[]>> = {
  check: ["context", "question"],
  hook: ["question", "text"],
  typedAnswer: ["context", "question"],
  workedExample: ["problem"],
};

const EXAMPLE_SCREENS: ReadonlySet<LessonSpec["screens"][number]["kind"]> = new Set([
  "application",
  "check",
  "hook",
  "workedExample",
]);

type StoredStep = { content: unknown; kind: StepKind };

function describeStep({ content, kind }: StoredStep): string | null {
  const fields = EXAMPLE_FIELDS[kind] ?? [];

  if (!isJsonObject(content)) {
    return null;
  }

  const text = fields
    .map((field) => content[field])
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .replaceAll(/\s+/gu, " ")
    .trim();

  return text.length > 0 ? text : null;
}

function getPlannedExamples(spec: LessonSpec | null): string[] {
  if (!spec) {
    return [];
  }

  return [
    ...spec.skills.map((skill) => skill.example),
    ...spec.screens
      .filter((screen) => EXAMPLE_SCREENS.has(screen.kind))
      .map((screen) => screen.brief),
  ];
}

function describeLesson({
  spec,
  steps,
  summary,
}: {
  spec: unknown;
  steps: readonly StoredStep[];
  summary: unknown;
}): Pick<ChapterLesson, "examples" | "ideas"> {
  const planned = parseStoredLessonSpec(spec);
  const summaryIdeas = toSummaryIdeas(summary);
  const written = steps.flatMap((step) => describeStep(step) ?? []);

  return {
    examples: (written.length > 0 ? written : getPlannedExamples(planned)).slice(0, MAX_EXAMPLES),
    ideas:
      summaryIdeas.length > 0
        ? summaryIdeas
        : (planned?.skills.map((skill) => skill.description) ?? []),
  };
}

export async function loadChapterLessons({
  chapterId,
  lessonId,
  ownerId,
}: {
  chapterId: string | null;
  lessonId: string;
  ownerId: string | null;
}): Promise<ChapterLesson[]> {
  if (!chapterId) {
    return [];
  }

  const placements = await prisma.chapterLesson.findMany({
    include: {
      lesson: {
        select: {
          canDo: true,
          spec: true,
          steps: {
            orderBy: { position: "asc" },
            select: { content: true, kind: true },
            where: CURRENT_STEPS,
          },
          summary: true,
          title: true,
        },
      },
    },
    orderBy: { position: "asc" },
    where: { chapterId, lesson: libraryRowsVisibleTo(ownerId) },
  });

  const ownPosition = placements.find((placement) => placement.lessonId === lessonId)?.position;

  return placements
    .filter((placement) => placement.lessonId !== lessonId)
    .map(({ lesson, position }) => ({
      canDo: lesson.canDo ?? undefined,
      order: ownPosition !== undefined && position < ownPosition ? "before" : "after",
      title: lesson.title,
      ...describeLesson(lesson),
    }));
}
