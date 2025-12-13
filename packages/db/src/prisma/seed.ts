import { prisma } from "../index";
import { courses } from "./seed/courses";

async function main() {
  const owner = await prisma.user.upsert({
    create: {
      email: "owner@zoonk.test",
      emailVerified: true,
      name: "Owner User",
      role: "admin",
    },
    update: {},
    where: { email: "owner@zoonk.test" },
  });

  const admin = await prisma.user.upsert({
    create: {
      email: "admin@zoonk.test",
      emailVerified: true,
      name: "Admin User",
      role: "admin",
    },
    update: {},
    where: { email: "admin@zoonk.test" },
  });

  const member = await prisma.user.upsert({
    create: {
      email: "member@zoonk.test",
      emailVerified: true,
      name: "Member User",
      role: "member",
    },
    update: {},
    where: { email: "member@zoonk.test" },
  });

  const org = await prisma.organization.upsert({
    create: {
      members: {
        create: [
          { role: "owner", userId: owner.id },
          { role: "admin", userId: admin.id },
          { role: "member", userId: member.id },
        ],
      },
      name: "Zoonk AI",
      slug: "ai",
    },
    update: {},
    where: { slug: "ai" },
  });

  await Promise.all(
    courses.map((course) =>
      prisma.course.upsert({
        create: {
          authorId: owner.id,
          organizationId: org.id,
          ...course,
        },
        update: {},
        where: {
          orgSlug: {
            language: course.language,
            organizationId: org.id,
            slug: course.slug,
          },
        },
      }),
    ),
  );

  // Seed content changes and comments
  const mlCourse = await prisma.course.findFirst({
    where: { language: "en", slug: "machine-learning" },
  });

  if (mlCourse) {
    // Delete existing content changes for this course to avoid duplicates on re-seed
    await prisma.contentChange.deleteMany({
      where: { courseId: mlCourse.id },
    });

    // Approved change (already merged)
    await prisma.contentChange.create({
      data: {
        authorId: admin.id,
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
        reviewedById: owner.id,
        status: "APPROVED",
        title: "Updated course description",
      },
    });

    // Pending change (awaiting review)
    const pendingChange = await prisma.contentChange.create({
      data: {
        authorId: member.id,
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
        authorId: member.id,
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
        reviewedById: admin.id,
        status: "REJECTED",
        title: "Change slug (rejected)",
      },
    });

    // Threaded comments on the pending change
    const rootComment = await prisma.changeComment.create({
      data: {
        authorId: admin.id,
        changeId: pendingChange.id,
        content:
          "I like this title change, but should we keep 'Machine Learning' at the start for SEO?",
      },
    });

    await prisma.changeComment.create({
      data: {
        authorId: member.id,
        changeId: pendingChange.id,
        content: "Good point! How about 'Machine Learning: A Practical Guide'?",
        parentId: rootComment.id,
      },
    });

    await prisma.changeComment.create({
      data: {
        authorId: owner.id,
        changeId: pendingChange.id,
        content: "I agree with the SEO concern. Let's keep ML first.",
        parentId: rootComment.id,
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
