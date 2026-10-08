import { randomUUID } from "node:crypto";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
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

/** A request whose own title and skill match nothing, so only the mocked terms find lessons. */
async function lessonRequest() {
  const skill = await skillFixture();

  return {
    course: { id: randomUUID(), title: "Everyday math" },
    description: "Work out a price after a discount",
    kind: "lesson" as const,
    language: "en",
    level: "beginner" as const,
    skills: [{ id: skill.id, name: skill.name }],
    targetLanguage: null,
    title: `Discounts ${uniqueWord()}`,
  };
}

describe("lesson identity search", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("finds a lesson through a term with stop words", async () => {
    const word = uniqueWord();

    const [request, target] = await Promise.all([
      lessonRequest(),
      libraryLessonFixture({ title: `Introduction to the ${word}` }),
    ]);

    mockSearchTerms([`Introduction to the ${word}`]);
    const decisionSpy = mockDecision(target.id);

    await resolveLibraryIdentity({ request });

    expect(getCandidateIds(decisionSpy)).toStrictEqual([target.id]);
  });

  it("finds an eligible lesson when more ineligible lessons share its words than a term ranks", async () => {
    const word = uniqueWord();
    const owner = await userFixture();

    const ineligible = [
      { language: "pt" },
      { level: "intermediate" as const },
      { targetLanguage: "es" },
      { ownerId: owner.id, visibility: "private" as const },
    ];

    await Promise.all(
      Array.from({ length: MAX_MATCHES_PER_TERM + 1 }, (_, index) =>
        libraryLessonFixture({
          ...ineligible[index % ineligible.length],
          title: `Percent ${word}`,
        }),
      ),
    );

    const [request, target] = await Promise.all([
      lessonRequest(),
      libraryLessonFixture({ title: `Percent ${word}` }),
    ]);

    mockSearchTerms([word]);
    const decisionSpy = mockDecision(target.id);

    await resolveLibraryIdentity({ request });

    expect(getCandidateIds(decisionSpy)).toStrictEqual([target.id]);
  });

  it("ranks a lesson matching a specific term first when a broad term matches too many to rank", async () => {
    const [broad, specific] = [uniqueWord(), uniqueWord()];

    await Promise.all(
      Array.from({ length: MAX_MATCHES_PER_TERM + 1 }, () =>
        libraryLessonFixture({ title: `Percent ${broad}` }),
      ),
    );

    const [request, target] = await Promise.all([
      lessonRequest(),
      libraryLessonFixture({ title: `Percent ${broad} ${specific}` }),
    ]);

    mockSearchTerms([broad, specific]);
    const decisionSpy = mockDecision(target.id);

    await resolveLibraryIdentity({ request });

    const candidateIds = getCandidateIds(decisionSpy);

    expect(candidateIds[0]).toBe(target.id);
    expect(candidateIds).toHaveLength(5);
  });
});
