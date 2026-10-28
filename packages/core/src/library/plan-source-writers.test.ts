import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { generateLanguageAudio } from "@zoonk/ai/tasks/audio";
import { voiceListeningScript } from "@zoonk/ai/tasks/audio/listening";
import { checkCoverage } from "@zoonk/ai/tasks/v2/curriculum/coverage-check";
import { type PastQuestion } from "@zoonk/ai/tasks/v2/items/past-questions";
import { generateAlphabetLesson } from "@zoonk/ai/tasks/v2/language/alphabet-lesson";
import { type Plan, type TransactionClient, prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import {
  chapterSkillFixture,
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  lessonSkillFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture, mediaAssetFixture } from "@zoonk/testing/fixtures/library-steps";
import { listeningSetFixture } from "@zoonk/testing/fixtures/listening";
import { itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture, sourceFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { assertReadBudget, countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { describe, expect, it, vi } from "vitest";
import { serveStoredFile, storeBlobUploads } from "../_test-utils/blob-uploads";
import { waitForBlockedStatement } from "../_test-utils/learner-lock";
import {
  ENGLISH,
  LANGUAGES,
  MATH,
  SPANISH,
  choiceBlueprintFixture,
} from "../exams/choices/_test-utils/choice-blueprint";
import { loadPlanContext } from "../plans/_utils/plan-context";
import { resolvePlanInputDependents } from "../plans/_utils/plan-input-dependencies";
import { computePlan } from "../plans/_utils/replan";
import { parsePlanGraph } from "../plans/planner/plan-state";
import { getSession } from "../users/get-session";
import { attachChapterToCourse } from "./chapters/attach-course-chapter";
import { findEarlyOutlineChapter } from "./curriculum/early-outline-chapter";
import { addMissingExamGraphSkills } from "./curriculum/exam-graph-repair";
import { resetExamSkillGraphForAdmin } from "./curriculum/exam-skill-graph-reset";
import { loadGoalCurriculumInputs } from "./curriculum/goal-curriculum-inputs";
import { placeContinuations } from "./curriculum/place-continuations";
import { saveExamSkillGraph } from "./curriculum/reusable-curriculum";
import { saveLessonSpecs } from "./curriculum/save-lesson-specs";
import { saveOutlineChapter } from "./curriculum/save-outline-chapter";
import { examStructureSchema } from "./exams/blueprint-contract";
import { getExamFormats } from "./exams/exam-choice-format";
import { recordChoiceOptions } from "./exams/record-choice-options";
import { recordSubjectQuestions } from "./exams/record-subject-questions";
import { recordTopicFrequency } from "./exams/record-topic-frequency";
import { holdBackLessonDraft } from "./generation/hold-back-lesson";
import { mockDecision, mockSearchTerms, uniqueWord } from "./identity/_test-utils/identity-mocks";
import { generatedMultipleChoice, generatedProvenance } from "./items/_test-utils/generated-items";
import { createItems } from "./items/create-items";
import { savePastQuestions } from "./items/past-questions";
import { getAlphabetIdentityKey } from "./language/alphabet/alphabet-identity";
import { writeAlphabetLesson } from "./language/alphabet/write-alphabet-lesson";
import {
  type LessonScreenToSave,
  saveLessonContent,
  saveLessonVersion,
} from "./lessons/_utils/save-lesson-content";
import { createLibraryLesson } from "./lessons/create-library-lesson";
import { placeChapterLessons } from "./lessons/place-chapter-lessons";
import { voiceListeningSet } from "./listening/voice-listening-set";
import {
  drawTestImage,
  mockDrawnImages,
  mockImageChecks,
  resetImageModels,
  testScene,
} from "./media/_test-utils/image-mocks";
import { checkImageAsset } from "./media/check-image-asset";
import { temperatureSpec, writtenTemperatureLesson } from "./quality/_test-utils/written-lessons";
import { setAsidePublishedLesson } from "./quality/published-lesson-check";
import { replaceFlaggedDrills } from "./review-flags/rewrite-flagged-drills";
import { toStepContent } from "./steps/written-screens";

const SOURCE_ROOT = fileURLToPath(new URL("..", import.meta.url));

const PLANNER_MODELS =
  "skill|skillPrerequisite|lesson|lessonSkill|chapter|chapterLesson|chapterSkill|courseChapter|item|itemSet|examBlueprint|examSkillGraph";

const WRITE_OPERATIONS =
  "create|createMany|createManyAndReturn|update|updateMany|updateManyAndReturn|upsert|delete|deleteMany";

const PLANNER_TABLES =
  "skills|skill_prerequisites|library_lessons|lesson_skills|library_chapters|chapter_lessons|chapter_skills|course_chapters|items|item_sets|exam_blueprints|exam_skill_graphs";

const CLIENT_WRITE = new RegExp(
  String.raw`\b(?:prisma|tx|transaction)\.(${PLANNER_MODELS})\.(${WRITE_OPERATIONS})\b`,
  "gu",
);

const RAW_WRITE = new RegExp(
  String.raw`(?:INSERT INTO|UPDATE|DELETE FROM)\s+"?(${PLANNER_TABLES})"?\b`,
  "gu",
);

const LOADER_FILES = [
  "plans/_utils/boss-plan-facts.ts",
  "plans/_utils/exam-option-skills.ts",
  "plans/_utils/load-listening-starts.ts",
  "plans/_utils/plan-tools.ts",
  "plans/_utils/planner-exam-facts.ts",
  "plans/_utils/planner-inputs.ts",
  "plans/_utils/planner-lessons.ts",
  "plans/_utils/quick-bases.ts",
  "plans/_utils/replan.ts",
  "library/curriculum/chapter-taught-lessons.ts",
  "learner/_utils/goal-skill-graph.ts",
  "checkpoints/_utils/boss-recordings.ts",
  "checkpoints/_utils/checkpoint-candidates.ts",
  "checkpoints/_utils/load-boss-bank-facts.ts",
  "library/items/item-field.ts",
  "library/items/item-sets.ts",
  "exams/listening/listening-exam.ts",
  "exams/listening/listening-parts.ts",
  "exams/listening/listening-skills.ts",
  "exams/listening/pick-listening-sets.ts",
  "exams/listening/prepare-listening-part.ts",
];

type Registration =
  | { verdict: "covered" | "marks"; why: string; writes: string[] }
  | {
      fields: string[];
      readElsewhere?: Partial<Record<string, string>>;
      verdict: "excluded";
      why: string;
      writes: string[];
    };

const REGISTRY: Record<string, Registration[]> = {
  "library/chapters/attach-course-chapter.ts": [
    {
      verdict: "marks",
      why: "placement: chapter lessons, tags, course",
      writes: ["courseChapter.upsert"],
    },
  ],
  "library/chapters/create-library-chapter.ts": [
    {
      verdict: "covered",
      why: "a new chapter is read only once placed and given lessons, which mark",
      writes: ["chapter.create"],
    },
  ],
  "library/claims/generation-claim.ts": [
    {
      fields: [
        "outlineRunId",
        "outlineStatus",
        "contentRunId",
        "contentStatus",
        "specRunId",
        "specStatus",
      ],
      verdict: "excluded",
      why: "generation claims",
      writes: ["chapter.updateMany", "lesson.updateMany"],
    },
  ],
  "library/curriculum/early-outline-chapter.ts": [
    { verdict: "marks", why: "removes a placement", writes: ["courseChapter.delete"] },
    {
      fields: ["model"],
      readElsewhere: { "plans/_utils/replan.ts": "a plan's own provenance" },
      verdict: "excluded",
      why: "relabels which model wrote the rows",
      writes: ["chapter.updateMany", "lesson.updateMany", "skill.updateMany"],
    },
  ],
  "library/curriculum/exam-graph-repair.ts": [
    { verdict: "marks", why: "the exam's shared graph", writes: ["examSkillGraph.update"] },
  ],
  "library/curriculum/exam-skill-graph-reset.ts": [
    { verdict: "marks", why: "the exam's shared graph", writes: ["examSkillGraph.deleteMany"] },
  ],
  "library/curriculum/place-continuations.ts": [
    {
      verdict: "marks",
      why: "chapter order: lessons are read in it",
      writes: ["courseChapter.update", "courseChapter.updateMany"],
    },
  ],
  "library/curriculum/reusable-curriculum.ts": [
    {
      verdict: "marks",
      why: "the exam's shared graph, unless it's unchanged or another run's",
      writes: ["examSkillGraph.createMany", "examSkillGraph.updateMany"],
    },
  ],
  "library/curriculum/save-lesson-specs.ts": [
    {
      verdict: "marks",
      why: "chapter order and lesson minutes",
      writes: ["chapterLesson.updateMany", "chapterLesson.upsert", "lesson.updateMany"],
    },
  ],
  "library/curriculum/save-outline-chapter.ts": [
    {
      verdict: "marks",
      why: "chapter tools and tags",
      writes: ["chapter.update", "chapterSkill.createMany"],
    },
  ],
  "library/exams/check-freshness.ts": [
    {
      fields: ["nextCheckAt"],
      verdict: "excluded",
      why: "freshness schedule",
      writes: ["examBlueprint.update"],
    },
  ],
  "library/exams/freshness-checks.ts": [
    {
      fields: ["nextCheckAt"],
      verdict: "excluded",
      why: "freshness schedule",
      writes: ["examBlueprint.updateMany"],
    },
  ],
  "library/exams/record-choice-options.ts": [
    {
      fields: ["pastOptions"],
      verdict: "excluded",
      why: "past options feed only a mock's format mix (see the behavioral case below)",
      writes: ["raw:exam_blueprints"],
    },
  ],
  "library/exams/record-subject-questions.ts": [
    {
      verdict: "marks",
      why: "past question counts size the mocks",
      writes: ["raw:exam_blueprints"],
    },
  ],
  "library/exams/record-topic-frequency.ts": [
    { verdict: "marks", why: "topic frequency weighs the topics", writes: ["raw:exam_blueprints"] },
  ],
  "library/exams/save-exam-blueprint.ts": [
    {
      verdict: "covered",
      why: "a new blueprint has no plan yet; updates run the blueprint protocol",
      writes: ["examBlueprint.create", "examBlueprint.update"],
    },
  ],
  "library/explanations/save-explanation.ts": [
    {
      fields: ["contentStatus", "relatedQuestions", "summary"],
      readElsewhere: { "plans/_utils/replan.ts": "a plan's posted summary" },
      verdict: "excluded",
      why: "publication (its content marker stays)",
      writes: ["lesson.updateMany"],
    },
  ],
  "library/generation/hold-back-lesson.ts": [
    { verdict: "marks", why: "a set-aside lesson leaves plans", writes: ["lesson.updateMany"] },
  ],
  "library/generation/lesson-generation-state.ts": [
    {
      fields: ["contentStatus", "specStatus"],
      verdict: "excluded",
      why: "generation state",
      writes: ["lesson.updateMany"],
    },
  ],
  "library/items/create-item-set.ts": [
    {
      fields: [],
      verdict: "excluded",
      why: "sets start unvoiced, outside the text bank (see the set case below)",
      writes: ["itemSet.create"],
    },
  ],
  "library/items/create-items.ts": [
    { verdict: "marks", why: "bank items on a skill", writes: ["item.createManyAndReturn"] },
  ],
  "library/items/numeric-skills.ts": [
    {
      fields: ["isQuantitative"],
      verdict: "excluded",
      why: "exam format hints",
      writes: ["skill.update"],
    },
  ],
  "library/items/past-questions.ts": [
    { verdict: "marks", why: "bank items on the exam's skills", writes: ["item.createMany"] },
  ],
  "library/items/recalibrate-item-difficulty.ts": [
    {
      fields: ["difficulty", "discrimination"],
      verdict: "excluded",
      why: "item calibration",
      writes: ["raw:items"],
    },
  ],
  "library/language/_utils/save-language-lesson.ts": [
    {
      fields: ["contentStatus", "summary"],
      readElsewhere: { "plans/_utils/replan.ts": "a plan's posted summary" },
      verdict: "excluded",
      why: "publication (its content marker stays)",
      writes: ["lesson.updateMany"],
    },
  ],
  "library/language/alphabet/write-alphabet-lesson.ts": [
    { verdict: "marks", why: "publication renames the lesson", writes: ["lesson.updateMany"] },
  ],
  "library/lessons/_utils/save-lesson-content.ts": [
    {
      verdict: "marks",
      why: "bank items on the screens' skills",
      writes: ["item.create", "lesson.update", "lesson.updateMany"],
    },
  ],
  "library/lessons/create-library-lesson.ts": [
    { verdict: "marks", why: "a new lesson teaching skills", writes: ["lesson.create"] },
  ],
  "library/lessons/place-chapter-lessons.ts": [
    {
      verdict: "marks",
      why: "chapter membership and order",
      writes: ["chapterLesson.createMany", "chapterLesson.deleteMany"],
    },
  ],
  "library/listening/voice-listening-set.ts": [
    { verdict: "marks", why: "a voiced set joins the recordings", writes: ["itemSet.updateMany"] },
  ],
  "library/media/check-image-asset.ts": [
    { verdict: "marks", why: "removes bank items", writes: ["item.deleteMany"] },
    {
      fields: ["updatedAt"],
      verdict: "excluded",
      why: "cache freshness",
      writes: ["item.updateMany"],
    },
  ],
  "library/quality/later-reviews.ts": [
    {
      fields: ["contentStatus"],
      verdict: "excluded",
      why: "a pulled lesson keeps its content marker",
      writes: ["lesson.updateMany"],
    },
  ],
  "library/quality/published-lesson-check.ts": [
    { verdict: "marks", why: "a set-aside lesson leaves plans", writes: ["lesson.update"] },
  ],
  "library/review-flags/rewrite-flagged-drills.ts": [
    { verdict: "marks", why: "bank item content", writes: ["item.update"] },
  ],
  "library/skills/create-skill.ts": [
    {
      verdict: "covered",
      why: "the skill protocol locks the endpoints (`skill-input-write`)",
      writes: ["skill.create", "skillPrerequisite.createMany", "skillPrerequisite.deleteMany"],
    },
  ],
  "library/skills/merge-skill.ts": [
    {
      verdict: "covered",
      why: "the skill protocol locks the endpoints and aliases (`skill-input-write`)",
      writes: [
        "chapterSkill.createMany",
        "chapterSkill.deleteMany",
        "item.updateMany",
        "lessonSkill.createMany",
        "lessonSkill.deleteMany",
        "skill.updateMany",
        "skillPrerequisite.createMany",
        "skillPrerequisite.deleteMany",
      ],
    },
  ],
  "library/tools/find-or-create-setup-lesson.ts": [
    {
      fields: ["canDo"],
      verdict: "excluded",
      why: "the lesson's can-do line",
      writes: ["lesson.updateMany"],
    },
  ],
};

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory, { recursive: true, withFileTypes: true }).flatMap((entry) => {
    const path = join(entry.parentPath, entry.name);
    const file = relative(SOURCE_ROOT, path);

    return entry.isFile() &&
      file.endsWith(".ts") &&
      !file.endsWith(".test.ts") &&
      !file.includes("_test-utils")
      ? [file]
      : [];
  });
}

function scanWrites(): Map<string, Set<string>> {
  const writes = new Map<string, Set<string>>();

  for (const file of listSourceFiles(SOURCE_ROOT)) {
    const text = readFileSync(join(SOURCE_ROOT, file), "utf8");

    const found = [
      ...[...text.matchAll(CLIENT_WRITE)].map(([, model, operation]) => `${model}.${operation}`),
      ...[...text.matchAll(RAW_WRITE)].map(([, table]) => `raw:${table}`),
    ];

    if (found.length > 0) {
      writes.set(file, new Set(found));
    }
  }

  return writes;
}

const DATABASE_ROOT = fileURLToPath(new URL("../../../db/src", import.meta.url));

const PLAN_WRITE = new RegExp(
  String.raw`\b(?:prisma|tx|transaction)\.plan\.(?:${WRITE_OPERATIONS})\b|(?:INSERT INTO|UPDATE)\s+"?plans"?\b`,
  "u",
);

const PLAN_SOURCE_FIELD = /\b(?:sourceSkillIds|source_skill_ids)\b/u;

const PLAN_SOURCE_WRITERS: Record<string, string> = {
  "plans/_utils/write-plan.ts": "layouts register their sources",
};

function writesPlanSources(code: string): boolean {
  return PLAN_WRITE.test(code) && PLAN_SOURCE_FIELD.test(code);
}

function readCode(file: string): string {
  return readFileSync(join(SOURCE_ROOT, file), "utf8")
    .replaceAll(/\/\*[\s\S]*?\*\//gu, "")
    .replaceAll(/^\s*\/\/.*$/gmu, "");
}

function readLoaders(): Record<string, string> {
  return Object.fromEntries(LOADER_FILES.map((file) => [file, readCode(file)]));
}

describe("plan source writer coverage", () => {
  it("registers every write of a model plans read, and no write that's gone", () => {
    const scanned = scanWrites();

    const unregistered = [...scanned].flatMap(([file, writes]) =>
      [...writes].flatMap((write) =>
        (REGISTRY[file] ?? []).some((entry) => entry.writes.includes(write))
          ? []
          : [`${file} ${write}`],
      ),
    );

    const stale = Object.entries(REGISTRY).flatMap(([file, entries]) =>
      entries.flatMap((entry) =>
        entry.writes.flatMap((write) =>
          scanned.get(file)?.has(write) ? [] : [`${file} ${write}`],
        ),
      ),
    );

    expect(unregistered).toStrictEqual([]);
    expect(stale).toStrictEqual([]);
  });

  it("writes a plan's sources only where they're registered", () => {
    const writers = [
      ...listSourceFiles(SOURCE_ROOT),
      ...listSourceFiles(DATABASE_ROOT).filter(
        (file) => !file.includes("/generated/") && !file.includes("/prisma/"),
      ),
    ].filter((file) => writesPlanSources(readCode(file)));

    expect(writers.toSorted()).toStrictEqual(Object.keys(PLAN_SOURCE_WRITERS).toSorted());
  });

  it("recognizes every form a plan's sources can be written in", () => {
    const writes = [
      "await tx.plan.update({ data: { sourceSkillIds }, where: { id } })",
      "await tx.plan.updateManyAndReturn({ data: { sourceSkillIds: [] } })",
      "await prisma.plan.createManyAndReturn({ data: [{ sourceSkillIds }] })",
      'UPDATE "plans" SET source_skill_ids = $1',
      "INSERT INTO plans (source_skill_ids) VALUES ($1)",
    ];

    expect(writes.filter((write) => !writesPlanSources(write))).toStrictEqual([]);
  });

  it("excludes only writes of fields no loader reads", () => {
    const loaders = readLoaders();

    const read = Object.entries(REGISTRY).flatMap(([file, entries]) =>
      entries.flatMap((entry) =>
        entry.verdict === "excluded"
          ? entry.fields.flatMap((field) =>
              Object.entries(loaders).flatMap(([loader, text]) =>
                new RegExp(String.raw`\b${field}\b`, "u").test(text) &&
                entry.readElsewhere?.[loader] === undefined
                  ? [`${file} ${field} read in ${loader}`]
                  : [],
              ),
            )
          : [],
      ),
    );

    expect(read).toStrictEqual([]);
  });

  it("keeps new item sets unvoiced and out of the text bank", () => {
    const createSet = readCode("library/items/create-item-set.ts");
    const itemField = readCode("library/items/item-field.ts");

    expect(createSet).not.toMatch(/\bmediaAssetId\b/u);
    expect(itemField).toMatch(/setId: null/u);
  });

  it("keeps past options out of the loaders, behind the helpers that read them", () => {
    const loaders = Object.values(readLoaders()).join("\n");

    const helpers = [
      "pastOptions",
      "getExamFormats",
      "getExamChoiceFormat",
      "getMockFormatMix",
      "getFormatMixSource",
      "fitsExamOptions",
      "fitsExamChoice",
    ];

    expect(
      helpers.filter((name) => new RegExp(String.raw`\b${name}\b`, "u").test(loaders)),
    ).toStrictEqual([]);
  });
});

const SHARE_LOCKS = {
  exam_blueprints: (tx: TransactionClient, id: string) =>
    tx.$queryRaw`SELECT id FROM exam_blueprints WHERE id = ${id}::uuid FOR SHARE`,
  library_lessons: (tx: TransactionClient, id: string) =>
    tx.$queryRaw`SELECT id FROM library_lessons WHERE id = ${id}::uuid FOR SHARE`,
  skills: (tx: TransactionClient, id: string) =>
    tx.$queryRaw`SELECT id FROM skills WHERE id = ${id}::uuid FOR SHARE`,
};

type SourceRoot = { id: string; table: keyof typeof SHARE_LOCKS };

const WRITER_WAIT = { timeout: 10_000 };
const READER_TIMEOUT_MS = 20_000;

function holdShare({ id, table }: SourceRoot) {
  const held = Promise.withResolvers<number>();
  const released = Promise.withResolvers<null>();

  const done = prisma.$transaction(
    async (tx) => {
      await SHARE_LOCKS[table](tx, id);
      const [backend] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
      held.resolve(backend?.pid ?? 0);
      await released.promise;
    },
    { timeout: READER_TIMEOUT_MS },
  );

  done.catch((error: unknown) => held.reject(error));

  return { done, pid: held.promise, release: () => released.resolve(null) };
}

type WriterCase = {
  beforeRelease?: () => Promise<void>;
  expectWritten: () => Promise<void>;
  marks?: number;
  plan: Pick<Plan, "id" | "inputVersion">;
  root: SourceRoot;
  write: () => Promise<unknown>;
};

async function writeWhileRead({ beforeRelease, expectWritten, plan, root, write }: WriterCase) {
  const reader = holdShare(root);
  const readerPid = await reader.pid;
  const writing = write();
  const sourceLock = new RegExp(String.raw`FROM ${root.table}\b[\s\S]*FOR NO KEY UPDATE`, "u");

  try {
    await waitForBlockedStatement(readerPid, sourceLock);
    await beforeRelease?.();
  } finally {
    reader.release();
    await Promise.all([reader.done, writing]);
  }

  await expectWritten();

  return prisma.plan.findUniqueOrThrow({ select: { inputVersion: true }, where: { id: plan.id } });
}

function lessonRoot(id: string): SourceRoot {
  return { id, table: "library_lessons" };
}

function skillRoot(id: string): SourceRoot {
  return { id, table: "skills" };
}

function blueprintRoot(id: string): SourceRoot {
  return { id, table: "exam_blueprints" };
}

type GoalAttrs = Omit<Parameters<typeof goalFixture>[0], "userId">;
type PlanAttrs = Omit<Parameters<typeof planFixture>[0], "goalId">;

async function learnerPlan({ goal, plan }: { goal?: GoalAttrs; plan?: PlanAttrs } = {}) {
  const user = await userFixture();
  const created = await goalFixture({ ...goal, userId: user.id });
  return planFixture({ ...plan, goalId: created.id });
}

async function planOnLesson(lessonId: string) {
  const plan = await learnerPlan();
  await planItemFixture({ lessonId, planId: plan.id });
  return plan;
}

function examPlan(examBlueprintId: string) {
  return learnerPlan({ goal: { examBlueprintId, kind: "exam", language: "pt" } });
}

const DATED_PROVENANCE = {
  generatedAt: new Date(),
  model: "test/fixture",
  promptVersion: "test",
  runId: "plan-source-writers",
};

const SCOPE = { generalGoal: null, language: "en", ownerId: null, targetLanguage: null };

function checkScreen(skillId: string): LessonScreenToSave {
  return {
    content: {
      basis: null,
      options: [
        { id: "right", isCorrect: true, reason: "Two halves make a whole.", text: "2" },
        { id: "wrong", isCorrect: false, reason: "A whole contains two halves.", text: "3" },
      ],
      question: "How many halves make a whole?",
    },
    kind: "check",
    mathItem: null,
    provenance: generatedProvenance(),
    skillId,
  };
}

async function claimedLesson() {
  const workflowRunId = randomUUID();

  const [lesson, skill] = await Promise.all([
    libraryLessonFixture({ contentRunId: workflowRunId, contentStatus: "running" }),
    skillFixture(),
  ]);

  await lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id });
  return { lesson, skill, workflowRunId };
}

async function publishedLesson() {
  const [lesson, skill] = await Promise.all([
    libraryLessonFixture({ contentStatus: "completed" }),
    skillFixture(),
  ]);

  await Promise.all([
    libraryStepFixture({ lessonId: lesson.id, version: 1 }),
    lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id }),
  ]);

  return { lesson, skill };
}

function readLesson(lessonId: string) {
  return prisma.lesson.findUniqueOrThrow({
    omit: { spec: true, summary: true },
    where: { id: lessonId },
  });
}

async function publishLessonCase(): Promise<WriterCase> {
  const { lesson, skill, workflowRunId } = await claimedLesson();
  const plan = await planOnLesson(lesson.id);

  return {
    expectWritten: () =>
      expect(readLesson(lesson.id)).resolves.toMatchObject({ contentStatus: "completed" }),
    plan,
    root: lessonRoot(lesson.id),
    write: () =>
      saveLessonContent({
        language: "en",
        lessonId: lesson.id,
        screens: [checkScreen(skill.id)],
        summary: [],
        workflowRunId,
      }),
  };
}

async function mathItemCase(): Promise<WriterCase> {
  const { lesson, skill, workflowRunId } = await claimedLesson();
  const plan = await learnerPlan({ plan: { sourceSkillIds: [skill.id] } });
  const written = writtenTemperatureLesson().screens[3];
  const converted = written && toStepContent(written, { allowImage: false, language: "en" });

  if (!converted?.ok) {
    throw new Error("Expected a numeric screen");
  }

  return {
    expectWritten: () =>
      expect(prisma.item.count({ where: { skillId: skill.id } })).resolves.toBe(1),
    plan,
    root: skillRoot(skill.id),
    write: () =>
      saveLessonContent({
        language: "en",
        lessonId: lesson.id,
        screens: [{ ...checkScreen(skill.id), ...converted }],
        summary: [],
        workflowRunId,
      }),
  };
}

async function lessonVersionCase(): Promise<WriterCase> {
  const { lesson, skill } = await publishedLesson();
  const plan = await planOnLesson(lesson.id);

  return {
    expectWritten: () =>
      expect(prisma.step.count({ where: { lessonId: lesson.id, version: 2 } })).resolves.toBe(1),
    plan,
    root: lessonRoot(lesson.id),
    write: () =>
      saveLessonVersion({
        language: "en",
        lessonId: lesson.id,
        replaces: 1,
        screens: [checkScreen(skill.id)],
        summary: [],
      }),
  };
}

async function holdBackCase(): Promise<WriterCase> {
  const { lesson, workflowRunId } = await claimedLesson();
  const plan = await planOnLesson(lesson.id);

  return {
    expectWritten: () =>
      expect(readLesson(lesson.id)).resolves.toMatchObject({ contentStatus: "failed" }),
    plan,
    root: lessonRoot(lesson.id),
    write: () =>
      holdBackLessonDraft({
        lessonId: lesson.id,
        model: "test/fixture",
        problems: [{ problem: "The answer is incorrect.", screen: 0 }],
        workflowRunId,
      }),
  };
}

async function setAsideCase(): Promise<WriterCase> {
  const { lesson } = await publishedLesson();
  const plan = await planOnLesson(lesson.id);

  return {
    expectWritten: () =>
      expect(readLesson(lesson.id)).resolves.toMatchObject({ setAsideAt: expect.any(Date) }),
    plan,
    root: lessonRoot(lesson.id),
    write: () => setAsidePublishedLesson({ lessonId: lesson.id, version: 1 }),
  };
}

async function newLessonCase(): Promise<WriterCase> {
  const skill = await skillFixture();
  const plan = await learnerPlan({ plan: { sourceSkillIds: [skill.id] } });
  const identityKey = `test-lesson-${randomUUID()}`;

  return {
    expectWritten: () =>
      expect(
        prisma.lessonSkill.count({ where: { lesson: { identityKey }, skillId: skill.id } }),
      ).resolves.toBe(1),
    plan,
    root: skillRoot(skill.id),
    write: () =>
      createLibraryLesson({
        description: "Work out a price after a markdown",
        estimatedMinutes: 3,
        homeChapterId: null,
        identityKey,
        language: "en",
        level: "beginner",
        ownerId: null,
        provenance: generatedProvenance(),
        skillIds: [skill.id],
        targetLanguage: null,
        title: "Markdowns",
      }),
  };
}

async function itemsCase(): Promise<WriterCase> {
  const skill = await skillFixture();
  const plan = await learnerPlan({ plan: { sourceSkillIds: [skill.id] } });

  return {
    expectWritten: () =>
      expect(prisma.item.count({ where: { skillId: skill.id } })).resolves.toBe(1),
    plan,
    root: skillRoot(skill.id),
    write: () =>
      createItems({
        format: "multipleChoice",
        items: [generatedMultipleChoice()],
        language: "en",
        provenance: generatedProvenance(),
        skillId: skill.id,
      }),
  };
}

const PAPER_TEXT = `QUESTÃO 91
Um celular custava R$ 1.000,00 e teve dois aumentos seguidos de 10%.
Qual é o novo preço do celular?
A R$ 1.200,00
B R$ 1.210,00
C R$ 1.100,00
D R$ 1.020,00
E R$ 1.201,00`;

function copiedQuestion(): PastQuestion {
  const options = ["R$ 1.200,00", "R$ 1.210,00", "R$ 1.100,00", "R$ 1.020,00", "R$ 1.201,00"];

  return {
    citation: "Enem 2023, 2º dia, questão 91",
    item: {
      context: "Um celular custava R$ 1.000,00 e teve dois aumentos seguidos de 10%.",
      difficulty: "easy",
      fixedOrder: false,
      format: "multipleChoice",
      image: null,
      options: options.map((text) => ({
        isCorrect: text === "R$ 1.210,00",
        misconception: text === "R$ 1.210,00" ? null : "Soma os aumentos",
        reason: "Motivo.",
        text,
      })),
      question: "Qual é o novo preço do celular?",
      visual: null,
    },
    number: "91",
    skill: 1,
  };
}

async function pastQuestionsCase(): Promise<WriterCase> {
  const [skill, paper, blueprint] = await Promise.all([
    skillFixture({ language: "pt", name: "Aumentos percentuais sucessivos" }),
    sourceFixture({ extractedText: PAPER_TEXT, language: "pt", title: "Enem 2023, caderno azul" }),
    examBlueprintFixture({ language: "pt", name: "Enem" }),
  ]);

  const plan = await learnerPlan({ plan: { sourceSkillIds: [skill.id] } });

  return {
    expectWritten: () =>
      expect(
        prisma.item.count({
          where: { examBlueprintId: blueprint.id, skillId: skill.id, sourceId: paper.id },
        }),
      ).resolves.toBe(1),
    plan,
    root: skillRoot(skill.id),
    write: () =>
      savePastQuestions({
        paperText: PAPER_TEXT,
        provenance: generatedProvenance(),
        questions: [copiedQuestion()],
        target: {
          exam: "Enem",
          examBlueprintId: blueprint.id,
          format: "multipleChoice",
          language: "pt",
          optionCount: 5,
          paper: { id: paper.id, title: paper.title },
          skills: [{ description: skill.description, id: skill.id, name: skill.name }],
        },
      }),
  };
}

async function placeLessonsCase(): Promise<WriterCase> {
  const [chapter, lesson] = await Promise.all([libraryChapterFixture(), libraryLessonFixture()]);
  const plan = await planOnLesson(lesson.id);

  return {
    expectWritten: () =>
      expect(
        prisma.chapterLesson.findMany({
          select: { lessonId: true },
          where: { chapterId: chapter.id },
        }),
      ).resolves.toStrictEqual([{ lessonId: lesson.id }]),
    plan,
    root: lessonRoot(lesson.id),
    write: () => placeChapterLessons({ chapterId: chapter.id, lessonIds: [lesson.id] }),
  };
}

async function lessonSpecsCase(): Promise<WriterCase> {
  const workflowRunId = randomUUID();
  const chapter = await libraryChapterFixture();

  const lesson = await libraryLessonFixture({
    homeChapterId: chapter.id,
    specRunId: workflowRunId,
    specStatus: "running",
  });

  await chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id, position: 0 });
  const plan = await planOnLesson(lesson.id);
  const word = uniqueWord();
  const spec = temperatureSpec();

  const split = {
    ...spec,
    skills: spec.skills.map((skill) => ({ ...skill, name: `${skill.name} ${word}` })),
    title: `Temperatures, part two ${word}`,
  };

  mockSearchTerms([uniqueWord()]);
  mockDecision(null);

  return {
    expectWritten: async () => {
      await expect(readLesson(lesson.id)).resolves.toMatchObject({ specStatus: "completed" });

      await expect(prisma.chapterLesson.count({ where: { chapterId: chapter.id } })).resolves.toBe(
        2,
      );
    },
    marks: 2,
    plan,
    root: lessonRoot(lesson.id),
    write: () =>
      saveLessonSpecs({
        homeChapterId: chapter.id,
        lessonId: lesson.id,
        provenance: DATED_PROVENANCE,
        scope: SCOPE,
        specs: [spec, split],
        workflowRunId,
      }),
  };
}

const TOOLS = [{ essential: true, name: "Spreadsheet (Google Sheets or Excel)" }];

async function outlineCase(): Promise<WriterCase> {
  const [course, tag] = await Promise.all([courseFixture(), skillFixture()]);
  const plan = await learnerPlan({ plan: { sourceSkillIds: [tag.id] } });
  const title = `Budgets ${uniqueWord()}`;

  mockSearchTerms([uniqueWord()]);
  mockDecision(null);

  const placement = () =>
    prisma.courseChapter.findFirst({ include: { chapter: true }, where: { courseId: course.id } });

  return {
    beforeRelease: () => vi.waitFor(() => expect(placement()).resolves.not.toBeNull(), WRITER_WAIT),
    expectWritten: async () => {
      const placed = await placement();
      expect(placed?.chapter.tools).toStrictEqual(TOOLS);

      await expect(
        prisma.chapterSkill.count({ where: { chapterId: placed?.chapterId, skillId: tag.id } }),
      ).resolves.toBe(1);
    },
    marks: 3,
    plan,
    root: skillRoot(tag.id),
    write: () =>
      saveOutlineChapter({
        chapter: {
          description: `What ${title} covers`,
          lessons: [],
          objectives: ["Build a monthly budget"],
          skillKeys: ["budget"],
          title,
          tools: TOOLS,
        },
        courseId: course.id,
        goalSkills: [
          { description: "Build a monthly budget", id: tag.id, key: "budget", name: tag.name },
        ],
        level: "beginner",
        position: 0,
        provenance: DATED_PROVENANCE,
        scope: SCOPE,
        workflowRunId: randomUUID(),
      }),
  };
}

async function attachCase(): Promise<WriterCase> {
  const [course, chapter, lesson] = await Promise.all([
    courseFixture(),
    libraryChapterFixture(),
    libraryLessonFixture(),
  ]);

  await chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id });
  const plan = await learnerPlan({ goal: { primaryCourseId: course.id } });

  return {
    expectWritten: () =>
      expect(
        prisma.courseChapter.count({ where: { chapterId: chapter.id, courseId: course.id } }),
      ).resolves.toBe(1),
    plan,
    root: lessonRoot(lesson.id),
    write: () =>
      attachChapterToCourse({
        chapterId: chapter.id,
        courseId: course.id,
        level: "beginner",
        position: 0,
      }),
  };
}

async function earlyOutlineCase(): Promise<WriterCase> {
  const [course, chapter, lesson] = await Promise.all([
    courseFixture(),
    libraryChapterFixture({ outlineStatus: "failed" }),
    libraryLessonFixture(),
  ]);

  await Promise.all([
    courseChapterFixture({
      chapterId: chapter.id,
      courseId: course.id,
      level: "beginner",
      position: 0,
    }),
    chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id }),
  ]);

  const plan = await learnerPlan({ goal: { primaryCourseId: course.id } });

  return {
    expectWritten: () =>
      expect(prisma.courseChapter.count({ where: { courseId: course.id } })).resolves.toBe(0),
    plan,
    root: lessonRoot(lesson.id),
    write: () =>
      findEarlyOutlineChapter({ courseId: course.id, level: "beginner", nextPosition: 0 }),
  };
}

async function continuationsCase(): Promise<WriterCase> {
  const [course, first, second, continuation, lesson] = await Promise.all([
    courseFixture(),
    libraryChapterFixture(),
    libraryChapterFixture(),
    libraryChapterFixture(),
    libraryLessonFixture(),
  ]);

  await Promise.all([
    ...[first, second, continuation].map((chapter, position) =>
      courseChapterFixture({ chapterId: chapter.id, courseId: course.id, position }),
    ),
    chapterLessonFixture({ chapterId: second.id, lessonId: lesson.id }),
  ]);

  const plan = await planOnLesson(lesson.id);

  return {
    expectWritten: () =>
      expect(
        prisma.courseChapter.findMany({
          orderBy: { position: "asc" },
          select: { chapterId: true },
          where: { courseId: course.id },
        }),
      ).resolves.toStrictEqual([first, continuation, second].map(({ id }) => ({ chapterId: id }))),
    plan,
    root: lessonRoot(lesson.id),
    write: () =>
      placeContinuations({
        courseId: course.id,
        level: "beginner",
        moves: [{ afterChapterId: first.id, chapterId: continuation.id }],
      }),
  };
}

async function drillsCase(): Promise<WriterCase> {
  const [skill, law] = await Promise.all([
    skillFixture(),
    sourceFixture({ language: "pt", title: "Lei nº 8.112, de 11 de dezembro de 1990" }),
  ]);

  const drill = await itemFixture({
    format: "trueFalse",
    language: "pt",
    skillId: skill.id,
    sourceCitation: "Lei nº 8.112, Art. 13",
    sourceId: law.id,
  });

  const plan = await learnerPlan({ plan: { sourceSkillIds: [skill.id] } });
  const provenance = generatedProvenance();

  return {
    expectWritten: () =>
      expect(prisma.item.findUniqueOrThrow({ where: { id: drill.id } })).resolves.toMatchObject({
        runId: `${provenance.runId}:0`,
      }),
    plan,
    root: skillRoot(skill.id),
    write: () =>
      replaceFlaggedDrills({
        drills: [
          {
            context: null,
            difficulty: "medium",
            format: "trueFalse",
            image: null,
            isTrue: true,
            misconception: null,
            reason: "O art. 13 fixa trinta dias para a posse.",
            reference: "Art. 13",
            statement: "A posse ocorrerá no prazo de trinta dias contados da publicação do ato.",
            visual: null,
          },
        ],
        group: {
          article: {
            reference: "Art. 13",
            text: "Art. 13. A posse ocorrerá no prazo de trinta dias contados da publicação do ato de provimento.",
          },
          citation: "Lei nº 8.112, Art. 13",
          format: "trueFalse",
          itemIds: [drill.id],
          language: "pt",
          law: { shortName: "Lei nº 8.112", title: law.title, url: law.url },
          sourceId: law.id,
          style: "cebraspe",
        },
        optionCount: 4,
        provenance,
      }),
  };
}

async function pictureCase(): Promise<WriterCase> {
  const [asset, skill, image] = await Promise.all([
    mediaAssetFixture({ scene: testScene({ focalObject: `a ${randomUUID()} map` }) }),
    skillFixture(),
    drawTestImage(),
  ]);

  const question = await itemFixture({ mediaAssetId: asset.id, skillId: skill.id });
  const plan = await learnerPlan({ plan: { sourceSkillIds: [skill.id] } });

  serveStoredFile({ data: new Uint8Array(image), mediaType: "image/webp" });
  storeBlobUploads();
  resetImageModels();
  mockImageChecks([false, false, false]);
  mockDrawnImages([image, image]);

  return {
    expectWritten: () =>
      expect(prisma.item.findUnique({ where: { id: question.id } })).resolves.toBeNull(),
    plan,
    root: skillRoot(skill.id),
    write: () => checkImageAsset({ assetId: asset.id }),
  };
}

async function listeningCase(): Promise<WriterCase> {
  const [set, skill] = await Promise.all([listeningSetFixture(), skillFixture()]);
  await itemFixture({ setId: set.id, skillId: skill.id });
  const plan = await learnerPlan({ plan: { sourceSkillIds: [skill.id] } });

  storeBlobUploads();

  vi.mocked(voiceListeningScript).mockResolvedValue({
    data: {
      audio: new Uint8Array([1, 2, 3]),
      durationMs: 48_000,
      format: "mp3",
      provenance: {
        generatedAt: new Date().toISOString(),
        latencyMs: 9000,
        model: "google/gemini-3.8-flash-lite-tts",
        promptVersion: "test-listening-voice",
        provider: "vertex",
        requestedModel: "google/gemini-3.8-flash-lite-tts",
        runId: randomUUID(),
        usage: { audioSeconds: 48 },
      },
    },
    error: null,
  });

  return {
    expectWritten: () =>
      expect(prisma.itemSet.findUniqueOrThrow({ where: { id: set.id } })).resolves.toMatchObject({
        mediaAssetId: expect.any(String),
      }),
    plan,
    root: skillRoot(skill.id),
    write: () => voiceListeningSet({ setId: set.id }),
  };
}

async function graphRepairCase(): Promise<WriterCase> {
  const [blueprint, course, reading, math] = await Promise.all([
    choiceBlueprintFixture(),
    courseFixture(),
    skillFixture({ language: "pt", name: `Ler textos ${uniqueWord()}` }),
    skillFixture({ language: "pt", name: `Resolver problemas ${uniqueWord()}` }),
  ]);

  const graph = {
    phases: [{ milestone: "Ler e calcular", name: "Base" }],
    skills: [
      { area: LANGUAGES, skill: reading },
      { area: MATH, skill: math },
    ].map(({ area, skill }) => ({
      area,
      courseIds: [course.id],
      lessons: 3,
      name: skill.name,
      phase: 0,
      skillId: skill.id,
      topics: [`Leitura: ${area}`],
      weight: 4,
    })),
  };

  await prisma.examSkillGraph.create({
    data: {
      examBlueprintId: blueprint.id,
      generatedAt: new Date(),
      graph,
      model: "test/fixture",
      promptVersion: "test",
      runId: randomUUID(),
    },
  });

  const plan = await examPlan(blueprint.id);
  const word = uniqueWord();

  mockSearchTerms([uniqueWord()]);
  mockDecision(null);

  vi.mocked(checkCoverage).mockResolvedValue({
    data: {
      examWeights: [],
      missing: [ENGLISH, SPANISH].map((area) => ({
        area,
        description: `Read short texts in ${area}`,
        examWeight: 2,
        name: `Ler textos em ${area} ${word}`,
        prerequisites: [reading.id],
        topics: [`Leitura: ${area}`],
      })),
      placements: [],
    },
    provenance: generatedProvenance(),
  } as unknown as Awaited<ReturnType<typeof checkCoverage>>);

  return {
    expectWritten: async () => {
      const stored = await prisma.examSkillGraph.findUniqueOrThrow({
        where: { examBlueprintId: blueprint.id },
      });

      expect(parsePlanGraph(stored.graph).skills).toHaveLength(4);
    },
    plan,
    root: blueprintRoot(blueprint.id),
    write: () => addMissingExamGraphSkills(blueprint.id),
  };
}

async function graphResetCase(): Promise<WriterCase> {
  const [blueprint, admin] = await Promise.all([
    examBlueprintFixture(),
    userFixture({ role: "admin" }),
  ]);

  await prisma.examSkillGraph.create({
    data: {
      examBlueprintId: blueprint.id,
      generatedAt: new Date(),
      graph: { phases: [], skills: [] },
      model: "test/fixture",
      promptVersion: "test",
      runId: randomUUID(),
    },
  });

  const plan = await examPlan(blueprint.id);

  vi.mocked(getSession).mockResolvedValue(
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The command reads only trusted identity and role.
    { user: { id: admin.id, role: "admin" } } as Awaited<ReturnType<typeof getSession>>,
  );

  return {
    expectWritten: () =>
      expect(
        prisma.examSkillGraph.findUnique({ where: { examBlueprintId: blueprint.id } }),
      ).resolves.toBeNull(),
    plan,
    root: blueprintRoot(blueprint.id),
    write: () => resetExamSkillGraphForAdmin({ examBlueprintId: blueprint.id }),
  };
}

async function sharedGraphCase(): Promise<WriterCase> {
  const [blueprint, course, skill] = await Promise.all([
    examBlueprintFixture({ language: "pt" }),
    courseFixture({ visibility: "public" }),
    skillFixture(),
  ]);

  const plan = await examPlan(blueprint.id);
  const inputs = await loadGoalCurriculumInputs(plan.goalId);
  const provenance = { ...DATED_PROVENANCE, runId: randomUUID() };

  if (!inputs) {
    throw new Error("The goal's curriculum inputs couldn't be read.");
  }

  return {
    expectWritten: () =>
      expect(
        prisma.examSkillGraph.findUnique({ where: { examBlueprintId: blueprint.id } }),
      ).resolves.toMatchObject({ runId: provenance.runId }),
    plan,
    root: blueprintRoot(blueprint.id),
    write: () =>
      saveExamSkillGraph({
        graph: {
          phases: [{ milestone: "Explain the basics", name: "Foundations" }],
          skills: [
            {
              area: "Immunology",
              courseIds: [course.id],
              lessons: 3,
              name: skill.name,
              phase: 0,
              skillId: skill.id,
              weight: 3,
            },
          ],
        },
        inputs,
        provenance,
        scope: { ...SCOPE, generalGoal: "Immunology board exam", language: "pt" },
      }),
  };
}

async function topicFrequencyCase(): Promise<WriterCase> {
  const blueprint = await examBlueprintFixture();
  const plan = await examPlan(blueprint.id);

  return {
    expectWritten: () =>
      expect(
        prisma.examBlueprint.findUniqueOrThrow({ where: { id: blueprint.id } }),
      ).resolves.toMatchObject({ structure: { pastTopicFrequency: { subjects: [] } } }),
    plan,
    root: blueprintRoot(blueprint.id),
    write: () => recordTopicFrequency({ examBlueprintId: blueprint.id, subjects: [] }),
  };
}

const CITATION = { passage: "Matemática: 45 questões", sourceId: "notice" };
const MATH_SUBJECT = "Matemática";

async function subjectQuestionsCase(): Promise<WriterCase> {
  const blueprint = await examBlueprintFixture({
    structure: examStructureSchema.parse({
      formats: [],
      mock: null,
      rules: [],
      subjects: [
        { citation: CITATION, name: MATH_SUBJECT, questions: null, topics: [], weight: null },
      ],
    }),
  });

  const plan = await examPlan(blueprint.id);

  return {
    expectWritten: () =>
      expect(
        prisma.examBlueprint.findUniqueOrThrow({ where: { id: blueprint.id } }),
      ).resolves.toMatchObject({
        structure: { pastQuestions: { subjects: [{ name: MATH_SUBJECT, questions: 45 }] } },
      }),
    plan,
    root: blueprintRoot(blueprint.id),
    write: () =>
      recordSubjectQuestions({
        edition: "2025",
        examBlueprintId: blueprint.id,
        questions: [45],
        source: { title: null, url: "https://example.test/questions-2025" },
        subjects: [MATH_SUBJECT],
      }),
  };
}

const HANGUL = {
  canDo: "Read and say four Hangul vowels and consonants",
  description: "Read the letters every Korean syllable block is built from.",
  intro: [{ text: "Letters stack into one block per syllable.", title: "Blocks, not a line" }],
  letters: [
    ["ㅏ", "a", "아"],
    ["ㅓ", "eo", "어"],
    ["ㄱ", "g/k", "가"],
    ["ㄴ", "n", "나"],
  ].map(([symbol = "", readingAid = "", audioText = ""]) => ({
    audioText,
    forms: [],
    pronunciation: `Like ${readingAid}.`,
    readingAid,
    symbol,
  })),
  script: "Hangul",
  summary: ["Each block is one syllable."],
  title: "Your first Hangul",
};

async function alphabetCase(): Promise<WriterCase> {
  const workflowRunId = randomUUID();

  const lesson = await libraryLessonFixture({
    contentRunId: workflowRunId,
    contentStatus: "running",
    identityKey: getAlphabetIdentityKey("ko-KR"),
    language: `x${randomUUID().slice(0, 8)}`,
    targetLanguage: "ko-KR",
  });

  const plan = await planOnLesson(lesson.id);

  vi.mocked(generateAlphabetLesson).mockResolvedValue({
    data: HANGUL,
    provenance: {
      generatedAt: new Date().toISOString(),
      latencyMs: 1,
      model: "openai/gpt-6-luna",
      promptVersion: "test-prompt",
      provider: "openai",
      requestedModel: "openai/gpt-6-luna",
      runId: randomUUID(),
      usage: {},
    },
    systemPrompt: "",
    usage: {} as never,
    userPrompt: "",
  });

  vi.mocked(generateLanguageAudio).mockResolvedValue({
    data: null,
    error: new Error("TTS failed"),
  });

  return {
    expectWritten: () =>
      expect(readLesson(lesson.id)).resolves.toMatchObject({
        contentStatus: "completed",
        title: HANGUL.title,
      }),
    plan,
    root: lessonRoot(lesson.id),
    write: () =>
      writeAlphabetLesson({
        learnerLanguage: lesson.language,
        targetLanguage: "ko-KR",
        workflowRunId,
      }),
  };
}

const WRITER_CASES: Record<string, Record<string, () => Promise<WriterCase>>> = {
  "library/chapters/attach-course-chapter.ts": { attachChapterToCourse: attachCase },
  "library/curriculum/early-outline-chapter.ts": { findEarlyOutlineChapter: earlyOutlineCase },
  "library/curriculum/exam-graph-repair.ts": { addMissingExamGraphSkills: graphRepairCase },
  "library/curriculum/exam-skill-graph-reset.ts": { resetExamSkillGraphForAdmin: graphResetCase },
  "library/curriculum/place-continuations.ts": { placeContinuations: continuationsCase },
  "library/curriculum/reusable-curriculum.ts": { saveExamSkillGraph: sharedGraphCase },
  "library/curriculum/save-lesson-specs.ts": { saveLessonSpecs: lessonSpecsCase },
  "library/curriculum/save-outline-chapter.ts": { saveOutlineChapter: outlineCase },
  "library/exams/record-subject-questions.ts": { recordSubjectQuestions: subjectQuestionsCase },
  "library/exams/record-topic-frequency.ts": { recordTopicFrequency: topicFrequencyCase },
  "library/generation/hold-back-lesson.ts": { holdBackLessonDraft: holdBackCase },
  "library/items/create-items.ts": { createItems: itemsCase },
  "library/items/past-questions.ts": { savePastQuestions: pastQuestionsCase },
  "library/language/alphabet/write-alphabet-lesson.ts": { writeAlphabetLesson: alphabetCase },
  "library/lessons/_utils/save-lesson-content.ts": {
    "saveLessonContent (a math item's skill)": mathItemCase,
    "saveLessonContent (the lesson)": publishLessonCase,
    "saveLessonVersion (the lesson)": lessonVersionCase,
  },
  "library/lessons/create-library-lesson.ts": { createLibraryLesson: newLessonCase },
  "library/lessons/place-chapter-lessons.ts": { placeChapterLessons: placeLessonsCase },
  "library/listening/voice-listening-set.ts": { voiceListeningSet: listeningCase },
  "library/media/check-image-asset.ts": { checkImageAsset: pictureCase },
  "library/quality/published-lesson-check.ts": { setAsidePublishedLesson: setAsideCase },
  "library/review-flags/rewrite-flagged-drills.ts": { replaceFlaggedDrills: drillsCase },
};

const CASES = Object.entries(WRITER_CASES).flatMap(([file, cases]) =>
  Object.entries(cases).map(([name, build]) => ({ build, file, name })),
);

describe("plan source writers lock what plans read and mark them", () => {
  it("has a case for every writer the registry says marks", () => {
    const marking = Object.entries(REGISTRY).flatMap(([file, entries]) =>
      entries.some((entry) => entry.verdict === "marks") ? [file] : [],
    );

    expect(Object.keys(WRITER_CASES).toSorted()).toStrictEqual(marking.toSorted());
  });

  it.each(CASES)("$name ($file)", async ({ build }) => {
    const writer = await build();

    await expect(writeWhileRead(writer)).resolves.toStrictEqual({
      inputVersion: writer.plan.inputVersion + (writer.marks ?? 1),
    });
  });
});

describe(resolvePlanInputDependents, () => {
  it("finds a plan that registered only the tag of a lesson's chapter, from the lesson or the chapter", async () => {
    const [chapter, lesson, taught, tag] = await Promise.all([
      libraryChapterFixture(),
      libraryLessonFixture(),
      skillFixture(),
      skillFixture(),
    ]);

    await Promise.all([
      chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id }),
      lessonSkillFixture({ lessonId: lesson.id, skillId: taught.id }),
      chapterSkillFixture({ chapterId: chapter.id, skillId: tag.id }),
    ]);

    const plan = await learnerPlan({ plan: { sourceSkillIds: [tag.id] } });

    await expect(
      resolvePlanInputDependents(prisma, { lessonIds: [lesson.id] }),
    ).resolves.toStrictEqual([plan.id]);

    await expect(
      resolvePlanInputDependents(prisma, { chapterIds: [chapter.id] }),
    ).resolves.toStrictEqual([plan.id]);
  });

  it("reads only skills and plans for a write of skills alone", async () => {
    const skill = await skillFixture();
    const plan = await learnerPlan({ plan: { sourceSkillIds: [skill.id] } });

    const counts = await countDatabaseStatements(() =>
      resolvePlanInputDependents(prisma, { skillIds: [skill.id] }),
    );

    expect(counts.result).toStrictEqual([plan.id]);
    assertReadBudget(counts, 2);
  });
});

const UNSTATED_OPTIONS = examStructureSchema.parse({
  formats: [
    { citation: CITATION, description: "Múltipla escolha", kind: "multipleChoice", options: null },
  ],
  mock: {
    adaptive: false,
    citations: [],
    order: null,
    scoring: { description: "Each correct answer earns one point", method: "raw" },
    sections: [{ day: 1, kind: "objective", minutes: 120, name: MATH_SUBJECT, questions: 45 }],
    timeLimitMinutes: 120,
    totalQuestions: 45,
  },
  rules: [],
  subjects: [
    {
      citation: CITATION,
      name: MATH_SUBJECT,
      questions: 45,
      topics: ["Porcentagem"],
      weight: null,
    },
  ],
});

describe(recordChoiceOptions, () => {
  it("leaves what a plan of the exam plans from as it was", async () => {
    const now = new Date();

    const [user, skill, blueprint] = await Promise.all([
      userFixture(),
      skillFixture({ language: "pt" }),
      examBlueprintFixture({ language: "pt", structure: UNSTATED_OPTIONS }),
    ]);

    const goal = await goalFixture({
      examBlueprintId: blueprint.id,
      kind: "exam",
      language: "pt",
      targetDate: new Date(now.getTime() + 90 * MS_PER_DAY),
      timezone: "UTC",
      userId: user.id,
    });

    await planFixture({
      goalId: goal.id,
      graph: {
        phases: [{ milestone: null, name: "Foundations" }],
        skills: [
          {
            area: MATH_SUBJECT,
            lessons: 2,
            name: skill.name,
            phase: 0,
            skillId: skill.id,
            topics: ["Porcentagem"],
          },
        ],
      },
      phases: [{ name: "Foundations" }],
      settings: { pace: { factor: 1, source: "typical" } },
    });

    const getInputsKey = async () => {
      const context = await loadPlanContext({ goal, now });

      if (!context) {
        throw new Error("Expected the goal's plan");
      }

      const { inputsKey } = await computePlan({ context, mode: "forced", now });
      return inputsKey;
    };

    const before = await getInputsKey();

    await recordChoiceOptions({
      edition: "2025",
      examBlueprintId: blueprint.id,
      now,
      options: 4,
      source: { title: "Prova 2025", url: "https://example.test/prova-2025.pdf" },
    });

    const stored = await prisma.examBlueprint.findUniqueOrThrow({ where: { id: blueprint.id } });

    expect(getExamFormats(examStructureSchema.parse(stored.structure))).toMatchObject([
      { kind: "multipleChoice", options: 4 },
    ]);

    await expect(getInputsKey()).resolves.toBe(before);
  });
});

function holdPlan(planId: string) {
  const held = Promise.withResolvers<number>();
  const released = Promise.withResolvers<null>();

  const done = prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM plans WHERE id = ${planId}::uuid FOR UPDATE`;
      const [backend] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
      held.resolve(backend?.pid ?? 0);
      await released.promise;
    },
    { timeout: READER_TIMEOUT_MS },
  );

  done.catch((error: unknown) => held.reject(error));

  return { done, pid: held.promise, release: () => released.resolve(null) };
}

describe("a publisher that loses its claim while it waits for a plan", () => {
  it("marks nothing: the alphabet lesson's plan and its learner keep their versions", async () => {
    const { plan, root, write } = await alphabetCase();
    const holder = holdPlan(plan.id);
    const holderPid = await holder.pid;
    const writing = write();

    try {
      await waitForBlockedStatement(holderPid, /FOR UPDATE OF plan/u);

      await prisma.lesson.update({ data: { contentStatus: "failed" }, where: { id: root.id } });
    } finally {
      holder.release();
      await Promise.all([holder.done, writing]);
    }

    await expect(writing).resolves.toStrictEqual({ lessonId: root.id, status: "running" });

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toMatchObject({
      inputVersion: plan.inputVersion,
    });
  });
});
