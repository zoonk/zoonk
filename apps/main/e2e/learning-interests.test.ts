import { prisma } from "@zoonk/db";
import { expect, test } from "./fixtures";

test("suggested and custom interests survive a mobile save and reopening", async ({
  userWithoutProgress: page,
  noProgressUser,
}, testInfo) => {
  await prisma.userLearningProfile.upsert({
    create: { interests: ["science fiction", "Birdwatching"], userId: noProgressUser.id },
    update: { interests: ["science fiction", "Birdwatching"] },
    where: { userId: noProgressUser.id },
  });

  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/profile/interests");
  await expect(page.getByRole("checkbox", { exact: true, name: "Science fiction" })).toBeChecked();
  await expect(page.getByRole("textbox", { name: "Other interests" })).toHaveValue("Birdwatching");
  await page.getByRole("checkbox", { exact: true, name: "Technology" }).check();
  await page.getByRole("textbox", { name: "Other interests" }).fill("Birdwatching\nWoodworking");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status")).toHaveText("Your interests are saved.");

  const saved = await prisma.userLearningProfile.findUniqueOrThrow({
    where: { userId: noProgressUser.id },
  });

  expect(saved.interests).toEqual(["science fiction", "Technology", "Birdwatching", "Woodworking"]);
  await page.screenshot({ fullPage: true, path: testInfo.outputPath("interests-mobile.png") });
  await page.reload();
  await expect(page.getByRole("checkbox", { exact: true, name: "Science fiction" })).toBeChecked();
  await expect(page.getByRole("checkbox", { exact: true, name: "Technology" })).toBeChecked();

  await expect(page.getByRole("textbox", { name: "Other interests" })).toHaveValue(
    "Birdwatching\nWoodworking",
  );

  await page.getByRole("checkbox", { exact: true, name: "Technology" }).uncheck();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status")).toHaveText("Your interests are saved.");

  const updated = await prisma.userLearningProfile.findUniqueOrThrow({
    where: { userId: noProgressUser.id },
  });

  expect(updated.interests).toEqual(["science fiction", "Birdwatching", "Woodworking"]);
});
