import { randomUUID } from "node:crypto";
import { checkCitedFacts } from "@zoonk/ai/tasks/research/check-cited-facts";
import { checkExamReading } from "@zoonk/ai/tasks/research/check-exam-reading";
import {
  type BlueprintExtraction,
  extractExamBlueprint,
} from "@zoonk/ai/tasks/research/extract-exam-blueprint";
import { findDomainShares } from "@zoonk/ai/tasks/research/find-domain-shares";
import { toBlueprintContent } from "@zoonk/core/library/exams/blueprint-content";
import {
  examEditionSchema,
  examStructureSchema,
} from "@zoonk/core/library/exams/blueprint-contract";
import { listBlueprintFacts } from "@zoonk/core/library/exams/blueprint-facts";
import { findNoticeReading } from "@zoonk/core/library/exams/notice-reading";
import { saveExamBlueprint } from "@zoonk/core/library/exams/save";
import { storeWebSource } from "@zoonk/core/library/sources/web";
import { prisma } from "@zoonk/db";
import { Response as PageResponse, fetch } from "undici";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readNoticeAgainWorkflow } from "../freshness/read-notice-again-workflow";

const PROVENANCE = {
  costUsd: 0,
  generatedAt: "2026-11-01T12:00:00.000Z",
  latencyMs: 1,
  model: "google/gemini-3.8-flash",
  promptVersion: "v1",
  provider: "google",
  requestedModel: "google/gemini-3.8-flash",
  runId: "r1",
  usage: {},
};

const TASK = { provenance: PROVENANCE, systemPrompt: "", usage: {} as never, userPrompt: "" };

const TOTAL_LINE = "The FE exam has 110 questions and lasts 5 hours and 20 minutes.";

const CHOICE_LINE =
  "Candidates take the FE exam in the one discipline they choose at registration.";

const CIVIL_LINE = "FE Civil: 110 questions.";
const MECHANICAL_LINE = "FE Mechanical: 110 questions.";
const NOTICE = [TOTAL_LINE, CHOICE_LINE, CIVIL_LINE, MECHANICAL_LINE].join("\n");

function discipline({
  choiceGroup,
  line,
  name,
}: {
  choiceGroup: string | null;
  line: string;
  name: string;
}): BlueprintExtraction["subjects"][number] {
  const passages = [{ document: 1, passage: line }];

  return {
    choiceGroup,
    group: null,
    matrix: [],
    name,
    otherGroups: [],
    partOf: null,
    passages: choiceGroup ? [...passages, { document: 1, passage: CHOICE_LINE }] : passages,
    questions: 110,
    shortName: name.replace("FE ", ""),
    topicHeadings: [],
    topics: [],
    weight: null,
  };
}

function reading(choiceGroup: string | null): BlueprintExtraction {
  return {
    choiceGroups: [],
    dates: [],
    edition: {
      passages: [{ document: 1, passage: TOTAL_LINE }],
      questionCount: 110,
      timeZone: null,
      year: 2026,
    },
    formats: [],
    mock: null,
    reusePolicy: { document: null, passage: null, pastQuestions: "unknown" },
    rules: [],
    subjects: [
      discipline({ choiceGroup, line: CIVIL_LINE, name: "FE Civil" }),
      discipline({ choiceGroup, line: MECHANICAL_LINE, name: "FE Mechanical" }),
    ],
    testedLanguage: null,
    topicFrequency: [],
  };
}

const SAT_DOMAINS = [
  { heading: "Algebra", percent: 35, topic: "Linear equations in one variable" },
  { heading: "Advanced Math", percent: 35, topic: "Nonlinear functions" },
  {
    heading: "Problem-Solving and Data Analysis",
    percent: 15,
    topic: "Ratios, rates, proportional relationships, and units",
  },
  { heading: "Geometry and Trigonometry", percent: 15, topic: "Area and volume" },
];

function domainLine(domain: (typeof SAT_DOMAINS)[number]): string {
  return `${domain.heading} ≈${domain.percent}%`;
}

const SAT_NOTICE = [
  "The Math section has 44 questions.",
  ...SAT_DOMAINS.flatMap((domain) => [domainLine(domain), domain.topic]),
].join("\n");

function satReading(): BlueprintExtraction {
  return {
    ...reading(null),
    edition: { passages: [], questionCount: null, timeZone: null, year: 2026 },
    subjects: [
      {
        ...discipline({
          choiceGroup: null,
          line: "The Math section has 44 questions.",
          name: "Math",
        }),
        questions: 44,
        shortName: "Math",
        topicHeadings: SAT_DOMAINS.map((domain) => ({
          firstTopic: domain.topic,
          name: domain.heading,
        })),
        topics: SAT_DOMAINS.map((domain) => domain.topic),
      },
    ],
  };
}

async function storedExam({ extraction = reading("Discipline"), notice = NOTICE } = {}) {
  vi.mocked(fetch).mockImplementation(
    async () => new PageResponse(notice, { headers: { "content-type": "text/plain" } }),
  );

  const source = await storeWebSource({
    kind: "official",
    language: "en",
    publisher: "NCEES",
    title: "FE exam",
    topic: "exam",
    url: `https://ncees.example/${randomUUID()}.txt`,
  });

  const documents = [{ sourceId: source.id, text: notice }];
  const facts = listBlueprintFacts({ documents, extraction });

  const content = toBlueprintContent({
    documents,
    extraction,
    facts,
    noticeUrl: source.url,
    sourceHash: source.contentHash,
    supportedIds: facts.map((fact) => fact.id),
  });

  const identity = {
    board: null,
    country: "US",
    language: "en",
    name: `FE exam ${randomUUID()}`,
    ownerId: null,
    role: null,
  };

  const saved = await saveExamBlueprint({
    content: {
      ...content,
      edition: { ...content.edition, check: { checkedAt: new Date().toISOString(), problems: [] } },
    },
    identity,
    provenance: PROVENANCE,
    sourceId: source.id,
  });

  return { blueprint: saved.blueprint, identity, source };
}

async function readStored(id: string) {
  const row = await prisma.examBlueprint.findUniqueOrThrow({ where: { id } });

  return {
    edition: examEditionSchema.parse(row.edition),
    row,
    structure: examStructureSchema.parse(row.structure),
  };
}

const WHOLE = {
  kind: "wholeExamSubjects",
  subjects: ["FE Civil", "FE Mechanical"],
  total: 110,
} as const;

describe("a reading whose subjects each hold the whole exam", () => {
  beforeEach(() => {
    vi.mocked(checkExamReading).mockResolvedValue({
      ...TASK,
      data: { missingSubjects: [], statedCounts: [] },
    });

    vi.mocked(checkCitedFacts).mockImplementation(async ({ facts }) => ({
      ...TASK,
      data: { supportedIds: facts.map((fact) => fact.id) },
    }));
  });

  it("is read once more, told which subjects, and set aside when it still has them", async () => {
    const { blueprint, identity, source } = await storedExam();

    vi.mocked(extractExamBlueprint).mockResolvedValue({ ...TASK, data: reading(null) });

    await expect(readNoticeAgainWorkflow({ examBlueprintId: blueprint.id })).resolves.toStrictEqual(
      { status: "read" },
    );

    expect(extractExamBlueprint).toHaveBeenCalledTimes(2);
    expect(vi.mocked(extractExamBlueprint).mock.calls[0]?.[0].corrections).toStrictEqual([]);

    expect(vi.mocked(extractExamBlueprint).mock.calls[1]?.[0].corrections).toStrictEqual([WHOLE]);

    const stored = await readStored(blueprint.id);

    expect(stored.row.noticeRereadSource).toBeNull();

    expect(stored.structure.subjects.map((subject) => subject.choiceGroup)).toStrictEqual([
      "Discipline",
      "Discipline",
    ]);

    expect(stored.edition.setAside).toMatchObject({
      problems: [WHOLE],
      sourceHash: source.contentHash,
    });

    await expect(findNoticeReading({ identity, sourceId: source.id })).resolves.toStrictEqual({
      problems: [WHOLE],
      read: true,
    });
  });

  it("saves the corrected re-read when it reads them as options of one choice", async () => {
    const { blueprint, source } = await storedExam();

    vi.mocked(extractExamBlueprint)
      .mockResolvedValueOnce({ ...TASK, data: reading(null) })
      .mockResolvedValueOnce({ ...TASK, data: reading("Discipline") });

    await readNoticeAgainWorkflow({ examBlueprintId: blueprint.id });

    const stored = await readStored(blueprint.id);

    expect(extractExamBlueprint).toHaveBeenCalledTimes(2);
    expect(stored.row.noticeRereadSource).toBe(source.contentHash);
    expect(stored.edition.setAside).toBeUndefined();
  });
});

describe("a reading whose subjects have headings", () => {
  beforeEach(() => {
    vi.mocked(checkExamReading).mockResolvedValue({
      ...TASK,
      data: { missingSubjects: [], statedCounts: [] },
    });

    vi.mocked(checkCitedFacts).mockImplementation(async ({ facts }) => ({
      ...TASK,
      data: { supportedIds: facts.map((fact) => fact.id) },
    }));
  });

  it("saves each heading's official share of its subject, with the passage that states it", async () => {
    const { blueprint } = await storedExam({ extraction: satReading(), notice: SAT_NOTICE });
    vi.mocked(extractExamBlueprint).mockResolvedValue({ ...TASK, data: satReading() });

    vi.mocked(findDomainShares).mockResolvedValue({
      ...TASK,
      data: SAT_DOMAINS.map((domain) => ({
        basis: "questions" as const,
        document: 1,
        heading: domain.heading,
        passage: domainLine(domain),
        percent: { max: domain.percent, min: domain.percent },
        questions: null,
        subject: 1,
      })),
    });

    await readNoticeAgainWorkflow({ examBlueprintId: blueprint.id });

    expect(findDomainShares).toHaveBeenCalledWith(
      expect.objectContaining({
        subjects: [
          {
            headings: [
              "Algebra",
              "Advanced Math",
              "Problem-Solving and Data Analysis",
              "Geometry and Trigonometry",
            ],
            name: "Math",
          },
        ],
      }),
    );

    const { structure } = await readStored(blueprint.id);

    expect(structure.subjects[0]?.topicGroups?.map((group) => group.share)).toStrictEqual([
      0.35, 0.35, 0.15, 0.15,
    ]);

    expect(structure.subjects[0]?.topicGroups?.[0]?.citation?.passage).toBe("Algebra ≈35%");
  });
});
