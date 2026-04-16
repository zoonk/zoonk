import { beforeEach, describe, expect, test, vi } from "vitest";
import { uploadCourseImageAction } from "./image";

const mocks = vi.hoisted(() => ({
  getAuthorizedCourse: vi.fn(),
  getErrorMessage: vi.fn(),
  getExtracted: vi.fn(),
  processAndUploadImage: vi.fn(),
  revalidatePath: vi.fn(),
  updateCourse: vi.fn(),
}));

vi.mock("@/data/courses/get-authorized-course", () => ({
  getAuthorizedCourse: mocks.getAuthorizedCourse,
}));

vi.mock("@/data/courses/update-course", () => ({
  updateCourse: mocks.updateCourse,
}));

vi.mock("@/lib/error-messages", () => ({
  getErrorMessage: mocks.getErrorMessage,
}));

vi.mock("@zoonk/core/images/process-and-upload", () => ({
  processAndUploadImage: mocks.processAndUploadImage,
}));

vi.mock("next-intl/server", () => ({
  getExtracted: mocks.getExtracted,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

function createFormData() {
  const formData = new FormData();
  formData.append("file", new File(["image"], "course.png", { type: "image/png" }));
  return formData;
}

describe(uploadCourseImageAction, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getErrorMessage.mockResolvedValue("Forbidden");
    mocks.getExtracted.mockResolvedValue((message: string) => message);
  });

  test("does not upload when course authorization fails", async () => {
    mocks.getAuthorizedCourse.mockResolvedValue({
      data: null,
      error: new Error("forbidden"),
    });

    const result = await uploadCourseImageAction({ courseId: "course-42" }, createFormData());

    expect(result).toEqual({ error: "Forbidden" });
    expect(mocks.getAuthorizedCourse).toHaveBeenCalledWith({ courseId: "course-42" });
    expect(mocks.processAndUploadImage).not.toHaveBeenCalled();
    expect(mocks.updateCourse).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  test("derives the upload path from the authorized course record", async () => {
    mocks.getAuthorizedCourse.mockResolvedValue({
      data: {
        id: "course-42",
        organization: { slug: "real-org" },
        slug: "real-course",
      },
      error: null,
    });
    mocks.processAndUploadImage.mockResolvedValue({
      data: "https://example.com/course.webp",
      error: null,
    });
    mocks.updateCourse.mockResolvedValue({
      data: { id: "course-42", imageUrl: "https://example.com/course.webp" },
      error: null,
    });

    const result = await uploadCourseImageAction({ courseId: "course-42" }, createFormData());

    expect(result).toEqual({ error: null });
    expect(mocks.processAndUploadImage).toHaveBeenCalledWith({
      file: expect.any(File),
      fileName: "courses/real-org/real-course.webp",
    });
    expect(mocks.updateCourse).toHaveBeenCalledWith({
      courseId: "course-42",
      imageUrl: "https://example.com/course.webp",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/real-org/c/real-course");
  });
});
