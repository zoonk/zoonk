import { warmUpCardSchema } from "@zoonk/ai/tasks/warm-up/warm-up-cards";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture, mediaAssetFixture } from "@zoonk/testing/fixtures/library-steps";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  examBlueprintFixture,
  sourceChangeNoticeFixture,
  sourceFixture,
} from "@zoonk/testing/fixtures/sources";
import { warmUpFixture } from "@zoonk/testing/fixtures/warm-ups";
import { describe, expect, it } from "vitest";
import {
  approve,
  proposeFix,
  revertFix,
  signInApprover,
  signInProposer,
} from "./_test-utils/content-fix-steps";
import { proposeContentFix } from "./propose-content-fix";

const provenance = { model: "test", promptVersion: "test", runId: "test" };

const scenario = {
  character: { name: "Ana", place: "Cafe", role: "Waiter" },
  characterBrief: "Help the guest",
  hints: ["Greet"],
  objectives: [{ description: "Order coffee", label: "Order" }],
  openingLine: "Hello",
  situation: "A cafe",
  title: "Coffee",
};

const blueprint = { formats: [], mock: null, rules: [], subjects: [] };

async function setup(model: string, privateRow = false) {
  const visibility = privateRow ? ("private" as const) : ("public" as const);

  if (model === "Course") {
    const row = await courseFixture({
      landingPage: { audience: ["Students"], outcomes: ["Learn"], valueProposition: "Start" },
      visibility,
    });

    return {
      id: row.id,
      invalid: { landingPage: {} },
      set: {
        landingPage: { audience: ["Learners"], outcomes: ["Practice"], valueProposition: "Begin" },
      },
    };
  }

  if (model === "Chapter") {
    const row = await libraryChapterFixture({ objectives: ["Learn"], visibility });
    return { id: row.id, invalid: { objectives: [] }, set: { objectives: ["Practice"] } };
  }

  if (model === "Lesson") {
    const row = await libraryLessonFixture({
      canDo: "Read",
      contentStatus: "completed",
      relatedQuestions: ["Why?"],
      visibility,
    });

    return {
      id: row.id,
      invalid: { relatedQuestions: [] },
      set: { canDo: "Read clearly", relatedQuestions: ["How?"] },
    };
  }

  if (model === "Skill") {
    const row = await skillFixture({ visibility });

    return {
      id: row.id,
      invalid: { name: "" },
      set: { description: "Correct description", example: "Example", name: "Corrected skill" },
    };
  }

  if (model === "Source") {
    const row = await sourceFixture({ visibility });
    return { id: row.id, invalid: { url: "bad" }, set: { title: "Correct citation" } };
  }

  if (model === "MediaAsset") {
    const row = await mediaAssetFixture({ visibility });
    return { id: row.id, invalid: { alt: 4 }, set: { alt: "A red triangle" } };
  }

  if (model === "WarmUp") {
    const row = await warmUpFixture();
    const cards = row.cards;

    if (!Array.isArray(cards)) {
      throw new TypeError("Expected cards");
    }

    const next = cards.map((card) => ({
      ...warmUpCardSchema.parse(card),
      options: warmUpCardSchema
        .parse(card)
        .options.map((option, index) => ({ ...option, correct: index === 0 })),
      reveal: "Corrected reveal",
    }));

    return { id: row.id, invalid: { cards: [] }, set: { cards: next } };
  }

  if (model === "ConversationScenario") {
    const chapter = await libraryChapterFixture({ visibility });

    const row = await prisma.conversationScenario.create({
      data: { chapterId: chapter.id, content: scenario, level: "A1", ...provenance },
    });

    return {
      id: row.id,
      invalid: { content: {} },
      set: { content: { ...scenario, title: "Ordering coffee" } },
    };
  }

  if (model === "TutorSharedAnswer") {
    const lesson = await libraryLessonFixture({ contentStatus: "completed", visibility });
    const step = await libraryStepFixture({ lessonId: lesson.id });

    const row = await prisma.tutorSharedAnswer.create({
      data: {
        answer: "Because",
        question: "Why?",
        stepId: step.id,
        suggestion: "simpler",
        ...provenance,
      },
    });

    return { id: row.id, invalid: { answer: "" }, set: { answer: "Because of the rule" } };
  }

  if (model === "SourceChangeNotice") {
    const source = await sourceFixture({ visibility });
    const row = await sourceChangeNoticeFixture({ sourceId: source.id });
    return { id: row.id, invalid: { message: "" }, set: { message: "Corrected notice" } };
  }

  if (model === "ChapterMindMap") {
    const chapter = await libraryChapterFixture({ visibility });

    const structure = {
      branches: ["One", "Two", "Three"].map((title) => ({
        drawing: "circle",
        explanation: "Explain",
        points: ["Point"],
        title,
      })),
      centralIdea: "Learn",
      comparison: null,
      summary: "Summary",
      title: "Map",
    };

    const row = await prisma.chapterMindMap.create({
      data: { chapterId: chapter.id, language: "en", status: "completed", structure },
    });

    return {
      id: row.id,
      invalid: { structure: { ...structure, branches: [] } },
      set: { structure: { ...structure, title: "Corrected map" } },
    };
  }

  if (["Step", "LessonSource", "StepSource"].includes(model)) {
    const lesson = await libraryLessonFixture({ contentStatus: "completed", visibility });
    const source = await sourceFixture();

    const step = await libraryStepFixture({
      lessonId: lesson.id,
      sourceId: source.id,
      sourcePage: 1,
    });

    if (model === "Step") {
      return { id: step.id, invalid: { sourcePage: 0 }, set: { sourcePage: 2 } };
    }

    if (model === "LessonSource") {
      return {
        id: lesson.id,
        invalid: { citations: [{ articles: [], sourceId: "missing" }] },
        set: { citations: [{ articles: ["Article 2"], sourceId: source.id }] },
      };
    }

    return {
      id: step.id,
      invalid: { citations: [{ contentHash: null, sourceId: "missing" }] },
      set: { citations: [{ contentHash: source.contentHash, sourceId: source.id }] },
    };
  }

  const exam = await examBlueprintFixture({ structure: blueprint, visibility });
  const citationSource = await sourceFixture();

  if (model === "ExamBlueprint") {
    return {
      id: exam.id,
      invalid: { structure: {} },
      set: {
        name: "Corrected exam",
        structure: {
          ...blueprint,
          rules: [{ citation: { passage: "ID", sourceId: citationSource.id }, text: "Bring ID" }],
        },
      },
    };
  }

  if (model === "TargetCutoff") {
    const row = await prisma.targetCutoff.create({
      data: {
        examBlueprintId: exam.id,
        status: "unknown",
        targetKey: "test",
        year: 2026,
        ...provenance,
      },
    });

    return {
      id: row.id,
      invalid: { maxScore: 100, score: 200, status: "found" },
      set: { maxScore: 100, score: 80, sourceUrl: "https://example.com/cutoff", status: "found" },
    };
  }

  const row = await prisma.examCourseWeights.create({
    data: {
      examBlueprintId: exam.id,
      status: "unknown",
      targetKey: "test",
      year: 2026,
      ...provenance,
    },
  });

  return {
    id: row.id,
    invalid: { subjects: [{ name: "Math", weight: -1 }] },
    set: {
      sourceUrl: "https://example.com/weights",
      status: "found",
      subjects: [{ name: "Math", weight: 2 }],
    },
  };
}

const models = [
  "Course",
  "Chapter",
  "Lesson",
  "Skill",
  "Source",
  "MediaAsset",
  "WarmUp",
  "ConversationScenario",
  "TutorSharedAnswer",
  "SourceChangeNotice",
  "ExamBlueprint",
  "TargetCutoff",
  "ExamCourseWeights",
  "ChapterMindMap",
  "Step",
  "LessonSource",
  "StepSource",
];

describe.each(models)("shared %s fixes", (model) => {
  it("proposes, approves and reverts with the original values", async () => {
    const row = await setup(model);
    await signInProposer();

    const fix = await proposeFix({
      changes: [{ id: row.id, model, [model === "Step" ? "setCitation" : "set"]: row.set }],
      reason: "Correct shared content",
    });

    const approver = await signInApprover();

    await expect(approve({ fixId: fix.id, key: approver.key })).resolves.toMatchObject({
      fix: { status: "applied" },
      status: "decided",
    });

    if (model === "ChapterMindMap") {
      const owed = await prisma.followUp.findFirst({ where: { kind: "redrawChapterMindMap" } });

      if (!owed) {
        throw new Error("Missing owed redraw");
      }

      await prisma.chapterMindMap.update({ data: { status: "failed" }, where: { id: row.id } });
    }

    await signInProposer();
    const reverted = await revertFix({ fixId: fix.id, reason: "Restore original" });
    expect(reverted.status).toBe("proposed");

    if (reverted.status !== "proposed") {
      throw new Error("Expected revert");
    }

    const nextApprover = await signInApprover();

    await expect(approve({ fixId: reverted.fix.id, key: nextApprover.key })).resolves.toMatchObject(
      { fix: { status: "applied" }, status: "decided" },
    );

    const originals = fix.changes.flatMap((change) => ("fields" in change ? change.fields : []));

    expect(reverted.fix.changes).toMatchObject([
      {
        fields: originals.map((field) => ({
          after: field.before,
          before: field.after,
          field: field.field,
        })),
      },
    ]);
  });

  it("refuses invalid content", async () => {
    const row = await setup(model);
    await signInProposer();

    await expect(
      proposeContentFix({
        changes: [{ id: row.id, model, [model === "Step" ? "setCitation" : "set"]: row.invalid }],
        reason: "Invalid",
      }),
    ).resolves.toMatchObject({ status: "invalid" });
  });

  it("refuses private content", async () => {
    const row = await setup(model, true);

    if (model === "WarmUp") {
      await prisma.warmUp.update({ data: { status: "writing" }, where: { id: row.id } });
    }

    await signInProposer();

    await expect(
      proposeContentFix({
        changes: [{ id: row.id, model, [model === "Step" ? "setCitation" : "set"]: row.set }],
        reason: "Private",
      }),
    ).resolves.toMatchObject({ status: "invalid" });
  });
});
