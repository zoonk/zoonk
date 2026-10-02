import { mediaAssetFixture } from "@zoonk/testing/fixtures/library-steps";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { buildImageReuseKey, scopeIdentityKey } from "@zoonk/utils/identity-key";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getCandidateIds,
  mockDecision,
  mockSearchTerms,
  uniqueWord,
} from "./_test-utils/identity-mocks";
import { resolveLibraryIdentity } from "./resolve-library-identity";

vi.mock("@zoonk/ai/tasks/v2/identity/decision", () => ({ decideLibraryIdentity: vi.fn() }));
vi.mock("@zoonk/ai/tasks/v2/identity/search-terms", () => ({ generateSearchTerms: vi.fn() }));

function imageRequest(overrides: {
  prompt: string;
  hasLabels?: boolean;
  language?: string;
  ownerId?: string | null;
  textAllowed?: boolean;
}) {
  return {
    hasLabels: false,
    kind: "image" as const,
    language: "pt",
    styleVersion: 1,
    textAllowed: true,
    ...overrides,
  };
}

function imageKey({ language, prompt }: { language: string | null; prompt: string }) {
  return buildImageReuseKey({ language, prompt, styleVersion: 1 });
}

describe("image identity", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("offers public images in the same style whose labels fit the lesson", async () => {
    const word = uniqueWord();
    const owner = await userFixture();
    const prompt = `Focal object: a ${word} on a scale.`;

    const [noText, portugueseLabels] = await Promise.all([
      mediaAssetFixture({
        prompt,
        reuseKey: imageKey({ language: null, prompt: `${prompt} 1` }),
        styleVersion: 1,
      }),
      mediaAssetFixture({
        language: "pt",
        prompt,
        reuseKey: imageKey({ language: "pt", prompt: `${prompt} 2` }),
        styleVersion: 1,
      }),
      mediaAssetFixture({
        language: "en",
        prompt,
        reuseKey: imageKey({ language: "en", prompt: `${prompt} 3` }),
        styleVersion: 1,
      }),
      mediaAssetFixture({
        prompt,
        reuseKey: buildImageReuseKey({ language: null, prompt, styleVersion: 2 }),
        styleVersion: 2,
      }),
      mediaAssetFixture({
        ownerId: owner.id,
        prompt,
        reuseKey: scopeIdentityKey({
          key: imageKey({ language: null, prompt: `${prompt} 4` }),
          ownerId: owner.id,
        }),
        styleVersion: 1,
        visibility: "private",
      }),
    ]);

    mockSearchTerms([word]);
    const decisionSpy = mockDecision(noText.id);

    await expect(
      resolveLibraryIdentity({ request: imageRequest({ prompt: `A ${word} being weighed` }) }),
    ).resolves.toMatchObject({ id: noText.id, match: "search" });

    expect(getCandidateIds(decisionSpy).toSorted()).toStrictEqual(
      [noText.id, portugueseLabels.id].toSorted(),
    );
  });

  it("offers only images without text to language courses", async () => {
    const word = uniqueWord();
    const prompt = `Focal object: a ${word} house.`;

    const [noText] = await Promise.all([
      mediaAssetFixture({
        prompt,
        reuseKey: imageKey({ language: null, prompt }),
        styleVersion: 1,
      }),
      mediaAssetFixture({
        language: "pt",
        prompt,
        reuseKey: imageKey({ language: "pt", prompt }),
        styleVersion: 1,
      }),
    ]);

    mockSearchTerms([word]);
    const decisionSpy = mockDecision(null);

    await resolveLibraryIdentity({
      request: imageRequest({ prompt: `A ${word} home`, textAllowed: false }),
    });

    expect(getCandidateIds(decisionSpy)).toStrictEqual([noText.id]);
  });

  it("matches the same scene exactly, with labels only in their language", async () => {
    const prompt = `Focal object: a ${uniqueWord()} price tag. Labels: "antes" next to the tag.`;

    const labeled = await mediaAssetFixture({
      language: "pt",
      prompt,
      reuseKey: imageKey({ language: "pt", prompt }),
      styleVersion: 1,
    });

    const searchSpy = mockSearchTerms([]);

    await expect(
      resolveLibraryIdentity({ request: imageRequest({ hasLabels: true, prompt: `${prompt}.` }) }),
    ).resolves.toMatchObject({ id: labeled.id, match: "exact" });

    await expect(
      resolveLibraryIdentity({
        request: imageRequest({ hasLabels: true, language: "es", prompt }),
      }),
    ).resolves.toMatchObject({
      identityKey: imageKey({ language: "es", prompt }),
      kind: "generate",
    });

    expect(searchSpy).toHaveBeenCalledOnce();
  });

  it("never gives a private image to another learner", async () => {
    const [owner, otherLearner] = await Promise.all([userFixture(), userFixture()]);
    const prompt = `Focal object: our ${uniqueWord()} dashboard.`;
    const key = imageKey({ language: null, prompt });

    const [ownImage] = await Promise.all([
      mediaAssetFixture({
        ownerId: owner.id,
        prompt,
        reuseKey: scopeIdentityKey({ key, ownerId: owner.id }),
        styleVersion: 1,
        visibility: "private",
      }),
      mediaAssetFixture({
        ownerId: otherLearner.id,
        prompt,
        reuseKey: key,
        styleVersion: 1,
        visibility: "private",
      }),
    ]);

    mockSearchTerms([]);

    await expect(
      resolveLibraryIdentity({ request: imageRequest({ ownerId: owner.id, prompt }) }),
    ).resolves.toMatchObject({ id: ownImage.id, match: "exact" });

    await expect(
      resolveLibraryIdentity({ request: imageRequest({ ownerId: otherLearner.id, prompt }) }),
    ).resolves.toMatchObject({ kind: "generate" });

    await expect(
      resolveLibraryIdentity({ request: imageRequest({ prompt }) }),
    ).resolves.toMatchObject({ identityKey: key, kind: "generate" });
  });
});
