import { prisma } from "@zoonk/db";
import { courseCategoryFixture, courseFixture } from "@zoonk/testing/fixtures/courses";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import {
  brandFixture,
  productFixture,
  productReleaseFixture,
} from "@zoonk/testing/fixtures/products";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import {
  approve,
  proposeFix,
  revertFix,
  signInApprover,
  signInProposer,
} from "./_test-utils/content-fix-steps";
import { proposeContentFix } from "./propose-content-fix";

async function approveFix(input: unknown) {
  await signInProposer();
  const fix = await proposeFix(input);
  const { key } = await signInApprover();
  return { decision: await approve({ fixId: fix.id, key }), fix };
}

async function revertAndApprove(fixId: string) {
  await signInProposer();
  const revert = await revertFix({ fixId, reason: "Put it back." });

  if (revert.status !== "proposed") {
    throw new Error(`Expected a revert, got ${revert.status}`);
  }

  const { key } = await signInApprover();
  return approve({ fixId: revert.fix.id, key });
}

async function proposeRefused(change: unknown) {
  await signInProposer();
  return proposeContentFix({ changes: [change], reason: "Test fix" });
}

function categoriesOf(courseId: string) {
  return prisma.courseCategory
    .findMany({ orderBy: { category: "asc" }, where: { courseId } })
    .then((rows) => rows.map((row) => row.category));
}

describe("course category fixes", () => {
  it("files a public course under the categories sent, and its revert files it back", async () => {
    const course = await courseFixture({ visibility: "public" });
    await courseCategoryFixture({ category: "science", courseId: course.id });

    const { decision, fix } = await approveFix({
      changes: [{ id: course.id, model: "Course", setCategories: ["health", "tech"] }],
      reason: "The course teaches health apps.",
    });

    expect(decision).toMatchObject({ fix: { status: "applied" } });
    await expect(categoriesOf(course.id)).resolves.toStrictEqual(["health", "tech"]);

    await expect(revertAndApprove(fix.id)).resolves.toMatchObject({ fix: { status: "applied" } });
    await expect(categoriesOf(course.id)).resolves.toStrictEqual(["science"]);
  });

  it("files an uncategorized course, and its revert leaves it uncategorized again", async () => {
    const course = await courseFixture({ visibility: "public" });

    const { fix } = await approveFix({
      changes: [{ id: course.id, model: "Course", setCategories: ["tech"] }],
      reason: "The course teaches an app.",
    });

    await expect(revertAndApprove(fix.id)).resolves.toMatchObject({ fix: { status: "applied" } });
    await expect(categoriesOf(course.id)).resolves.toStrictEqual([]);
  });

  it("refuses a category the catalog doesn't have and a private course", async () => {
    const [course, owned] = await Promise.all([
      courseFixture({ visibility: "public" }),
      courseFixture({ visibility: "private" }),
    ]);

    await expect(
      proposeRefused({ id: course.id, model: "Course", setCategories: ["cooking"] }),
    ).resolves.toMatchObject({ status: "invalid" });

    await expect(
      proposeRefused({ id: owned.id, model: "Course", setCategories: ["tech"] }),
    ).resolves.toMatchObject({ status: "invalid" });
  });
});

describe("product fixes", () => {
  it("fixes how a product's name is written and its description", async () => {
    const brand = await brandFixture();

    const product = await productFixture({
      name: "Nextjs",
      normalizedName: "nextjs",
      organizationId: brand.id,
    });

    const { decision } = await approveFix({
      changes: [
        {
          id: product.id,
          model: "Product",
          set: { description: "A React framework for websites.", name: "Next.js" },
        },
      ],
      reason: "The product writes its name with a dot.",
    });

    expect(decision).toMatchObject({ fix: { status: "applied" } });

    await expect(
      prisma.product.findUniqueOrThrow({ where: { id: product.id } }),
    ).resolves.toMatchObject({
      description: "A React framework for websites.",
      name: "Next.js",
      normalizedName: "nextjs",
    });
  });

  it("refuses a name research would no longer find the product by", async () => {
    const brand = await brandFixture();

    const product = await productFixture({
      name: "Nextjs",
      normalizedName: "nextjs",
      organizationId: brand.id,
    });

    await expect(
      proposeRefused({ id: product.id, model: "Product", set: { name: "Remix" } }),
    ).resolves.toMatchObject({ message: expect.stringContaining("nextjs"), status: "invalid" });
  });
});

describe("product release fixes", () => {
  it("fixes a release's dates, and its revert puts them back", async () => {
    const brand = await brandFixture();
    const product = await productFixture({ organizationId: brand.id });

    const release = await productReleaseFixture({
      productId: product.id,
      releasedAt: new Date("2026-10-01"),
      releasedMonthOnly: true,
    });

    const { decision, fix } = await approveFix({
      changes: [
        {
          id: release.id,
          model: "ProductRelease",
          set: { releasedAt: "2025-10-21", releasedMonthOnly: false, supportEndsAt: "2027-10-21" },
        },
      ],
      reason: "The release came out in October 2025.",
    });

    expect(decision).toMatchObject({ fix: { status: "applied" } });

    await expect(
      prisma.productRelease.findUniqueOrThrow({ where: { id: release.id } }),
    ).resolves.toMatchObject({
      releasedAt: new Date("2025-10-21"),
      releasedMonthOnly: false,
      supportEndsAt: new Date("2027-10-21"),
    });

    await expect(revertAndApprove(fix.id)).resolves.toMatchObject({ fix: { status: "applied" } });

    await expect(
      prisma.productRelease.findUniqueOrThrow({ where: { id: release.id } }),
    ).resolves.toMatchObject({
      releasedAt: new Date("2026-10-01"),
      releasedMonthOnly: true,
      supportEndsAt: null,
    });
  });

  it("refuses a month-only date with no date", async () => {
    const brand = await brandFixture();
    const product = await productFixture({ organizationId: brand.id });
    const release = await productReleaseFixture({ productId: product.id });

    await expect(
      proposeRefused({ id: release.id, model: "ProductRelease", set: { releasedMonthOnly: true } }),
    ).resolves.toMatchObject({ status: "invalid" });
  });
});

describe("brand fixes", () => {
  it("fixes the facts research wrote about a brand", async () => {
    const brand = await brandFixture();

    const { decision } = await approveFix({
      changes: [
        {
          id: brand.id,
          model: "Organization",
          set: { description: "Makes tools for the web.", name: "Vercel" },
        },
      ],
      reason: "The brand is Vercel.",
    });

    expect(decision).toMatchObject({ fix: { status: "applied" } });

    await expect(
      prisma.organization.findUniqueOrThrow({ where: { id: brand.id } }),
    ).resolves.toMatchObject({ description: "Makes tools for the web.", name: "Vercel" });
  });

  it("refuses an organization research didn't write, or one with members", async () => {
    const [account, member, user] = await Promise.all([
      organizationFixture(),
      brandFixture(),
      userFixture(),
    ]);

    await prisma.member.create({
      data: { organizationId: member.id, role: "member", userId: user.id },
    });

    await expect(
      proposeRefused({ id: account.id, model: "Organization", set: { name: "Renamed" } }),
    ).resolves.toMatchObject({ status: "invalid" });

    await expect(
      proposeRefused({ id: member.id, model: "Organization", set: { name: "Renamed" } }),
    ).resolves.toMatchObject({ status: "invalid" });
  });
});
