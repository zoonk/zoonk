import { randomUUID } from "node:crypto";
import { checkLessonImage } from "@zoonk/ai/tasks/v2/images/check";
import { prisma } from "@zoonk/db";
import { courseCategoryFixture, courseFixture } from "@zoonk/testing/fixtures/courses";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { describe, expect, it, vi } from "vitest";
import { uploadImage } from "../../images/upload-image";
import { mockSearchTerms } from "../identity/_test-utils/identity-mocks";
import {
  drawBlankImage,
  drawTestImage,
  mockDrawnImages,
  mockImageScene,
  resetImageModels,
  testScene,
} from "../media/_test-utils/image-mocks";
import {
  generatedMultipleChoice,
  generatedProvenance,
  generatedTypedItem,
} from "./_test-utils/generated-items";
import { createItems } from "./create-items";
import { parseItemContent } from "./item-content";

/** Vercel Blob and the image models are external boundaries; scene reuse and storage run for real. */
vi.mock("../../images/upload-image", () => ({ uploadImage: vi.fn() }));
vi.mock("@zoonk/ai/tasks/v2/identity/decision", () => ({ decideLibraryIdentity: vi.fn() }));
vi.mock("@zoonk/ai/tasks/v2/identity/search-terms", () => ({ generateSearchTerms: vi.fn() }));
vi.mock("@zoonk/ai/tasks/v2/images/check", () => ({ checkLessonImage: vi.fn() }));
vi.mock("@zoonk/ai/tasks/v2/images/generate", () => ({ generateLessonImage: vi.fn() }));
vi.mock("@zoonk/ai/tasks/v2/images/scene", () => ({ generateImageScene: vi.fn() }));

const FIGURE_CONTEXT = "Na figura, uma seta aponta para uma organela da célula vegetal.";

/** Fresh image models and uploads for a test that draws: queued results never leak between tests. */
function mockUploads() {
  resetImageModels();

  vi.mocked(uploadImage).mockImplementation(({ fileName }) =>
    Promise.resolve({ data: `https://blob.test/${fileName}-${randomUUID()}`, error: null }),
  );
}

const figure = {
  alt: "A plant cell with its chloroplast labeled.",
  prompt: "A plant cell with the chloroplast, nucleus and cell wall labeled.",
};

/** A skill in a biology chapter, so its pictures take the subject's palette. */
async function biologySkill() {
  const course = await courseFixture({ title: "Biologia" });

  const [chapter, skill] = await Promise.all([
    libraryChapterFixture({ homeCourseId: course.id, title: "Célula" }),
    skillFixture({ language: "pt", name: "Organelas da célula vegetal" }),
    courseCategoryFixture({ category: "science", courseId: course.id }),
  ]);

  await prisma.chapterSkill.create({ data: { chapterId: chapter.id, skillId: skill.id } });
  return skill;
}

describe(createItems, () => {
  it("stores checked items with their exam, field, difficulty and provenance", async () => {
    const [skill, exam] = await Promise.all([skillFixture(), examBlueprintFixture()]);
    const provenance = generatedProvenance();
    const item = generatedMultipleChoice({ difficulty: "hard" });

    const { created, rejected } = await createItems({
      examBlueprintId: exam.id,
      field: "nursing",
      format: "multipleChoice",
      items: [item],
      language: "pt",
      provenance,
      skillId: skill.id,
    });

    expect(rejected).toStrictEqual([]);
    expect(created).toHaveLength(1);

    expect(created[0]).toMatchObject({
      difficulty: 1,
      examBlueprintId: exam.id,
      field: "nursing",
      format: "multipleChoice",
      generatedAt: new Date(provenance.generatedAt),
      language: "pt",
      model: provenance.model,
      promptVersion: provenance.promptVersion,
      runId: provenance.runId,
      skillId: skill.id,
    });

    const { difficulty: _difficulty, format: _format, ...expectedContent } = item;

    expect(
      parseItemContent({ content: created[0]!.content, format: "multipleChoice" }),
    ).toStrictEqual({ content: expectedContent, format: "multipleChoice" });
  });

  it("stores a question about a figure with its picture, leaving the picture's check to the caller, and a retried step stores no copies", async () => {
    mockUploads();
    const skill = await biologySkill();
    const provenance = generatedProvenance();
    const plain = generatedMultipleChoice();
    const pictured = generatedMultipleChoice({ context: FIGURE_CONTEXT, image: figure });

    mockImageScene(testScene({ focalObject: `a plant cell ${randomUUID()}` }));
    mockSearchTerms([]);
    mockDrawnImages([await drawTestImage(), await drawTestImage()]);

    const input = {
      format: "multipleChoice" as const,
      items: [plain, pictured],
      language: "pt",
      provenance,
      skillId: skill.id,
    };

    const { created, rejected, unchecked } = await createItems(input);

    expect(rejected).toStrictEqual([]);

    // The question is asked at once; its new picture's model check follows (`checkImageAsset`).
    expect(checkLessonImage).not.toHaveBeenCalled();
    expect(unchecked).toStrictEqual([created[1]?.mediaAssetId]);

    const rows = await prisma.item.findMany({
      include: { mediaAsset: true },
      orderBy: { createdAt: "asc" },
      where: { id: { in: created.map((item) => item.id) } },
    });

    expect(
      rows.map((row) => [parseItemContent(row).content, row.mediaAsset?.palette]),
    ).toStrictEqual([
      [expect.objectContaining({ image: null, question: plain.question }), undefined],
      [expect.objectContaining({ image: figure, question: pictured.question }), "science"],
    ]);

    await createItems(input);
    await expect(prisma.item.count({ where: { runId: provenance.runId } })).resolves.toBe(2);
  });

  it("leaves out a question whose picture can't be drawn instead of storing it bare", async () => {
    mockUploads();
    const skill = await skillFixture();
    const pictured = generatedMultipleChoice({ context: FIGURE_CONTEXT, image: figure });

    mockImageScene(testScene({ focalObject: `a plant cell ${randomUUID()}` }));
    mockSearchTerms([]);
    mockDrawnImages([await drawBlankImage(), await drawBlankImage()]);

    await expect(
      createItems({
        format: "multipleChoice",
        items: [pictured],
        language: "pt",
        provenance: generatedProvenance(),
        skillId: skill.id,
      }),
    ).resolves.toStrictEqual({
      created: [],
      rejected: [{ index: 0, problems: [expect.stringContaining("picture")] }],
      unchecked: [],
    });
  });

  it("keeps items that fail the checks out and reports why", async () => {
    const skill = await skillFixture();
    const good = generatedMultipleChoice();

    const twoCorrect = generatedMultipleChoice({
      options: good.options.map((option) => ({ ...option, isCorrect: true })),
    });

    const { created, rejected } = await createItems({
      format: "multipleChoice",
      items: [twoCorrect, good, generatedTypedItem()],
      language: "en",
      provenance: generatedProvenance(),
      skillId: skill.id,
    });

    expect(created.map((item) => parseItemContent(item).content)).toStrictEqual([
      expect.objectContaining({ question: good.question }),
    ]);

    expect(rejected).toStrictEqual([
      { index: 0, problems: ["Has 2 correct options instead of 1."] },
      { index: 2, problems: ["Is typed instead of multipleChoice."] },
    ]);
  });

  it("stores options without the letters the writer printed before them", async () => {
    const skill = await skillFixture();
    const item = generatedMultipleChoice();
    const [right, wrong] = item.options;

    // ENEM placement, Sep 2026: the writer followed "5 alternativas (A a E)" and labeled each one.
    const labeled = generatedMultipleChoice({
      options: [
        { ...wrong!, text: "B) 20" },
        { ...right!, text: "A) 5" },
      ],
    });

    const { created } = await createItems({
      format: "multipleChoice",
      items: [labeled],
      language: "pt",
      provenance: generatedProvenance(),
      skillId: skill.id,
    });

    const stored = await prisma.item.findUniqueOrThrow({ where: { id: created[0]!.id } });

    expect(stored.content).toMatchObject({
      options: expect.arrayContaining([
        expect.objectContaining({ isCorrect: true, text: "5" }),
        expect.objectContaining({ isCorrect: false, text: "20" }),
      ]),
    });
  });

  it("enforces the exam's option count", async () => {
    const skill = await skillFixture();

    const { created, rejected } = await createItems({
      format: "multipleChoice",
      items: [generatedMultipleChoice()],
      language: "pt",
      optionCount: 5,
      provenance: generatedProvenance(),
      skillId: skill.id,
    });

    expect(created).toStrictEqual([]);
    expect(rejected).toStrictEqual([{ index: 0, problems: ["Has 2 options instead of 5."] }]);
  });

  it("returns the stored items instead of copies when a workflow step retries", async () => {
    const skill = await skillFixture();
    const provenance = generatedProvenance();
    const items = [generatedTypedItem(), generatedTypedItem({ question: "Another question?" })];

    const params = {
      format: "typed" as const,
      items,
      language: "en",
      provenance,
      skillId: skill.id,
    };

    const first = await createItems(params);
    const retry = await createItems(params);

    expect(retry.created.map((item) => item.id)).toStrictEqual(
      first.created.map((item) => item.id),
    );

    await expect(prisma.item.count({ where: { skillId: skill.id } })).resolves.toBe(2);
  });

  it("stores each format one run wrote for a skill, and still no copies on a retry", async () => {
    const skill = await skillFixture();
    const provenance = generatedProvenance();
    const shared = { language: "en", provenance, skillId: skill.id };

    const choice = {
      ...shared,
      format: "multipleChoice" as const,
      items: [generatedMultipleChoice()],
    };

    const typed = { ...shared, format: "typed" as const, items: [generatedTypedItem()] };

    await createItems(choice);
    const stored = await createItems(typed);
    const retried = await createItems(typed);

    expect(stored.created).toHaveLength(1);

    expect(retried.created.map((item) => item.id)).toStrictEqual(
      stored.created.map((item) => item.id),
    );

    const formats = await prisma.item.findMany({
      select: { format: true },
      where: { skillId: skill.id },
    });

    expect(formats.map((item) => item.format).toSorted()).toStrictEqual([
      "multipleChoice",
      "typed",
    ]);
  });
});
