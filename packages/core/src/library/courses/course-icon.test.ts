import { generateCourseIcon } from "@zoonk/ai/tasks/v2/courses/icon";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { uploadImage } from "../../images/upload-image";
import { drawBlankImage, drawTestImage } from "../media/_test-utils/image-mocks";
import { createCourseIcon } from "./course-icon";

/** The image model and Vercel Blob are external services; checks, optimizing and saving run for real. */
vi.mock("@zoonk/ai/tasks/v2/courses/icon", () => ({ generateCourseIcon: vi.fn() }));
vi.mock("../../images/upload-image", () => ({ uploadImage: vi.fn() }));

const ICON_URL = "https://blob.test/library/courses/immunology.webp";

function drawnIcon(
  image: Buffer,
  runId = "icon-run",
): Awaited<ReturnType<typeof generateCourseIcon>> {
  const result = {
    data: { image: { mediaType: "image/webp", uint8Array: new Uint8Array(image) } },
    provenance: {
      generatedAt: "2026-09-27T12:00:00.000Z",
      model: "openai/gpt-image-2.5-flare",
      promptVersion: "icon-v1",
      runId,
    },
  };

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Core reads only the image bytes.
  return result as unknown as Awaited<ReturnType<typeof generateCourseIcon>>;
}

describe(createCourseIcon, () => {
  beforeEach(() => {
    vi.mocked(uploadImage).mockResolvedValue({ data: ICON_URL, error: null });
  });

  it("draws, stores and links the icon of a shared course, drawing again after a blank frame", async () => {
    const [course, blank, icon] = await Promise.all([
      courseFixture({ description: "How the body fights germs", title: "Immunology" }),
      drawBlankImage(),
      drawTestImage(),
    ]);

    vi.mocked(generateCourseIcon)
      .mockResolvedValueOnce(drawnIcon(blank, "blank-run"))
      .mockResolvedValueOnce(drawnIcon(icon, "kept-run"));

    await expect(createCourseIcon({ courseId: course.id })).resolves.toBe(ICON_URL);

    const stored = await prisma.course.findUniqueOrThrow({ where: { id: course.id } });

    expect(stored).toMatchObject({
      iconGeneratedAt: new Date("2026-09-27T12:00:00.000Z"),
      iconModel: "openai/gpt-image-2.5-flare",
      iconPromptVersion: "icon-v1",
      iconRunId: "kept-run",
      imageUrl: ICON_URL,
    });

    expect(generateCourseIcon).toHaveBeenCalledTimes(2);

    expect(vi.mocked(generateCourseIcon).mock.calls[0]?.[0]).toMatchObject({
      description: "How the body fights germs",
      title: "Immunology",
    });

    expect(vi.mocked(uploadImage).mock.calls[0]?.[0].fileName).toBe(
      `library/courses/${course.slug}.webp`,
    );
  });

  it("goes without an icon when every drawing is blank", async () => {
    const [course, blank] = await Promise.all([courseFixture(), drawBlankImage()]);
    vi.mocked(generateCourseIcon).mockResolvedValue(drawnIcon(blank));

    await expect(createCourseIcon({ courseId: course.id })).resolves.toBeNull();

    const stored = await prisma.course.findUniqueOrThrow({ where: { id: course.id } });

    expect(stored).toMatchObject({ iconRunId: null, imageUrl: null });
    expect(uploadImage).not.toHaveBeenCalled();
  });

  it("keeps an existing icon and never draws one for private or language courses", async () => {
    const [withIcon, privateCourse, languageCourse] = await Promise.all([
      courseFixture({ imageUrl: "https://blob.test/old.webp" }),
      courseFixture({ visibility: "private" }),
      courseFixture({ targetLanguage: "es", title: "Espanhol" }),
    ]);

    await expect(createCourseIcon({ courseId: withIcon.id })).resolves.toBe(
      "https://blob.test/old.webp",
    );

    await expect(createCourseIcon({ courseId: privateCourse.id })).resolves.toBeNull();
    await expect(createCourseIcon({ courseId: languageCourse.id })).resolves.toBeNull();
    expect(generateCourseIcon).not.toHaveBeenCalled();
  });
});
