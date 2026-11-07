import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { brandFixture, productFixture } from "@zoonk/testing/fixtures/products";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { describe, expect, it } from "vitest";
import {
  getCandidateIds,
  mockDecision,
  mockSearchTerms,
  uniqueWord,
} from "./_test-utils/identity-mocks";
import { resolveLibraryIdentity } from "./resolve-library-identity";

async function productCourses() {
  const brand = await brandFixture();
  const product = await productFixture({ organizationId: brand.id });
  const home = { organizationId: brand.id, productId: product.id };

  const [main, pinned, otherPinned, general] = await Promise.all([
    courseFixture({ ...home, title: "Gadget" }),
    courseFixture({ ...home, isPinned: true, title: "Gadget 2" }),
    courseFixture({ ...home, isPinned: true, title: "Gadget 1" }),
    courseFixture({ title: "Everyday tech" }),
  ]);

  return { general, main, otherPinned, pinned };
}

function chapterRequest({ course, word }: { course: { id: string; title: string }; word: string }) {
  return {
    course: { id: course.id, title: course.title },
    description: "Keep the device charged",
    kind: "chapter" as const,
    language: "en",
    level: "beginner" as const,
    objectives: [],
    targetLanguage: null,
    title: `Charging ${word}`,
  };
}

async function homedChapter({ courseId, word }: { courseId: string; word: string }) {
  return libraryChapterFixture({ homeCourseId: courseId, title: `Charging ${word}` });
}

async function chapterCandidates(request: ReturnType<typeof chapterRequest>, matchId: string) {
  mockSearchTerms([request.title]);
  const decision = mockDecision(matchId);
  await resolveLibraryIdentity({ request });
  return getCandidateIds(decision);
}

describe("chapter identity of pinned courses", () => {
  it("never offers a pinned course's chapter to another course", async () => {
    const word = uniqueWord();
    const { general, main, pinned } = await productCourses();

    const [fromMain, fromPinned] = await Promise.all([
      homedChapter({ courseId: main.id, word }),
      homedChapter({ courseId: pinned.id, word }),
    ]);

    const candidates = await chapterCandidates(
      chapterRequest({ course: general, word }),
      fromMain.id,
    );

    expect(candidates).toStrictEqual([fromMain.id]);
    expect(candidates).not.toContain(fromPinned.id);
  });

  it("offers a pinned course no chapter to reuse", async () => {
    const word = uniqueWord();
    const { general, pinned } = await productCourses();
    const generalChapter = await homedChapter({ courseId: general.id, word });

    const candidates = await chapterCandidates(
      chapterRequest({ course: pinned, word }),
      generalChapter.id,
    );

    expect(candidates).toStrictEqual([]);
  });
});

async function lessonRequest({
  course,
  word,
}: {
  course: { id: string; title: string };
  word: string;
}) {
  const skill = await skillFixture();

  return {
    course: { id: course.id, title: course.title },
    description: "Charge the battery without wearing it out",
    kind: "lesson" as const,
    language: "en",
    level: "beginner" as const,
    skills: [{ id: skill.id, name: skill.name }],
    targetLanguage: null,
    title: `Battery care ${word}`,
  };
}

async function homedLesson({ courseId, word }: { courseId: string; word: string }) {
  const chapter = await libraryChapterFixture({ homeCourseId: courseId });
  return libraryLessonFixture({ homeChapterId: chapter.id, title: `Battery care ${word}` });
}

async function lessonCandidates(request: Awaited<ReturnType<typeof lessonRequest>>) {
  mockSearchTerms([request.title]);
  const decision = mockDecision(null);
  await resolveLibraryIdentity({ request });
  return getCandidateIds(decision).toSorted();
}

describe("lesson identity of pinned courses", () => {
  it("offers another course no lesson homed in a pinned course", async () => {
    const word = uniqueWord();
    const { general, main, pinned } = await productCourses();

    const [fromMain, fromGeneral] = await Promise.all([
      homedLesson({ courseId: main.id, word }),
      homedLesson({ courseId: general.id, word }),
      homedLesson({ courseId: pinned.id, word }),
    ]);

    const candidates = await lessonCandidates(await lessonRequest({ course: main, word }));

    expect(candidates).toStrictEqual([fromMain.id, fromGeneral.id].toSorted());
  });

  it("offers a pinned course its own and general lessons, never its product's other courses'", async () => {
    const word = uniqueWord();
    const { general, main, otherPinned, pinned } = await productCourses();

    const [own, fromGeneral] = await Promise.all([
      homedLesson({ courseId: pinned.id, word }),
      homedLesson({ courseId: general.id, word }),
      homedLesson({ courseId: main.id, word }),
      homedLesson({ courseId: otherPinned.id, word }),
    ]);

    const candidates = await lessonCandidates(await lessonRequest({ course: pinned, word }));

    expect(candidates).toStrictEqual([own.id, fromGeneral.id].toSorted());
  });
});
