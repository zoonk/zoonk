import { randomUUID } from "node:crypto";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { aiOrganizationFixture, organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { describe, expect, it } from "vitest";
import { getCompletedLanguageCourseHrefs } from "./language-course";

/**
 * Creates a source-language value that no seeded course should use, so each
 * test can assert the full returned href map without depending on cleanup.
 */
function getUniqueSourceLanguage() {
  return `q${randomUUID().slice(0, 8)}`;
}

/**
 * Builds stable test slugs with a readable prefix so failed assertions make it
 * clear which fixture was supposed to be returned.
 */
function getCourseSlug(label: string) {
  return `language-href-${label}-${randomUUID().slice(0, 8)}`;
}

describe(getCompletedLanguageCourseHrefs, () => {
  it("returns hrefs for completed published AI language courses in the source language", async () => {
    const organization = await aiOrganizationFixture();
    const language = getUniqueSourceLanguage();
    const icelandicSlug = getCourseSlug("icelandic");
    const javaneseSlug = getCourseSlug("javanese");

    await Promise.all([
      courseFixture({
        generationStatus: "completed",
        isPublished: true,
        language,
        organizationId: organization.id,
        slug: icelandicSlug,
        targetLanguage: "is",
      }),
      courseFixture({
        generationStatus: "completed",
        isPublished: true,
        language,
        organizationId: organization.id,
        slug: javaneseSlug,
        targetLanguage: "jv",
      }),
    ]);

    const hrefs = await getCompletedLanguageCourseHrefs({ language });

    expect(hrefs).toStrictEqual({
      is: `/b/${AI_ORG_SLUG}/c/${icelandicSlug}`,
      jv: `/b/${AI_ORG_SLUG}/c/${javaneseSlug}`,
    });
  });

  it("ignores courses that are not eligible completed language courses", async () => {
    const [aiOrganization, otherOrganization] = await Promise.all([
      aiOrganizationFixture(),
      organizationFixture(),
    ]);

    const language = getUniqueSourceLanguage();
    const eligibleSlug = getCourseSlug("eligible");

    await Promise.all([
      courseFixture({
        generationStatus: "completed",
        isPublished: true,
        language,
        organizationId: aiOrganization.id,
        slug: eligibleSlug,
        targetLanguage: "is",
      }),
      courseFixture({
        generationStatus: "completed",
        isPublished: true,
        language: getUniqueSourceLanguage(),
        organizationId: aiOrganization.id,
        targetLanguage: "jv",
      }),
      courseFixture({
        generationStatus: "completed",
        isPublished: false,
        language,
        organizationId: aiOrganization.id,
        targetLanguage: "jv",
      }),
      courseFixture({
        generationStatus: "pending",
        isPublished: true,
        language,
        organizationId: aiOrganization.id,
        targetLanguage: "jv",
      }),
      courseFixture({
        generationStatus: "completed",
        isPublished: true,
        language,
        organizationId: otherOrganization.id,
        targetLanguage: "jv",
      }),
      courseFixture({
        generationStatus: "completed",
        isPublished: true,
        language,
        organizationId: aiOrganization.id,
        targetLanguage: "xx",
      }),
      courseFixture({
        generationStatus: "completed",
        isPublished: true,
        language,
        organizationId: aiOrganization.id,
        targetLanguage: null,
      }),
    ]);

    const hrefs = await getCompletedLanguageCourseHrefs({ language });

    expect(hrefs).toStrictEqual({ is: `/b/${AI_ORG_SLUG}/c/${eligibleSlug}` });
  });

  it("uses the newest completed course when a target language has duplicates", async () => {
    const organization = await aiOrganizationFixture();
    const language = getUniqueSourceLanguage();
    const newerSlug = getCourseSlug("newer");

    await Promise.all([
      courseFixture({
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        generationStatus: "completed",
        isPublished: true,
        language,
        organizationId: organization.id,
        slug: getCourseSlug("older"),
        targetLanguage: "is",
      }),
      courseFixture({
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
        generationStatus: "completed",
        isPublished: true,
        language,
        organizationId: organization.id,
        slug: newerSlug,
        targetLanguage: "is",
      }),
    ]);

    const hrefs = await getCompletedLanguageCourseHrefs({ language });

    expect(hrefs).toStrictEqual({ is: `/b/${AI_ORG_SLUG}/c/${newerSlug}` });
  });
});
