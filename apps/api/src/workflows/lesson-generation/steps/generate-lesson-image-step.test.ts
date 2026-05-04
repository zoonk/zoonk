import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { generateContentThumbnailImage } from "@zoonk/core/content/thumbnail";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createLessonContext } from "./_test-utils/create-lesson-context";
import { generateLessonImageStep } from "./generate-lesson-image-step";

vi.mock("@zoonk/core/content/thumbnail", () => ({
  generateContentThumbnailImage: vi
    .fn()
    .mockResolvedValue({ data: "https://example.com/lesson.webp", error: null }),
}));

describe(generateLessonImageStep, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates a lesson thumbnail from the lesson title and description", async () => {
    const context = await createLessonContext({ organizationId, titlePrefix: "Thumbnail" });

    const result = await generateLessonImageStep(context);

    expect(result).toBe("https://example.com/lesson.webp");

    expect(generateContentThumbnailImage).toHaveBeenCalledWith({
      description: context.description,
      kind: "lesson",
      title: context.title,
    });

    expect(getStreamedEvents()).toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: "started", step: "generateLessonImage" }),
        expect.objectContaining({ status: "completed", step: "generateLessonImage" }),
      ]),
    );
  });

  it("returns null without streaming or calling AI for lesson kinds without thumbnails", async () => {
    const context = await createLessonContext({
      kind: "practice",
      organizationId,
      titlePrefix: "Practice Thumbnail",
    });

    const result = await generateLessonImageStep(context);

    expect(result).toBeNull();
    expect(generateContentThumbnailImage).not.toHaveBeenCalled();

    expect(getStreamedEvents()).not.toContainEqual(
      expect.objectContaining({ step: "generateLessonImage" }),
    );
  });

  it("throws when a lesson image is requested without a title", async () => {
    const context = await createLessonContext({
      organizationId,
      titlePrefix: "Missing Title Thumbnail",
    });

    await expect(generateLessonImageStep({ ...context, title: null })).rejects.toThrow(
      "Lesson image generation requires a lesson title",
    );

    expect(generateContentThumbnailImage).not.toHaveBeenCalled();
  });
});
