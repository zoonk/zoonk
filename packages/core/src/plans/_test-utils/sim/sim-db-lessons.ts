import { type CourseLevel, type Lesson, type StudySessionBlock, prisma } from "@zoonk/db";
import { playableStepContent } from "@zoonk/testing/fixtures/playable-step-contents";
import { normalizeString } from "@zoonk/utils/string";
import { runDeferredWork } from "../../../_test-utils/deferred-work";
import { checkLessonStep } from "../../../lesson-player/check-lesson-step";
import { completeLibraryLesson } from "../../../lesson-player/complete-library-lesson";
import { CURRENT_STEPS } from "../../../library/lessons/lesson-versions";
import { readBlockPayload } from "../../../sessions/block-payload";
import { startStudyBlock } from "../../../sessions/start-study-block";
import { startLearningEvent } from "../../../stats/record-learning-event";
import { fromIsoDate } from "../../planner/plan-calendar";
import { type RuleAnswer } from "../rules/rule-context";
import { SIM_ANSWER_MS } from "./sim-db-items";
import { passSimTime } from "./sim-db-reads";
import { type DbRunner } from "./sim-db-runner";
import { SIM_PROVENANCE, type SimLibrary } from "./sim-library";

/**
 * With a question bank, the database tier's lessons are written too, and the learner plays them
 * through the lesson player, so the learner model holds what lessons teach as it does in the app.
 */

const MINUTE_MS = 60_000;

/** The options of the check screen every simulated lesson asks (`playableStepContent.check`). */
const RIGHT_OPTION = "likely";
const WRONG_OPTION = "path";

/**
 * A lesson of a life's library copy, by its row id, with the skills it teaches: the graph skills
 * the fixture links it to, or none for one a chapter's outline ties to the graph (see
 * `writeSimLessons`).
 */
export type SimLessonRow = {
  id: string;
  level: CourseLevel;
  skillIds: readonly string[];
  title: string;
};

/** The finer skill of its own a lesson tied to the graph only through its chapter teaches. */
function getFinerSkillId({ lessonId, library }: { lessonId: string; library: SimLibrary }) {
  return library.toId(`finer:${library.short(lessonId)}`);
}

/**
 * Writes lessons as the Library does: each teaches the skills it's linked to, or else a finer
 * skill of its own (most Library lessons teach skills finer than a goal's graph, which reach the
 * graph through their chapter's outline: the fixtures keep only links to graph skills), and asks a
 * check screen on each skill it teaches, which is where the lesson player records its answers.
 */
export async function writeSimLessons({
  lessons,
  library,
}: {
  lessons: readonly SimLessonRow[];
  library: SimLibrary;
}): Promise<void> {
  const { language } = library.fixture.goal;
  const finer = lessons.filter((lesson) => lesson.skillIds.length === 0);

  await prisma.skill.createMany({
    data: finer.map((lesson) => {
      const id = getFinerSkillId({ lessonId: lesson.id, library });

      return {
        description: lesson.title,
        id,
        identityKey: `sim-skill-${id}`,
        language,
        level: lesson.level,
        name: lesson.title,
        normalizedName: normalizeString(lesson.title),
        ...SIM_PROVENANCE,
      };
    }),
    skipDuplicates: true,
  });

  await Promise.all([
    prisma.lessonSkill.createMany({
      data: finer.map((lesson) => ({
        lessonId: lesson.id,
        skillId: getFinerSkillId({ lessonId: lesson.id, library }),
      })),
      skipDuplicates: true,
    }),
    prisma.step.createMany({
      data: lessons.flatMap((lesson) => {
        const skillIds =
          lesson.skillIds.length > 0
            ? lesson.skillIds
            : [getFinerSkillId({ lessonId: lesson.id, library })];

        return skillIds.map((skillId, position) => ({
          content: playableStepContent.check,
          kind: "check" as const,
          lessonId: lesson.id,
          position,
          skillId,
          ...SIM_PROVENANCE,
        }));
      }),
    }),
    prisma.lesson.updateMany({
      data: { contentStatus: "completed", specStatus: "completed" },
      where: { id: { in: lessons.map((lesson) => lesson.id) } },
    }),
  ]);
}

/**
 * Every lesson of a fixture's library copy, as `writeSimLessons` takes them: a pending skill's
 * lessons teach it before it lands, as the fixture links them.
 */
export function listSimLessons(library: SimLibrary): SimLessonRow[] {
  const { fixture, toId } = library;
  const linked = Map.groupBy(fixture.lessonSkills, ([lessonId]) => lessonId);

  return fixture.lessons.map(([id, title, , level]) => ({
    id: toId(id),
    level,
    skillIds: (linked.get(id) ?? []).map(([, skillId]) => toId(skillId)),
    title,
  }));
}

/**
 * A lesson the app writes when a session first needs it, such as a quick lesson the learner chose
 * for a topic the Library had none for: written then, on the skills it was created with.
 */
async function writeLessonJustInTime({
  lessonId,
  library,
}: {
  lessonId: string;
  library: SimLibrary;
}): Promise<void> {
  const lesson = await prisma.lesson.findUniqueOrThrow({
    select: { level: true, skills: { select: { skillId: true } }, title: true },
    where: { id: lessonId },
  });

  await writeSimLessons({
    lessons: [
      {
        id: lessonId,
        level: lesson.level,
        skillIds: lesson.skills.map((skill) => skill.skillId),
        title: lesson.title,
      },
    ],
    library,
  });
}

/**
 * The run the lesson player opens when the learner starts the session's lesson (`openLessonRun`),
 * without the start's allowance: lives don't model running out of the free plan's lessons.
 */
function openSimLessonRun(
  runner: DbRunner,
  {
    lesson,
    sessionId,
  }: { lesson: Pick<Lesson, "homeChapterId" | "id" | "title">; sessionId: string },
) {
  return prisma.$transaction((tx) =>
    startLearningEvent(tx, {
      contentIds: {
        lessonId: lesson.id,
        ...(lesson.homeChapterId && { chapterId: lesson.homeChapterId }),
        studySessionId: sessionId,
      },
      goalId: runner.goal.id,
      kind: "lesson",
      lessonKind: "library",
      startedAt: new Date(),
      timeZone: "UTC",
      titleSnapshot: lesson.title,
      userId: runner.goal.userId,
    }),
  );
}

/**
 * Plays a session's written lesson as the app does (`openStudyBlock`, then the lesson player): the
 * block starts (unless the day no longer offers it), the lesson's run opens from the session, each screen is answered, wrong when its
 * skill or the plan skill the block teaches is one the learner misses that day, the learner takes
 * `speed` times the lesson's estimate, and the completion finishes the block, which says when the
 * lesson comes back (`runner.finishedLessons`, with the plan skill it was planned for and the skills
 * it teaches). Returns the answers as the checks read them, on the graph's skills: a finer skill's
 * answers show the plan skill the lesson was planned for studied.
 */
export async function playWrittenLesson(
  runner: DbRunner,
  {
    block,
    misses,
    sessionId,
  }: {
    block: Pick<StudySessionBlock, "id" | "lessonId" | "payload">;
    misses: ReadonlySet<string>;
    sessionId: string;
  },
): Promise<RuleAnswer[]> {
  const lessonId = block.lessonId ?? "";
  const { planSkillId } = readBlockPayload(block);

  const started = await startStudyBlock({
    blockId: block.id,
    input: { timeZone: "UTC" },
    sessionId,
  });

  // A block the day no longer offers (a test-out earlier in the session skipped it) isn't played:
  // the learner goes on to the next one.
  if (started.status !== "ready") {
    return [];
  }

  const readScreens = () =>
    prisma.step.findMany({
      orderBy: { position: "asc" },
      select: { id: true, skillId: true },
      where: { lessonId, ...CURRENT_STEPS },
    });

  const [lesson, written] = await Promise.all([
    prisma.lesson.findUniqueOrThrow({
      select: { estimatedMinutes: true, homeChapterId: true, id: true, title: true },
      where: { id: lessonId },
    }),
    readScreens(),
  ]);

  if (written.length === 0) {
    await writeLessonJustInTime({ lessonId, library: runner.library });
  }

  const screens = written.length > 0 ? written : await readScreens();
  const run = await openSimLessonRun(runner, { lesson, sessionId });

  const missed = planSkillId !== null && misses.has(planSkillId);
  const graphSkills = new Set(runner.library.graph.skills.map((skill) => skill.skillId));

  // The player shows one screen after the other; what an answer leaves for after its response is
  // done before the next one.
  const answers = await screens.reduce<Promise<RuleAnswer[]>>(async (previous, screen) => {
    const answered = await previous;
    const correct = !missed && !misses.has(screen.skillId ?? "");
    const finish = runDeferredWork();

    const checked = await checkLessonStep({
      input: {
        answer: { kind: "check", optionId: correct ? RIGHT_OPTION : WRONG_OPTION },
        durationMs: SIM_ANSWER_MS,
        runId: run.id,
        timeZone: "UTC",
      },
      stepId: screen.id,
    });

    await finish();

    if (checked.status !== "checked") {
      throw new Error(`A simulated lesson's screen wasn't checked: ${checked.status}`);
    }

    const recorded = screen.skillId ?? "";
    const skillId = graphSkills.has(recorded) ? recorded : (planSkillId ?? recorded);

    return [
      ...answered,
      { at: runner.today, correct, format: "other" as const, skillId, source: "lesson" as const },
    ];
  }, Promise.resolve([]));

  passSimTime(Math.round(lesson.estimatedMinutes * MINUTE_MS * runner.life.speed));

  const finish = runDeferredWork();

  const completed = await completeLibraryLesson({
    input: { runId: run.id, timeZone: "UTC" },
    lessonId,
  });

  await finish();

  if (completed.status !== "completed") {
    throw new Error(
      `Simulated lesson ${lessonId} (${screens.length} screens) didn't complete: ${completed.status}`,
    );
  }

  const comesBackOn = completed.completion.studyBlock?.comesBackOn;

  const taught = await prisma.lessonSkill.findMany({
    select: { skillId: true },
    where: { lessonId },
  });

  runner.finishedLessons.push({
    comesBackOn: comesBackOn ? fromIsoDate(comesBackOn) : null,
    day: runner.today,
    lessonId,
    skillIds: [
      ...new Set([...(planSkillId ? [planSkillId] : []), ...taught.map((row) => row.skillId)]),
    ],
  });

  return answers;
}
