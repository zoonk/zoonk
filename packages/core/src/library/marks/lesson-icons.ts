import "server-only";
import { type AiGenerationContext } from "@zoonk/ai/ai-generation-event";
import { type CallWait } from "@zoonk/ai/provider-options";
import { matchLessonIcons } from "@zoonk/ai/tasks/icons/match";
import { type IconNeed } from "@zoonk/ai/tasks/icons/need";
import { prisma } from "@zoonk/db";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getLibraryLessonCacheTag } from "../../cache/tags";
import {
  type IconRow,
  claimLessonIcon,
  findIconsById,
  findIconsByName,
  searchIconCandidates,
} from "../icons/lesson-icon-library";
import { readSavedLessonMap } from "../lessons/lesson-map";
import { CURRENT_STEPS } from "../lessons/lesson-versions";
import { readSavedStepMarks } from "./step-marks";
import { type LessonIconRequest } from "./tag-lesson-marks";

/** `draw`: this run claimed it; `wait`: another run is drawing it; `ready`: drawn already. */
export type PickedIcon = { iconId: string; name: string; state: "draw" | "ready" | "wait" };

function toPicked({
  icon,
  name,
  runId,
}: {
  icon: IconRow;
  name: string;
  runId: string;
}): PickedIcon[] {
  if (icon.status === "completed") {
    return [{ iconId: icon.id, name, state: "ready" }];
  }

  if (icon.status !== "running") {
    return [];
  }

  return [{ iconId: icon.id, name, state: icon.runId === runId ? "draw" : "wait" }];
}

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

async function claimOrJoin({
  existing,
  need,
  runId,
}: {
  existing: IconRow | undefined;
  need: IconNeed;
  runId: string;
}): Promise<IconRow> {
  return existing?.status === "completed" || existing?.status === "failed"
    ? existing
    : claimLessonIcon({ need, runId });
}

/**
 * Internal workflow bridge: an icon of the same name is reused as is; otherwise a text search
 * finds candidates and one model call decides reuse or draw, and this run claims what it draws.
 */
export async function pickLessonIcons({
  analytics,
  requests,
  runId,
  wait,
}: {
  analytics?: AiGenerationContext;
  requests: readonly LessonIconRequest[];
  runId: string;
  wait?: CallWait;
}): Promise<PickedIcon[]> {
  const existing = await findIconsByName(requests.map((request) => request.need.name));

  const named = new Map(existing.map((icon) => [icon.name, icon]));

  const reused = await decideReuse({
    analytics,
    requests: requests.filter((request) => !named.has(request.need.name)),
    wait,
  });

  const picked = await Promise.all(
    requests.map(async ({ need }): Promise<PickedIcon[]> => {
      const reuse = reused.get(need.name);

      if (reuse) {
        return [{ iconId: reuse, name: need.name, state: "ready" }];
      }

      const icon = await claimOrJoin({ existing: named.get(need.name), need, runId });
      return toPicked({ icon, name: need.name, runId });
    }),
  );

  return picked.flat();
}

export async function readIconStates(iconIds: readonly string[]): Promise<IconRow[]> {
  return findIconsById(iconIds);
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
  picked: readonly Pick<PickedIcon, "iconId" | "name">[];
}): Promise<void> {
  const [lesson, icons] = await Promise.all([
    prisma.lesson.findUnique({
      select: { steps: { select: { id: true, marks: true }, where: CURRENT_STEPS }, summary: true },
      where: { id: lessonId },
    }),
    findIconsById(picked.map((icon) => icon.iconId)),
  ]);

  if (!lesson) {
    return;
  }

  const drawn = new Set(icons.filter((icon) => icon.status === "completed").map((icon) => icon.id));

  const ready = new Map(
    picked.filter((icon) => drawn.has(icon.iconId)).map((icon) => [icon.name, icon.iconId]),
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
