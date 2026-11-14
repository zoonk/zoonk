import "server-only";
import { type ContentFixUnit, prisma } from "@zoonk/db";
import { getMainPageUrl } from "@zoonk/utils/url";

export type ContentFixLocation = {
  adminHref: string | null;
  language: string | null;
  /** What a language course teaches; `language` is the language it's taught in. */
  targetLanguage?: string;
  mainUrl: string | null;
  /** From the course down to what the fix changes; empty once the content was deleted. */
  trail: string[];
};

type Unit = { unit: ContentFixUnit; unitId: string };

const courseSelect = {
  id: true,
  language: true,
  organization: { select: { slug: true } },
  slug: true,
  title: true,
} as const;

const chapterSelect = {
  homeCourse: { select: courseSelect },
  id: true,
  language: true,
  slug: true,
  title: true,
} as const;

type CourseRow = {
  id: string;
  language: string;
  organization: { slug: string } | null;
  slug: string;
  title: string;
};

type ChapterRow = {
  homeCourse: CourseRow | null;
  id: string;
  language: string;
  slug: string;
  title: string;
};

function coursePath(course: CourseRow | null): string | null {
  return course?.organization ? `/b/${course.organization.slug}/c/${course.slug}` : null;
}

function mainUrl({ language, path }: { language: string; path: string | null }): string | null {
  return path ? getMainPageUrl({ locale: language, path }) : null;
}

function courseLocation(course: CourseRow): ContentFixLocation {
  return {
    adminHref: `/courses/${course.id}`,
    language: course.language,
    mainUrl: mainUrl({ language: course.language, path: coursePath(course) }),
    trail: [course.title],
  };
}

function chapterLocation(chapter: ChapterRow): ContentFixLocation {
  const course = coursePath(chapter.homeCourse);

  return {
    adminHref: chapter.homeCourse ? `/courses/${chapter.homeCourse.id}` : null,
    language: chapter.language,
    mainUrl: mainUrl({
      language: chapter.language,
      path: course ? `${course}/ch/${chapter.slug}` : null,
    }),
    trail: [chapter.homeCourse?.title, chapter.title].filter((title) => title !== undefined),
  };
}

function idsOf(units: readonly Unit[], kind: ContentFixUnit): string[] {
  return [...new Set(units.filter((unit) => unit.unit === kind).map((unit) => unit.unitId))];
}

async function loadLessons(ids: string[]) {
  const lessons = await prisma.lesson.findMany({
    select: {
      homeChapter: { select: chapterSelect },
      id: true,
      language: true,
      targetLanguage: true,
      title: true,
    },
    where: { id: { in: ids } },
  });

  return lessons.map((lesson): [string, ContentFixLocation] => [
    lesson.id,
    {
      adminHref: `/lessons/${lesson.id}`,
      language: lesson.language,
      targetLanguage: lesson.targetLanguage ?? undefined,
      mainUrl: mainUrl({ language: lesson.language, path: `/learn/${lesson.id}` }),
      trail: [
        ...(lesson.homeChapter ? chapterLocation(lesson.homeChapter).trail : []),
        lesson.title,
      ],
    },
  ]);
}

async function loadChapters(ids: string[]) {
  const chapters = await prisma.chapter.findMany({
    select: chapterSelect,
    where: { id: { in: ids } },
  });

  return chapters.map((chapter): [string, ContentFixLocation] => [
    chapter.id,
    chapterLocation(chapter),
  ]);
}

async function loadCourses(ids: string[]) {
  const courses = await prisma.course.findMany({
    select: courseSelect,
    where: { id: { in: ids } },
  });

  return courses.map((course): [string, ContentFixLocation] => [course.id, courseLocation(course)]);
}

async function loadItems(ids: string[]) {
  const items = await prisma.item.findMany({
    select: { id: true, skill: { select: { language: true, name: true } } },
    where: { id: { in: ids } },
  });

  return items.map((item): [string, ContentFixLocation] => [
    item.id,
    {
      adminHref: `/items/${item.id}`,
      language: item.skill.language,
      mainUrl: null,
      trail: [item.skill.name, "Practice question"],
    },
  ]);
}

async function loadLevelTests(ids: string[]) {
  const banks = await prisma.languageLevelTest.findMany({
    select: { id: true, language: true, targetLanguage: true },
    where: { id: { in: ids } },
  });

  return banks.map((bank): [string, ContentFixLocation] => [
    bank.id,
    {
      adminHref: null,
      language: bank.language,
      targetLanguage: bank.targetLanguage,
      mainUrl: null,
      trail: ["Level test"],
    },
  ]);
}

async function loadShared(units: readonly Unit[]): Promise<[string, ContentFixLocation][]> {
  const [skills, sources, exams, assets, sets, warmUps] = await Promise.all([
    prisma.skill.findMany({
      select: { id: true, language: true, name: true },
      where: { id: { in: idsOf(units, "skill") } },
    }),
    prisma.source.findMany({
      select: { id: true, language: true, title: true },
      where: { id: { in: idsOf(units, "source") } },
    }),
    prisma.examBlueprint.findMany({
      select: { id: true, language: true, name: true },
      where: { id: { in: idsOf(units, "examBlueprint") } },
    }),
    prisma.mediaAsset.findMany({
      select: { alt: true, id: true, language: true },
      where: { id: { in: idsOf(units, "mediaAsset") } },
    }),
    prisma.itemSet.findMany({
      select: { id: true, language: true },
      where: { id: { in: idsOf(units, "itemSet") } },
    }),
    prisma.warmUp.findMany({
      select: { id: true, language: true },
      where: { id: { in: idsOf(units, "warmUp") } },
    }),
  ]);

  return [
    ...skills.map((row) => ({ ...row, title: row.name })),
    ...sources,
    ...exams.map((row) => ({ ...row, title: row.name })),
    ...assets.map((row) => ({ ...row, title: row.alt ?? "Media asset" })),
    ...sets.map((row) => ({ ...row, title: "Question set" })),
    ...warmUps.map((row) => ({ ...row, title: "Warm-up deck" })),
  ].map((row) => [
    row.id,
    { adminHref: null, language: row.language, mainUrl: null, trail: [row.title] },
  ]);
}

async function loadVocabulary(units: readonly Unit[]): Promise<[string, ContentFixLocation][]> {
  const [words, sentences] = await Promise.all([
    prisma.word.findMany({
      select: { id: true, targetLanguage: true, word: true },
      where: { id: { in: idsOf(units, "word") } },
    }),
    prisma.sentence.findMany({
      select: { id: true, sentence: true, targetLanguage: true },
      where: { id: { in: idsOf(units, "sentence") } },
    }),
  ]);

  return [
    ...words.map((row) => ({ ...row, title: `Word “${row.word}”` })),
    ...sentences.map((row) => ({ ...row, title: `Sentence “${row.sentence}”` })),
  ].map((row) => [
    row.id,
    { adminHref: null, language: row.targetLanguage, mainUrl: null, trail: [row.title] },
  ]);
}

async function loadBrands(units: readonly Unit[]): Promise<[string, ContentFixLocation][]> {
  const [products, brands] = await Promise.all([
    prisma.product.findMany({
      select: { id: true, name: true, organization: { select: { name: true } } },
      where: { id: { in: idsOf(units, "product") } },
    }),
    prisma.organization.findMany({
      select: { id: true, name: true },
      where: { id: { in: idsOf(units, "organization") } },
    }),
  ]);

  return [
    ...products.map((row) => ({ id: row.id, trail: [row.organization.name, row.name] })),
    ...brands.map((row) => ({ id: row.id, trail: [row.name] })),
  ].map((row) => [row.id, { adminHref: null, language: null, mainUrl: null, trail: row.trail }]);
}

const MISSING: ContentFixLocation = { adminHref: null, language: null, mainUrl: null, trail: [] };

/** Where each fix's content lives now, read fresh: a fix keeps plain ids, so the content may be gone. */
export async function loadContentFixLocations(units: readonly Unit[]) {
  const [lessons, chapters, courses, items, levelTests, shared, vocabulary, brands] =
    await Promise.all([
      loadLessons(idsOf(units, "lesson")),
      loadChapters(idsOf(units, "chapter")),
      loadCourses(idsOf(units, "course")),
      loadItems(idsOf(units, "item")),
      loadLevelTests(idsOf(units, "levelTest")),
      loadShared(units),
      loadVocabulary(units),
      loadBrands(units),
    ]);

  const graphs: [string, ContentFixLocation][] = units
    .filter((unit) => unit.unit === "examSkillGraph" || unit.unit === "languageSkillGraph")
    .map((unit) => [
      unit.unitId,
      {
        adminHref: null,
        language: null,
        mainUrl: null,
        trail: [unit.unit === "examSkillGraph" ? "Exam skill graph" : "Language skill graph"],
      },
    ]);

  const locations = new Map([
    ...graphs,
    ...lessons,
    ...chapters,
    ...courses,
    ...items,
    ...levelTests,
    ...shared,
    ...vocabulary,
    ...brands,
  ]);

  return (unit: Unit): ContentFixLocation => locations.get(unit.unitId) ?? MISSING;
}
