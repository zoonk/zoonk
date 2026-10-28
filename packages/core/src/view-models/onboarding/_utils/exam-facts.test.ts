import { randomUUID } from "node:crypto";
import { findExamDate } from "@zoonk/ai/tasks/v2/goals/find-exam-date";
import { decideExamIdentity } from "@zoonk/ai/tasks/v2/research/exam-identity-decision";
import { examBlueprintFixture, sourceFixture } from "@zoonk/testing/fixtures/sources";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildExamIdentityKey } from "../../../library/exams/exam-identity";
import { findExamFacts } from "./exam-facts";

const TODAY = "2026-09-28";
const NOTICE_URL = "https://cdn.cebraspe.org.br/concursos/camara_25/edital.pdf";

type Finding = Awaited<ReturnType<typeof findExamDate>>["data"];

function lookupAnswers(data: Finding) {
  vi.mocked(findExamDate).mockResolvedValue({
    data,
    provenance: {} as never,
    systemPrompt: "",
    usage: {} as never,
    userPrompt: "",
  });
}

async function storedExam({
  days,
  language = "en",
  name = `Test Exam ${randomUUID()}`,
  role = null,
  year,
}: {
  days: string[];
  language?: string;
  name?: string;
  role?: string | null;
  year: number;
}) {
  const source = await sourceFixture({ title: "Official notice" });
  const citation = { passage: "The exam takes place on", sourceId: source.id };

  const blueprint = await examBlueprintFixture({
    edition: {
      check: null,
      citations: [],
      dates: [
        {
          citation,
          date: `${year}-05-20`,
          kind: "registrationEnd",
          label: "Registration ends",
          startTime: null,
        },
        ...days.map((date, index) => ({
          citation,
          date,
          kind: "exam" as const,
          label: `Day ${index + 1}`,
          startTime: null,
        })),
      ],
      noticeUrl: null,
      questionCount: null,
      sourceHash: null,
      timeZone: null,
      year,
    },
    identityKey: buildExamIdentityKey({ name, ownerId: null, role }),
    language,
    name,
    role,
  });

  return { blueprint, examName: name, source };
}

describe(findExamFacts, () => {
  beforeEach(() => {
    vi.mocked(decideExamIdentity).mockResolvedValue(null);
    lookupAnswers({ dates: [], source: null, status: "unknown" });
  });

  it("gives the notice's days still ahead, with their source, for the year it's for", async () => {
    const { blueprint, examName, source } = await storedExam({
      days: ["2026-03-01", "2026-11-08", "2026-11-15"],
      year: 2026,
    });

    const officialSource = { title: "Official notice", url: source.url };

    const expected = {
      blueprintId: blueprint.id,
      dates: [
        {
          date: "2026-11-08",
          estimated: false,
          label: "Day 2",
          registrationClosed: true,
          source: officialSource,
        },
        {
          date: "2026-11-15",
          estimated: false,
          label: "Day 3",
          registrationClosed: true,
          source: officialSource,
        },
      ],
      targetDate: null,
    };

    const [named, unnamed] = await Promise.all([
      findExamFacts({ exam: { examName, examYear: 2026 }, language: "en", today: TODAY }),
      findExamFacts({ exam: { examName }, language: "en", today: TODAY }),
    ]);

    expect(named).toStrictEqual(expected);
    expect(unnamed).toStrictEqual(expected);
    expect(findExamDate).not.toHaveBeenCalled();
  });

  it("finds a language certificate's notice stored in the language it tests", async () => {
    const { blueprint, examName } = await storedExam({
      days: ["2026-11-14", "2027-04-02"],
      language: "es",
      year: 2026,
    });

    const facts = await findExamFacts({
      exam: { examName, targetLanguage: "es" },
      language: "pt",
      today: TODAY,
    });

    expect(facts).toMatchObject({ blueprintId: blueprint.id, targetDate: null });
    expect(facts.dates.map((day) => day.date)).toStrictEqual(["2026-11-14", "2027-04-02"]);
    expect(findExamDate).not.toHaveBeenCalled();
  });

  it("finds the stored notice when the learner words the exam and its role another way", async () => {
    // Keep a unique municipality within the search's five-word term limit to isolate stored notices.
    const town = randomUUID().slice(0, 8);

    const { blueprint } = await storedExam({
      days: ["2027-01-17"],
      language: "pt",
      name: `Concurso Câmara Municipal ${town}`,
      role: "Analista Legislativo - Registro e Redação",
      year: 2027,
    });

    vi.mocked(decideExamIdentity).mockImplementation(async ({ candidates }) => {
      const match = candidates.find((candidate) => candidate.id === blueprint.id);
      return match ? { id: match.id, probability: 0.9 } : null;
    });

    const facts = await findExamFacts({
      exam: {
        examName: `Concurso da Câmara Municipal ${town}`,
        examYear: 2027,
        institution: `Câmara Municipal ${town}`,
        role: "registro/redação",
      },
      language: "pt",
      today: TODAY,
    });

    expect(facts).toMatchObject({ blueprintId: blueprint.id, targetDate: null });
    expect(facts.dates.map((day) => day.date)).toStrictEqual(["2027-01-17"]);

    expect(decideExamIdentity).toHaveBeenCalledWith(
      expect.objectContaining({
        request: expect.objectContaining({ country: "BR", role: "registro/redação" }),
      }),
    );
  });

  it("looks up the published day when no notice is stored, and makes it the goal's date", async () => {
    lookupAnswers({
      dates: [
        { date: "2027-01-17", label: "Objective test" },
        { date: "2027-01-24", label: "Written test" },
      ],
      source: { title: "Notice 1", url: NOTICE_URL },
      status: "official",
    });

    const source = { title: "Notice 1", url: NOTICE_URL };

    await expect(
      findExamFacts({
        exam: { examName: `Unstored Exam ${randomUUID()}`, examYear: 2027, role: "Analyst" },
        language: "en",
        today: TODAY,
      }),
    ).resolves.toStrictEqual({
      blueprintId: null,
      dates: [
        {
          date: "2027-01-17",
          estimated: false,
          label: "Objective test",
          registrationClosed: false,
          source,
        },
        {
          date: "2027-01-24",
          estimated: false,
          label: "Written test",
          registrationClosed: false,
          source,
        },
      ],
      targetDate: "2027-01-17",
    });

    expect(findExamDate).toHaveBeenCalledWith(
      expect.objectContaining({ role: "Analyst", today: TODAY, year: 2027 }),
    );
  });

  it("only offers a published day in another month than the one the learner named", async () => {
    const source = { title: "Notice 1", url: NOTICE_URL };

    lookupAnswers({
      dates: [{ date: "2027-01-10", label: "Objective test" }],
      source,
      status: "official",
    });

    const exam = { examName: `Unstored Exam ${randomUUID()}`, examYear: 2027 };

    const [march, january] = await Promise.all([
      findExamFacts({ exam: { ...exam, examMonth: 3 }, language: "en", today: TODAY }),
      findExamFacts({ exam: { ...exam, examMonth: 1 }, language: "en", today: TODAY }),
    ]);

    expect(march).toStrictEqual({
      blueprintId: null,
      dates: [
        {
          date: "2027-01-10",
          estimated: false,
          label: "Objective test",
          registrationClosed: false,
          source,
        },
      ],
      targetDate: null,
    });

    expect(january.targetDate).toBe("2027-01-10");
  });

  it("never guesses: a notice that isn't out leaves the date to be confirmed", async () => {
    lookupAnswers({ dates: [], source: null, status: "notPublished" });

    await expect(
      findExamFacts({
        exam: { examName: `Unknown Exam ${randomUUID()}`, examYear: 2028 },
        language: "en",
        today: TODAY,
      }),
    ).resolves.toStrictEqual({ blueprintId: null, dates: [], targetDate: null });
  });

  it("leaves the date to be confirmed when the search fails, instead of failing the card", async () => {
    vi.mocked(findExamDate).mockRejectedValue(new Error("The search is down"));

    await expect(
      findExamFacts({
        exam: { examName: `Unreachable Exam ${randomUUID()}` },
        language: "en",
        today: TODAY,
      }),
    ).resolves.toStrictEqual({ blueprintId: null, dates: [], targetDate: null });
  });

  it("doesn't look anything up when the learner gave their own day", async () => {
    await findExamFacts({
      exam: { examName: `Own Day Exam ${randomUUID()}` },
      language: "en",
      lookUpDate: false,
      today: TODAY,
    });

    expect(findExamDate).not.toHaveBeenCalled();
  });

  it("estimates the next edition when every stored day has passed, unless a new notice is out", async () => {
    const { blueprint, examName } = await storedExam({
      days: ["2025-11-09", "2025-11-16"],
      year: 2025,
    });

    await expect(
      findExamFacts({ exam: { examName }, language: "en", today: TODAY }),
    ).resolves.toStrictEqual({
      blueprintId: blueprint.id,
      dates: [
        {
          date: "2026-11-08",
          estimated: true,
          label: "Day 1",
          registrationClosed: false,
          source: null,
        },
        {
          date: "2026-11-15",
          estimated: true,
          label: "Day 2",
          registrationClosed: false,
          source: null,
        },
      ],
      targetDate: null,
    });

    lookupAnswers({
      dates: [{ date: "2026-11-22", label: "Day 1" }],
      source: { title: "New notice", url: NOTICE_URL },
      status: "official",
    });

    await expect(
      findExamFacts({ exam: { examName }, language: "en", today: TODAY }),
    ).resolves.toMatchObject({ blueprintId: blueprint.id, targetDate: "2026-11-22" });
  });

  it("estimates the days in the month the learner named, over the notice's usual month", async () => {
    const { examName } = await storedExam({ days: ["2025-07-27"], year: 2025 });

    await expect(
      findExamFacts({
        exam: { examMonth: 3, examName, examYear: 2027 },
        language: "en",
        today: TODAY,
      }),
    ).resolves.toMatchObject({
      dates: [
        {
          date: "2027-03-28",
          estimated: true,
          label: "Day 1",
          registrationClosed: false,
          source: null,
        },
      ],
      targetDate: null,
    });
  });

  it("has no dates for a year that has passed", async () => {
    const { blueprint, examName } = await storedExam({ days: ["2026-11-08"], year: 2026 });

    await expect(
      findExamFacts({ exam: { examName, examYear: 2025 }, language: "en", today: TODAY }),
    ).resolves.toStrictEqual({ blueprintId: blueprint.id, dates: [], targetDate: null });
  });
});
