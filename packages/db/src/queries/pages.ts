import "server-only";

import { prisma } from "../index";

export type PageRole = "admin" | "editor";

export type CreatePageInput = {
  name: string;
  slug: string;
  description?: string | null;
  website?: string | null;
  image?: string | null;
  xUrl?: string | null;
  instagramUrl?: string | null;
  linkedinUrl?: string | null;
  threadsUrl?: string | null;
  youtubeUrl?: string | null;
  tiktokUrl?: string | null;
  githubUrl?: string | null;
  userId: string;
};

export type UpdatePageInput = {
  slug: string;
  name?: string;
  description?: string | null;
  website?: string | null;
  image?: string | null;
  xUrl?: string | null;
  instagramUrl?: string | null;
  linkedinUrl?: string | null;
  threadsUrl?: string | null;
  youtubeUrl?: string | null;
  tiktokUrl?: string | null;
  githubUrl?: string | null;
  newSlug?: string;
};

export async function createPage(input: CreatePageInput) {
  const { userId, ...pageData } = input;

  return prisma.page.create({
    data: {
      ...pageData,
      members: {
        create: {
          userId,
          role: "admin",
        },
      },
    },
    include: {
      members: true,
    },
  });
}

export async function findPageBySlug(slug: string) {
  return prisma.page.findUnique({
    where: { slug },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      },
    },
  });
}

export async function updatePage(input: UpdatePageInput) {
  const { slug, newSlug, ...updateData } = input;

  return prisma.page.update({
    where: { slug },
    data: {
      ...updateData,
      ...(newSlug ? { slug: newSlug } : {}),
    },
  });
}

export async function deletePage(slug: string) {
  return prisma.page.delete({
    where: { slug },
  });
}

export async function checkPageMemberRole(params: {
  pageId: string;
  userId: string;
  role?: PageRole;
}) {
  const { pageId, userId, role } = params;

  const member = await prisma.pageMember.findUnique({
    where: {
      pageId_userId: { pageId, userId },
    },
  });

  if (!member) {
    return false;
  }

  if (role) {
    return member.role === role;
  }

  return true;
}

export async function isPageAdmin(pageId: string, userId: string) {
  return checkPageMemberRole({ pageId, userId, role: "admin" });
}

export async function checkSlugAvailability(slug: string) {
  const existing = await prisma.page.findUnique({
    where: { slug },
    select: { id: true },
  });

  return !existing;
}
