import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { sourceFixture } from "@zoonk/testing/fixtures/sources";
import { describe, expect, it } from "vitest";
import { type BlueprintContent, examStructureSchema } from "./blueprint-contract";
import { type ExamIdentity } from "./exam-identity";
import { previewExamBlueprintChanges, saveExamBlueprint } from "./save-exam-blueprint";

const PROVENANCE = {
  generatedAt: new Date("2026-11-24T12:00:00.000Z"),
  model: "test/model",
  promptVersion: "test-v1",
  runId: "run-1",
};

const ESSAY_PASSAGE = "zawierające – odpowiednio – test oraz wypracowanie";

function identity(): ExamIdentity {
  return {
    board: null,
    country: "PL",
    language: "pl",
    name: `Egzamin ${randomUUID()}`,
    ownerId: null,
    role: null,
  };
}

function stored({ sourceHash, sourceId }: { sourceHash: string; sourceId: string }) {
  const citation = { passage: ESSAY_PASSAGE, sourceId };

  return {
    edition: {
      check: null,
      citations: [],
      dates: [{ citation, date: "2027-05-04", kind: "exam", label: "Pisemna", startTime: null }],
      noticeUrl: "https://example.org/notice.pdf",
      questionCount: null,
      sourceHash,
      sourceIds: [sourceId],
      timeZone: "Europe/Warsaw",
      year: 2027,
    },
    structure: {
      formats: [
        { citation, description: "Test historycznoliteracki", kind: "other", options: null },
        { citation, description: "Wypracowanie", kind: "essay", options: null },
        { citation, description: "Ustna", kind: "oral", options: null },
      ],
      mock: {
        adaptive: false,
        citations: [citation],
        order: null,
        scoring: { description: "Punkty", method: "raw" },
        sections: [
          { day: null, kind: "objective", minutes: 60, name: "Test", questions: 38 },
          {
            day: null,
            kind: "written",
            minutes: 50,
            name: "Wypracowanie",
            questions: null,
            tasks: [
              { count: 1, description: "List", lines: 20, points: 10 },
              { count: 1, description: "Artykuł", lines: 30, points: 15 },
            ],
          },
        ],
        timeLimitMinutes: 110,
        totalQuestions: 38,
      },
      rules: [],
      subjects: [
        { citation, name: "Język polski", questions: null, topics: ["Lektury"], weight: null },
      ],
    },
    topicFrequency: [],
  } satisfies BlueprintContent;
}

/** One run's extractor or fact check kept fewer facts from the same documents. */
function thinner(content: BlueprintContent): BlueprintContent {
  const { mock } = content.structure;

  return {
    ...content,
    structure: {
      ...content.structure,
      formats: content.structure.formats.filter((format) => format.kind !== "essay"),
      mock: mock && {
        ...mock,
        sections: mock.sections.map((section) => ({
          ...section,
          minutes: null,
          questions: null,
          tasks: section.tasks
            ?.slice(0, 1)
            .map(({ count, description }) => ({ count, description })),
        })),
        totalQuestions: null,
      },
    },
  };
}

async function saveTwice({
  first,
  second,
  sourceId,
}: {
  first: BlueprintContent;
  second: BlueprintContent;
  sourceId: string;
}) {
  const examIdentity = identity();

  await saveExamBlueprint({
    content: first,
    identity: examIdentity,
    provenance: PROVENANCE,
    sourceId,
  });

  const preview = await previewExamBlueprintChanges({ content: second, identity: examIdentity });

  const saved = await saveExamBlueprint({
    content: second,
    identity: examIdentity,
    provenance: { ...PROVENANCE, runId: "run-2" },
    reread: true,
    sourceId,
  });

  return { preview, saved, structure: examStructureSchema.parse(saved.blueprint.structure) };
}

describe("a reading saved over a stored one", () => {
  it("keeps what an earlier reading of the same notice found when a re-read misses it", async () => {
    const source = await sourceFixture({ language: "pl" });
    const first = stored({ sourceHash: source.contentHash, sourceId: source.id });

    const { saved, structure } = await saveTwice({
      first,
      second: thinner(first),
      sourceId: source.id,
    });

    expect(saved.changes).toStrictEqual([]);
    expect(saved.blueprint.runId).toBe("run-1");

    expect(structure.formats.map((format) => format.kind)).toStrictEqual([
      "other",
      "essay",
      "oral",
    ]);

    expect(structure.mock?.totalQuestions).toBe(38);

    expect(
      structure.mock?.sections.map(({ minutes, questions, tasks }) => ({
        minutes,
        questions,
        tasks: tasks?.map(({ lines, points }) => ({ lines, points })),
      })),
    ).toStrictEqual([
      { minutes: 60, questions: 38, tasks: undefined },
      {
        minutes: 50,
        questions: null,
        tasks: [
          { lines: 20, points: 10 },
          { lines: 30, points: 15 },
        ],
      },
    ]);
  });

  it("takes what a re-read of the same notice adds or corrects", async () => {
    const source = await sourceFixture({ language: "pl" });
    const first = stored({ sourceHash: source.contentHash, sourceId: source.id });
    const { mock } = first.structure;

    const richer = {
      ...first,
      structure: {
        ...first.structure,
        mock: {
          ...mock,
          sections: mock.sections.map((section, index) => ({
            ...section,
            minutes: index === 0 ? 70 : section.minutes,
            tasks: section.tasks?.map((task) => ({ ...task, handwritten: true })),
          })),
        },
      },
    };

    const { saved, structure } = await saveTwice({ first, second: richer, sourceId: source.id });

    expect(saved.changes.map((change) => change.field)).toStrictEqual(["mock"]);
    expect(saved.blueprint.runId).toBe("run-2");
    expect(structure.mock?.sections[0]?.minutes).toBe(70);
    expect(structure.mock?.sections[1]?.tasks?.every((task) => task.handwritten)).toBe(true);
  });

  it("keeps a format a changed notice's reading left out only while the documents still quote it", async () => {
    const [before, quoting, silent] = await Promise.all([
      sourceFixture({ language: "pl" }),
      sourceFixture({
        extractedText: `Egzamin składa się z arkuszy ${ESSAY_PASSAGE}.`,
        language: "pl",
      }),
      sourceFixture({ extractedText: "Egzamin składa się z testu.", language: "pl" }),
    ]);

    const first = stored({ sourceHash: before.contentHash, sourceId: before.id });

    const read = (source: typeof quoting) => {
      const reading = thinner(first);

      return {
        ...reading,
        edition: { ...reading.edition, sourceHash: source.contentHash, sourceIds: [source.id] },
      };
    };

    const [kept, dropped] = await Promise.all([
      saveTwice({ first, second: read(quoting), sourceId: quoting.id }),
      saveTwice({ first, second: read(silent), sourceId: silent.id }),
    ]);

    expect(kept.structure.formats.map((format) => format.kind)).toStrictEqual([
      "other",
      "essay",
      "oral",
    ]);

    expect(dropped.structure.formats.map((format) => format.kind)).toStrictEqual(["other", "oral"]);
    expect(dropped.preview?.map((change) => change.field)).toContain("formats");
    expect(kept.preview?.map((change) => change.field)).not.toContain("formats");
    expect(kept.structure.mock?.sections[0]?.minutes).toBeNull();
  });

  it("writes no notice for a re-read of the same notice", async () => {
    const source = await sourceFixture({ language: "pl" });
    const first = stored({ sourceHash: source.contentHash, sourceId: source.id });

    const { preview, saved } = await saveTwice({
      first,
      second: thinner(first),
      sourceId: source.id,
    });

    expect(preview).toBeNull();

    await expect(
      prisma.sourceChangeNotice.count({ where: { examBlueprintId: saved.blueprint.id } }),
    ).resolves.toBe(0);
  });
});
