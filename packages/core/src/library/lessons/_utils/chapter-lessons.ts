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

/** Enough of a lesson's examples to steer clear of them without crowding the prompt. */
const MAX_EXAMPLES = 6;

/** Where a written screen sets up its case or asks its question. */
const EXAMPLE_FIELDS: Partial<Record<StepKind, readonly string[]>> = {
  check: ["context", "question"],
  hook: ["question", "text"],
  typedAnswer: ["context", "question"],
  workedExample: ["problem"],
};

/** The planned screens whose briefs carry the lesson's cases, numbers and questions. */
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

/**
 * What a sibling lesson teaches and uses, from the best of what exists: a written lesson's
 * summary card and screens, a planned lesson's skills and briefs, or nothing for a lesson that is
 * only outlined.
 */
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

/**
 * The other lessons of a lesson's home chapter in teaching order, each marked as coming before or
 * after it, with what it teaches and the examples it uses so far. It reads whatever exists now and
 * never waits: a sibling planned in parallel shows up with its title and can-do line only. Only
 * lessons the lesson's own audience can see count, so a learner's private lesson never shapes a
 * shared one.
 */
export async function loadChapterLessons({
  chapterId,
  lessonId,
  ownerId,
}: {
  chapterId: string | null;
  lessonId: string;
  /** The lesson's owner, for a private lesson; null for a shared one. */
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
