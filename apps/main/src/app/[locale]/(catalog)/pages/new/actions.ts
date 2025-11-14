"use server";

import { createPageApi } from "@zoonk/api/pages";
import { revalidatePath, revalidateTag } from "next/cache";
import { verifySession } from "@/lib/auth/dal";

export type CreatePageState = {
  status: "idle" | "error" | "success";
  message?: string;
  slug?: string;
};

export async function createPageAction(
  _prevState: CreatePageState,
  formData: FormData,
): Promise<CreatePageState> {
  const name = String(formData.get("name") || "").trim();
  const slug = String(formData.get("slug") || "").trim();

  try {
    // Verify session
    const session = await verifySession();
    if (!session.isAuth || !session.userId) {
      return {
        status: "error",
        message: "You must be logged in to create a page",
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
        message: "Page URL is required",
      };
    }

    // Create page
    const page = await createPageApi({
      name,
      slug,
      userId: session.userId,
    });

    // Revalidate
    revalidatePath(`/p/${page.slug}`, "page");
    revalidateTag(`page-${page.slug}`, "max");

    return {
      status: "success",
      slug: page.slug,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to create page. Please try again.";

    return {
      status: "error",
      message,
    };
  }
}
