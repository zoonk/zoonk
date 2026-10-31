import { prisma } from "@zoonk/db";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { headers } from "next/headers";
import { describe, expect, it, vi } from "vitest";
import { mockGuestSession, mockSession } from "../_test-utils/mock-session";
import { checkBirthYear } from "./check-birth-year";
import { saveBirthYear } from "./save-birth-year";

const THIS_YEAR = new Date().getUTCFullYear();

function fromCountry(country: string) {
  vi.mocked(headers).mockResolvedValue(new Headers({ "x-vercel-ip-country": country }));
}

async function savedBirthYear(userId: string) {
  const profile = await prisma.userLearningProfile.findUnique({ where: { userId } });
  return profile?.birthYear ?? null;
}

describe(saveBirthYear, () => {
  it("saves a guest's year without making other settings", async () => {
    const user = await userFixture();
    await prisma.user.update({ data: { isAnonymous: true }, where: { id: user.id } });
    mockGuestSession(user.id);
    fromCountry("BR");

    const result = await saveBirthYear({ birthYear: THIS_YEAR - 15 });

    expect(result).toMatchObject({
      profile: { birthYear: THIS_YEAR - 15, shareUsageData: null },
      status: "saved",
    });

    await expect(
      prisma.userLearningProfile.findUnique({ where: { userId: user.id } }),
    ).resolves.toMatchObject({ birthYear: THIS_YEAR - 15, buddyKind: null, soundsEnabled: true });
  });

  it("saves nothing below the country's minimum age and says what it is", async () => {
    const user = await userFixture();
    mockSession(user.id);
    fromCountry("KR");

    await expect(saveBirthYear({ birthYear: THIS_YEAR - 14 })).resolves.toStrictEqual({
      minimumAge: 14,
      status: "belowMinimumAge",
    });

    await expect(savedBirthYear(user.id)).resolves.toBeNull();
  });

  it("keeps the first year a learner gave", async () => {
    const user = await userFixture();
    await learningProfileFixture({ birthYear: 1990, userId: user.id });
    mockSession(user.id);
    fromCountry("US");

    const result = await saveBirthYear({ birthYear: THIS_YEAR - 5 });

    expect(result).toMatchObject({ profile: { birthYear: 1990 }, status: "saved" });
    await expect(savedBirthYear(user.id)).resolves.toBe(1990);
  });

  it("refuses a year in the future", async () => {
    const user = await userFixture();
    mockSession(user.id);
    fromCountry("US");

    await expect(saveBirthYear({ birthYear: THIS_YEAR + 1 })).resolves.toStrictEqual({
      status: "invalidBirthYear",
    });
  });

  it("needs a session", async () => {
    mockSession(null);
    fromCountry("US");

    await expect(saveBirthYear({ birthYear: 1990 })).resolves.toStrictEqual({
      status: "unauthorized",
    });
  });
});

describe(checkBirthYear, () => {
  it("answers a visitor without an account, by the minimum age where they are", async () => {
    mockSession(null);
    fromCountry("IT");

    await expect(checkBirthYear({ birthYear: THIS_YEAR - 14 })).resolves.toStrictEqual({
      minimumAge: 14,
      status: "belowMinimumAge",
    });

    fromCountry("BR");

    await expect(checkBirthYear({ birthYear: THIS_YEAR - 14 })).resolves.toStrictEqual({
      status: "allowed",
    });
  });
});
