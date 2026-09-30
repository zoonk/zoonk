import { randomUUID } from "node:crypto";
import { decideLibraryIdentity } from "@zoonk/ai/tasks/v2/identity/decision";
import { generateSearchTerms } from "@zoonk/ai/tasks/v2/identity/search-terms";
import { type LibraryIdentitySubject } from "@zoonk/ai/tasks/v2/identity/subject";
import { vi } from "vitest";

const MATCH_PROBABILITY = 0.9;
const MISS_PROBABILITY = 0.1;

/**
 * Model calls are the one external boundary in identity tests: the AI gateway
 * is blocked in tests and real verdicts aren't deterministic. Test files mock
 * both task modules with `vi.mock`; the database search between the two model
 * steps runs for real. This gives every subject of a call the same terms.
 */
export function mockSearchTerms(terms: string[]) {
  return mockSearchTermsFor(() => terms);
}

/** Gives each subject of a call the terms `write` returns for it. */
export function mockSearchTermsFor(write: (subject: LibraryIdentitySubject) => string[]) {
  return vi.mocked(generateSearchTerms).mockImplementation(({ subjects }) =>
    Promise.resolve(
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Identity search only reads the terms, not the task's prompts or provenance.
      { data: { subjects: subjects.map((subject) => ({ terms: write(subject) })) } } as Awaited<
        ReturnType<typeof generateSearchTerms>
      >,
    ),
  );
}

export function mockDecision(matchId: string | null) {
  return vi
    .mocked(decideLibraryIdentity)
    .mockImplementation(({ candidates }) =>
      Promise.resolve({
        match: matchId ? { id: matchId, model: "test/jev", probability: MATCH_PROBABILITY } : null,
        verdicts: candidates.map((candidate) => ({
          id: candidate.id,
          model: "test/jev",
          probability: candidate.id === matchId ? MATCH_PROBABILITY : MISS_PROBABILITY,
        })),
      }),
    );
}

/** A word no other test's rows contain, so text search results belong to this test. */
export function uniqueWord(): string {
  return `zq${randomUUID().replaceAll("-", "").slice(0, 10)}`;
}

export function getCandidateIds(spy: ReturnType<typeof mockDecision>): string[] {
  return spy.mock.calls[0]?.[0].candidates.map((candidate) => candidate.id) ?? [];
}
