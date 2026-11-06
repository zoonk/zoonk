import "server-only";
import { type AiGenerationContext } from "@zoonk/ai/ai-generation-event";
import { type CallWait } from "@zoonk/ai/provider-options";
import { matchLessonIcons } from "@zoonk/ai/tasks/icons/match";
import { type IconNeed } from "@zoonk/ai/tasks/icons/need";
import { prisma } from "@zoonk/db";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getLibraryLessonCacheTag } from "../../cache/tags";
import { type IconRow, findIconsByName, searchIconCandidates } from "../icons/lesson-icon-library";
import { readSavedLessonMap } from "../lessons/lesson-map";
import { toPreparedVersion } from "../lessons/lesson-versions";
import { readSavedStepMarks } from "./step-marks";
import { type LessonIconRequest, savePreparedMap } from "./tag-lesson-marks";

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
 * The map shows the ideas side by side to tell them apart, so a library icon goes to one idea: an
 * idea that has it by name keeps it, and a later idea the reuse check sends to it draws its own.
 */
function keepIdeasApart({
  named,
  requests,
  reused,
}: {
  named: ReadonlyMap<string, IconRow>;
  requests: readonly LessonIconRequest[];
  reused: ReadonlyMap<string, string>;
}): Map<string, string> {
  const ideas = requests.filter((request) => request.forIdea);
  const namedIds = new Set(ideas.flatMap(({ need }) => named.get(need.name)?.id ?? []));
  const ideaReuse = ideas.map(({ need }) => reused.get(need.name));

  const taken = new Set(
    ideas.flatMap(({ need }, index) => {
      const reuse = ideaReuse[index];
      const isTaken = reuse && (namedIds.has(reuse) || ideaReuse.slice(0, index).includes(reuse));
      return isTaken ? [need.name] : [];
    }),
  );

  return new Map([...reused].filter(([name]) => !taken.has(name)));
}

/**
 * Internal workflow bridge: an icon of the same name is reused as is, even one another lesson is
 * still drawing, and a name that failed before is skipped; otherwise a text search finds candidates
 * and one model call decides reuse or draw.
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

  const reused = keepIdeasApart({
    named,
    requests,
    reused: await decideReuse({
      analytics,
      requests: requests.filter((request) => !named.has(request.need.name)),
      wait,
    }),
  });

  return requests.flatMap(({ need }) => {
    const icon = named.get(need.name);

    if (icon) {
      return icon.status === "failed" ? [] : [{ iconId: icon.id, name: need.name, need }];
    }

    return [{ iconId: reused.get(need.name) ?? null, name: need.name, need }];
  });
}

function linkIcon<
  T extends { iconId?: string | null; iconNeed?: IconNeed | null; iconPending?: boolean },
>({ linked, saved }: { linked: ReadonlyMap<string, string>; saved: T }): T {
  const iconId = (saved.iconNeed && linked.get(saved.iconNeed.name)) || null;
  return { ...saved, iconId, iconPending: false };
}

/**
 * Internal workflow bridge: links each icon, drawn or still drawing, to the screens and ideas that
 * asked for it and stops waiting for the rest; reads show an icon once its row is completed.
 */
export async function linkLessonIcons({
  lessonId,
  picked,
}: {
  lessonId: string;
  picked: readonly { iconId: string | null; name: string }[];
}): Promise<void> {
  const found = await prisma.lesson.findUnique({
    select: {
      stagedSummary: true,
      steps: { select: { id: true, marks: true, staged: true }, where: { retiredAt: null } },
      summary: true,
    },
    where: { id: lessonId },
  });

  if (!found) {
    return;
  }

  const lesson = toPreparedVersion(found);

  const linked = new Map(picked.flatMap(({ iconId, name }) => (iconId ? [[name, iconId]] : [])));

  const stepUpdates = lesson.steps.flatMap((step) => {
    const saved = readSavedStepMarks(step.marks);

    return saved?.iconPending
      ? [
          prisma.step.updateMany({
            data: { marks: linkIcon({ linked, saved }) },
            where: { id: step.id, marks: { equals: saved } },
          }),
        ]
      : [];
  });

  const map = readSavedLessonMap(lesson.summary);

  const mapUpdate =
    map?.ideas.some((idea) => idea.iconPending) && lesson.summary !== null
      ? savePreparedMap({
          lessonId,
          map: {
            ...map,
            ideas: map.ideas.map((idea) =>
              idea.iconPending ? linkIcon({ linked, saved: idea }) : idea,
            ),
          },
          read: lesson.summary,
          staged: lesson.staged,
        })
      : [];

  await prisma.$transaction([...stepUpdates, ...mapUpdate]);
  revalidateCacheTags([getLibraryLessonCacheTag(lessonId)]);
}
