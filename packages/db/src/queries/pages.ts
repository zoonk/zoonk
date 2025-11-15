import "server-only";

import { prisma } from "../index";
import type { Page, PageMember } from "../models";

export async function getPage(params: { slug: string }) {
  const { slug } = params;

  return prisma.page.findUnique({
    where: { slug },
  });
}

export async function createPage(params: Page) {
  return prisma.page.create({
    data: params,
  });
}

export async function updatePage(slug: string, params: Partial<Page>) {
  return prisma.page.update({
    data: params,
    where: { slug },
  });
}

export async function deletePage(slug: string) {
  return prisma.page.delete({
    where: { slug },
  });
}

export async function getPageMember(params: {
  pageId: number;
  userId: string;
}) {
  const { pageId, userId } = params;

  return prisma.pageMember.findUnique({
    where: {
      pageUser: { pageId, userId },
    },
  });
}

export async function createPageMember(params: PageMember) {
  return prisma.pageMember.create({
    data: params,
  });
}

export async function updatePageMember(params: PageMember) {
  const { pageId, userId, role } = params;

  return prisma.pageMember.update({
    data: { role },
    where: {
      pageUser: { pageId, userId },
    },
  });
}

export async function deletePageMember(params: {
  pageId: number;
  userId: string;
}) {
  const { pageId, userId } = params;

  return prisma.pageMember.delete({
    where: {
      pageUser: { pageId, userId },
    },
  });
}
