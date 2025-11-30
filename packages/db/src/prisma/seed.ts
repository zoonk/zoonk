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
