import { EvaluationTimeoutError } from "@zoonk/ai/evaluate/timeout";
import {
  generateCourseOutline,
  streamCourseOutline,
} from "@zoonk/ai/tasks/v2/curriculum/course-outline";
import { type generateSkillGraph } from "@zoonk/ai/tasks/v2/curriculum/skill-graph";
import {
  type TeachingChaptersParams,
  findTeachingChapters,
} from "@zoonk/ai/tasks/v2/curriculum/teaching-chapters";
import { decideLibraryIdentity } from "@zoonk/ai/tasks/v2/identity/decision";
import { generateSearchTerms } from "@zoonk/ai/tasks/v2/identity/search-terms";
import { trackServerEvent } from "@zoonk/core/analytics/server";
import { toGoalPlanGraph } from "@zoonk/core/library/curriculum/goal-plan-graph";
import { createGoalPlan } from "@zoonk/core/plans/create";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import {
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import * as logger from "@zoonk/utils/logger";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getWorkflowMetadata, sleep } from "workflow";
import { getRun, start } from "workflow/api";
import { mockHookConflict } from "../../../../mocks/workflow";
import { mockLastRunEvent } from "../../../../mocks/workflow-runtime";
import { getStartMock } from "../../_test-utils/start-mock";
import { courseContentNotificationWorkflow } from "../_shared/course-content-notification-workflow";
import {
  outlineResult,
  recordedOutput,
  replayStreamedOutline,
  taskResult,
} from "../_test-utils/recorded-outputs";
import { courseDetailsWorkflow, courseIconWorkflow } from "./course-details-workflow";
import { courseOutlineWorkflow } from "./course-outline-workflow";
import { saveOutlineChapterStep, writeOutlineBandStep } from "./steps/course-outline-steps";

type SkillGraph = Awaited<ReturnType<typeof generateSkillGraph>>["data"];
type CourseOutline = Awaited<ReturnType<typeof generateCourseOutline>>["data"];

const recordedGraph = recordedOutput<SkillGraph>("skill-graph");
const recordedOutline = recordedOutput<CourseOutline>("course-outline");

const scope = {
  generalGoal: "Understand how vaccines work",
  language: "en",
  ownerId: null,
  targetLanguage: null,
};

const TIMEOUT = 60_000;

async function planWaitingGoal(
  idsByKey: Record<string, string>,
  { setupComplete = true }: { setupComplete?: boolean } = {},
) {
  const user = await userFixture();

  const goal = await goalFixture({
    details: setupComplete
      ? { answered: ["purpose", "level", "targetDate", "buddy", "placement", "schedule"] }
      : {},
    userId: user.id,
  });

  await prisma.plan.create({
    data: { goalId: goal.id, settings: { startDate: new Date().toISOString().slice(0, 10) } },
  });

  await createGoalPlan({
    goalId: goal.id,
    graph: toGoalPlanGraph({ courseIdsByKey: {}, graph: recordedGraph, idsByKey }),
  });

  return goal;
}

async function waitingGoal(options: { setupComplete?: boolean } = {}) {
  const skills = await Promise.all(
    recordedGraph.skills.map((skill) =>
      skillFixture({ description: skill.description, name: skill.name }),
    ),
  );

  const idsByKey = Object.fromEntries(
    recordedGraph.skills.map((skill, index) => [skill.key, skills[index]?.id ?? ""]),
  );

  const goal = await planWaitingGoal(idsByKey, options);

  const bandSkills = recordedGraph.skills.map((skill) => ({
    description: skill.description,
    id: idsByKey[skill.key] ?? "",
    key: skill.key,
    name: skill.name,
  }));

  return { bandSkills, goal, idsByKey };
}

async function markPlanUntil({
  planId,
  signal,
}: {
  planId: string;
  signal: AbortSignal;
}): Promise<number> {
  if (signal.aborted) {
    return 0;
  }

  await prisma.$executeRaw`UPDATE plans SET input_version = input_version + 1 WHERE id = ${planId}::uuid`;
  return 1 + (await markPlanUntil({ planId, signal }));
}

function outlineOneChapter() {
  const oneChapter = { ...recordedOutline, chapters: recordedOutline.chapters.slice(0, 1) };

  vi.mocked(generateCourseOutline).mockResolvedValue(outlineResult(oneChapter));
  vi.mocked(streamCourseOutline).mockImplementation(replayStreamedOutline(oneChapter) as never);
}

function lessonItems(goalId: string) {
  return prisma.planItem.findMany({
    orderBy: { position: "asc" },
    where: { kind: "lesson", plan: { goalId } },
  });
}

function interviewChapter(title: string, skillKeys: string[]) {
  return {
    description: `${title}.`,
    lessons: ["Perguntas situacionais", "Resultados de um projeto", "Pontos fortes"].map(
      (lesson) => ({
        canDo: `Responder: ${lesson}`,
        description: `${lesson} em entrevistas.`,
        estimatedMinutes: 3,
        skills: [`${lesson} ${crypto.randomUUID().slice(0, 6)}`],
        title: `${lesson} ${title}`,
      }),
    ),
    objectives: ["Responder perguntas de entrevista"],
    skillKeys,
    title,
    tools: [],
  };
}

const ITALIAN_SCOPE = { generalGoal: null, language: "pt", ownerId: null, targetLanguage: "it" };

async function writtenBand({
  chapters,
  courseId,
}: {
  chapters: { lessons: string[]; title: string }[];
  courseId: string;
}) {
  return Promise.all(
    chapters.map(async ({ lessons, title }, position) => {
      const chapter = await libraryChapterFixture({ language: "pt", targetLanguage: "it", title });

      const rows = await Promise.all(
        lessons.map((lesson) =>
          libraryLessonFixture({
            estimatedMinutes: 3,
            homeChapterId: chapter.id,
            language: "pt",
            targetLanguage: "it",
            title: lesson,
          }),
        ),
      );

      await Promise.all([
        courseChapterFixture({ chapterId: chapter.id, courseId, position }),
        prisma.chapterLesson.createMany({
          data: rows.map((lesson, index) => ({
            chapterId: chapter.id,
            lessonId: lesson.id,
            position: index,
          })),
        }),
      ]);

      return { chapter, lessons: rows };
    }),
  );
}

async function italianSkill(name: string) {
  return skillFixture({
    language: "pt",
    name: `${name} ${crypto.randomUUID().slice(0, 8)}`,
    targetLanguage: "it",
  });
}

function toSkillRef(skill: { description: string; id: string; name: string }) {
  return { description: skill.description, id: skill.id, key: skill.id, name: skill.name };
}

async function goalWaitingOn({ courseId, skillId }: { courseId: string; skillId: string }) {
  const [user, skill] = await Promise.all([
    userFixture(),
    prisma.skill.findUniqueOrThrow({ where: { id: skillId } }),
  ]);

  const goal = await goalFixture({
    details: { answered: ["reason", "level", "targetDate", "buddy", "placement", "schedule"] },
    kind: "language",
    language: "pt",
    primaryCourseId: courseId,
    targetLanguage: "it",
    userId: user.id,
  });

  await prisma.plan.create({
    data: { goalId: goal.id, settings: { startDate: new Date().toISOString().slice(0, 10) } },
  });

  await createGoalPlan({
    goalId: goal.id,
    graph: {
      phases: [{ milestone: null, name: "Viagens" }],
      skills: [
        {
          area: "Italiano",
          courseIds: [courseId],
          lessons: 2,
          name: skill.name,
          phase: 0,
          skillId,
          weight: null,
        },
      ],
    },
  });

  return goal;
}

function teachNothing(params: TeachingChaptersParams) {
  return taskResult(
    params.skills.map((skill) => ({
      after: params.chapters.length,
      chapter: null,
      key: skill.key,
    })),
  );
}

async function writeAfterEarlyAttempt(firstStatus: "completed" | "failed") {
  const [{ bandSkills }, course] = await Promise.all([
    waitingGoal(),
    courseFixture({ outlineStatus: "running", title: "Immunology" }),
  ]);

  const first = await libraryChapterFixture({ level: "overview", outlineStatus: firstStatus });

  await courseChapterFixture({
    chapterId: first.id,
    courseId: course.id,
    level: "overview",
    position: 0,
  });

  const band = await writeOutlineBandStep({
    courseId: course.id,
    plan: {
      courseTitle: course.title,
      extensions: [],
      isNewBand: true,
      level: "overview",
      material: null,
      nextPosition: 0,
      otherChapterTitles: [],
      skills: bandSkills,
      taughtElsewhere: [],
      withoutTools: false,
    },
    scope,
    waitedSkillId: bandSkills[0]?.id,
    workflowRunId: "outline-run",
  });

  return { band, course, first };
}

describe(courseOutlineWorkflow, () => {
  beforeEach(() => {
    vi.mocked(generateSearchTerms).mockImplementation(
      async ({ subjects }) =>
        taskResult({
          subjects: subjects.map(() => ({ terms: [`zq${crypto.randomUUID().slice(0, 8)}`] })),
        }) as never,
    );

    vi.mocked(decideLibraryIdentity).mockResolvedValue({ match: null, verdicts: [] });
    vi.mocked(generateCourseOutline).mockResolvedValue(outlineResult(recordedOutline));

    vi.mocked(streamCourseOutline).mockImplementation(
      replayStreamedOutline(recordedOutline) as never,
    );

    vi.mocked(findTeachingChapters).mockImplementation(async (params) => teachNothing(params));
  });

  describe("on a band other learners already use", { timeout: TIMEOUT }, () => {
    it("teaches a later goal's skill through the chapter that already covers it, writing no chapter", async () => {
      const course = await courseFixture({
        language: "pt",
        outlineStatus: "completed",
        targetLanguage: "it",
        title: "Italiano",
      });

      const [[lodging, symptoms], skill] = await Promise.all([
        writtenBand({
          chapters: [
            { lessons: ["Disponibilidade de quartos", "Check-in"], title: "Reserva e hospedagem" },
            { lessons: ["Partes do corpo"], title: "Sintomas e pedidos de ajuda" },
          ],
          courseId: course.id,
        }),
        italianSkill("Hospedar-se em um hotel"),
      ]);

      const goal = await goalWaitingOn({ courseId: course.id, skillId: skill.id });

      vi.mocked(findTeachingChapters).mockResolvedValue(
        taskResult([{ after: 1, chapter: 1, key: skill.id }]),
      );

      await expect(
        courseOutlineWorkflow({
          bands: [{ level: "beginner", skills: [toSkillRef(skill)] }],
          courseId: course.id,
          scope: ITALIAN_SCOPE,
        }),
      ).resolves.toMatchObject({ chapterIds: [], status: "written" });

      expect(generateCourseOutline).not.toHaveBeenCalled();
      expect(streamCourseOutline).not.toHaveBeenCalled();

      expect(vi.mocked(findTeachingChapters).mock.calls[0]?.[0].chapters).toStrictEqual([
        { lessons: ["Disponibilidade de quartos", "Check-in"], title: "Reserva e hospedagem" },
        { lessons: ["Partes do corpo"], title: "Sintomas e pedidos de ajuda" },
      ]);

      const [tags, placements, items] = await Promise.all([
        prisma.chapterSkill.findMany({ select: { chapterId: true }, where: { skillId: skill.id } }),
        prisma.courseChapter.findMany({
          orderBy: { position: "asc" },
          select: { chapterId: true },
          where: { courseId: course.id },
        }),
        lessonItems(goal.id),
      ]);

      expect(tags).toStrictEqual([{ chapterId: lodging?.chapter.id }]);

      expect(placements.map((placement) => placement.chapterId)).toStrictEqual([
        lodging?.chapter.id,
        symptoms?.chapter.id,
      ]);

      expect(items.map((item) => item.lessonId)).toStrictEqual(
        lodging?.lessons.map((lesson) => lesson.id),
      );
    });

    it("writes a chapter only for the skill no chapter teaches, right after the chapter it builds on", async () => {
      const course = await courseFixture({
        language: "pt",
        outlineStatus: "completed",
        targetLanguage: "it",
        title: "Italiano",
      });

      const [[lodging], stay, complain] = await Promise.all([
        writtenBand({
          chapters: [
            { lessons: ["Disponibilidade de quartos"], title: "Reserva e hospedagem" },
            { lessons: ["Partes do corpo"], title: "Sintomas e pedidos de ajuda" },
          ],
          courseId: course.id,
        }),
        italianSkill("Hospedar-se em um hotel"),
        italianSkill("Reclamar de um problema no quarto"),
      ]);

      vi.mocked(findTeachingChapters).mockResolvedValue(
        taskResult([
          { after: 1, chapter: 1, key: stay.id },
          { after: 1, chapter: null, key: complain.id },
        ]),
      );

      vi.mocked(generateCourseOutline).mockResolvedValue(
        outlineResult({
          chapters: [interviewChapter("Problemas na hospedagem", [complain.id])],
          uncoveredSkillKeys: [],
        }),
      );

      await courseOutlineWorkflow({
        bands: [{ level: "beginner", skills: [toSkillRef(stay), toSkillRef(complain)] }],
        courseId: course.id,
        scope: ITALIAN_SCOPE,
      });

      const params = vi.mocked(generateCourseOutline).mock.calls[0]?.[0];

      expect(params?.requiredSkills?.map((skill) => skill.key)).toStrictEqual([complain.id]);
      expect(params?.taughtElsewhere).toContain(stay.name);

      const [placements, tags] = await Promise.all([
        prisma.courseChapter.findMany({
          include: { chapter: { select: { title: true } } },
          orderBy: { position: "asc" },
          where: { courseId: course.id },
        }),
        prisma.chapterSkill.findMany({ select: { chapterId: true }, where: { skillId: stay.id } }),
      ]);

      expect(placements.map((placement) => placement.chapter.title)).toStrictEqual([
        "Reserva e hospedagem",
        "Problemas na hospedagem",
        "Sintomas e pedidos de ajuda",
      ]);

      expect(tags).toStrictEqual([{ chapterId: lodging?.chapter.id }]);
    });

    it("keeps a saved chapter after its anchor when another chapter of the band fails to save", async () => {
      const course = await courseFixture({
        language: "pt",
        outlineStatus: "completed",
        targetLanguage: "it",
        title: "Italiano",
      });

      const [, complain, checkout] = await Promise.all([
        writtenBand({
          chapters: [
            { lessons: ["Disponibilidade de quartos"], title: "Reserva e hospedagem" },
            { lessons: ["Partes do corpo"], title: "Sintomas e pedidos de ajuda" },
          ],
          courseId: course.id,
        }),
        italianSkill("Reclamar de um problema no quarto"),
        italianSkill("Fazer o check-out"),
      ]);

      vi.mocked(findTeachingChapters).mockResolvedValue(
        taskResult([
          { after: 1, chapter: null, key: complain.id },
          { after: 1, chapter: null, key: checkout.id },
        ]),
      );

      vi.mocked(generateCourseOutline).mockResolvedValue(
        outlineResult({
          chapters: [
            interviewChapter("Problemas na hospedagem", [complain.id]),
            interviewChapter("Saída da hospedagem", [checkout.id]),
          ],
          uncoveredSkillKeys: [],
        }),
      );

      vi.mocked(generateSearchTerms).mockImplementation(async ({ subjects }) => {
        if (subjects.some((subject) => subject.item.title === "Saída da hospedagem")) {
          throw new Error("The search terms provider is down");
        }

        return taskResult({
          subjects: subjects.map(() => ({ terms: [`zq${crypto.randomUUID().slice(0, 8)}`] })),
        }) as never;
      });

      await expect(
        courseOutlineWorkflow({
          bands: [{ level: "beginner", skills: [toSkillRef(complain), toSkillRef(checkout)] }],
          courseId: course.id,
          scope: ITALIAN_SCOPE,
        }),
      ).rejects.toThrow();

      const placements = await prisma.courseChapter.findMany({
        include: { chapter: { select: { title: true } } },
        orderBy: { position: "asc" },
        where: { courseId: course.id },
      });

      expect(placements.map((placement) => placement.chapter.title)).toStrictEqual([
        "Reserva e hospedagem",
        "Problemas na hospedagem",
        "Sintomas e pedidos de ajuda",
      ]);
    });

    it("leaves an exam's band to the outline, which keeps each chapter to one subject", async () => {
      const course = await courseFixture({ language: "pt", outlineStatus: "completed" });

      const [, skill] = await Promise.all([
        writtenBand({
          chapters: [{ lessons: ["Porcentagem"], title: "Razões e proporções" }],
          courseId: course.id,
        }),
        italianSkill("Calcular juros simples"),
      ]);

      await courseOutlineWorkflow({
        bands: [{ level: "beginner", skills: [toSkillRef(skill)] }],
        courseId: course.id,
        scope: { ...ITALIAN_SCOPE, exams: [{ name: "ENEM", style: "Five-option items." }] },
      });

      expect(findTeachingChapters).not.toHaveBeenCalled();
      expect(generateCourseOutline).toHaveBeenCalledOnce();
    });

    it("gives a guest who waited on another's run the chapter it wrote, instead of a second copy", async () => {
      const course = await courseFixture({
        language: "pt",
        outlineStatus: "completed",
        targetLanguage: "it",
        title: "Italiano",
      });

      const [, phone, call] = await Promise.all([
        writtenBand({
          chapters: [{ lessons: ["Cumprimentos"], title: "Primeiros contatos" }],
          courseId: course.id,
        }),
        italianSkill("Resolver assuntos simples por telefone"),
        italianSkill("Fazer ligações breves"),
      ]);

      const [phoneGoal, callGoal] = await Promise.all([
        goalWaitingOn({ courseId: course.id, skillId: phone.id }),
        goalWaitingOn({ courseId: course.id, skillId: call.id }),
      ]);

      const written = "Ligações do dia a dia";
      const loserDone = Promise.withResolvers<null>();

      vi.mocked(findTeachingChapters)
        .mockImplementationOnce(async (params) => {
          await loserDone.promise;
          return teachNothing(params);
        })
        .mockImplementation(async (params) => {
          const chapter = params.chapters.findIndex((item) => item.title === written) + 1;

          return taskResult(
            params.skills.map((skill) => ({ after: chapter, chapter, key: skill.key })),
          );
        });

      vi.mocked(generateCourseOutline).mockImplementation(async (params) =>
        outlineResult({
          chapters: [
            interviewChapter(
              written,
              (params.requiredSkills ?? []).map((skill) => skill.key),
            ),
          ],
          uncoveredSkillKeys: [],
        }),
      );

      const inputs = [phone, call].map((skill) => ({
        bands: [{ level: "beginner" as const, skills: [toSkillRef(skill)] }],
        courseId: course.id,
        scope: ITALIAN_SCOPE,
      }));

      vi.mocked(getRun).mockReturnValue({
        exists: Promise.resolve(true),
        status: Promise.resolve("running"),
      } as unknown as ReturnType<typeof getRun>);

      const metadata = getWorkflowMetadata();

      vi.mocked(getWorkflowMetadata)
        .mockReturnValueOnce({ ...metadata, workflowRunId: "phone-outline" })
        .mockReturnValueOnce({ ...metadata, workflowRunId: "call-outline" });

      const runs = inputs.map((input) => courseOutlineWorkflow(input));

      await expect(Promise.race(runs)).resolves.toStrictEqual({ status: "busy" });
      loserDone.resolve(null);
      await Promise.all(runs);

      const [nextTurn] = getStartMock().mock.calls.flatMap(([workflow, args]) =>
        workflow === courseOutlineWorkflow
          ? (args as Parameters<typeof courseOutlineWorkflow>)
          : [],
      );

      if (!nextTurn) {
        throw new Error("The run that waited didn't take another turn.");
      }

      await courseOutlineWorkflow(nextTurn);

      const placements = await prisma.courseChapter.findMany({
        include: { chapter: { select: { id: true, title: true } } },
        orderBy: { position: "asc" },
        where: { courseId: course.id },
      });

      expect(placements.map((placement) => placement.chapter.title)).toStrictEqual([
        "Primeiros contatos",
        written,
      ]);

      expect(generateCourseOutline).toHaveBeenCalledOnce();

      const chapter = placements[1]?.chapter.id;

      const [tags, phoneItems, callItems] = await Promise.all([
        prisma.chapterSkill.findMany({ select: { skillId: true }, where: { chapterId: chapter } }),
        lessonItems(phoneGoal.id),
        lessonItems(callGoal.id),
      ]);

      expect(tags.map((tag) => tag.skillId).toSorted()).toStrictEqual(
        [phone.id, call.id].toSorted(),
      );

      expect(phoneItems.every((item) => item.lessonId !== null)).toBe(true);

      expect(callItems.map((item) => item.lessonId)).toStrictEqual(
        phoneItems.map((item) => item.lessonId),
      );
    });
  });

  it(
    "writes a new band's outline, turns the goal's stand-ins into lessons and starts the course's background work",
    { timeout: TIMEOUT },
    async () => {
      const [{ bandSkills, goal }, course] = await Promise.all([
        waitingGoal(),
        courseFixture({ outlineStatus: "pending", title: "Immunology" }),
      ]);

      const result = await courseOutlineWorkflow({
        bands: [{ level: "overview", skills: bandSkills }],
        courseId: course.id,
        scope,
      });

      expect(result).toMatchObject({ bandsWritten: 1, status: "written" });

      expect(result.status === "written" && result.chapterIds).toHaveLength(
        recordedOutline.chapters.length,
      );

      const [storedCourse, placements, items] = await Promise.all([
        prisma.course.findUniqueOrThrow({ where: { id: course.id } }),
        prisma.courseChapter.findMany({
          orderBy: { position: "asc" },
          where: { courseId: course.id },
        }),
        lessonItems(goal.id),
      ]);

      expect(storedCourse).toMatchObject({ isPublished: true, outlineStatus: "completed" });

      expect(placements.map((placement) => placement.position)).toStrictEqual(
        recordedOutline.chapters.map((_, index) => index),
      );

      expect(items.length).toBeGreaterThan(0);
      expect(items.every((item) => item.lessonId !== null)).toBe(true);

      expect(vi.mocked(start).mock.calls).toStrictEqual([
        [courseIconWorkflow, [{ analytics: undefined, courseId: course.id }]],
        [
          courseDetailsWorkflow,
          [{ analytics: undefined, courseId: course.id }],
          { attributes: { courseId: course.id } },
        ],
      ]);
    },
  );

  it(
    "keeps a band written when a waiting goal can't take its lessons, and says which",
    { timeout: TIMEOUT },
    async () => {
      const [busy, course] = await Promise.all([
        waitingGoal(),
        courseFixture({ outlineStatus: "pending", title: "Immunology" }),
      ]);

      const other = await planWaitingGoal(busy.idsByKey);
      const readyBeforeRetry: boolean[] = [];

      vi.mocked(sleep).mockImplementationOnce(async () => {
        const items = await lessonItems(other.id);
        readyBeforeRetry.push(items.length > 0 && items.every((item) => item.lessonId !== null));
      });

      const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId: busy.goal.id } });
      const error = vi.spyOn(logger, "logError");
      const stop = new AbortController();
      const marking = markPlanUntil({ planId: plan.id, signal: stop.signal });

      const writing = courseOutlineWorkflow({
        analytics: { distinctId: busy.goal.userId, goalId: busy.goal.id, platform: "web" },
        bands: [{ level: "overview", skills: busy.bandSkills }],
        courseId: course.id,
        scope,
      });

      try {
        await Promise.allSettled([writing.finally(() => stop.abort()), marking]);
        await expect(marking).resolves.toBeGreaterThan(1);
        await expect(writing).resolves.toMatchObject({ status: "written" });
        expect(readyBeforeRetry).toStrictEqual([true]);

        expect(error).toHaveBeenCalledWith(
          "[courseOutlineWorkflow] Goals waiting on a band couldn't take its lessons:",
          expect.objectContaining({ courseId: course.id, goalIds: [busy.goal.id] }),
        );
      } finally {
        error.mockRestore();
      }

      const [storedCourse, busyItems, otherItems] = await Promise.all([
        prisma.course.findUniqueOrThrow({ where: { id: course.id } }),
        lessonItems(busy.goal.id),
        lessonItems(other.id),
      ]);

      expect(storedCourse.outlineStatus).toBe("completed");
      expect(otherItems.every((item) => item.lessonId !== null)).toBe(true);
      expect(busyItems.some((item) => item.lessonId === null)).toBe(true);

      expect(trackServerEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          distinctId: busy.goal.userId,
          name: "Generation Failed",
          properties: { content_kind: "course", model: null, task: "waiting-goals-replan" },
        }),
      );
    },
  );

  it(
    "writes every band at the standard tier, never priority, and bands the plan gets to in days at the flex tier",
    { timeout: TIMEOUT },
    async () => {
      outlineOneChapter();

      const [{ bandSkills }, course] = await Promise.all([
        waitingGoal(),
        courseFixture({ outlineStatus: "pending", title: "Immunology" }),
      ]);

      const half = Math.ceil(bandSkills.length / 2);

      await courseOutlineWorkflow({
        bands: [
          { level: "overview", skills: bandSkills.slice(0, half) },
          { level: "beginner", skills: bandSkills.slice(half) },
        ],
        courseId: course.id,
        scope,
        waitedSkillId: bandSkills[0]?.id,
      });

      expect(
        vi
          .mocked(streamCourseOutline)
          .mock.calls.map(([params]) => [params.level, params.serviceTier]),
      ).toStrictEqual([["overview", undefined]]);

      expect(
        vi
          .mocked(generateCourseOutline)
          .mock.calls.map(([params]) => [params.level, params.serviceTier]),
      ).toStrictEqual([["beginner", undefined]]);

      const later = await courseFixture({ outlineStatus: "pending", title: "Immunology" });
      vi.mocked(generateCourseOutline).mockClear();

      await courseOutlineWorkflow({
        background: true,
        bands: [{ level: "beginner", skills: bandSkills.slice(half) }],
        courseId: later.id,
        scope,
      });

      expect(
        vi.mocked(generateCourseOutline).mock.calls.map(([params]) => params.serviceTier),
      ).toStrictEqual(["flex"]);
    },
  );

  it(
    "writes a course's bands at once, so a later band doesn't wait for the first one to land",
    { timeout: TIMEOUT },
    async () => {
      const [{ bandSkills }, course] = await Promise.all([
        waitingGoal(),
        courseFixture({ outlineStatus: "pending", title: "Immunology" }),
      ]);

      const half = Math.ceil(bandSkills.length / 2);

      const secondStarted = new Promise<boolean>((resolve) => {
        vi.mocked(generateCourseOutline).mockImplementation(async (params) => {
          resolve(params.level === "beginner");
          return outlineResult(recordedOutline);
        });

        setTimeout(() => resolve(false), 5000);
      });

      vi.mocked(streamCourseOutline).mockImplementationOnce((async (params: never) => {
        await expect(secondStarted).resolves.toBe(true);
        return replayStreamedOutline(recordedOutline)(params);
      }) as never);

      await expect(
        courseOutlineWorkflow({
          bands: [
            { level: "overview", skills: bandSkills.slice(0, half) },
            { level: "beginner", skills: bandSkills.slice(half) },
          ],
          courseId: course.id,
          scope,
          waitedSkillId: bandSkills[0]?.id,
        }),
      ).resolves.toMatchObject({ status: "written" });
    },
  );

  it(
    "writes the band a learner waits on at the priority tier when its course is an exam's or a language's",
    { timeout: TIMEOUT },
    async () => {
      outlineOneChapter();

      const [{ bandSkills }, course] = await Promise.all([
        waitingGoal(),
        courseFixture({ outlineStatus: "pending", title: "Immunology" }),
      ]);

      const examScope = {
        ...scope,
        exams: [{ name: "ENEM", style: "Interdisciplinary five-option items." }],
      };

      const half = Math.ceil(bandSkills.length / 2);

      await courseOutlineWorkflow({
        bands: [
          { level: "overview", skills: bandSkills.slice(0, half) },
          { level: "beginner", skills: bandSkills.slice(half) },
        ],
        courseId: course.id,
        scope: examScope,
        waitedSkillId: bandSkills[0]?.id,
      });

      expect(vi.mocked(streamCourseOutline).mock.calls[0]?.[0].serviceTier).toBe("priority");
      expect(vi.mocked(generateCourseOutline).mock.calls[0]?.[0].serviceTier).toBeUndefined();
    },
  );

  it(
    "saves the first chapter of a band a learner waits on while the rest is written, and re-plans the learner from it",
    { timeout: TIMEOUT },
    async () => {
      const [{ bandSkills, goal }, course] = await Promise.all([
        waitingGoal(),
        courseFixture({ outlineStatus: "pending", title: "Immunology" }),
      ]);

      const replay = replayStreamedOutline(recordedOutline);
      const whileWriting: { placements: number; plannedLessons: number }[] = [];

      vi.mocked(streamCourseOutline).mockImplementation((async (
        params: Parameters<typeof replay>[0],
      ) => {
        const result = await replay(params);

        const [placements, items] = await Promise.all([
          prisma.courseChapter.count({ where: { courseId: course.id } }),
          lessonItems(goal.id),
        ]);

        whileWriting.push({
          placements,
          plannedLessons: items.filter((item) => item.lessonId !== null).length,
        });

        return result;
      }) as never);

      const result = await courseOutlineWorkflow({
        bands: [{ level: "overview", skills: bandSkills }],
        courseId: course.id,
        scope,
        waitedSkillId: bandSkills[0]?.id,
      });

      expect(whileWriting).toStrictEqual([{ placements: 1, plannedLessons: expect.any(Number) }]);
      expect(whileWriting[0]?.plannedLessons).toBeGreaterThan(0);

      const [placements, items] = await Promise.all([
        prisma.courseChapter.findMany({
          orderBy: { position: "asc" },
          where: { courseId: course.id },
        }),
        lessonItems(goal.id),
      ]);

      expect(placements.map((placement) => placement.position)).toStrictEqual(
        recordedOutline.chapters.map((_, index) => index),
      );

      expect(result.status === "written" && result.chapterIds).toStrictEqual(
        placements.map((placement) => placement.chapterId),
      );

      expect(items.every((item) => item.lessonId !== null)).toBe(true);
    },
  );

  it(
    "streams a band that exists when a learner waits on it, saving its first new chapter after the band's chapters",
    { timeout: TIMEOUT },
    async () => {
      const [{ bandSkills }, course, existing] = await Promise.all([
        waitingGoal(),
        courseFixture({ outlineStatus: "completed", title: "Immunology" }),
        libraryChapterFixture({ level: "overview" }),
      ]);

      await courseChapterFixture({
        chapterId: existing.id,
        courseId: course.id,
        level: "overview",
        position: 0,
      });

      const result = await courseOutlineWorkflow({
        bands: [{ level: "overview", skills: bandSkills }],
        courseId: course.id,
        scope,
        waitedSkillId: bandSkills[0]?.id,
      });

      const placements = await prisma.courseChapter.findMany({
        orderBy: { position: "asc" },
        where: { courseId: course.id },
      });

      expect(streamCourseOutline).toHaveBeenCalledOnce();
      expect(placements[0]?.chapterId).toBe(existing.id);

      expect(placements.map((placement) => placement.position)).toStrictEqual(
        placements.map((_, index) => index),
      );

      expect(result.status === "written" && result.chapterIds).toStrictEqual(
        placements.slice(1).map((placement) => placement.chapterId),
      );
    },
  );

  describe(writeOutlineBandStep, { timeout: TIMEOUT }, () => {
    it("queues the early chapter's invalidation without depending on Main's availability", async () => {
      vi.stubEnv("ZOONK_APP", "api");
      const fetch = vi.fn().mockRejectedValue(new Error("Main offline"));
      vi.stubGlobal("fetch", fetch);

      try {
        const { band, course } = await writeAfterEarlyAttempt("failed");

        expect(band.early?.chapterId).toBeTruthy();
        expect(streamCourseOutline).toHaveBeenCalledOnce();
        expect(fetch).not.toHaveBeenCalled();

        expect(start).toHaveBeenCalledWith(courseContentNotificationWorkflow, [
          [`course-curriculum:${course.id}`],
        ]);
      } finally {
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
      }
    });

    it("keeps the first chapter an earlier attempt finished, and writes the rest of the band after it", async () => {
      const { band, first } = await writeAfterEarlyAttempt("completed");

      expect(streamCourseOutline).not.toHaveBeenCalled();
      expect(vi.mocked(generateCourseOutline).mock.calls[0]?.[0].serviceTier).toBeUndefined();
      expect(band.early).toStrictEqual({ chapterId: first.id, goalIds: [], position: 0 });
      expect(band.chapters).toStrictEqual(recordedOutline.chapters.slice(1));
    });

    it("takes out a first chapter an earlier attempt didn't finish, and streams the band again", async () => {
      const { band, course, first } = await writeAfterEarlyAttempt("failed");

      expect(streamCourseOutline).toHaveBeenCalledOnce();
      expect(band.early?.chapterId).not.toBe(first.id);

      await expect(
        prisma.courseChapter.findMany({
          select: { chapterId: true },
          where: { courseId: course.id },
        }),
      ).resolves.toStrictEqual([{ chapterId: band.early?.chapterId }]);
    });
  });

  it(
    "frees the course for the next goal when a band fails, and counts the failure for the learner",
    { timeout: TIMEOUT },
    async () => {
      const [{ bandSkills, goal }, course] = await Promise.all([
        waitingGoal(),
        courseFixture({ outlineStatus: "pending", title: "Immunology" }),
      ]);

      vi.mocked(generateCourseOutline).mockRejectedValue(new Error("Provider unavailable"));

      await expect(
        courseOutlineWorkflow({
          analytics: { distinctId: goal.userId, goalId: goal.id, platform: "web" },
          bands: [{ level: "overview", skills: bandSkills }],
          courseId: course.id,
          scope,
        }),
      ).rejects.toThrow("Provider unavailable");

      await expect(
        prisma.course.findUniqueOrThrow({ where: { id: course.id } }),
      ).resolves.toMatchObject({ outlineRunId: "test-run-id", outlineStatus: "failed" });

      expect(trackServerEvent).toHaveBeenLastCalledWith(
        expect.objectContaining({
          distinctId: goal.userId,
          name: "Generation Failed",
          properties: { content_kind: "course", model: null, task: "course-outline" },
          shared: expect.objectContaining({ platform: "web" }),
        }),
      );

      const items = await lessonItems(goal.id);

      expect(items.length).toBeGreaterThan(0);
      expect(items.every((item) => item.lessonId === null)).toBe(true);
      expect(start).not.toHaveBeenCalledWith(courseDetailsWorkflow, expect.anything());
    },
  );

  it("gives a private course no details or other bands", { timeout: TIMEOUT }, async () => {
    const [{ bandSkills }, owner] = await Promise.all([waitingGoal(), userFixture()]);

    const course = await courseFixture({
      outlineStatus: "pending",
      title: "Immunology",
      userId: owner.id,
      visibility: "private",
    });

    await expect(
      courseOutlineWorkflow({
        bands: [{ level: "overview", skills: bandSkills }],
        courseId: course.id,
        scope: { ...scope, ownerId: owner.id },
      }),
    ).resolves.toMatchObject({ status: "written" });

    expect(start).not.toHaveBeenCalled();
  });

  it(
    "adds only the chapters that teach a later goal's missing skills to a band that exists",
    { timeout: TIMEOUT },
    async () => {
      const [{ bandSkills }, course, existing] = await Promise.all([
        waitingGoal(),
        courseFixture({ outlineStatus: "completed", title: "Immunology" }),
        libraryChapterFixture({ level: "overview" }),
      ]);

      await courseChapterFixture({
        chapterId: existing.id,
        courseId: course.id,
        level: "overview",
        position: 0,
      });

      const [first, ...rest] = recordedOutline.chapters;

      vi.mocked(generateCourseOutline).mockResolvedValue(
        outlineResult({
          ...recordedOutline,
          chapters: [...(first ? [{ ...first, skillKeys: [] }] : []), ...rest],
        }),
      );

      await courseOutlineWorkflow({
        bands: [{ level: "overview", skills: bandSkills }],
        courseId: course.id,
        scope,
      });

      const placements = await prisma.courseChapter.findMany({
        orderBy: { position: "asc" },
        where: { courseId: course.id },
      });

      expect(placements.map((placement) => placement.position)).toStrictEqual(
        placements.map((_, index) => index),
      );

      expect(placements).toHaveLength(
        rest.filter((chapter) => chapter.skillKeys.length > 0).length + 1,
      );

      expect(placements[0]?.chapterId).toBe(existing.id);

      expect(vi.mocked(generateCourseOutline).mock.calls[0]?.[0].otherLevelChapters).toStrictEqual([
        existing.title,
      ]);
    },
  );

  it(
    "tells the outline which of the band's skills the course's other chapters already teach",
    { timeout: TIMEOUT },
    async () => {
      outlineOneChapter();

      const [{ bandSkills }, course, otherSubject, chapter, otherChapter, lesson, otherLesson] =
        await Promise.all([
          waitingGoal(),
          courseFixture({ outlineStatus: "pending", title: "Immunology" }),
          courseFixture({ title: "Veterinary parasitology" }),
          libraryChapterFixture(),
          libraryChapterFixture(),
          libraryLessonFixture(),
          libraryLessonFixture(),
        ]);

      const [elsewhere, inOtherSubject, ...rest] = bandSkills;

      await Promise.all([
        courseChapterFixture({ chapterId: chapter.id, courseId: course.id, position: 0 }),
        courseChapterFixture({
          chapterId: otherChapter.id,
          courseId: otherSubject.id,
          position: 0,
        }),
        prisma.chapterLesson.createMany({
          data: [
            { chapterId: chapter.id, lessonId: lesson.id, position: 0 },
            { chapterId: otherChapter.id, lessonId: otherLesson.id, position: 0 },
          ],
        }),
        lessonSkillFixture({ lessonId: lesson.id, skillId: elsewhere?.id ?? "" }),
        lessonSkillFixture({ lessonId: otherLesson.id, skillId: inOtherSubject?.id ?? "" }),
      ]);

      await courseOutlineWorkflow({
        bands: [{ level: "overview", skills: bandSkills }],
        courseId: course.id,
        scope,
      });

      const [call] = vi.mocked(generateCourseOutline).mock.calls;

      expect(call?.[0].taughtElsewhere).toStrictEqual([elsewhere?.name]);

      expect(call?.[0].requiredSkills?.map((skill) => skill.key)).toStrictEqual(
        [inOtherSubject, ...rest].map((skill) => skill?.key),
      );
    },
  );

  it(
    "asks an exam answered on paper for chapters without tools, even for skills a tool chapter teaches",
    { timeout: TIMEOUT },
    async () => {
      outlineOneChapter();

      const [{ bandSkills }, course, practice, lesson] = await Promise.all([
        waitingGoal(),
        courseFixture({ outlineStatus: "pending", title: "Speech recognition" }),
        libraryChapterFixture({ tools: [{ essential: true, name: "Audio editor (Audacity)" }] }),
        libraryLessonFixture(),
      ]);

      const [withTool] = bandSkills;

      await Promise.all([
        courseChapterFixture({ chapterId: practice.id, courseId: course.id, position: 0 }),
        prisma.chapterLesson.create({
          data: { chapterId: practice.id, lessonId: lesson.id, position: 0 },
        }),
        lessonSkillFixture({ lessonId: lesson.id, skillId: withTool?.id ?? "" }),
      ]);

      await courseOutlineWorkflow({
        bands: [{ level: "overview", skills: bandSkills, withToolChapters: false }],
        courseId: course.id,
        scope,
      });

      const [call] = vi.mocked(generateCourseOutline).mock.calls;

      expect(call?.[0]).toMatchObject({ taughtElsewhere: [], withoutTools: true });
      expect(call?.[0].requiredSkills?.map((skill) => skill.key)).toContain(withTool?.key);
    },
  );

  it(
    "tells an exam's outline the subject each skill sits in, and a shared course's outline none",
    { timeout: TIMEOUT },
    async () => {
      outlineOneChapter();

      const [{ bandSkills }, examCourse, course] = await Promise.all([
        waitingGoal(),
        courseFixture({ outlineStatus: "pending", title: "ENEM" }),
        courseFixture({ outlineStatus: "pending", title: "Immunology" }),
      ]);

      const skills = bandSkills.map((skill) => ({ ...skill, area: "Matemática" }));
      const examScope = { ...scope, exams: [{ name: "ENEM", style: "Five-option items." }] };

      await courseOutlineWorkflow({
        bands: [{ level: "overview", skills }],
        courseId: examCourse.id,
        scope: examScope,
      });

      await courseOutlineWorkflow({
        bands: [{ level: "overview", skills }],
        courseId: course.id,
        scope,
      });

      const [exam, shared] = vi
        .mocked(generateCourseOutline)
        .mock.calls.map(([params]) => params.requiredSkills?.map((skill) => skill.area));

      expect(exam).toStrictEqual(skills.map(() => "Matemática"));
      expect(shared).toStrictEqual(skills.map(() => null));
    },
  );

  it(
    "waits while another run saves the course's other bands, then plans against what it saved",
    { timeout: TIMEOUT },
    async () => {
      const [{ bandSkills }, course, savedChapter] = await Promise.all([
        waitingGoal(),
        courseFixture({ outlineRunId: "bands-run", outlineStatus: "running", title: "Immunology" }),
        libraryChapterFixture({ level: "overview" }),
      ]);

      vi.mocked(getRun).mockReturnValueOnce({
        exists: Promise.resolve(true),
        status: Promise.resolve("running"),
      } as never);

      vi.mocked(sleep).mockImplementationOnce(async () => {
        await courseChapterFixture({
          chapterId: savedChapter.id,
          courseId: course.id,
          level: "overview",
          position: 0,
        });

        await prisma.course.update({
          data: { outlineStatus: "completed" },
          where: { id: course.id },
        });
      });

      await expect(
        courseOutlineWorkflow({
          bands: [{ level: "overview", skills: bandSkills }],
          courseId: course.id,
          scope,
        }),
      ).resolves.toMatchObject({ status: "written" });

      const placements = await prisma.courseChapter.findMany({
        orderBy: { position: "asc" },
        where: { courseId: course.id, level: "overview" },
      });

      expect(placements[0]?.chapterId).toBe(savedChapter.id);
      expect(placements.length).toBeGreaterThan(1);

      expect(placements.map((placement) => placement.position)).toStrictEqual(
        placements.map((_, index) => index),
      );

      expect(vi.mocked(generateCourseOutline).mock.calls[0]?.[0].otherLevelChapters).toStrictEqual([
        savedChapter.title,
      ]);
    },
  );

  it(
    "writes a guest's band while leaving its onboarding plan and the course's background work alone",
    { timeout: TIMEOUT },
    async () => {
      const [{ bandSkills, goal }, course] = await Promise.all([
        waitingGoal({ setupComplete: false }),
        courseFixture({ outlineStatus: "pending", title: "Immunology" }),
      ]);

      await expect(
        courseOutlineWorkflow({
          bands: [{ level: "overview", skills: bandSkills }],
          courseId: course.id,
          forGuest: true,
          scope,
        }),
      ).resolves.toMatchObject({ bandsWritten: 1, status: "written" });

      const items = await lessonItems(goal.id);

      expect(items.length).toBeGreaterThan(0);
      expect(items.every((item) => item.lessonId === null)).toBe(true);
      expect(start).not.toHaveBeenCalled();
    },
  );

  it("leaves a shared course's background work to a learner with an account, even when a guest's band needs nothing", async () => {
    const [skill, course, lesson] = await Promise.all([
      skillFixture(),
      courseFixture(),
      libraryLessonFixture(),
    ]);

    const chapter = await libraryChapterFixture();

    await Promise.all([
      prisma.chapterSkill.create({ data: { chapterId: chapter.id, skillId: skill.id } }),
      courseChapterFixture({ chapterId: chapter.id, courseId: course.id, position: 0 }),
      prisma.chapterLesson.create({
        data: { chapterId: chapter.id, lessonId: lesson.id, position: 0 },
      }),
    ]);

    await expect(
      courseOutlineWorkflow({
        bands: [
          {
            level: "overview",
            skills: [{ description: skill.description, id: skill.id, key: "k", name: skill.name }],
          },
        ],
        courseId: course.id,
        forGuest: true,
        scope,
      }),
    ).resolves.toStrictEqual({ bandsWritten: 0, chapterIds: [], status: "written" });

    expect(generateCourseOutline).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
  });

  it(
    "retries a chapter whose reuse decisions time out on a busy provider, and the retry saves it once",
    { timeout: TIMEOUT },
    async () => {
      const token = `zq${crypto.randomUUID().slice(0, 8)}`;

      const [{ bandSkills }, course] = await Promise.all([
        waitingGoal(),
        courseFixture({ title: "Immunology" }),
        skillFixture({ name: `Antigen recognition ${token}` }),
      ]);

      vi.mocked(generateSearchTerms).mockImplementation(
        async ({ subjects }) =>
          taskResult({ subjects: subjects.map(() => ({ terms: [token] })) }) as never,
      );

      vi.mocked(decideLibraryIdentity).mockRejectedValueOnce(
        new EvaluationTimeoutError("typesafe-ai/jev didn't answer within 10000 ms."),
      );

      const [chapter] = recordedOutline.chapters;

      if (!chapter) {
        throw new Error("The recorded outline has no chapter.");
      }

      const save = () =>
        saveOutlineChapterStep({
          chapter,
          courseId: course.id,
          goalSkills: bandSkills,
          level: "overview",
          position: 0,
          provenance: taskResult(recordedOutline).provenance,
          scope,
          workflowRunId: "outline-run",
        });

      await expect(save()).rejects.toMatchObject({ name: "RetryableError", retryAfter: "1m" });

      const { value: saved } = await save();

      const [placements, homeLessons, stored] = await Promise.all([
        prisma.courseChapter.findMany({ where: { courseId: course.id } }),
        prisma.lesson.findMany({ where: { homeChapterId: saved.chapterId } }),
        prisma.chapter.findUniqueOrThrow({ where: { id: saved.chapterId } }),
      ]);

      expect(placements.map((placement) => placement.chapterId)).toStrictEqual([saved.chapterId]);
      expect(homeLessons).toHaveLength(chapter.lessons.length + 1);
      expect(saved.lessonIds.toSorted()).toStrictEqual(homeLessons.map((row) => row.id).toSorted());
      expect(stored.outlineStatus).toBe("completed");
    },
  );

  it("writes nothing when the course already teaches every skill in another band", async () => {
    const [skill, course] = await Promise.all([skillFixture(), courseFixture()]);
    const chapter = await libraryChapterFixture();

    await Promise.all([
      prisma.chapterSkill.create({ data: { chapterId: chapter.id, skillId: skill.id } }),
      courseChapterFixture({ chapterId: chapter.id, courseId: course.id, position: 0 }),
    ]);

    const lesson = await libraryLessonFixture();

    await prisma.chapterLesson.create({
      data: { chapterId: chapter.id, lessonId: lesson.id, position: 0 },
    });

    await expect(
      courseOutlineWorkflow({
        bands: [
          {
            level: "overview",
            skills: [{ description: skill.description, id: skill.id, key: "k", name: skill.name }],
          },
        ],
        courseId: course.id,
        scope,
      }),
    ).resolves.toStrictEqual({ bandsWritten: 0, chapterIds: [], status: "written" });

    expect(generateCourseOutline).not.toHaveBeenCalled();

    expect(start).toHaveBeenCalledWith(
      courseDetailsWorkflow,
      [{ analytics: undefined, courseId: course.id }],
      { attributes: { courseId: course.id } },
    );
  });

  it(
    "writes a skill's next chapter right after its last one, under a new title, and swaps its lessons into the plan",
    { timeout: TIMEOUT },
    async () => {
      const [user, course, skill, existing, later] = await Promise.all([
        userFixture(),
        courseFixture({
          language: "pt",
          outlineStatus: "completed",
          targetLanguage: "en",
          title: "Inglês",
        }),
        skillFixture({ language: "pt", name: `Descrever experiência ${crypto.randomUUID()}` }),
        libraryChapterFixture({
          language: "pt",
          targetLanguage: "en",
          title: "Candidaturas e entrevistas",
        }),
        libraryChapterFixture({ language: "pt", targetLanguage: "en", title: "Vida no trabalho" }),
      ]);

      const written = await Promise.all(
        ["Formação acadêmica", "Tarefas anteriores"].map((title) =>
          libraryLessonFixture({
            estimatedMinutes: 3,
            homeChapterId: existing.id,
            language: "pt",
            targetLanguage: "en",
            title,
          }),
        ),
      );

      await Promise.all([
        courseChapterFixture({ chapterId: existing.id, courseId: course.id, position: 0 }),
        courseChapterFixture({ chapterId: later.id, courseId: course.id, position: 1 }),
        prisma.chapterSkill.create({ data: { chapterId: existing.id, skillId: skill.id } }),
        prisma.chapterLesson.createMany({
          data: written.map((lesson, position) => ({
            chapterId: existing.id,
            lessonId: lesson.id,
            position,
          })),
        }),
      ]);

      const goal = await goalFixture({
        details: { answered: ["reason", "level", "targetDate", "buddy", "placement", "schedule"] },
        kind: "language",
        language: "pt",
        primaryCourseId: course.id,
        targetLanguage: "en",
        userId: user.id,
      });

      await prisma.plan.create({
        data: { goalId: goal.id, settings: { startDate: new Date().toISOString().slice(0, 10) } },
      });

      await createGoalPlan({
        goalId: goal.id,
        graph: {
          phases: [{ milestone: null, name: "Trabalho" }],
          skills: [
            {
              area: "Inglês",
              courseIds: [course.id],
              lessons: 12,
              name: skill.name,
              phase: 0,
              skillId: skill.id,
              weight: null,
            },
          ],
        },
      });

      const ref = { description: skill.description, id: skill.id, key: skill.id, name: skill.name };

      vi.mocked(generateCourseOutline).mockResolvedValue(
        outlineResult({
          chapters: [
            interviewChapter("Candidaturas e entrevistas", [ref.key]),
            interviewChapter("Entrevistas com perguntas situacionais", [ref.key]),
            interviewChapter("Negociação de salário", [ref.key]),
            interviewChapter("Vida no Canadá", []),
          ],
          uncoveredSkillKeys: [],
        }),
      );

      await courseOutlineWorkflow({
        bands: [{ extend: [{ lessons: 12, skill: ref }], level: "beginner", skills: [] }],
        courseId: course.id,
        scope: { generalGoal: null, language: "pt", ownerId: null, targetLanguage: "en" },
      });

      expect(vi.mocked(generateCourseOutline).mock.calls[0]?.[0].extendSkills).toStrictEqual([
        {
          area: null,
          chapters: [{ lessons: written.map((lesson) => lesson.title), title: existing.title }],
          description: skill.description,
          key: ref.key,
          lessons: 10,
          name: skill.name,
        },
      ]);

      const placements = await prisma.courseChapter.findMany({
        include: { chapter: { select: { title: true } } },
        orderBy: { position: "asc" },
        where: { courseId: course.id },
      });

      expect(
        placements.map((placement) => [placement.position, placement.chapter.title]),
      ).toStrictEqual([
        [0, "Candidaturas e entrevistas"],
        [1, "Entrevistas com perguntas situacionais"],
        [2, "Vida no trabalho"],
      ]);

      const items = await lessonItems(goal.id);

      const lessons = await prisma.lesson.findMany({
        where: { id: { in: items.flatMap((item) => item.lessonId ?? []) } },
      });

      const titleOf = (lessonId: string | null) =>
        lessons.find((row) => row.id === lessonId)?.title;

      expect(
        items.map((item) => (item.lessonId ? titleOf(item.lessonId) : item.skillId)),
      ).toStrictEqual([
        "Formação acadêmica",
        "Tarefas anteriores",
        "Perguntas situacionais Entrevistas com perguntas situacionais",
        "Resultados de um projeto Entrevistas com perguntas situacionais",
        "Pontos fortes Entrevistas com perguntas situacionais",
        skill.id,
      ]);
    },
  );

  it(
    "writes a level a run lists twice as one band, so its chapters never claim the same place",
    { timeout: TIMEOUT },
    async () => {
      const [course, extended, missing, existing] = await Promise.all([
        courseFixture({ language: "pt", outlineStatus: "completed", title: "Inglês" }),
        skillFixture({ language: "pt", name: `Descrever experiência ${crypto.randomUUID()}` }),
        skillFixture({ language: "pt", name: `Negociar salário ${crypto.randomUUID()}` }),
        libraryChapterFixture({ language: "pt", title: "Candidaturas e entrevistas" }),
      ]);

      const written = await libraryLessonFixture({
        estimatedMinutes: 3,
        homeChapterId: existing.id,
        language: "pt",
        title: "Formação acadêmica",
      });

      await Promise.all([
        courseChapterFixture({ chapterId: existing.id, courseId: course.id, position: 0 }),
        prisma.chapterSkill.create({ data: { chapterId: existing.id, skillId: extended.id } }),
        prisma.chapterLesson.create({
          data: { chapterId: existing.id, lessonId: written.id, position: 0 },
        }),
        lessonSkillFixture({ lessonId: written.id, skillId: extended.id }),
      ]);

      const toRef = (skill: typeof extended) => ({
        description: skill.description,
        id: skill.id,
        key: skill.id,
        name: skill.name,
      });

      vi.mocked(generateCourseOutline)
        .mockResolvedValueOnce(
          outlineResult({
            chapters: [
              interviewChapter("Entrevistas com perguntas situacionais", [extended.id]),
              interviewChapter("Negociação de salário", [missing.id]),
            ],
            uncoveredSkillKeys: [],
          }),
        )
        .mockResolvedValueOnce(
          outlineResult({
            chapters: [
              interviewChapter("Entrevistas técnicas", [extended.id]),
              interviewChapter("Benefícios e contratos", [missing.id]),
            ],
            uncoveredSkillKeys: [],
          }),
        );

      const result = await courseOutlineWorkflow({
        bands: [
          { level: "beginner", skills: [toRef(missing)] },
          { extend: [{ lessons: 12, skill: toRef(extended) }], level: "beginner", skills: [] },
        ],
        courseId: course.id,
        scope: { generalGoal: null, language: "pt", ownerId: null, targetLanguage: null },
      });

      expect(result).toMatchObject({ bandsWritten: 1, status: "written" });

      expect(
        vi
          .mocked(generateCourseOutline)
          .mock.calls.map(([params]) => [
            params.requiredSkills?.map((skill) => skill.key),
            params.extendSkills?.map((skill) => skill.key),
          ]),
      ).toStrictEqual([[[missing.id], [extended.id]]]);

      const placements = await prisma.courseChapter.findMany({
        include: { chapter: { select: { title: true } } },
        orderBy: { position: "asc" },
        where: { courseId: course.id },
      });

      expect(
        placements.map((placement) => [placement.position, placement.chapter.title]),
      ).toStrictEqual([
        [0, "Candidaturas e entrevistas"],
        [1, "Entrevistas com perguntas situacionais"],
        [2, "Negociação de salário"],
      ]);
    },
  );

  it("takes the course over from a run that stalled instead of joining it forever", async () => {
    const [skill, course] = await Promise.all([skillFixture(), courseFixture()]);
    const chapter = await libraryChapterFixture();

    await Promise.all([
      prisma.chapterSkill.create({ data: { chapterId: chapter.id, skillId: skill.id } }),
      courseChapterFixture({ chapterId: chapter.id, courseId: course.id, position: 0 }),
    ]);

    const lesson = await libraryLessonFixture();

    await prisma.chapterLesson.create({
      data: { chapterId: chapter.id, lessonId: lesson.id, position: 0 },
    });

    const cancel = vi.fn(() => {
      mockHookConflict(null);
      return Promise.resolve();
    });

    vi.mocked(getRun).mockReturnValue({
      cancel,
      exists: Promise.resolve(true),
      status: Promise.resolve("running"),
    } as unknown as ReturnType<typeof getRun>);

    mockHookConflict({ returnValue: new Promise(() => {}), runId: "stalled-run" });

    mockLastRunEvent("stalled-run", {
      createdAt: new Date(Date.now() - 60 * 60 * 1000),
      eventType: "step_started",
    });

    await expect(
      courseOutlineWorkflow({
        bands: [
          {
            level: "overview",
            skills: [{ description: skill.description, id: skill.id, key: "k", name: skill.name }],
          },
        ],
        courseId: course.id,
        scope,
      }),
    ).resolves.toStrictEqual({ bandsWritten: 0, chapterIds: [], status: "written" });

    expect(cancel).toHaveBeenCalledOnce();
  });

  it("waits for the run already writing the course, then writes what is still missing", async () => {
    const course = await courseFixture();
    mockHookConflict({ returnValue: Promise.resolve({ status: "written" }), runId: "owner-run" });

    const input = {
      bands: [{ level: "overview" as const, skills: [] }],
      courseId: course.id,
      scope,
    };

    await expect(courseOutlineWorkflow(input)).resolves.toStrictEqual({ status: "joined" });
    expect(start).toHaveBeenCalledWith(courseOutlineWorkflow, [{ ...input, attempt: 1 }]);
  });

  it("keeps its turn while its bands are still missing, however many runs held the course before it", async () => {
    const [course, skill] = await Promise.all([courseFixture(), skillFixture()]);
    mockHookConflict({ returnValue: Promise.resolve({ status: "written" }), runId: "other-run" });

    const input = {
      attempt: 1,
      bands: [
        {
          level: "advanced" as const,
          skills: [{ description: skill.description, id: skill.id, key: "k", name: skill.name }],
        },
      ],
      courseId: course.id,
      scope,
    };

    await expect(courseOutlineWorkflow(input)).resolves.toStrictEqual({ status: "joined" });
    expect(start).toHaveBeenCalledWith(courseOutlineWorkflow, [{ ...input, attempt: 2 }]);
  });

  it("stops waiting once the runs before it wrote everything it needed", async () => {
    const [skill, course] = await Promise.all([skillFixture(), courseFixture()]);
    const [chapter, lesson] = await Promise.all([libraryChapterFixture(), libraryLessonFixture()]);

    await Promise.all([
      courseChapterFixture({ chapterId: chapter.id, courseId: course.id, position: 0 }),
      prisma.chapterLesson.create({
        data: { chapterId: chapter.id, lessonId: lesson.id, position: 0 },
      }),
      lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id }),
    ]);

    mockHookConflict({ returnValue: Promise.resolve({ status: "written" }), runId: "other-run" });

    await expect(
      courseOutlineWorkflow({
        bands: [
          {
            level: "beginner",
            skills: [{ description: skill.description, id: skill.id, key: "k", name: skill.name }],
          },
        ],
        courseId: course.id,
        scope,
      }),
    ).resolves.toStrictEqual({ status: "joined" });

    expect(start).not.toHaveBeenCalled();
  });

  it("fails visibly instead of dropping its bands when the course stays taken", async () => {
    const [course, skill] = await Promise.all([courseFixture(), skillFixture()]);
    mockHookConflict({ returnValue: Promise.resolve({ status: "written" }), runId: "other-run" });

    await expect(
      courseOutlineWorkflow({
        attempt: 1000,
        bands: [
          {
            level: "advanced",
            skills: [{ description: skill.description, id: skill.id, key: "k", name: skill.name }],
          },
        ],
        courseId: course.id,
        scope,
      }),
    ).rejects.toThrow(/still missing/u);

    expect(start).not.toHaveBeenCalled();
  });
});
