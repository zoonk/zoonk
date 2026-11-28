import "server-only";
import { type Mistake } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { io } from "next/cache";
import { showStepOptions } from "../lesson-player/_utils/shown-step-options";
import { type TrueFalseLabels, getTrueFalseLabels } from "../library/exams/true-false-labels";
import { type ItemSetView } from "../library/items/item-set-view";
import { loadExamStructure } from "../sessions/_utils/exam-structure";
import { type SessionQuestion } from "../sessions/_utils/session-items";
import { getUnservedMistakeIds, readBlockPayload } from "../sessions/block-payload";
import { getSession } from "../users/get-session";
import { narrowToSkill } from "./_utils/mistake-scope";
import { findPracticeMock } from "./_utils/mock-practice";
import { findPracticeBlock, loadPendingBlockMistakes } from "./_utils/practice-block";
import { loadPracticeEntries } from "./_utils/practice-entries";
import { resolvePracticeScope } from "./_utils/practice-scope";
import { MAX_PRACTICE_ANSWERS, type MistakePracticeInput } from "./contract";
import { findTeachingLessonIds, loadDrillLessons, toDrillView } from "./drill-lessons";
import { getPracticeTimeZone, listReadyMistakes } from "./mistake-availability";
import {
  type DrillView,
  getDrillKind,
  getDrillTimeLimitSeconds,
  selectMistakesToPractice,
} from "./mistake-drills";
import { getMistakeShowing, toMistakeQuestion } from "./mistake-item";
import { type MistakeLessonReplay } from "./mistake-replay";
import { type MistakeSnapshot, readMistakeSnapshot } from "./mistake-snapshot";

type MistakePracticeEntry = {
  cause: Mistake["cause"];
  drill: DrillView;
  lesson: MistakeLessonReplay | null;
  mistakeId: string;
  /** The order this entry laid out its options in; an item answer sends it back. */
  showing: string;
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
    skillIds: selected.flatMap(({ skillId }) => skillId ?? []),
    userId,
  });

  const [drillLessons, structure] = await Promise.all([
    loadDrillLessons([...lessons.values()]),
    scope.goal ? loadExamStructure(scope.goal) : null,
  ]);

  const practice = selected.map(({ replay, ...mistake }) => {
    const kind = getDrillKind(mistake.cause);
    const showing = getMistakeShowing(mistake);

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
      lesson:
        replay.kind === "lesson"
          ? { ...replay.lesson, step: showStepOptions({ seed: showing, step: replay.lesson.step }) }
          : null,
      mistakeId: mistake.id,
      questions: replay.kind === "item" ? [toMistakeQuestion({ replay, showing })] : [],
      showing,
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
    const mock = await findPracticeMock({ mockId, userId });
    return mock && { block: null, goal: mock.goal, mockId, skillIds: null };
  }

  const scope = await resolvePracticeScope({ goalId });
  return scope && { ...scope, block: null, mockId: undefined };
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

  const now = new Date();
  const skillIds = narrowToSkill({ scopeSkillIds: scope.skillIds, skillId });

  if (block) {
    const { mistakes, replays } = await loadPendingBlockMistakes({
      mistakeIds: ["completed", "skipped"].includes(block.block.status)
        ? []
        : getUnservedMistakeIds(readBlockPayload(block.block)),
      now,
      timeZone,
      userId,
    });

    return mistakes.flatMap((mistake) => {
      const replay = replays.get(mistake.id);
      return replay ? [{ ...mistake, replay }] : [];
    });
  }

  const entries = await loadPracticeEntries({
    includeAllFormats: input.includeAllFormats,
    mockId,
    skillIds,
    userId,
  });

  return orderPractice({
    localDate: getDateInTimeZone({ date: now, timeZone }),
    mistakes: entries,
    mockId,
    timeZone,
  });
}

function orderPractice<TEntry extends Mistake>({
  localDate,
  mistakes,
  mockId,
  timeZone,
}: {
  localDate: Date;
  mistakes: TEntry[];
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
