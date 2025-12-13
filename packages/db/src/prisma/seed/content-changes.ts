import type { Organization, PrismaClient } from "../../generated/prisma/client";
import type { SeedUsers } from "./users";

export async function seedContentChanges(
  prisma: PrismaClient,
  org: Organization,
  users: SeedUsers,
): Promise<void> {
  const mlCourse = await prisma.course.findFirst({
    where: { language: "en", slug: "machine-learning" },
  });

  if (!mlCourse) {
    return;
  }

  // Delete existing content changes for this course to avoid duplicates on re-seed
  await prisma.contentChange.deleteMany({
    where: { courseId: mlCourse.id },
  });

  // Approved change (already merged)
  await prisma.contentChange.create({
    data: {
      authorId: users.admin.id,
      contentId: mlCourse.id,
      contentType: "COURSE",
      courseId: mlCourse.id,
      diff: {
        description: {
          after: mlCourse.description,
          before: "Old description...",
        },
      },
      organizationId: org.id,
      reviewedAt: new Date(),
      reviewedById: users.owner.id,
      status: "APPROVED",
      title: "Updated course description",
    },
  });

  // Pending change (awaiting review)
  const pendingChange = await prisma.contentChange.create({
    data: {
      authorId: users.member.id,
      contentId: mlCourse.id,
      contentType: "COURSE",
      courseId: mlCourse.id,
      diff: {
        title: {
          after: "Machine Learning Fundamentals",
          before: mlCourse.title,
        },
      },
      organizationId: org.id,
      status: "PENDING",
      title: "Propose new title",
    },
  });

  // Rejected change
  await prisma.contentChange.create({
    data: {
      authorId: users.member.id,
      contentId: mlCourse.id,
      contentType: "COURSE",
      courseId: mlCourse.id,
      diff: {
        slug: {
          after: "ml",
          before: mlCourse.slug,
        },
      },
      organizationId: org.id,
      reviewedAt: new Date(),
      reviewedById: users.admin.id,
      status: "REJECTED",
      title: "Change slug (rejected)",
    },
  });

  // Seed threaded comments on the pending change
  await seedChangeComments(prisma, pendingChange.id, users);
}

async function seedChangeComments(
  prisma: PrismaClient,
  changeId: number,
  users: SeedUsers,
): Promise<void> {
  const rootComment = await prisma.changeComment.create({
    data: {
      authorId: users.admin.id,
      changeId,
      content:
        "I like this title change, but should we keep 'Machine Learning' at the start for SEO?",
    },
  });

  await prisma.changeComment.create({
    data: {
      authorId: users.member.id,
      changeId,
      content: "Good point! How about 'Machine Learning: A Practical Guide'?",
      parentId: rootComment.id,
    },
  });

  await prisma.changeComment.create({
    data: {
      authorId: users.owner.id,
      changeId,
      content: "I agree with the SEO concern. Let's keep ML first.",
      parentId: rootComment.id,
    },
  });
}
