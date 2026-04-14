"use server";

import { isAdmin } from "@/lib/admin-guard";
import { processAndUploadImage } from "@zoonk/core/images/process-and-upload";
import { parseStepContent } from "@zoonk/core/steps/contract/content";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { parseBigIntId } from "@zoonk/utils/number";
import { revalidatePath } from "next/cache";

export async function uploadStepImageAction(
  params: {
    stepId: string;
    imageTarget: "visual" | number;
  },
  formData: FormData,
): Promise<{ error: string | null; imageUrl: string | null }> {
  if (!(await isAdmin())) {
    return { error: "Unauthorized", imageUrl: null };
  }

  const stepId = parseBigIntId(params.stepId);

  if (!stepId) {
    return { error: "Invalid step ID", imageUrl: null };
  }

  const { imageTarget } = params;
  const file = formData.get("file");

  if (!(file && file instanceof File)) {
    return { error: "No file provided", imageUrl: null };
  }

  const targetLabel = imageTarget === "visual" ? "visual" : `option-${imageTarget}`;
  const { data: imageUrl, error: uploadError } = await processAndUploadImage({
    file,
    fileName: `steps/admin-review/${stepId}-${targetLabel}.webp`,
  });

  if (uploadError) {
    const errorMessages: Record<typeof uploadError, string> = {
      invalidType: "Invalid file type. Please upload a JPEG, PNG, WebP, or GIF image.",
      optimizeFailed: "Failed to process image. Please try again.",
      tooLarge: "File is too large. Maximum size is 5MB.",
      uploadFailed: "Failed to upload image. Please try again.",
    };

    return { error: errorMessages[uploadError], imageUrl: null };
  }

  const step = await prisma.step.findUnique({ where: { id: stepId } });

  if (!step) {
    return { error: "Step not found", imageUrl: null };
  }

  const { error: updateError } = await safeAsync(() => {
    if (imageTarget === "visual") {
      const visual = parseStepContent("visual", step.content);
      return prisma.step.update({
        data: { content: { ...visual, url: imageUrl } },
        where: { id: stepId },
      });
    }

    const content = parseStepContent("selectImage", step.content);
    const updatedOptions = content.options.map((option, index) =>
      index === imageTarget ? { ...option, url: imageUrl } : option,
    );

    return prisma.step.update({
      data: { content: { ...content, options: updatedOptions } },
      where: { id: stepId },
    });
  });

  if (updateError) {
    return { error: "Failed to update step. Please try again.", imageUrl: null };
  }

  revalidatePath("/review");
  return { error: null, imageUrl };
}
