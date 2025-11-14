import "server-only";

import {
  type CreatePageInput,
  type UpdatePageInput,
  checkSlugAvailability,
  createPage,
  deletePage,
  findPageBySlug,
  isPageAdmin,
  updatePage,
} from "@zoonk/db";
import { isValidSlug } from "@zoonk/utils/validation";

export type CreatePageApiInput = Omit<CreatePageInput, "userId"> & {
  userId: string;
};

export type UpdatePageApiInput = UpdatePageInput;

export async function createPageApi(input: CreatePageApiInput) {
  const { slug } = input;

  // Validate slug format
  if (!isValidSlug(slug)) {
    throw new Error(
      "Invalid page URL. Only lowercase letters, numbers, and hyphens are allowed. Must be 2-63 characters.",
    );
  }

  // Check slug availability
  const isAvailable = await checkSlugAvailability(slug);
  if (!isAvailable) {
    throw new Error("This page URL is already taken. Please choose another.");
  }

  return createPage(input);
}

export async function getPageBySlug(slug: string) {
  return findPageBySlug(slug);
}

export async function updatePageApi(input: UpdatePageApiInput, userId: string) {
  const page = await findPageBySlug(input.slug);

  if (!page) {
    throw new Error("Page not found");
  }

  // Check if user is admin
  const isAdmin = await isPageAdmin(page.id, userId);
  if (!isAdmin) {
    throw new Error("You do not have permission to edit this page");
  }

  // If slug is changing, validate new slug
  if (input.newSlug && input.newSlug !== input.slug) {
    if (!isValidSlug(input.newSlug)) {
      throw new Error(
        "Invalid page URL. Only lowercase letters, numbers, and hyphens are allowed. Must be 2-63 characters.",
      );
    }

    const isAvailable = await checkSlugAvailability(input.newSlug);
    if (!isAvailable) {
      throw new Error("This page URL is already taken. Please choose another.");
    }
  }

  return updatePage(input);
}

export async function deletePageApi(slug: string, userId: string) {
  const page = await findPageBySlug(slug);

  if (!page) {
    throw new Error("Page not found");
  }

  // Check if user is admin
  const isAdmin = await isPageAdmin(page.id, userId);
  if (!isAdmin) {
    throw new Error("You do not have permission to delete this page");
  }

  return deletePage(slug);
}

export async function checkUserIsPageAdmin(slug: string, userId: string) {
  const page = await findPageBySlug(slug);

  if (!page) {
    return false;
  }

  return isPageAdmin(page.id, userId);
}
