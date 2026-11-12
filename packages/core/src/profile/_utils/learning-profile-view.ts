import { BuddyGlasses, type UserLearningProfile, prisma } from "@zoonk/db";
import { toCountryChoice } from "../../goals/_utils/content-country-view";
import {
  type RecentCountries,
  getCountrySuggestions,
  loadRecentCountries,
} from "../../goals/_utils/country-suggestions";
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
  recent: RecentCountries;
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
    // These feed the "Where you live" picker, where a "where you live" tag would repeat its title.
    suggested: getCountrySuggestions({
      homeCountry: profile?.homeCountry ?? null,
      language,
      recent,
    }).map((country) => ({ ...country, tag: null })),
  };
}

/** GETs supply their request facts; write responses omit them for fresh reads. */
export async function findLearningProfileView({
  knownProfile,
  language = "en",
  readRecentCountries = loadRecentCountries,
  userId,
}: {
  knownProfile?: UserLearningProfile | null | Promise<UserLearningProfile | null>;
  language?: string;
  readRecentCountries?: typeof loadRecentCountries;
  userId: string;
}): Promise<LearningProfileView> {
  const [profile, availableGlasses, recent] = await Promise.all([
    knownProfile === undefined
      ? prisma.userLearningProfile.findUnique({ where: { userId } })
      : knownProfile,
    listAvailableGlasses(userId),
    readRecentCountries(userId),
  ]);

  return toLearningProfileView({ availableGlasses, language, profile, recent });
}
