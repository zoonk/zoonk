import "server-only";
import { type AiGenerationContext } from "@zoonk/ai/ai-generation-event";
import { type CallWait } from "@zoonk/ai/provider-options";
import { matchLessonIcons } from "@zoonk/ai/tasks/icons/match";
import { type IconNeed } from "@zoonk/ai/tasks/icons/need";
import { prisma } from "@zoonk/db";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getLibraryLessonCacheTag } from "../../cache/tags";
import { findIconsById, findIconsByName, searchIconCandidates } from "../icons/lesson-icon-library";
import { readSavedLessonMap } from "../lessons/lesson-map";
import { CURRENT_STEPS } from "../lessons/lesson-versions";
import { readSavedStepMarks } from "./step-marks";
import { type LessonIconRequest } from "./tag-lesson-marks";

/** `iconId` is the library icon to reuse, or null for one to draw. */
export type PickedIcon = { iconId: string | null; name: string; need: IconNeed };

async function decideReuse({
  analytics,
  requests,
  wait,
}: {
  analytics?: AiGenerationContext;
  requests: readonly LessonIconRequest[];
  wait?: CallWait;
}): Promise<Map<string, string>> {
  const searched = await Promise.all(
    requests.map(async (request) => ({
      ...request,
      candidates: await searchIconCandidates(request.need),
    })),
  );

  const needs = searched.filter((request) => request.candidates.length > 0);

  if (needs.length === 0) {
    return new Map();
  }

  const { data } = await matchLessonIcons({ analytics, needs, wait });

  return new Map(
    needs.flatMap((request, index) => {
      const reuse = data[index];
      return reuse ? [[request.need.name, reuse]] : [];
    }),
  );
}

/**
 * Internal workflow bridge: a drawn icon of the same name is reused as is, and a name that failed
 * before is skipped; otherwise a text search finds candidates and one model call decides reuse or
 * draw.
 */
export async function pickLessonIcons({
  analytics,
  requests,
  wait,
}: {
  analytics?: AiGenerationContext;
  requests: readonly LessonIconRequest[];
  wait?: CallWait;
}): Promise<PickedIcon[]> {
  const existing = await findIconsByName(requests.map((request) => request.need.name));
  const named = new Map(existing.map((icon) => [icon.name, icon]));

  const reused = await decideReuse({
    analytics,
    requests: requests.filter((request) => !named.has(request.need.name)),
    wait,
  });

  return requests.flatMap(({ need }) => {
    const icon = named.get(need.name);

    if (icon) {
      return icon.status === "completed" ? [{ iconId: icon.id, name: need.name, need }] : [];
    }

    return [{ iconId: reused.get(need.name) ?? null, name: need.name, need }];
  });
}

function linkIcon<
  T extends { iconId?: string | null; iconNeed?: IconNeed | null; iconPending?: boolean },
>({ ready, saved }: { ready: ReadonlyMap<string, string>; saved: T }): T {
  const iconId = (saved.iconNeed && ready.get(saved.iconNeed.name)) || null;
  return { ...saved, iconId, iconPending: false };
}

/**
 * Internal workflow bridge: links each drawn icon to the screens and ideas that asked for it and
 * stops waiting for the rest, so the lesson's next read shows them and stops asking again.
 */
export async function linkLessonIcons({
  lessonId,
  picked,
}: {
  lessonId: string;
  picked: readonly { iconId: string | null; name: string }[];
}): Promise<void> {
  const [lesson, icons] = await Promise.all([
    prisma.lesson.findUnique({
      select: { steps: { select: { id: true, marks: true }, where: CURRENT_STEPS }, summary: true },
      where: { id: lessonId },
    }),
    findIconsById(picked.flatMap((icon) => (icon.iconId ? [icon.iconId] : []))),
  ]);

  if (!lesson) {
    return;
  }

  const drawn = new Set(icons.filter((icon) => icon.status === "completed").map((icon) => icon.id));

  const ready = new Map(
    picked.flatMap(({ iconId, name }) => (iconId && drawn.has(iconId) ? [[name, iconId]] : [])),
  );

  const stepUpdates = lesson.steps.flatMap((step) => {
    const saved = readSavedStepMarks(step.marks);

    return saved?.iconPending
      ? [
          prisma.step.updateMany({
            data: { marks: linkIcon({ ready, saved }) },
            where: { id: step.id, marks: { equals: saved } },
          }),
        ]
      : [];
  });

  const map = readSavedLessonMap(lesson.summary);

  const mapUpdate =
    map?.ideas.some((idea) => idea.iconPending) && lesson.summary !== null
      ? [
          prisma.lesson.updateMany({
            data: {
              summary: {
                ...map,
                ideas: map.ideas.map((idea) =>
                  idea.iconPending ? linkIcon({ ready, saved: idea }) : idea,
                ),
              },
            },
            where: { id: lessonId, summary: { equals: lesson.summary } },
          }),
        ]
      : [];

  await prisma.$transaction([...stepUpdates, ...mapUpdate]);
  revalidateCacheTags([getLibraryLessonCacheTag(lessonId)]);
}
