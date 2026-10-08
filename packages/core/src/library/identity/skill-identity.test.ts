import { courseFixture } from "@zoonk/testing/fixtures/courses";
import {
  chapterSkillFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { buildSkillIdentityKey, scopeIdentityKey } from "@zoonk/utils/identity-key";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getCandidateIds,
  mockDecision,
  mockSearchTerms,
  uniqueWord,
} from "./_test-utils/identity-mocks";
import { MAX_MATCHES_PER_TERM } from "./_utils/text-search-sql";
import { resolveLibraryIdentity } from "./resolve-library-identity";

vi.mock("@zoonk/ai/tasks/v2/identity/decision", () => ({ decideLibraryIdentity: vi.fn() }));
vi.mock("@zoonk/ai/tasks/v2/identity/search-terms", () => ({ generateSearchTerms: vi.fn() }));

function skillRequest({ name, ownerId }: { name: string; ownerId?: string }) {
  return {
    description: "",
    kind: "skill" as const,
    language: "en",
    name,
    ownerId,
    targetLanguage: null,
  };
}

describe("private skill identity", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("matches a private skill only for its owner", async () => {
    const [owner, otherLearner] = await Promise.all([userFixture(), userFixture()]);
    const name = `Close ${uniqueWord()} tickets`;
    const key = buildSkillIdentityKey({ name, targetLanguage: null });

    const ownSkill = await skillFixture({
      identityKey: scopeIdentityKey({ key, ownerId: owner.id }),
      name,
      ownerId: owner.id,
      visibility: "private",
    });

    mockSearchTerms([]);

    await expect(
      resolveLibraryIdentity({ request: skillRequest({ name, ownerId: owner.id }) }),
    ).resolves.toMatchObject({ id: ownSkill.id, match: "exact" });

    await expect(
      resolveLibraryIdentity({ request: skillRequest({ name, ownerId: otherLearner.id }) }),
    ).resolves.toMatchObject({
      identityKey: scopeIdentityKey({ key, ownerId: otherLearner.id }),
      kind: "generate",
    });
  });

  it("never hands a private skill to others, even under a public key", async () => {
    const owner = await userFixture();
    const word = uniqueWord();
    const name = `File a ${word} report`;

    const misfiled = await skillFixture({
      identityKey: buildSkillIdentityKey({ name, targetLanguage: null }),
      name,
      ownerId: owner.id,
      visibility: "private",
    });

    const publicSkill = await skillFixture({ name: `Write a ${word} report` });

    mockSearchTerms([word]);
    const decisionSpy = mockDecision(null);

    const result = await resolveLibraryIdentity({ request: skillRequest({ name }) });

    expect(result).toMatchObject({ kind: "generate" });
    expect(getCandidateIds(decisionSpy)).toStrictEqual([publicSkill.id]);
    expect(getCandidateIds(decisionSpy)).not.toContain(misfiled.id);
  });
});

describe("skill identity decision", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("gives the decision the course a skill is studied in and the courses each candidate is taught in", async () => {
    const word = uniqueWord();

    const [portuguese, skill] = await Promise.all([
      courseFixture({ title: "Língua Portuguesa" }),
      skillFixture({ name: `Inferir ${word} de textos` }),
    ]);

    const chapter = await libraryChapterFixture({ homeCourseId: portuguese.id });
    await chapterSkillFixture({ chapterId: chapter.id, skillId: skill.id });

    mockSearchTerms([word]);
    const decisionSpy = mockDecision(null);

    await resolveLibraryIdentity({
      request: {
        ...skillRequest({ name: `Inferir ${word} entre textos` }),
        course: "Língua Inglesa",
      },
    });

    const [input] = decisionSpy.mock.calls[0] ?? [];

    expect(input?.subject.item.courses).toStrictEqual(["Língua Inglesa"]);

    expect(input?.candidates).toStrictEqual([
      expect.objectContaining({
        id: skill.id,
        item: expect.objectContaining({ courses: ["Língua Portuguesa"] }),
      }),
    ]);
  });
});

describe("skill identity search", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("ranks a skill matching a specific term first when a broad term matches too many to rank", async () => {
    const [broad, specific] = [uniqueWord(), uniqueWord()];

    await Promise.all(
      Array.from({ length: MAX_MATCHES_PER_TERM + 1 }, () =>
        skillFixture({ name: `Read ${broad} charts` }),
      ),
    );

    const target = await skillFixture({ name: `Read ${broad} ${specific} charts` });

    mockSearchTerms([broad, specific]);
    const decisionSpy = mockDecision(target.id);

    await resolveLibraryIdentity({ request: skillRequest({ name: `Plot ${uniqueWord()}` }) });

    const candidateIds = getCandidateIds(decisionSpy);

    expect(candidateIds[0]).toBe(target.id);
    expect(candidateIds).toHaveLength(5);
  });
});
