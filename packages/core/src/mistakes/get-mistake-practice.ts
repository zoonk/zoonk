import "server-only";
import { type Mistake, prisma } from "@zoonk/db";
import { getString } from "@zoonk/utils/json";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { isUuid } from "@zoonk/utils/uuid";
import { io } from "next/cache";
import { type TrueFalseLabels, getTrueFalseLabels } from "../library/exams/true-false-labels";
import { type ItemSetView } from "../library/items/item-set-view";
import { loadExamStructure } from "../sessions/_utils/exam-structure";
import { type SessionQuestion } from "../sessions/_utils/session-items";
import { getSession } from "../users/get-session";
import { narrowToSkill } from "./_utils/mistake-scope";
import { findPracticeBlock, loadPendingBlockMistakes } from "./_utils/practice-block";
import { resolvePracticeScope } from "./_utils/practice-scope";
import { openVisibleMistakeWhere } from "./_utils/visible-mistake";
import { MAX_PRACTICE_ANSWERS, type MistakePracticeInput } from "./contract";
import { findTeachingLessonIds, loadDrillLessons, toDrillView } from "./drill-lessons";
import { getPracticeTimeZone, listReadyMistakes } from "./mistake-availability";
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

export async function getMistakePractice(
  input: MistakePracticeInput,
): Promise<MistakePracticeResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const userId = session.user.id;
  const scope = await resolveRunScope(input, userId);

  if (!scope) {
    return { status: "notFound" };
  }

  const selected = await loadRunMistakes({ input, scope, userId });

  const lessons = await findTeachingLessonIds({
    skillIds: selected.flatMap(({ mistake }) => mistake.skillId ?? []),
    userId,
  });

  const [drillLessons, structure] = await Promise.all([
    loadDrillLessons([...lessons.values()]),
    scope.goal ? loadExamStructure(scope.goal) : null,
  ]);

  const practice = selected.map(({ mistake, replay }) => {
    const kind = getDrillKind(mistake.cause);

    return {
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
    };
  });

  return { practice, status: "ready", trueFalseLabels: getTrueFalseLabels(structure) };
}

async function resolveRunScope(input: MistakePracticeInput, userId: string) {
  const { blockId, goalId, mockId, skillId } = input;

  if ((blockId && mockId) || ((blockId || mockId) && skillId)) {
    return null;
  }

  if (blockId) {
    const block = await findPracticeBlock({ blockId, userId });
    const goal = block?.session.goal ?? null;

    return block && (!goalId || goal?.id === goalId)
      ? { block, goal, mockId: undefined, skillIds: null }
      : null;
  }

  if (mockId) {
    return resolveMockScope({ goalId, mockId, userId });
  }

  const scope = await resolvePracticeScope({ goalId });
  return scope && { ...scope, block: null, mockId: undefined };
}

async function resolveMockScope({
  goalId,
  mockId,
  userId,
}: {
  goalId?: string;
  mockId: string;
  userId: string;
}) {
  if (!isUuid(mockId)) {
    return null;
  }

  const mock = await prisma.mockExam.findFirst({
    include: { goal: true },
    where: { id: mockId, status: "finished", userId },
  });

  return mock && (!goalId || mock.goalId === goalId)
    ? { block: null, goal: mock.goal, mockId, skillIds: null }
    : null;
}

async function loadRunMistakes({
  input,
  scope,
  userId,
}: {
  input: MistakePracticeInput;
  scope: NonNullable<Awaited<ReturnType<typeof resolveRunScope>>>;
  userId: string;
}) {
  const { block, mockId } = scope;
  const { skillId } = input;

  const timeZone = await getPracticeTimeZone({
    goal: scope.goal,
    timeZone: input.timeZone,
    userId,
  });

  await io();

  const localDate = getDateInTimeZone({ date: new Date(), timeZone });
  const skillIds = narrowToSkill({ scopeSkillIds: scope.skillIds, skillId });
  const includeAllFormats = Boolean(block || mockId || input.includeAllFormats);

  const { mistakes: open, replays: replayById } = block
    ? await loadPendingBlockMistakes({
        mistakeIds: ["completed", "skipped"].includes(block.block.status) ? [] : block.mistakeIds,
        timeZone,
        userId,
      })
    : await loadOpenMistakes({ mockId, skillIds, userId });

  const drillable = open.filter((mistake) => {
    const replay = replayById.get(mistake.id);

    return (
      replay &&
      (includeAllFormats ||
        (replay.kind === "item" && ["multipleChoice", "trueFalse"].includes(replay.item.format)))
    );
  });

  const selected = block
    ? drillable
    : orderPractice({ localDate, mistakes: drillable, mockId, timeZone });

  return selected.flatMap((mistake) => {
    const replay = replayById.get(mistake.id);
    return replay ? [{ mistake, replay }] : [];
  });
}

function orderPractice({
  localDate,
  mistakes,
  mockId,
  timeZone,
}: {
  localDate: Date;
  mistakes: Mistake[];
  mockId?: string;
  timeZone: string;
}) {
  const earlier = listReadyMistakes({ localDate, mistakes, timeZone });
  const earlierIds = new Set(earlier.map((mistake) => mistake.id));
  const today = mistakes.filter((mistake) => !earlierIds.has(mistake.id));

  if (mockId) {
    return [...earlier, ...today];
  }

  const first = selectMistakesToPractice({ limit: MAX_PRACTICE_ANSWERS, mistakes: earlier });

  return [
    ...first,
    ...selectMistakesToPractice({ limit: MAX_PRACTICE_ANSWERS - first.length, mistakes: today }),
  ];
}

async function loadOpenMistakes({
  mockId,
  skillIds,
  userId,
}: {
  mockId?: string;
  skillIds: string[] | null;
  userId: string;
}) {
  const mockAttempts = mockId
    ? await prisma.attempt.findMany({
        select: { answer: true },
        where: { isCorrect: false, mockExamId: mockId, userId },
      })
    : [];

  const reusedMistakes = mockAttempts.flatMap(
    ({ answer }) => getString(answer, "mockMistakeId") ?? [],
  );

  const mistakes = await prisma.mistake.findMany({
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    where: {
      ...openVisibleMistakeWhere,
      ...(mockId && {
        AND: [{ OR: [{ attempt: { mockExamId: mockId } }, { id: { in: reusedMistakes } }] }],
      }),
      ...(skillIds && { skillId: { in: skillIds } }),
      userId,
    },
  });

  return { mistakes, replays: await loadMistakeReplays({ mistakes, userId }) };
}
