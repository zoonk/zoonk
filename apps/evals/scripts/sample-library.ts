import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { parseArgs } from "node:util";
import { type TestCase } from "../src/lib/types";
import { isoDate, staffList, wholeNumber } from "./_utils/staff";

type Candidate = { id: string; language: string; targetLanguage: string | null };
type Provenance = { model: string; promptVersion: string; runId: string };

type Lesson = Candidate &
  Provenance & {
    canDo: string | null;
    description: string;
    homeChapterId: string | null;
    level: string;
    spec: Record<string, unknown> | null;
    summary: unknown;
    title: string;
    updatedAt: string;
  };

type FirstStep = Provenance & { id: string; kind: string; lessonId: string; version: number };

type Step = FirstStep & {
  content: unknown;
  mediaAssetId: string | null;
  position: number;
  sentenceId: string | null;
  sourcePage: number | null;
  wordId: string | null;
};

type Chapter = {
  description: string;
  homeCourseId: string | null;
  objectives: string[];
  title: string;
};

type Course = { country: string | null; title: string };
type LinkedText = { position: number; wordId?: string; sentenceId?: string };
type Word = { id: string; romanization: string | null; word: string };
type Sentence = { id: string; romanization: string | null; sentence: string };

const { values } = parseArgs({
  options: {
    before: { type: "string" },
    limit: { default: "12", type: "string" },
    out: { default: "datasets/library-sample.json", type: "string" },
    pool: { default: "60", type: "string" },
    seed: { type: "string" },
  },
});

const limit = wholeNumber(values.limit, 100, "limit");
const pool = wholeNumber(values.pool, 100, "pool");
const seed = values.seed ?? randomUUID();
const before = isoDate(values.before ?? new Date().toISOString());
const shared = ["ownerId isNull", "visibility eq public"];
const published = [...shared, "contentStatus eq completed", "setAsideAt isNull"];
const current = ["retiredAt isNull", "staged eq false"];
const provenanceFields = "model,promptVersion,runId";
const stepFields = `id,kind,lessonId,version,${provenanceFields}`;

function rank(value: string) {
  return createHash("sha256")
    .update(JSON.stringify([seed, value]))
    .digest("hex");
}

function sampleOrder(candidates: Candidate[], firstSteps: FirstStep[]) {
  const lessons = new Map(candidates.map((lesson) => [lesson.id, lesson]));
  const groups = new Map<string, FirstStep[]>();

  for (const step of firstSteps.toSorted((a, b) => rank(a.id).localeCompare(rank(b.id)))) {
    const lesson = lessons.get(step.lessonId);

    const key = JSON.stringify([
      lesson?.language,
      lesson?.targetLanguage,
      step.model,
      step.kind === "challenge",
    ]);

    const group = groups.get(key) ?? [];
    group.push(step);
    groups.set(key, group);
  }

  return [...groups.entries()]
    .toSorted(([a], [b]) => rank(a).localeCompare(rank(b)))
    .flatMap(([, steps], group) => steps.map((step, position) => ({ group, position, step })))
    .toSorted((a, b) => a.position - b.position || a.group - b.group)
    .map(({ step }) => step);
}

function one<Row>(model: string, fields: string, where: string[]): Row | undefined {
  return staffList<Row>(model, { fields, limit: 1, where }).records[0];
}

function getAuthoringContext(lesson: Lesson) {
  const chapter =
    lesson.homeChapterId &&
    one<Chapter>("Chapter", "description,homeCourseId,objectives,title", [
      `id eq ${lesson.homeChapterId}`,
      ...shared,
    ]);

  const course =
    chapter &&
    chapter.homeCourseId &&
    one<Course>("Course", "country,title", [
      `id eq ${chapter.homeCourseId}`,
      "userId isNull",
      "visibility eq public",
      "isPublished eq true",
    ]);

  const chapterTitle = chapter ? chapter.title : lesson.title;

  return {
    chapterDescription: chapter ? chapter.description : null,
    chapterTitle,
    country: course ? course.country : null,
    courseTitle: course ? course.title : chapterTitle,
    unitCanDos: chapter ? chapter.objectives : [],
  };
}

function getInput(lesson: Lesson, steps: Step[]) {
  if (steps.some((step) => step.kind === "alphabet")) {
    return {
      completeness: "recovered",
      kind: "alphabet",
      userInput: { learnerLanguage: lesson.language, targetLanguage: lesson.targetLanguage },
    };
  }

  const { chapterDescription, chapterTitle, country, courseTitle, unitCanDos } =
    getAuthoringContext(lesson);

  const context = {
    chapterTitle,
    country,
    courseTitle,
    language: lesson.language,
    level: lesson.level,
  };

  if (steps.some((step) => step.kind === "challenge")) {
    return {
      completeness: lesson.spec ? "partial" : "missingSpec",
      kind: "challenge",
      userInput: {
        ...context,
        chapterDescription,
        skills: lesson.spec?.skills,
        variant: lesson.spec?.variant,
      },
    };
  }

  if (lesson.targetLanguage) {
    return {
      completeness: "partial",
      kind: "language",
      userInput: {
        learnerLanguage: lesson.language,
        lessonCanDo: lesson.canDo,
        lessonDescription: lesson.description,
        lessonTitle: lesson.title,
        level: lesson.level,
        targetLanguage: lesson.targetLanguage,
        unitCanDos,
        unitTitle: chapterTitle,
      },
    };
  }

  return {
    completeness: lesson.spec ? "partial" : "missingSpec",
    kind: "written",
    userInput: { ...context, spec: lesson.spec },
  };
}

function vocabulary(lessonId: string, steps: Step[]) {
  const wordIds = [...new Set(steps.flatMap((step) => step.wordId ?? []))];
  const sentenceIds = [...new Set(steps.flatMap((step) => step.sentenceId ?? []))];

  const words =
    wordIds.length === 0
      ? []
      : staffList<Word>("Word", {
          fields: "id,word,romanization",
          limit: 100,
          where: [`id in ${wordIds.join(",")}`],
        }).records;

  const sentences =
    sentenceIds.length === 0
      ? []
      : staffList<Sentence>("Sentence", {
          fields: "id,sentence,romanization",
          limit: 100,
          where: [`id in ${sentenceIds.join(",")}`],
        }).records;

  const links = (model: string, fields: string) =>
    staffList<LinkedText>(model, {
      fields,
      limit: 100,
      order: "position:asc",
      where: [`lessonId eq ${lessonId}`],
    }).records;

  return {
    lessonSentences:
      sentenceIds.length === 0
        ? []
        : links(
            "LessonSentence",
            "position,sentenceId,translation,explanation,distractors,translationDistractors,otherSentenceOrders,otherTranslationOrders",
          ),
    lessonWords:
      wordIds.length === 0
        ? []
        : links("LessonWord", "position,wordId,translation,note,distractors"),
    sentences,
    words,
  };
}

function loadSample(first: FirstStep) {
  const lesson = one<Lesson>(
    "Lesson",
    `id,language,targetLanguage,canDo,description,homeChapterId,level,spec,summary,title,updatedAt,${provenanceFields}`,
    [`id eq ${first.lessonId}`, ...published],
  );

  if (!lesson) {
    return { skipped: "no longer published and shared" };
  }

  const { hasMore, records: steps } = staffList<Step>("Step", {
    fields: `${stepFields},content,mediaAssetId,position,sentenceId,sourcePage,wordId`,
    limit: 100,
    order: "position:asc",
    where: [`lessonId eq ${lesson.id}`, `version eq ${first.version}`, ...current],
  });

  if (hasMore || steps[0]?.id !== first.id) {
    return { skipped: hasMore ? "version has over 100 screens" : "version changed while sampling" };
  }

  const { completeness, kind, userInput } = getInput(lesson, steps);

  const content = {
    ...vocabulary(lesson.id, steps),
    screens: steps,
    summary: lesson.summary,
    title: lesson.title,
  };

  if (
    !one<{ id: string }>("Lesson", "id", [
      `id eq ${lesson.id}`,
      `updatedAt eq ${lesson.updatedAt}`,
      ...published,
    ])
  ) {
    return { skipped: "lesson changed while sampling" };
  }

  const testCase: TestCase = {
    id: `library-${lesson.id}-v${first.version}`,
    language: lesson.language,
    origin: "production",
    userInput,
  };

  return {
    sample: {
      ...testCase,
      completeness,
      kind,
      lessonProvenance: {
        model: lesson.model,
        promptVersion: lesson.promptVersion,
        runId: lesson.runId,
      },
      publishedContent: content,
      spec: lesson.spec,
      version: first.version,
    },
  };
}

const candidates = staffList<Candidate>("Lesson", {
  fields: "id,language,targetLanguage",
  limit: pool,
  order: "id:desc",
  where: [...published, `createdAt lt ${before}`],
});

const firstSteps =
  candidates.records.length === 0
    ? []
    : staffList<FirstStep>("Step", {
        fields: stepFields,
        limit: pool,
        where: [
          `lessonId in ${candidates.records.map((lesson) => lesson.id).join(",")}`,
          ...current,
          "position eq 0",
        ],
      }).records;

const cases = [];

const skipped = { "no current screens": candidates.records.length - firstSteps.length } as Record<
  string,
  number
>;

for (const first of sampleOrder(candidates.records, firstSteps)) {
  if (cases.length === limit) {
    break;
  }

  const result = loadSample(first);

  if (result.sample) {
    cases.push(result.sample);
  } else {
    skipped[result.skipped] = (skipped[result.skipped] ?? 0) + 1;
  }
}

const summary = {
  before,
  candidatePool: candidates.records.length,
  missingSpecs: cases.filter(({ completeness }) => completeness === "missingSpec").length,
  notSelected:
    candidates.records.length -
    cases.length -
    Object.values(skipped).reduce((total, count) => total + count, 0),
  olderCandidatesOutsidePool: candidates.hasMore,
  partialInputs: cases.filter(({ completeness }) => completeness === "partial").length,
  sampled: cases.length,
  seed,
  skipped,
};

await mkdir(dirname(values.out), { recursive: true });
await writeFile(values.out, `${JSON.stringify({ ...summary, cases }, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ ...summary, out: values.out }, null, 2)}\n`);
