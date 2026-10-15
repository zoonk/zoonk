import { PlanItemKind, prisma } from "@zoonk/db";
import { toUTCMidnight } from "@zoonk/utils/date";
import { type JsonObject, isJsonObject, mapJsonStrings } from "@zoonk/utils/json";
import snapshot from "./_data/funded-mock-relocation.json" with { type: "json" };
import { goalFixture, planFixture } from "./goals";
import { learningEventFixture } from "./learning-events";
import { learningProfileFixture } from "./learning-profiles";
import { libraryChapterFixture } from "./library-chapters";
import { chapterLessonFixture, lessonSkillFixture, libraryLessonFixture } from "./library-lessons";
import { choiceItemContent, itemFixture, skillFixture } from "./skills";
import { examBlueprintFixture } from "./sources";
import { studySessionBlockFixture, studySessionFixture } from "./study-sessions";

type Replay = { day: Date; ids: Map<string, string> };

function shiftedDate({ day }: Replay, value: string): Date {
  return new Date(new Date(value).getTime() + day.getTime() - new Date(snapshot.anchor).getTime());
}

/** Rebinds only the captured dates and real fixture IDs, including logical lesson keys. */
function json(value: unknown, replay: Replay): object {
  const projected = mapJsonStrings(value, (text) => {
    if (/^\d{4}-\d{2}-\d{2}(?:T|$)/u.test(text)) {
      const shifted = shiftedDate(replay, text).toISOString();
      return text.includes("T") ? shifted : shifted.slice(0, snapshot.anchor.length);
    }

    return text.replaceAll(/__[A-Z_0-9]+__/gu, (key) => {
      const id = replay.ids.get(key);

      if (!id) {
        throw new Error(`Missing captured fixture identity ${key}`);
      }

      return id;
    });
  });

  if (!projected || typeof projected !== "object") {
    throw new Error("Expected captured allocation facts");
  }

  return projected;
}

function jsonObject(value: unknown, replay: Replay): JsonObject {
  const projected = json(value, replay);

  if (!isJsonObject(projected)) {
    throw new Error("Expected captured plan settings");
  }

  return projected;
}

async function createLibrary() {
  const [chapter, skill] = await Promise.all([
    libraryChapterFixture({ title: "Basics" }),
    skillFixture({ name: "Planned skill 1" }),
  ]);

  const lessons = await Promise.all(
    Array.from({ length: snapshot.libraryLessons }, async (_, index) => {
      const lesson = await libraryLessonFixture({
        contentStatus: "completed",
        estimatedMinutes: snapshot.lessonMinutes,
        homeChapterId: chapter.id,
        specStatus: "completed",
        title: `Lesson 1.${index + 1} ${skill.id}`,
      });

      await Promise.all([
        chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id, position: index }),
        lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id }),
      ]);

      return lesson;
    }),
  );

  return { chapter, lessons, skill };
}

/**
 * DB-only replay of the actual pre-Open state reached by funded-mock-session-budget's public
 * missed-boss case. The captured allocation, 14 bank credits and real completion ledger are
 * unchanged; IDs and calendar labels belong to this learner. No auth, Vitest or core imports.
 */
export async function fundedMockRelocationDayFixture({
  localDate,
  userId,
}: {
  localDate: Date;
  userId: string;
}) {
  const library = await createLibrary();

  const ids = new Map([
    ["__CHAPTER__", library.chapter.id],
    ["__SKILL__", library.skill.id],
    ...library.lessons.map((lesson, index): [string, string] => [`__LESSON_${index}__`, lesson.id]),
  ]);

  const replay = { day: toUTCMidnight(localDate), ids };

  const blueprint = await examBlueprintFixture({
    structure: {
      formats: [],
      mock: {
        citations: [],
        order: null,
        scoring: { description: "One point per correct answer", method: "raw" },
        sections: [
          {
            day: 1,
            minutes: snapshot.mockMinutes * 2,
            name: "Math",
            questions: snapshot.bankQuestions * 2,
          },
        ],
        timeLimitMinutes: snapshot.mockMinutes * 2,
        totalQuestions: snapshot.bankQuestions * 2,
      },
      rules: [],
      subjects: [],
    },
  });

  const goal = await goalFixture({
    createdAt: shiftedDate(replay, snapshot.startDate),
    dailyMinutes: 30,
    details: { placementDeclined: true },
    examBlueprintId: blueprint.id,
    kind: "exam",
    targetDate: shiftedDate(replay, snapshot.targetDate),
    timezone: "UTC",
    userId,
  });

  const startWeekday = goal.createdAt.getUTCDay();
  const studiedWeekdays = snapshot.settings.weekdayMinutes.filter((minutes) => minutes > 0).length;

  const plan = await planFixture({
    goalId: goal.id,
    graph: json(snapshot.graph, replay),
    phases: json(snapshot.phases, replay),
    settings: {
      ...jsonObject(snapshot.settings, replay),
      weekdayMinutes: Array.from(
        { length: snapshot.settings.weekdayMinutes.length },
        (_, weekday) =>
          (weekday - startWeekday + snapshot.settings.weekdayMinutes.length) %
            snapshot.settings.weekdayMinutes.length <
          studiedWeekdays
            ? 30
            : 0,
      ),
    },
    version: snapshot.session.planVersion,
  });

  const rows = await Promise.all(
    snapshot.rows.map(async (row) => {
      const lesson = row.lessonIndex === null ? null : library.lessons[row.lessonIndex];
      const kind = Object.values(PlanItemKind).find((candidate) => candidate === row.kind);

      if (!kind || (row.lessonIndex !== null && !lesson)) {
        throw new Error("Expected the captured allocation item");
      }

      const item = await prisma.planItem.create({
        data: {
          chapterId: lesson ? library.chapter.id : null,
          completedAt: row.completedAt ? shiftedDate(replay, row.completedAt) : null,
          facts: jsonObject(row.facts, replay),
          kind,
          lessonId: lesson?.id ?? null,
          minutes: row.minutes,
          phase: row.phase,
          planId: plan.id,
          position: row.position,
          scheduledFor: shiftedDate(replay, row.scheduledFor),
          skillId: lesson ? library.skill.id : null,
          status: row.status === "done" ? "done" : "todo",
          titleSnapshot: lesson?.title ?? "",
        },
      });

      ids.set(`__ITEM_${row.position}__`, item.id);
      return item;
    }),
  );

  const questions = await Promise.all(
    Array.from({ length: snapshot.bankQuestions }, () =>
      itemFixture({ content: choiceItemContent(), skillId: library.skill.id }),
    ),
  );

  questions.forEach((question, index) => ids.set(`__QUESTION_${index}__`, question.id));

  const session = await studySessionFixture({
    createdAt: shiftedDate(replay, snapshot.session.createdAt),
    goalId: goal.id,
    localDate: shiftedDate(replay, snapshot.session.localDate),
    planVersion: snapshot.session.planVersion,
    plannedMinutes: snapshot.session.plannedMinutes,
    status: "planned",
    userId,
  });

  await studySessionBlockFixture({
    estimatedMinutes: snapshot.bossMinutes,
    kind: "checkpoint",
    payload: json(snapshot.block, replay),
    position: 0,
    sessionId: session.id,
  });

  await Promise.all(
    snapshot.ledger.map((entry) =>
      learningEventFixture({
        contentIds: json(entry.contentIds, replay),
        endedAt: shiftedDate(replay, entry.endedAt),
        seconds: entry.seconds,
        userId,
      }),
    ),
  );

  await prisma.dailyProgress.createMany({
    data: snapshot.progress.map((entry) => ({
      ...entry,
      date: shiftedDate(replay, entry.date),
      dayOfWeek: shiftedDate(replay, entry.date).getUTCDay(),
      userId,
    })),
  });

  await Promise.all([
    learningProfileFixture({ activeGoalId: goal.id, userId }),
    prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: userId, status: "active" },
    }),
  ]);

  const mock = rows.find((item) => item.kind === "mock");

  if (!mock) {
    throw new Error("Expected the actual saved funded mock");
  }

  return { from: replay.day, goal, mock, plan };
}
