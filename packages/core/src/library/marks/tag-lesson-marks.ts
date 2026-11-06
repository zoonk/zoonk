import "server-only";
import { type AiGenerationContext } from "@zoonk/ai/ai-generation-event";
import { type CallWait } from "@zoonk/ai/provider-options";
import { type IconNeed } from "@zoonk/ai/tasks/icons/need";
import { tagLesson } from "@zoonk/ai/tasks/lesson-marks";
import { type MarksScreen, type ScreenMarks } from "@zoonk/ai/tasks/lesson-marks/schema";
import { DbNull, type StepKind, prisma } from "@zoonk/db";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getLibraryLessonCacheTag } from "../../cache/tags";
import { PICTURE_WAIT_MS } from "../../lesson-player/picture-wait";
import {
  type SavedLessonMap,
  type SavedLessonMapIdea,
  readSavedLessonMap,
} from "../lessons/lesson-map";
import { CURRENT_STEPS } from "../lessons/lesson-versions";
import { safeParseStepContent } from "../steps/contract/step-contract";
import {
  type MarkedScreen,
  type SavedStepMarks,
  canShowIcon,
  getMarkedText,
  isTaggedScreen,
  readSavedStepMarks,
} from "./step-marks";

export type LessonIconRequest = { forIdea: boolean; need: IconNeed; usedFor: string };

/** `contentScope` is the lesson's, so its icon calls keep a private lesson's data protections. */
export type TaggedLesson = { contentScope: "personal" | "shared"; requests: LessonIconRequest[] };

type TaggedStep = { id: string; marks: SavedStepMarks | null; screen: MarksScreen };

function findLessonToTag(lessonId: string) {
  return prisma.lesson.findUnique({
    select: {
      id: true,
      language: true,
      ownerId: true,
      steps: {
        orderBy: { position: "asc" },
        select: { content: true, id: true, kind: true, marks: true },
        where: CURRENT_STEPS,
      },
      summary: true,
      targetLanguage: true,
      title: true,
    },
    where: { id: lessonId },
  });
}

type LessonToTag = NonNullable<Awaited<ReturnType<typeof findLessonToTag>>>;

function parseScreen({ content, kind }: { content: unknown; kind: StepKind }): MarkedScreen | null {
  if (kind === "explanation") {
    const parsed = safeParseStepContent(kind, content);
    return parsed.success ? { content: parsed.data, kind } : null;
  }

  if (kind === "workedExample") {
    const parsed = safeParseStepContent(kind, content);
    return parsed.success ? { content: parsed.data, kind } : null;
  }

  if (kind === "hook") {
    const parsed = safeParseStepContent(kind, content);
    return parsed.success ? { content: parsed.data, kind } : null;
  }

  if (kind === "check") {
    const parsed = safeParseStepContent(kind, content);
    return parsed.success ? { content: parsed.data, kind } : null;
  }

  if (kind === "typedAnswer") {
    const parsed = safeParseStepContent(kind, content);
    return parsed.success ? { content: parsed.data, kind } : null;
  }

  return null;
}

function questionText(screen: MarkedScreen): string {
  if (screen.kind === "check" || screen.kind === "typedAnswer") {
    return [screen.content.context, screen.content.question].filter(Boolean).join("\n");
  }

  return screen.kind === "hook" && screen.content.variant === "guess"
    ? screen.content.question
    : "";
}

function toMarksScreen(screen: MarkedScreen): MarksScreen {
  if (screen.kind === "explanation" || screen.kind === "workedExample") {
    return {
      hasVisual: !canShowIcon(screen),
      kind: screen.kind,
      text: getMarkedText(screen) ?? "",
      title: screen.content.title ?? null,
    };
  }

  return {
    hasVisual: true,
    kind: screen.kind === "hook" ? "guess" : "question",
    text: questionText(screen),
    title: null,
  };
}

function toTaggedSteps(lesson: LessonToTag): TaggedStep[] {
  return lesson.steps.flatMap((step) => {
    const screen = parseScreen(step);

    return screen && isTaggedScreen(screen)
      ? [{ id: step.id, marks: readSavedStepMarks(step.marks), screen: toMarksScreen(screen) }]
      : [];
  });
}

const MAX_USE_LENGTH = 240;

function describeScreen(screen: MarksScreen): string {
  return [screen.title, screen.text].filter(Boolean).join(": ").slice(0, MAX_USE_LENGTH);
}

function collectRequests({
  ideas,
  steps,
}: {
  ideas: readonly SavedLessonMapIdea[];
  steps: readonly TaggedStep[];
}): LessonIconRequest[] {
  const uses: LessonIconRequest[] = [
    ...steps.flatMap(({ marks, screen }) =>
      marks?.iconPending && marks.iconNeed
        ? [{ forIdea: false, need: marks.iconNeed, usedFor: `a screen: ${describeScreen(screen)}` }]
        : [],
    ),
    ...ideas.flatMap((idea) =>
      idea.iconPending && idea.iconNeed
        ? [{ forIdea: true, need: idea.iconNeed, usedFor: `the lesson map's idea: ${idea.text}` }]
        : [],
    ),
  ];

  const byName = new Map<string, LessonIconRequest>();

  for (const use of uses) {
    const known = byName.get(use.need.name);

    byName.set(
      use.need.name,
      known
        ? {
            ...known,
            forIdea: known.forIdea || use.forIdea,
            usedFor: `${known.usedFor}; ${use.usedFor}`,
          }
        : use,
    );
  }

  return [...byName.values()];
}

function toSavedMarks(marks: ScreenMarks): SavedStepMarks {
  return {
    example: marks.example,
    iconId: null,
    iconNeed: marks.icon,
    iconPending: marks.icon !== null,
    ideaIndex: marks.ideaIndex,
    underline: marks.underline,
  };
}

/** Writes only over untagged screens and the same map, so a lesson rewritten meanwhile keeps its own. */
async function saveMarks({
  lesson,
  map,
  steps,
}: {
  lesson: LessonToTag;
  map: SavedLessonMap | null;
  steps: readonly TaggedStep[];
}) {
  const mapUpdate =
    map && lesson.summary !== null
      ? [
          prisma.lesson.updateMany({
            data: { summary: map },
            where: { id: lesson.id, summary: { equals: lesson.summary } },
          }),
        ]
      : [];

  await prisma.$transaction([
    ...steps.map((step) =>
      prisma.step.updateMany({
        data: { marks: step.marks ?? DbNull },
        where: { id: step.id, marks: { equals: DbNull } },
      }),
    ),
    ...mapUpdate,
  ]);

  revalidateCacheTags([getLibraryLessonCacheTag(lesson.id)]);
}

function withIdeaMarks({
  ideas,
  map,
}: {
  ideas: readonly { about: string | null; icon: IconNeed | null }[];
  map: SavedLessonMap | null;
}): SavedLessonMap | null {
  return (
    map && {
      ...map,
      ideas: map.ideas.map((idea, index) => {
        const { about, icon } = ideas[index] ?? { about: null, icon: null };

        return {
          ...idea,
          ...(about ? { about } : {}),
          ...(icon ? { iconNeed: icon, iconPending: true } : {}),
        };
      }),
    }
  );
}

/**
 * Internal workflow bridge: tags a written lesson's screens and map once, then returns the icons
 * it still waits for. A lesson already tagged returns those without a model call.
 */
export async function tagLessonMarks({
  analytics,
  lessonId,
  wait,
}: {
  analytics?: AiGenerationContext;
  lessonId: string;
  wait?: CallWait;
}): Promise<TaggedLesson | null> {
  const lesson = await findLessonToTag(lessonId);

  if (!lesson || lesson.targetLanguage) {
    return null;
  }

  const contentScope = lesson.ownerId ? "personal" : "shared";
  const steps = toTaggedSteps(lesson);
  const map = readSavedLessonMap(lesson.summary);

  if (steps.every((step) => step.marks)) {
    return { contentScope, requests: collectRequests({ ideas: map?.ideas ?? [], steps }) };
  }

  const { data } = await tagLesson({
    analytics: { ...analytics, contentScope },
    ideas: (map?.ideas ?? []).map((idea) => ({ label: idea.label ?? null, text: idea.text })),
    language: lesson.language,
    lessonTitle: lesson.title,
    screens: steps.map((step) => step.screen),
    wait,
  });

  const tagged = steps.map((step, index) => {
    const marks = data.screens[index];
    return { ...step, marks: marks ? toSavedMarks(marks) : null };
  });

  const markedMap = withIdeaMarks({ ideas: data.ideas, map });

  await saveMarks({ lesson, map: markedMap, steps: tagged });

  return {
    contentScope,
    requests: collectRequests({ ideas: markedMap?.ideas ?? [], steps: tagged }),
  };
}

/**
 * Internal workflow bridge. An icon still drawing after the picture wait counts as stuck, so a
 * drawing that never finished doesn't hold every lesson that links it.
 */
export async function readLessonMarking(
  lessonId: string,
): Promise<{ drawingIcons: boolean; tagged: boolean }> {
  const lesson = await findLessonToTag(lessonId);

  if (!lesson) {
    return { drawingIcons: false, tagged: true };
  }

  const steps = toTaggedSteps(lesson);
  const ideas = readSavedLessonMap(lesson.summary)?.ideas ?? [];

  const iconIds = [
    ...steps.flatMap(({ marks }) => (marks?.iconId ? [marks.iconId] : [])),
    ...ideas.flatMap(({ iconId }) => (iconId ? [iconId] : [])),
  ];

  const drawing =
    iconIds.length === 0
      ? 0
      : await prisma.lessonIcon.count({
          where: {
            createdAt: { gt: new Date(Date.now() - PICTURE_WAIT_MS) },
            id: { in: iconIds },
            status: "running",
          },
        });

  return { drawingIcons: drawing > 0, tagged: steps.every((step) => step.marks) };
}
