import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { buildSkillIdentityKey } from "@zoonk/utils/identity-key";
import { normalizeString } from "@zoonk/utils/string";
import { describe, expect, it } from "vitest";
import { getGraphCourseCountry } from "../curriculum/curriculum-scope";
import { getWarmUpKey } from "../warm-ups/warm-up-key";
import { toTextSearch } from "./_utils/text-search-sql";
import { findCourseByTitle } from "./kinds/course-identity";
import { getLessonIdentitySearch } from "./kinds/lesson-identity";
import { getSkillIdentitySearch } from "./kinds/skill-identity";

describe("country-scoped reuse", () => {
  it("never reuses a Brazilian finance course in Portugal and keeps Brazilian reuse", async () => {
    const organization = await aiOrganizationFixture();
    const title = `Finanças pessoais ${crypto.randomUUID()}`;

    const course = await courseFixture({
      language: "pt",
      normalizedTitle: normalizeString(title),
      organizationId: organization.id,
      title,
    });

    const request = { language: "pt", ownerId: null, targetLanguage: null, title };

    await expect(findCourseByTitle({ ...request, country: "PT" })).resolves.toBeNull();

    await expect(findCourseByTitle({ ...request, country: "BR" })).resolves.toMatchObject({
      id: course.id,
    });

    await expect(findCourseByTitle(request)).resolves.toMatchObject({ id: course.id });
  });

  it("separates finance warm-ups while preserving the legacy own-country key", () => {
    const request = {
      generalGoal: "Finanças pessoais",
      kind: "learn" as const,
      language: "pt",
      ownerId: null,
      targetLanguage: null,
    };

    const legacy = getWarmUpKey(request);

    expect(getWarmUpKey({ ...request, country: "BR" })).toBe(legacy);
    expect(getWarmUpKey({ ...request, country: "PT" })).not.toBe(legacy);
  });

  it("excludes another country's skills and lessons from ranked reuse", async () => {
    const name = `Finanças pessoais ${crypto.randomUUID().replaceAll("-", "")}`;

    const skill = await skillFixture({
      identityKey: buildSkillIdentityKey({ name, targetLanguage: null }),
      language: "pt",
      name,
    });

    const lesson = await libraryLessonFixture({ language: "pt", level: "beginner", title: name });
    await lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id });
    const base = { language: "pt", ownerId: null, targetLanguage: null };
    const search = toTextSearch({ language: "pt", terms: [name] });

    if (!search) {
      throw new Error("Expected searchable finance title");
    }

    const skillRequest = { ...base, description: "Budgeting", kind: "skill" as const, name };

    const lessonRequest = {
      ...base,
      course: null,
      description: "Budgeting",
      kind: "lesson" as const,
      level: "beginner" as const,
      skills: [{ id: skill.id, name }],
      title: name,
    };

    await expect(
      getSkillIdentitySearch({ ...skillRequest, country: "PT" }).findExact(),
    ).resolves.toBeNull();

    await expect(
      getSkillIdentitySearch({ ...skillRequest, country: "BR" }).findExact(),
    ).resolves.toBe(skill.id);

    await expect(
      getSkillIdentitySearch({ ...skillRequest, country: "PT" }).findCandidateIds(search),
    ).resolves.not.toContain(skill.id);

    await expect(
      getLessonIdentitySearch({ ...lessonRequest, country: "PT" }).findCandidateIds(search),
    ).resolves.not.toContain(lesson.id);

    await expect(
      getLessonIdentitySearch({ ...lessonRequest, country: "BR" }).findCandidateIds(search),
    ).resolves.toContain(lesson.id);
  });

  it("keeps a general statistics course shared across learners' countries", async () => {
    const organization = await aiOrganizationFixture();
    const title = `Estatística ${crypto.randomUUID()}`;

    const course = await courseFixture({
      language: "pt",
      normalizedTitle: normalizeString(title),
      organizationId: organization.id,
      title,
    });

    const scope = {
      generalGoal: "Estatística",
      language: "pt",
      ownerId: null,
      targetLanguage: null,
    };

    const general = { countrySpecific: false, key: "statistics" };

    await Promise.all(
      ["PT", "BR"].map(async (country) => {
        const countryScope = getGraphCourseCountry({
          course: general,
          scope: { ...scope, country },
        });

        await expect(
          findCourseByTitle({ ...scope, country: countryScope, title }),
        ).resolves.toMatchObject({ id: course.id });
      }),
    );
  });
});
