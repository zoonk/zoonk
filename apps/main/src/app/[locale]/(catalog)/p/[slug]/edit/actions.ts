"use server";

import { del, put } from "@vercel/blob";
import { revalidatePath, revalidateTag } from "next/cache";
import { updatePageApi } from "@zoonk/api/pages";
import { verifySession } from "@/lib/auth/dal";

export type UpdatePageState = {
  status: "idle" | "error" | "success";
  message?: string;
  newSlug?: string;
};

async function handleImageUpload(
  imageFile: File | null,
  currentImage: string | null,
  removeImage: boolean,
  slug: string,
): Promise<string | null> {
  let imageUrl = currentImage;

  // Handle new image upload
  if (imageFile && imageFile.size > 0) {
    // Delete old image if exists
    if (currentImage) {
      try {
        await del(currentImage);
      } catch (error) {
        console.error("Failed to delete old image:", error);
      }
    }

    // Upload new image
    const blob = await put(`pages/${slug}-${Date.now()}.webp`, imageFile, {
      access: "public",
      addRandomSuffix: true,
    });
    return blob.url;
  }

  // Handle image removal
  if (removeImage && currentImage) {
    try {
      await del(currentImage);
    } catch (error) {
      console.error("Failed to delete image:", error);
    }
    return null;
  }

  return imageUrl;
}

export async function updatePageAction(
  _prevState: UpdatePageState,
  formData: FormData,
): Promise<UpdatePageState> {
  const slug = String(formData.get("slug") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const newSlug = String(formData.get("newSlug") || "").trim();
  const description = String(formData.get("description") || "").trim() || null;
  const website = String(formData.get("website") || "").trim() || null;
  const xUrl = String(formData.get("xUrl") || "").trim() || null;
  const instagramUrl =
    String(formData.get("instagramUrl") || "").trim() || null;
  const linkedinUrl = String(formData.get("linkedinUrl") || "").trim() || null;
  const threadsUrl = String(formData.get("threadsUrl") || "").trim() || null;
  const youtubeUrl = String(formData.get("youtubeUrl") || "").trim() || null;
  const tiktokUrl = String(formData.get("tiktokUrl") || "").trim() || null;
  const githubUrl = String(formData.get("githubUrl") || "").trim() || null;
  const currentImage =
    String(formData.get("currentImage") || "").trim() || null;

  try {
    // Verify session
    const session = await verifySession();
    if (!session.isAuth || !session.userId) {
      return {
        status: "error",
        message: "You must be logged in to edit a page",
      };
    }

    // Validate inputs
    if (!name) {
      return {
        status: "error",
        message: "Page name is required",
      };
    }

    if (!slug) {
      return {
        status: "error",
        message: "Original slug is required",
      };
    }

    // Handle image upload
    const imageFile = formData.get("image") as File | null;
    const removeImage = formData.get("removeImage") === "true";
    const imageUrl = await handleImageUpload(
      imageFile,
      currentImage,
      removeImage,
      slug,
    );

    // Update page
    const updatedPage = await updatePageApi(
      {
        slug,
        name,
        newSlug: newSlug || undefined,
        description,
        website,
        image: imageUrl,
        xUrl,
        instagramUrl,
        linkedinUrl,
        threadsUrl,
        youtubeUrl,
        tiktokUrl,
        githubUrl,
      },
      session.userId,
    );

    // Revalidate
    const finalSlug = newSlug || slug;
    revalidatePath(`/p/${slug}`, "page");
    revalidatePath(`/p/${finalSlug}`, "page");
    revalidateTag(`page-${slug}`, "max");
    revalidateTag(`page-${finalSlug}`, "max");

    return {
      status: "success",
      newSlug: updatedPage.slug !== slug ? updatedPage.slug : undefined,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to update page. Please try again.";

    return {
      status: "error",
      message,
    };
  }
}
