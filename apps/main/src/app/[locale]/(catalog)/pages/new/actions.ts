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
    if (!(session.isAuth && session.userId)) {
      return {
        message: "You must be logged in to create a page",
        status: "error",
      };
    }

    // Validate inputs
    if (!name) {
      return {
        message: "Page name is required",
        status: "error",
      };
    }

    if (!slug) {
      return {
        message: "Page URL is required",
        status: "error",
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
      slug: page.slug,
      status: "success",
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to create page. Please try again.";

    return {
      message,
      status: "error",
    };
  }
}
