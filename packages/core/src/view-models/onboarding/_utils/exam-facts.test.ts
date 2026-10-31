import { randomUUID } from "node:crypto";
import { findExamDate } from "@zoonk/ai/tasks/goals/find-exam-date";
import { type UnderstoodGoal } from "@zoonk/ai/tasks/goals/understand-goal";
import { decideExamIdentity } from "@zoonk/ai/tasks/research/exam-identity-decision";
import { examBlueprintFixture, sourceFixture } from "@zoonk/testing/fixtures/sources";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildExamIdentityKey } from "../../../library/exams/exam-identity";
import {
  type ExamLookup,
  type StoredExam,
  findStoredExam,
  listExamLookups,
  searchExamDates,
  toExamFacts,
} from "./exam-facts";

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

function lookupFor(
  goal: Partial<UnderstoodGoal> & { examName: string },
  language = "en",
): ExamLookup {
  const [lookup] = listExamLookups({
    language,
    today: TODAY,
    understanding: {
      followUps: [],
      goals: [{ kind: "exam", subject: goal.examName, title: goal.examName, ...goal }],
      route: "goals",
    },
    words: `pass the ${goal.examName}`,
  });

  if (!lookup) {
    throw new Error("Expected an exam lookup");
  }

  return lookup;
}

function searchFor(lookup: ExamLookup, stored: StoredExam | null) {
  return searchExamDates({ lookup, stored, userId: randomUUID() });
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

describe(listExamLookups, () => {
  it("looks for a certificate's notice in the learner's language, then in the one it tests", () => {
    expect(lookupFor({ examName: "DELE B2", targetLanguage: "es" }, "pt")).toMatchObject({
      language: "pt",
      noticeLanguages: ["pt", "es"],
    });

    expect(lookupFor({ examName: "IELTS", targetLanguage: "en" }).noticeLanguages).toStrictEqual([
      "en",
    ]);
  });

  it("only looks up a day the learner didn't give, for an exam its organizer sets", () => {
    expect(lookupFor({ examDay: "official", examName: "ENEM" }).lookUpDate).toBe(true);
    expect(lookupFor({ examDay: "booked", examName: "TOEFL" }).lookUpDate).toBe(false);
    expect(lookupFor({ examName: "ENEM", targetDate: "2027-11-07" }).lookUpDate).toBe(false);
  });

  it("has nothing to look up for goals that name no exam", () => {
    expect(
      listExamLookups({
        language: "en",
        today: TODAY,
        understanding: {
          followUps: [],
          goals: [
            { kind: "learn", subject: "Welding", title: "Weld" },
            { examName: "IELTS", kind: "exam", subject: "English", title: "Pass the IELTS" },
          ],
          route: "goals",
        },
        words: "weld and pass the IELTS",
      }).map((lookup) => lookup?.exam.examName ?? null),
    ).toStrictEqual([null, "IELTS"]);

    expect(
      listExamLookups({
        language: "en",
        today: TODAY,
        understanding: { route: "unsafe" },
        words: "anything",
      }),
    ).toStrictEqual([]);
  });
});

describe(findStoredExam, () => {
  beforeEach(() => {
    vi.mocked(decideExamIdentity).mockResolvedValue(null);
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
    };

    const [named, unnamed] = await Promise.all([
      findStoredExam({ language: "en", lookup: lookupFor({ examName, examYear: 2026 }) }),
      findStoredExam({ language: "en", lookup: lookupFor({ examName }) }),
    ]);

    expect(named).toStrictEqual(expected);
    expect(unnamed).toStrictEqual(expected);
  });

  it("finds a language certificate's notice only in the language it tests", async () => {
    const { blueprint, examName } = await storedExam({
      days: ["2026-11-14", "2027-04-02"],
      language: "es",
      year: 2026,
    });

    const lookup = lookupFor({ examName, targetLanguage: "es" }, "pt");

    const [inPortuguese, inSpanish] = await Promise.all(
      lookup.noticeLanguages.map((language) => findStoredExam({ language, lookup })),
    );

    expect(inPortuguese).toBeNull();
    expect(inSpanish?.blueprintId).toBe(blueprint.id);
    expect(inSpanish?.dates.map((day) => day.date)).toStrictEqual(["2026-11-14", "2027-04-02"]);
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

    const stored = await findStoredExam({
      language: "pt",
      lookup: lookupFor(
        {
          examName: `Concurso da Câmara Municipal ${town}`,
          examYear: 2027,
          institution: `Câmara Municipal ${town}`,
          targetPosition: "registro/redação",
        },
        "pt",
      ),
    });

    expect(stored?.blueprintId).toBe(blueprint.id);
    expect(stored?.dates.map((day) => day.date)).toStrictEqual(["2027-01-17"]);

    expect(decideExamIdentity).toHaveBeenCalledWith(
      expect.objectContaining({
        request: expect.objectContaining({ country: "BR", role: "registro/redação" }),
      }),
    );
  });

  it("fails when the identity decision fails, so its step can try again", async () => {
    const town = randomUUID().slice(0, 8);

    await storedExam({
      days: ["2027-01-17"],
      language: "pt",
      name: `Concurso Câmara Municipal ${town}`,
      year: 2027,
    });

    vi.mocked(decideExamIdentity).mockRejectedValue(new Error("The model is down"));

    await expect(
      findStoredExam({
        language: "pt",
        lookup: lookupFor({ examName: `Concurso da Câmara Municipal ${town}` }, "pt"),
      }),
    ).rejects.toThrow("The model is down");
  });

  it("estimates the next edition when every stored day has passed", async () => {
    const { blueprint, examName } = await storedExam({
      days: ["2025-11-09", "2025-11-16"],
      year: 2025,
    });

    await expect(
      findStoredExam({ language: "en", lookup: lookupFor({ examName }) }),
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
    });
  });

  it("estimates the days in the month the learner named, over the notice's usual month", async () => {
    const { examName } = await storedExam({ days: ["2025-07-27"], year: 2025 });

    const stored = await findStoredExam({
      language: "en",
      lookup: lookupFor({ examMonth: 3, examName, examYear: 2027 }),
    });

    expect(stored?.dates).toStrictEqual([
      {
        date: "2027-03-28",
        estimated: true,
        label: "Day 1",
        registrationClosed: false,
        source: null,
      },
    ]);
  });

  it("has no dates for a year that has passed", async () => {
    const { blueprint, examName } = await storedExam({ days: ["2026-11-08"], year: 2026 });

    await expect(
      findStoredExam({ language: "en", lookup: lookupFor({ examName, examYear: 2025 }) }),
    ).resolves.toStrictEqual({ blueprintId: blueprint.id, dates: [] });
  });
});

describe(searchExamDates, () => {
  beforeEach(() => {
    lookupAnswers({ dates: [], source: null, status: "unknown" });
  });

  it("looks up the published days when no notice is stored", async () => {
    const source = { title: "Notice 1", url: NOTICE_URL };

    lookupAnswers({
      dates: [
        { date: "2027-01-17", label: "Objective test" },
        { date: "2027-01-24", label: "Written test" },
      ],
      source,
      status: "official",
    });

    const lookup = lookupFor({
      examName: `Unstored Exam ${randomUUID()}`,
      examYear: 2027,
      targetPosition: "Analyst",
    });

    await expect(searchFor(lookup, null)).resolves.toStrictEqual([
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
    ]);

    expect(findExamDate).toHaveBeenCalledWith(
      expect.objectContaining({ role: "Analyst", today: TODAY, year: 2027 }),
    );
  });

  it("doesn't search when a stored official day answers it, but does when the stored days are estimates", async () => {
    const lookup = lookupFor({ examName: `Stored Exam ${randomUUID()}` });
    const day = { date: "2026-11-08", label: "Day 1", registrationClosed: false, source: null };

    await expect(
      searchFor(lookup, { blueprintId: randomUUID(), dates: [{ ...day, estimated: false }] }),
    ).resolves.toStrictEqual([]);

    expect(findExamDate).not.toHaveBeenCalled();

    await searchFor(lookup, { blueprintId: randomUUID(), dates: [{ ...day, estimated: true }] });
    expect(findExamDate).toHaveBeenCalledOnce();
  });

  it("doesn't look anything up when the learner gave their own day or books the test", async () => {
    await Promise.all([
      searchFor(
        lookupFor({ examName: `Own Day Exam ${randomUUID()}`, targetDate: "2027-03-01" }),
        null,
      ),
      searchFor(lookupFor({ examDay: "booked", examName: `Booked Test ${randomUUID()}` }), null),
    ]);

    expect(findExamDate).not.toHaveBeenCalled();
  });

  it("never guesses: a notice that isn't out leaves the date to be confirmed", async () => {
    lookupAnswers({ dates: [], source: null, status: "notPublished" });

    await expect(
      searchFor(lookupFor({ examName: `Unknown Exam ${randomUUID()}`, examYear: 2028 }), null),
    ).resolves.toStrictEqual([]);
  });

  it("fails when the search fails, so its step can try again", async () => {
    vi.mocked(findExamDate).mockRejectedValue(new Error("The search is down"));

    await expect(
      searchFor(lookupFor({ examName: `Unreachable Exam ${randomUUID()}` }), null),
    ).rejects.toThrow("The search is down");
  });
});

describe(toExamFacts, () => {
  const source = { title: "Notice 1", url: NOTICE_URL };

  const found = {
    date: "2027-01-10",
    estimated: false,
    label: "Objective test",
    registrationClosed: false,
    source,
  };

  it("makes a searched day the goal's date, except in another month than the one the learner named", () => {
    const exam = { examName: `Unstored Exam ${randomUUID()}`, examYear: 2027 };

    expect(
      toExamFacts({
        lookup: lookupFor({ ...exam, examMonth: 1 }),
        searched: [found],
        stored: null,
      }),
    ).toStrictEqual({ blueprintId: null, dates: [found], targetDate: "2027-01-10" });

    expect(
      toExamFacts({
        lookup: lookupFor({ ...exam, examMonth: 3 }),
        searched: [found],
        stored: null,
      }),
    ).toStrictEqual({ blueprintId: null, dates: [found], targetDate: null });
  });

  it("keeps a stored notice's days when the search found none", () => {
    const stored = { blueprintId: randomUUID(), dates: [{ ...found, estimated: true }] };

    expect(
      toExamFacts({ lookup: lookupFor({ examName: "ENEM" }), searched: [], stored }),
    ).toStrictEqual({ blueprintId: stored.blueprintId, dates: stored.dates, targetDate: null });
  });
});
