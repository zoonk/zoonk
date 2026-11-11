import "server-only";
import { type Mistake, prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { io } from "next/cache";
import { type TrueFalseLabels, getTrueFalseLabels } from "../library/exams/true-false-labels";
import { type ItemSetView } from "../library/items/item-set-view";
import { loadExamStructure } from "../sessions/_utils/exam-structure";
import { type SessionQuestion } from "../sessions/_utils/session-items";
import { getSession } from "../users/get-session";
import { resolvePracticeScope } from "./_utils/practice-scope";
import { MAX_PRACTICE_ANSWERS, type MistakePracticeInput } from "./contract";
import { findTeachingLessonIds, loadDrillLessons, toDrillView } from "./drill-lessons";
import { getPracticeTimeZone, readyMistakeWhere } from "./mistake-availability";
import {
  type DrillView,
  getDrillKind,
  getDrillTimeLimitSeconds,
  selectMistakesToPractice,
} from "./mistake-drills";
import { toMistakeQuestion } from "./mistake-item";
import { type MistakeLessonReplay, loadMistakeReplays } from "./mistake-replay";
import { type MistakeSnapshot, readMistakeSnapshot } from "./mistake-snapshot";

type MistakePracticeEntry = {
  cause: Mistake["cause"];
  drill: DrillView;
  lesson: MistakeLessonReplay | null;
  mistakeId: string;
  tutorAvailable: boolean;
  /** Stimulus sets must be displayed with their questions. */
  questions: (SessionQuestion & { set: ItemSetView | null })[];
  snapshot: MistakeSnapshot;
};

export type MistakePracticeResult =
  | {
      practice: MistakePracticeEntry[];
      status: "ready";
      /** The words true-or-false statements are answered with: the goal's exam's, when scoped. */
      trueFalseLabels: TrueFalseLabels;
    }
  | { status: "notFound" }
  | { status: "unauthorized" };

function getPracticeSkillIds({
  scopeSkillIds,
  skillId,
}: {
  scopeSkillIds: string[] | null;
  skillId: string | undefined;
}): string[] | null {
  if (!skillId) {
    return scopeSkillIds;
  }

  return !scopeSkillIds || scopeSkillIds.includes(skillId) ? [skillId] : [];
}

/** Every ready mistake a run holds, oldest first with skill breadth, one question each. Submit each answer to answerMistakePractice. */
export async function getMistakePractice(
  input: MistakePracticeInput,
): Promise<MistakePracticeResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const userId = session.user.id;
  const scope = await resolvePracticeScope({ goalId: input.goalId });

  if (!scope) {
    return { status: "notFound" };
  }

  const timeZone = await getPracticeTimeZone({
    goal: scope.goal,
    timeZone: input.timeZone,
    userId,
  });

  // Next's io boundary keeps the live practice day out of prerendering.
  await io();
  const today = getDateInTimeZone({ date: new Date(), timeZone });

  const skillIds = getPracticeSkillIds({ scopeSkillIds: scope.skillIds, skillId: input.skillId });

  const open = await prisma.mistake.findMany({
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    where: {
      ...readyMistakeWhere({ localDate: today, timeZone }),
      userId,
      ...(skillIds ? { skillId: { in: skillIds } } : {}),
    },
  });

  const replayById = await loadMistakeReplays({ mistakes: open, userId });

  const drillable = open.filter((mistake) => {
    const replay = replayById.get(mistake.id);

    return (
      replay &&
      (input.includeAllFormats ||
        (replay.kind === "item" && ["multipleChoice", "trueFalse"].includes(replay.item.format)))
    );
  });

  const selected = selectMistakesToPractice({ limit: MAX_PRACTICE_ANSWERS, mistakes: drillable });

  const replays = selected.map((mistake) => ({ mistake, replay: replayById.get(mistake.id) }));

  const lessons = await findTeachingLessonIds({
    skillIds: selected.flatMap((mistake) => mistake.skillId ?? []),
    userId,
  });

  const [drillLessons, structure] = await Promise.all([
    loadDrillLessons([...lessons.values()]),
    scope.goal ? loadExamStructure(scope.goal) : null,
  ]);

  const practice = replays.flatMap(({ mistake, replay }) => {
    if (!replay || (replay.kind === "lesson" && !input.includeAllFormats)) {
      return [];
    }

    const kind = getDrillKind(mistake.cause);

    return [
      {
        cause: mistake.cause,
        drill: toDrillView({
          drill: {
            kind,
            lessonId:
              kind === "reteach" && mistake.skillId ? (lessons.get(mistake.skillId) ?? null) : null,
            timeLimitSeconds: getDrillTimeLimitSeconds(kind),
          },
          lessons: drillLessons,
        }),
        lesson: replay.kind === "lesson" ? replay.lesson : null,
        mistakeId: mistake.id,
        questions: replay.kind === "item" ? [toMistakeQuestion(replay)] : [],
        snapshot: readMistakeSnapshot(mistake.snapshot),
        tutorAvailable: replay.tutorAvailable,
      },
    ];
  });

  return { practice, status: "ready", trueFalseLabels: getTrueFalseLabels(structure) };
}
