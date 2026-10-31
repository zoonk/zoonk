import { put } from "@vercel/blob";
import { generateCourseIcon } from "@zoonk/ai/tasks/courses/icon";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { storeBlobUploads } from "../../_test-utils/blob-uploads";
import { drawBlankImage, drawTestImage } from "../media/_test-utils/image-mocks";
import { drawCourseIcon, saveCourseIcon } from "./course-icon";

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

async function createCourseIcon(input: { courseId: string }) {
  const icon = await drawCourseIcon(input);
  return saveCourseIcon({ ...input, icon });
}

describe(drawCourseIcon, () => {
  beforeEach(() => {
    storeBlobUploads({ url: ICON_URL });
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

    expect(vi.mocked(put).mock.calls[0]?.[0]).toBe(`library/courses/${course.slug}.webp`);
  });

  it("skips saving an icon when its course was deleted after drawing", async () => {
    const course = await courseFixture();
    vi.mocked(generateCourseIcon).mockResolvedValue(drawnIcon(await drawTestImage()));
    const icon = await drawCourseIcon({ courseId: course.id });
    await prisma.course.delete({ where: { id: course.id } });
    await expect(saveCourseIcon({ courseId: course.id, icon })).resolves.toBeNull();
    expect(put).not.toHaveBeenCalled();
  });

  it("reuses a drawing after an upload fails", async () => {
    const course = await courseFixture();
    vi.mocked(generateCourseIcon).mockResolvedValue(drawnIcon(await drawTestImage()));
    const icon = await drawCourseIcon({ courseId: course.id });
    vi.mocked(put).mockRejectedValueOnce(new Error("upload failed"));
    await expect(saveCourseIcon({ courseId: course.id, icon })).rejects.toThrow("upload failed");
    await expect(saveCourseIcon({ courseId: course.id, icon })).resolves.toBe(ICON_URL);
    expect(generateCourseIcon).toHaveBeenCalledOnce();
  });

  it("goes without an icon when every drawing is blank", async () => {
    const [course, blank] = await Promise.all([courseFixture(), drawBlankImage()]);
    vi.mocked(generateCourseIcon).mockResolvedValue(drawnIcon(blank));

    await expect(createCourseIcon({ courseId: course.id })).resolves.toBeNull();

    const stored = await prisma.course.findUniqueOrThrow({ where: { id: course.id } });

    expect(stored).toMatchObject({ iconRunId: null, imageUrl: null });
    expect(put).not.toHaveBeenCalled();
  });

  it("keeps an existing icon and never draws one for private or language courses, or before a course from before learning v2 gets its new details", async () => {
    const [withIcon, privateCourse, languageCourse, legacyCourse] = await Promise.all([
      courseFixture({ imageUrl: "https://blob.test/old.webp" }),
      courseFixture({ visibility: "private" }),
      courseFixture({ targetLanguage: "es", title: "Espanhol" }),
      courseFixture({ legacyDetails: true }),
    ]);

    await expect(createCourseIcon({ courseId: withIcon.id })).resolves.toBe(
      "https://blob.test/old.webp",
    );

    await expect(createCourseIcon({ courseId: privateCourse.id })).resolves.toBeNull();
    await expect(createCourseIcon({ courseId: languageCourse.id })).resolves.toBeNull();
    await expect(createCourseIcon({ courseId: legacyCourse.id })).resolves.toBeNull();
    expect(generateCourseIcon).not.toHaveBeenCalled();
  });
});
