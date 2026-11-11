import { BuddyGlasses, type UserLearningProfile, prisma } from "@zoonk/db";
import { toCountryChoice } from "../../goals/_utils/content-country-view";
import { getCountrySuggestions, loadRecentCountries } from "../../goals/_utils/country-suggestions";
import { DEFAULT_BUDDY, resolveProfileBuddy } from "../default-buddy";
import { type LearningProfileView } from "../learning-profile-contract";

const STARTER_GLASSES = DEFAULT_BUDDY.glasses;

/** Round glasses are always available; other frames require their matching milestone. */
export async function listAvailableGlasses(userId: string): Promise<BuddyGlasses[]> {
  const milestones = await prisma.milestone.findMany({
    select: { key: true },
    where: { kind: "glasses", userId },
  });

  const earned = new Set(milestones.map((milestone) => milestone.key));

  return Object.values(BuddyGlasses).filter(
    (glasses) => glasses === STARTER_GLASSES || earned.has(glasses),
  );
}

function toLearningProfileView({
  availableGlasses,
  profile,
  language,
  recent,
}: {
  availableGlasses: BuddyGlasses[];
  profile: UserLearningProfile | null;
  language: string;
  recent: Awaited<ReturnType<typeof loadRecentCountries>>;
}): LearningProfileView {
  return {
    activeGoalId: profile?.activeGoalId ?? null,
    availableGlasses,
    buddy: resolveProfileBuddy(profile),
    homeCountry: profile?.homeCountry ?? null,
    homeCountryName:
      toCountryChoice({ code: profile?.homeCountry ?? null, language })?.name ?? null,
    shareUsageData: profile?.shareUsageData ?? null,
    soundsEnabled: profile?.soundsEnabled ?? true,
    suggested: getCountrySuggestions({
      homeCountry: profile?.homeCountry ?? null,
      language,
      recent,
    }),
  };
}

/** GETs supply their request fact; write responses omit it for a fresh read. */
export async function findLearningProfileView(
  userId: string,
  knownProfile?: UserLearningProfile | null | Promise<UserLearningProfile | null>,
  language = "en",
): Promise<LearningProfileView> {
  const [profile, availableGlasses, recent] = await Promise.all([
    knownProfile === undefined
      ? prisma.userLearningProfile.findUnique({ where: { userId } })
      : knownProfile,
    listAvailableGlasses(userId),
    loadRecentCountries(userId),
  ]);

  return toLearningProfileView({ availableGlasses, language, profile, recent });
}
