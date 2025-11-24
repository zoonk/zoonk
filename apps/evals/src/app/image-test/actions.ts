"use server";

import { createCourseThumbnail } from "@zoonk/api/course-thumbnail";
import { parseFormField } from "@zoonk/utils/form";

export async function generateThumbnailAction(formData: FormData) {
  const title = parseFormField(formData, "title");

  if (!title) {
    return { error: "Title is required." };
  }

  const { data: imageUrl, error } = await createCourseThumbnail({ title });

  if (error) {
    console.error("Error generating thumbnail:", error);
    return { error: error.message };
  }

  return { imageUrl, success: true };
}
