import { randomUUID } from "node:crypto";
import { decideLibraryIdentity } from "@zoonk/ai/tasks/v2/identity/decision";
import { generateSearchTerms } from "@zoonk/ai/tasks/v2/identity/search-terms";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { sourceFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import {
  buildLessonIdentityKey,
  buildSkillIdentityKey,
  scopeIdentityKey,
} from "@zoonk/utils/identity-key";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getCandidateIds,
  mockDecision,
  mockSearchTerms,
  mockSearchTermsFor,
  uniqueWord,
} from "./_test-utils/identity-mocks";
import { resolveLibraryIdentities, resolveLibraryIdentity } from "./resolve-library-identity";

vi.mock("@zoonk/ai/tasks/v2/identity/decision", () => ({ decideLibraryIdentity: vi.fn() }));
vi.mock("@zoonk/ai/tasks/v2/identity/search-terms", () => ({ generateSearchTerms: vi.fn() }));

/** Every lesson request in these tests is for one course; other courses never match exactly. */
const course = { id: randomUUID(), title: "Everyday math" };

function lessonRequest(overrides: { title: string; skills: { id: string; name: string }[] }) {
  return {
    course,
    description: "Work out a price after a discount",
    kind: "lesson" as const,
    language: "en",
    level: "beginner" as const,
    targetLanguage: null,
    ...overrides,
  };
}

describe(resolveLibraryIdentity, () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("reuses an exact identity match without calling a model", async () => {
    const skill = await skillFixture();

    const identityKey = buildLessonIdentityKey({
      courseId: course.id,
      level: "beginner",
      skillIds: [skill.id],
      targetLanguage: null,
    });

    const lesson = await libraryLessonFixture({ identityKey });
    const searchSpy = mockSearchTerms([]);

    const result = await resolveLibraryIdentity({
      request: lessonRequest({
        skills: [{ id: skill.id, name: skill.name }],
        title: "Other title",
      }),
    });

    expect(result).toStrictEqual({
      id: lesson.id,
      kind: "existing",
      match: "exact",
      probability: null,
      verdicts: [],
    });

    expect(searchSpy).not.toHaveBeenCalled();
  });

  it("only offers public lessons in the same language, level and target language", async () => {
    const word = uniqueWord();

    const [owner, skill, skillForSearch] = await Promise.all([
      userFixture(),
      skillFixture(),
      skillFixture({ name: `Apply a ${word} to a price` }),
    ]);

    const [target, bySkillName] = await Promise.all([
      libraryLessonFixture({ title: `Percent ${word}` }),
      libraryLessonFixture({ title: "Sale prices" }),
      libraryLessonFixture({ level: "intermediate", title: `Percent ${word}` }),
      libraryLessonFixture({ language: "pt", title: `Percent ${word}` }),
      libraryLessonFixture({ targetLanguage: "es", title: `Percent ${word}` }),
      libraryLessonFixture({ ownerId: owner.id, title: `Percent ${word}`, visibility: "private" }),
    ]);

    await lessonSkillFixture({ lessonId: bySkillName.id, skillId: skillForSearch.id });

    mockSearchTerms([word]);
    const decisionSpy = mockDecision(target.id);

    /** A title no other test's rows use, so only this test's lessons match its words. */
    const title = `Discounts ${uniqueWord()}`;

    const result = await resolveLibraryIdentity({
      request: lessonRequest({ skills: [{ id: skill.id, name: skill.name }], title }),
    });

    expect(result).toMatchObject({ id: target.id, kind: "existing", match: "search" });

    expect(getCandidateIds(decisionSpy).toSorted()).toStrictEqual(
      [target.id, bySkillName.id].toSorted(),
    );
  });

  it("finds a lesson whose term is split between its own words and a skill's name", async () => {
    const [titleWord, skillWord] = [uniqueWord(), uniqueWord()];

    const [skill, skillForSearch, target] = await Promise.all([
      skillFixture(),
      skillFixture({ name: `Apply a ${skillWord}` }),
      libraryLessonFixture({ title: `Percent ${titleWord}` }),
      libraryLessonFixture({ title: `Percent ${titleWord} again` }),
    ]);

    await lessonSkillFixture({ lessonId: target.id, skillId: skillForSearch.id });

    mockSearchTerms([`${titleWord} ${skillWord}`]);
    const decisionSpy = mockDecision(target.id);

    await resolveLibraryIdentity({
      request: lessonRequest({
        skills: [{ id: skill.id, name: skill.name }],
        title: `Discounts ${uniqueWord()}`,
      }),
    });

    expect(getCandidateIds(decisionSpy)).toStrictEqual([target.id]);
  });

  it("generates under the scoped identity key when the decision rejects every candidate", async () => {
    const word = uniqueWord();

    const [skill] = await Promise.all([
      skillFixture(),
      libraryLessonFixture({ title: `Compound ${word}` }),
    ]);

    mockSearchTerms([word]);
    mockDecision(null);
    const title = `Discounts ${uniqueWord()}`;

    const result = await resolveLibraryIdentity({
      request: lessonRequest({ skills: [{ id: skill.id, name: skill.name }], title }),
    });

    expect(result).toMatchObject({
      identityKey: buildLessonIdentityKey({
        courseId: course.id,
        level: "beginner",
        skillIds: [skill.id],
        targetLanguage: null,
      }),
      kind: "generate",
      searchTerms: [title, skill.name, word],
    });

    expect(result.verdicts).toHaveLength(1);
  });

  it("skips the decision when the search finds nothing", async () => {
    const skill = await skillFixture();
    mockSearchTerms([uniqueWord()]);
    const decisionSpy = mockDecision(null);

    const result = await resolveLibraryIdentity({
      request: lessonRequest({ skills: [{ id: skill.id, name: skill.name }], title: uniqueWord() }),
    });

    expect(result.kind).toBe("generate");
    expect(decisionSpy).not.toHaveBeenCalled();
  });

  it("keeps private requests in their owner's key space without searching", async () => {
    const [owner, otherOwner, skill] = await Promise.all([
      userFixture(),
      userFixture(),
      skillFixture(),
    ]);

    const key = buildLessonIdentityKey({
      courseId: course.id,
      level: "beginner",
      skillIds: [skill.id],
      targetLanguage: null,
    });

    const [ownLesson] = await Promise.all([
      libraryLessonFixture({
        identityKey: scopeIdentityKey({ key, ownerId: owner.id }),
        ownerId: owner.id,
        visibility: "private",
      }),
      libraryLessonFixture({ identityKey: key }),
    ]);

    const searchSpy = mockSearchTerms([]);
    const request = lessonRequest({ skills: [{ id: skill.id, name: skill.name }], title: "Ours" });

    await expect(
      resolveLibraryIdentity({ request: { ...request, ownerId: owner.id } }),
    ).resolves.toMatchObject({ id: ownLesson.id, kind: "existing", match: "exact" });

    await expect(
      resolveLibraryIdentity({ request: { ...request, ownerId: otherOwner.id } }),
    ).resolves.toStrictEqual({
      identityKey: scopeIdentityKey({ key, ownerId: otherOwner.id }),
      kind: "generate",
      searchTerms: [],
      verdicts: [],
    });

    expect(searchSpy).not.toHaveBeenCalled();
  });

  it("finds chapters by their objectives, with or without accents", async () => {
    const word = uniqueWord();

    const chapter = await libraryChapterFixture({
      language: "pt",
      objectives: [`Traçar o gráfico da função ${word}`],
      title: "Retas",
    });

    mockSearchTerms([`funcao ${word}`]);
    const decisionSpy = mockDecision(chapter.id);

    const result = await resolveLibraryIdentity({
      request: {
        course: { id: randomUUID(), title: "Matemática" },
        description: "Funções do primeiro grau",
        kind: "chapter",
        language: "pt",
        level: "beginner",
        objectives: [],
        targetLanguage: null,
        title: "Função afim",
      },
    });

    expect(result).toMatchObject({ id: chapter.id, kind: "existing" });
    expect(getCandidateIds(decisionSpy)).toStrictEqual([chapter.id]);
  });

  it("follows a merged skill to the skill that survived", async () => {
    const survivor = await skillFixture();
    const name = `Calculate ${uniqueWord()}`;

    await skillFixture({
      identityKey: buildSkillIdentityKey({ name, targetLanguage: null }),
      mergedIntoId: survivor.id,
      name,
    });

    const result = await resolveLibraryIdentity({
      request: { description: "", kind: "skill", language: "en", name, targetLanguage: null },
    });

    expect(result).toMatchObject({ id: survivor.id, kind: "existing", match: "exact" });
  });

  it("never offers merged or private skills as candidates", async () => {
    const word = uniqueWord();

    const [owner, survivor] = await Promise.all([
      userFixture(),
      skillFixture({ name: `Read a ${word} chart` }),
    ]);

    await Promise.all([
      skillFixture({ mergedIntoId: survivor.id, name: `Read ${word} charts` }),
      skillFixture({
        identityKey: scopeIdentityKey({ key: word, ownerId: owner.id }),
        name: `Read our ${word} chart`,
        ownerId: owner.id,
        visibility: "private",
      }),
    ]);

    mockSearchTerms([word]);
    const decisionSpy = mockDecision(null);

    // The name's own unique word keeps other tests' public skills out of its words' matches.
    await resolveLibraryIdentity({
      request: {
        description: "",
        kind: "skill",
        language: "en",
        name: `Interpret a chart ${uniqueWord()}`,
        targetLanguage: null,
      },
    });

    expect(getCandidateIds(decisionSpy)).toStrictEqual([survivor.id]);
  });

  it("matches a source linked with a different URL form exactly", async () => {
    const path = randomUUID();
    const source = await sourceFixture({ identityKey: `example.test/editais/${path}` });

    const result = await resolveLibraryIdentity({
      request: {
        contentHash: null,
        kind: "source",
        language: "en",
        publisher: null,
        title: "Notice",
        url: `https://www.example.test/editais/${path}/?utm_source=mail`,
      },
    });

    expect(result).toMatchObject({ id: source.id, kind: "existing", match: "exact" });
  });
});

function skillRequest(name: string) {
  return { description: "", kind: "skill" as const, language: "en", name, targetLanguage: null };
}

function searchedTitles(): string[][] {
  return vi
    .mocked(generateSearchTerms)
    .mock.calls.map(([input]) => input.subjects.map((subject) => subject.item.title));
}

describe(resolveLibraryIdentities, () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("writes the terms of every request still unmatched in one call and answers in order", async () => {
    const [owner, word] = await Promise.all([userFixture(), Promise.resolve(uniqueWord())]);
    const exactName = `Round a price ${uniqueWord()}`;

    const [exact, found] = await Promise.all([
      skillFixture({
        identityKey: buildSkillIdentityKey({ name: exactName, targetLanguage: null }),
        name: exactName,
      }),
      skillFixture({ name: `Interpret a ${word} chart` }),
    ]);

    const [findsIt, findsNothing] = [
      `Read a chart ${uniqueWord()}`,
      `Tip a waiter ${uniqueWord()}`,
    ];

    mockSearchTermsFor((subject) => (subject.item.title === findsIt ? [word] : [uniqueWord()]));
    const decisionSpy = mockDecision(found.id);

    const results = await resolveLibraryIdentities({
      requests: [
        skillRequest(findsIt),
        skillRequest(exactName),
        { ...skillRequest(`Our chart ${uniqueWord()}`), ownerId: owner.id },
        skillRequest(findsNothing),
      ],
    });

    expect(results.map((result) => result.kind)).toStrictEqual([
      "existing",
      "existing",
      "generate",
      "generate",
    ]);

    expect(results[0]).toMatchObject({ id: found.id, match: "search" });
    expect(results[1]).toMatchObject({ id: exact.id, match: "exact" });
    expect(searchedTitles()).toStrictEqual([[findsIt, findsNothing]]);
    // Each request searched with its own terms: only the one whose terms find the skill was asked.
    expect(decisionSpy).toHaveBeenCalledOnce();
    expect(getCandidateIds(decisionSpy)).toStrictEqual([found.id]);
  });

  it("gives each request its own terms when a large batch is split across calls", async () => {
    const words = Array.from({ length: 10 }, () => uniqueWord());

    const skills = await Promise.all(
      words.map((word) => skillFixture({ name: `Explain ${word}` })),
    );

    const names = words.map(() => `Describe it ${uniqueWord()}`);

    mockSearchTermsFor((subject) => [words[names.indexOf(subject.item.title)] ?? uniqueWord()]);

    vi.mocked(decideLibraryIdentity).mockImplementation(({ candidates }) =>
      Promise.resolve({
        match: candidates[0] ? { id: candidates[0].id, model: "test/jev", probability: 1 } : null,
        verdicts: [],
      }),
    );

    const results = await resolveLibraryIdentities({
      requests: names.map((name) => skillRequest(name)),
    });

    expect(searchedTitles().map((titles) => titles.length)).toStrictEqual([5, 5]);

    expect(results.map((result) => (result.kind === "existing" ? result.id : null))).toStrictEqual(
      skills.map((skill) => skill.id),
    );
  });

  it("searches with terms the caller already wrote, without calling the model", async () => {
    const word = uniqueWord();
    const skill = await skillFixture({ name: `Interpret a ${word} chart` });
    mockDecision(skill.id);

    const [result] = await resolveLibraryIdentities({
      requests: [skillRequest(`Read a chart ${uniqueWord()}`)],
      searchTerms: [[word]],
    });

    expect(result).toMatchObject({ id: skill.id, kind: "existing", match: "search" });
    expect(generateSearchTerms).not.toHaveBeenCalled();
  });

  it("still searches an item's own words when the model wrote it no terms", async () => {
    const name = `Balance a ${uniqueWord()} budget`;
    const skill = await skillFixture({ name: `${name} each month` });
    mockSearchTermsFor(() => []);
    const decisionSpy = mockDecision(skill.id);

    const [result] = await resolveLibraryIdentities({ requests: [skillRequest(name)] });

    expect(result).toMatchObject({ id: skill.id, kind: "existing", match: "search" });
    expect(getCandidateIds(decisionSpy)).toStrictEqual([skill.id]);
  });
});
