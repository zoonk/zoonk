import "server-only";
import { prisma } from "@zoonk/db";
import { scopeIdentityKey } from "@zoonk/utils/identity-key";
import { getLocaleFromRequest } from "@zoonk/utils/locale-request";
import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { headers } from "next/headers";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getLearnerModelCacheTag } from "../cache/tags";
import { libraryRowsVisibleTo } from "../library/_utils/library-visibility";
import { CURRENT_STEPS } from "../library/lessons/lesson-versions";
import { ensureQuickLessons } from "../library/quick-lessons/quick-lessons";
import { createSkill } from "../library/skills/create-skill";
import { getSession } from "../users/get-session";
import { visibleMistakeWhere } from "./_utils/visible-mistake";
import { type MistakeLesson, findMistakeLessons, getMistakeLessonPlace } from "./mistake-lessons";
import { readMistakeReplay } from "./mistake-replay";
import { type MistakeSnapshot, readMistakeSnapshot } from "./mistake-snapshot";

const MAX_TOPIC_LENGTH = 120;

async function quickLesson(skillId: string): Promise<MistakeLesson | null> {
  const lessons = await ensureQuickLessons({ skillIds: [skillId] });
  const lesson = lessons.get(skillId);
  return lesson ? { id: lesson.lessonId, title: lesson.title } : null;
}

function snapshotDescription(saved: MistakeSnapshot) {
  return [
    saved.context,
    saved.set?.title,
    saved.set?.text,
    saved.set?.visual?.title,
    saved.set?.listening?.task,
    saved.image?.alt,
    saved.visual?.title,
    saved.question,
    saved.correctAnswer,
    saved.explanation,
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function lessonFromSnapshot({
  mistake,
  userId,
}: {
  mistake: { id: string; snapshot: unknown; attempt: { targetLanguage: string | null } | null };
  userId: string;
}) {
  const saved = readMistakeSnapshot(mistake.snapshot);

  if (!saved.question.trim()) {
    return null;
  }

  const replay = readMistakeReplay(mistake.snapshot);
  const source = replay?.kind === "lesson" ? replay.lesson : replay?.item;
  const requestHeaders = await headers();

  const language =
    source?.language ??
    getLocaleFromRequest({ acceptLanguage: requestHeaders.get("accept-language") });

  const { skill } = await createSkill(
    {
      description: snapshotDescription(saved),
      example: null,
      identityKey: scopeIdentityKey({ key: `mistake:${mistake.id}`, ownerId: userId }),
      language,
      level: replay?.kind === "lesson" ? replay.lesson.level : null,
      name:
        saved.question.length > MAX_TOPIC_LENGTH
          ? `${saved.question.slice(0, MAX_TOPIC_LENGTH - 1).trimEnd()}…`
          : saved.question,
      ownerId: userId,
      provenance: {
        generatedAt: new Date(),
        model: "pending",
        promptVersion: "pending",
        runId: "pending",
      },
      targetLanguage:
        replay?.kind === "lesson"
          ? replay.lesson.targetLanguage
          : (mistake.attempt?.targetLanguage ?? null),
    },
    mistake.id,
  );

  return quickLesson(skill.id);
}

export async function openMistakeLesson(
  mistakeId: string,
): Promise<
  { status: "ready"; lesson: MistakeLesson } | { status: "notFound" } | { status: "unauthorized" }
> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  if (!uuidSchema().safeParse(mistakeId).success) {
    return { status: "notFound" };
  }

  const userId = session.user.id;

  const mistake = await prisma.mistake.findFirst({
    select: {
      attempt: { select: { targetLanguage: true } },
      id: true,
      item: { select: { skillId: true } },
      itemId: true,
      skillId: true,
      snapshot: true,
      step: { select: { lessonId: true } },
    },
    where: { ...visibleMistakeWhere, id: mistakeId, userId },
  });

  if (!mistake) {
    return { status: "notFound" };
  }

  const place = getMistakeLessonPlace(mistake);
  const existing = await findMistakeLessons({ places: [place], userId });

  const taught = existing.get(mistake.id);

  if (taught) {
    return { lesson: taught, status: "ready" };
  }

  const source = mistake.itemId
    ? await prisma.step.findFirst({
        orderBy: { id: "asc" },
        select: { lesson: { select: { id: true, title: true } } },
        where: {
          ...CURRENT_STEPS,
          itemId: mistake.itemId,
          lesson: { ...libraryRowsVisibleTo(userId), setAsideAt: null },
        },
      })
    : null;

  if (source) {
    return { lesson: source.lesson, status: "ready" };
  }

  const skill = place.skillId
    ? await prisma.skill.findFirst({
        select: { id: true },
        where: { ...libraryRowsVisibleTo(userId), id: place.skillId },
      })
    : null;

  const lesson =
    (skill && (await quickLesson(skill.id))) ?? (await lessonFromSnapshot({ mistake, userId }));

  if (!lesson) {
    return { status: "notFound" };
  }

  revalidateCacheTags([getLearnerModelCacheTag(userId)]);
  return { lesson, status: "ready" };
}
