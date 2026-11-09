import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import {
  chapterLessonFixture,
  lessonSkillFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { playableStepContent } from "@zoonk/testing/fixtures/playable-step-contents";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { freezeClock } from "../_test-utils/frozen-clock";
import { mockSession } from "../_test-utils/mock-session";
import { markPlanRevealed } from "../goals/mark-plan-revealed";
import { completeLibraryLesson } from "../lesson-player/complete-library-lesson";
import { startLibraryLesson } from "../lesson-player/start-library-lesson";
import { replanGoalsWaitingOnSkills } from "../library/curriculum/replan-waiting-goals";
import { followWrittenLessons } from "../lookahead/lessons-ask";
import { keepPaceOwn } from "../plans/_test-utils/keep-pace-own";
import { planLibraryFixture, unplannedGoalFixture } from "../plans/_test-utils/plan-library";
import { createGoalPlan } from "../plans/create-goal-plan";
import { getPlanRevealToday } from "../view-models/today/get-plan-reveal-today";
import { getTodayView } from "../view-models/today/get-today-view";
import { openTodayView } from "./_test-utils/open-today-view";
import { startStudyBlock } from "./start-study-block";

describe("the learner's daily study time", () => {
  it.each(["exam", "learn"] as const)(
    "holds four hours on a %s goal while its course is still being outlined, through the reveal and Start",
    async (goalKind) => {
      freezeClock();
      vi.setSystemTime(new Date("2026-09-30T12:00:00Z"));
      await keepPaceOwn();

      const [user, course, library] = await Promise.all([
        userFixture(),
        courseFixture({ outlineStatus: "running" }),
        planLibraryFixture({
          skills: [
            { area: "Math", lessons: 20 },
            { area: "Science", lessons: 0, size: 120 },
            { area: "English", lessons: 80 },
          ],
        }),
      ]);

      const { goal } = await unplannedGoalFixture({
        dailyMinutes: 240,
        details: { placementDeclined: true },
        kind: goalKind,
        openingLessonId: goalKind === "learn" ? library.lessons[0]?.id : null,
        planRevealedAt: null,
        primaryCourseId: course.id,
        settings: { startDate: "2026-09-30" },
        targetDate: new Date("2026-12-30"),
        timezone: "UTC",
        userId: user.id,
      });

      await Promise.all([
        createGoalPlan({ goalId: goal.id, graph: library.graph }),
        learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
      ]);

      mockSession(user.id);
      const read = () => getTodayView({ goalId: goal.id, timeZone: "UTC" });

      await expect(read()).resolves.toMatchObject({ status: "preparing" });

      await expect(getPlanRevealToday(goal.id, "UTC")).resolves.toMatchObject({
        reveal: { today: { minutes: { left: 240, planned: 240 } } },
        status: "ready",
      });

      await expect(prisma.studySession.count({ where: { goalId: goal.id } })).resolves.toBe(0);
      await markPlanRevealed(goal.id);

      await expect(read()).resolves.toMatchObject({
        today: { session: { minutes: { left: 240, planned: 240 } } },
      });

      const opened = await openTodayView({ goalId: goal.id, timeZone: "UTC" });
      expect(opened.today.session.minutes).toMatchObject({ left: 240, planned: 240 });

      await expect(
        prisma.studySession.findUniqueOrThrow({ where: { id: opened.today.session.id } }),
      ).resolves.toMatchObject({ plannedMinutes: 240 });

      await expect(read()).resolves.toMatchObject({
        today: { session: { minutes: { left: 240 } } },
      });

      const landed = await Promise.all(
        Array.from({ length: 30 }, async (_, index) => {
          const lesson = await libraryLessonFixture({
            estimatedMinutes: 3,
            homeChapterId: library.chapters[0]?.id,
          });

          await Promise.all([
            chapterLessonFixture({
              chapterId: library.chapters[0]?.id ?? "",
              lessonId: lesson.id,
              position: 100 + index,
            }),
            lessonSkillFixture({ lessonId: lesson.id, skillId: library.skills[1]?.id ?? "" }),
          ]);

          return lesson;
        }),
      );

      await replanGoalsWaitingOnSkills({ skillIds: [library.skills[1]?.id ?? ""] });

      await prisma.course.update({
        data: { outlineStatus: "completed" },
        where: { id: course.id },
      });

      await expect(read()).resolves.toMatchObject({
        today: { session: { minutes: { left: 240 } } },
      });

      await followWrittenLessons({ askedAt: null, goalId: goal.id });

      await expect(read()).resolves.toMatchObject({
        today: { session: { minutes: { left: 240 } } },
      });

      expect(landed).toHaveLength(30);
      const block = opened.today.session.blocks.find((candidate) => candidate.kind === "learn");

      if (!block?.lessonId) {
        throw new Error("Missing the first lesson");
      }

      await Promise.all([
        prisma.lesson.update({
          data: { contentStatus: "completed", specStatus: "completed" },
          where: { id: block.lessonId },
        }),
        prisma.step.createMany({
          data: ["explanation", "summary"].map((kind, position) => ({
            content: playableStepContent[kind as "explanation" | "summary"],
            kind: kind as "explanation" | "summary",
            lessonId: block.lessonId!,
            model: "fixture",
            position,
            promptVersion: "fixture",
            runId: "fixture",
          })),
        }),
      ]);

      await startStudyBlock({
        blockId: block.id,
        input: { timeZone: "UTC" },
        sessionId: opened.today.session.id,
      });

      const started = await startLibraryLesson({
        input: { studySessionId: opened.today.session.id, timeZone: "UTC" },
        lessonId: block.lessonId,
      });

      if (started.status !== "started") {
        throw new Error(started.status);
      }

      vi.setSystemTime(new Date(Date.now() + 4 * 60_000));

      await expect(read()).resolves.toMatchObject({
        today: { session: { minutes: { left: 240 } } },
      });

      await expect(
        completeLibraryLesson({
          input: { runId: started.run.runId, timeZone: "UTC" },
          lessonId: block.lessonId,
        }),
      ).resolves.toMatchObject({
        completion: { studyBlock: { minutes: { left: 236 } } },
        status: "completed",
      });

      await expect(read()).resolves.toMatchObject({
        today: { session: { minutes: { left: 236 } } },
      });
    },
  );
});
