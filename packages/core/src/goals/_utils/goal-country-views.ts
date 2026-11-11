import "server-only";
import { type Goal, type UserLearningProfile, prisma } from "@zoonk/db";
import { getLanguageCountry } from "@zoonk/utils/countries";
import { isJsonObject } from "@zoonk/utils/json";
import { getAnsweredQuestions } from "../../view-models/onboarding/onboarding-steps";
import { type GoalContentCountry, type GoalCountryFields } from "../country-contract";
import { toContentCountryView, toCountryChoice } from "./content-country-view";
import { getCountrySuggestions, loadRecentCountries } from "./country-suggestions";

function getSource(details: Goal["details"]): GoalContentCountry["source"] {
  const source = isJsonObject(details) ? details.contentCountrySource : null;
  return source === "said" || source === "home" || source === "picked" ? source : "default";
}

function toGoalCountries({
  examCode,
  goal,
  homeCountry,
  rebuild,
  recent,
}: {
  examCode: string | null;
  goal: Goal;
  homeCountry: string | null;
  rebuild: GoalContentCountry["rebuild"];
  recent: Awaited<ReturnType<typeof loadRecentCountries>>;
}): GoalCountryFields {
  const { language } = goal;
  const own = getLanguageCountry(language);

  const dependent =
    goal.kind === "learn" && isJsonObject(goal.details) && goal.details.countryDependent === true;

  const general =
    goal.kind === "learn" && isJsonObject(goal.details) && goal.details.countryDependent === false;

  const exam = toCountryChoice({ code: examCode, language });
  let contentCountry: GoalContentCountry | null = null;
  const answered = getAnsweredQuestions(isJsonObject(goal.details) ? goal.details : {});

  if (
    dependent &&
    (goal.contentCountry ||
      answered.includes("contentCountry") ||
      getSource(goal.details) === "picked")
  ) {
    contentCountry = toContentCountryView({
      code: goal.contentCountry ?? own,
      editable: true,
      kind: "content",
      language,
      rebuild,
      source: getSource(goal.details),
    });
  } else if (goal.kind === "exam" && exam && exam.code !== own) {
    contentCountry = toContentCountryView({
      code: exam.code,
      editable: false,
      kind: "exam",
      language,
      source: "said",
    });
  }

  return {
    contentCountry,
    countryDependent: dependent,
    examCountry: goal.kind === "exam" ? exam : null,
    examplesCountry:
      general && homeCountry && homeCountry !== own
        ? toCountryChoice({ code: own, language })
        : null,
    languageCountry: toCountryChoice({ code: own, language }),
    suggested: getCountrySuggestions({ goalId: goal.id, homeCountry, language, recent }),
  };
}

export async function loadGoalCountryViews({
  goals,
  profile,
}: {
  goals: readonly Goal[];
  profile?: UserLearningProfile | null;
}) {
  const userId = goals[0]?.userId;

  if (!userId) {
    return [];
  }

  const [savedProfile, recent, rebuilds] = await Promise.all([
    profile === undefined ? prisma.userLearningProfile.findUnique({ where: { userId } }) : profile,
    loadRecentCountries(userId),
    prisma.followUp.findMany({
      select: { failedAt: true, input: true, key: true },
      where: { key: { in: goals.map((goal) => goal.id) }, kind: "rebuildGoalCurriculum", userId },
    }),
  ]);

  return goals.map((goal) => {
    const owed = rebuilds.find((row) => row.key === goal.id);
    const saved = owed && isJsonObject(owed.input) && owed.input.graphSaved === true;
    let rebuild: GoalContentCountry["rebuild"] = "none";

    if (owed && !saved) {
      rebuild = owed.failedAt ? "failed" : "preparing";
    }

    return {
      countries: toGoalCountries({
        examCode: recent.find((row) => row.id === goal.id)?.examBlueprint?.country ?? null,
        goal,
        homeCountry: savedProfile?.homeCountry ?? null,
        rebuild,
        recent,
      }),
      goal,
    };
  });
}
