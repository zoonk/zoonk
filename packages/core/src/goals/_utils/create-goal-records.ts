import "server-only";
import { type Goal, type OnboardingDraft, type TransactionClient } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { type EntitlementViewer } from "../../entitlements/_utils/entitlement-viewer";
import { claimBundleInWrite, openUsageLedgerInWrite } from "../../entitlements/bundle-claims";
import { type UsageDecision } from "../../entitlements/contract";
import { getCertificateLanguage } from "../../exams/language-exam";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { findCountryExamId } from "../../library/exams/exam-country";
import { linkGoalSources } from "../../library/sources/link-goal-sources";
import { findOwnSources } from "../../library/sources/own-sources";
import { fromIsoDate, toIsoDate } from "../../plans/planner/plan-calendar";
import { DAYS_PER_WEEK } from "../../plans/planner/plan-state";
import { type CourseStart } from "../course-start-details";
import { type GoalCreateInput, type GoalDraft, withoutCoreDetails } from "../goal-contract";
import { getCourseGoalIds } from "./find-course-goal";
import { resolveNewGoalCountry } from "./goal-content-country";
import { defaultDisplayName } from "./goal-display-name";
import { saveMetadataInTransaction } from "./goal-metadata";

function getWeekdayMinutes({
  dailyMinutes,
  studyDays,
}: {
  dailyMinutes: number;
  studyDays?: number[];
}) {
  if (!studyDays || new Set(studyDays).size === DAYS_PER_WEEK) {
    return null;
  }

  return Array.from({ length: DAYS_PER_WEEK }, (_, weekday) =>
    studyDays.includes(weekday) ? dailyMinutes : 0,
  );
}

/** The plan holds the exam subjects a goal is for, where every read of the exam's subjects finds them. */
function toScopeSettings(value: unknown): { examSubjects?: string[] } {
  const subjects = Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
  return subjects.length > 0 ? { examSubjects: subjects } : {};
}

function getCountryDetails(
  country: Awaited<ReturnType<typeof resolveNewGoalCountry>>,
  details: Record<string, unknown>,
) {
  const answered = Array.isArray(details.answered)
    ? details.answered.filter((value): value is string => typeof value === "string")
    : [];

  return country.countryDependent === null
    ? {}
    : {
        contentCountrySource: country.source,
        countryDependent: country.countryDependent,
        ...(country.source !== "default" && {
          answered: [...new Set([...answered, "contentCountry"])],
        }),
      };
}

export type CourseGoalOrigin = {
  country: string | null;
  details: CourseStart;
  courseId: string;
  sourceCourseId?: string;
};

export type CardPlace = { draftId: string; place: number };

export function getCardPlace(
  goal: Pick<Goal, "onboardingDraftId" | "onboardingPlace">,
): CardPlace | undefined {
  const { onboardingDraftId: draftId, onboardingPlace: place } = goal;
  return draftId === null || place === null ? undefined : { draftId, place };
}

function toCardColumns(card?: CardPlace) {
  return { onboardingDraftId: card?.draftId ?? null, onboardingPlace: card?.place ?? null };
}

type GoalRecord = {
  card?: CardPlace;
  courseStart?: CourseGoalOrigin;
  dailyMinutes: number;
  draft: GoalDraft;
  id: string;
  input: Pick<GoalCreateInput, "studyDays" | "studyTime" | "timeZone">;
  testedLanguage: string | null;
  userId: string;
};

type NewGoalRecord = GoalRecord & {
  input: GoalCreateInput;
  /** Material a request sent for its main goal, read only when the goal's card kept none. */
  sentSourceIds?: readonly string[];
  viewer: EntitlementViewer;
};

/** Runs in the caller's learner write, so a goal can be created atomically with other writes. */
export async function insertGoalWithPlan(
  tx: TransactionClient,
  {
    card,
    courseStart,
    dailyMinutes,
    draft,
    id,
    input,
    planShown = false,
    replacesGoalId,
    testedLanguage,
    userId,
  }: GoalRecord & {
    /** The learner reaches this goal's plan without a reveal, so none is owed. */
    planShown?: boolean;
    replacesGoalId?: string;
  },
): Promise<void> {
  const timeZone = getAnswerTimeZone({ goal: null, timeZone: input.timeZone });
  const { examSubjects, ...details } = draft.details ?? {};

  const country = await resolveNewGoalCountry({
    courseCountry: courseStart?.country,
    draft,
    tx,
    userId,
  });

  const examBlueprintId = await findCountryExamId(tx, {
    contentCountry: country.contentCountry,
    examBlueprintId: draft.examBlueprintId,
    kind: draft.kind,
  });

  await tx.goal.create({
    data: {
      contentCountry: country.contentCountry,
      dailyMinutes,
      details: {
        ...withoutCoreDetails(details),
        ...getCountryDetails(country, details),
        ...(courseStart && { courseStart: courseStart.details }),
      },
      displayName: draft.displayName ?? defaultDisplayName(draft),
      examBlueprintId,
      id,
      kind: draft.kind,
      language: draft.language,
      ...toCardColumns(card),
      planRevealedAt: planShown ? new Date() : null,
      primaryCourseId: draft.primaryCourseId ?? null,
      prompt: draft.prompt,
      replacesGoalId: replacesGoalId ?? null,
      sourceCourseId: courseStart?.sourceCourseId,
      studyTime: input.studyTime ?? null,
      targetDate: draft.targetDate ? fromIsoDate(draft.targetDate) : null,
      targetLanguage:
        (examBlueprintId ? testedLanguage : null) ??
        draft.targetLanguage ??
        getCertificateLanguage(draft),
      targetRegion: draft.targetRegion ?? null,
      timezone: input.timeZone ?? null,
      title: draft.title,
      userId,
    },
  });

  await tx.plan.create({
    data: {
      goalId: id,
      settings: {
        ...toScopeSettings(examSubjects),
        startDate: toIsoDate(getDateInTimeZone({ date: new Date(), timeZone })),
        ...(draft.kind === "language" && { stopsAtAim: true }),
        weekdayMinutes: getWeekdayMinutes({ dailyMinutes, studyDays: input.studyDays }),
      },
    },
  });
}

async function pauseGoal(
  tx: TransactionClient,
  { goalId, userId }: { goalId?: string; userId: string },
): Promise<void> {
  const goal = goalId
    ? await tx.goal.findFirst({
        where: { id: goalId, kind: { not: "explain" }, status: "active", userId },
      })
    : null;

  if (goal) {
    await saveMetadataInTransaction(tx, { goal, input: { status: "paused" }, userId });
  }
}

type CardMaterial = Pick<OnboardingDraft, "materialIntent" | "sourceIds">;

/** An archived goal frees its place, so the card can start it again. */
async function findCardGoal(
  tx: TransactionClient,
  { card, userId }: { card: CardPlace; userId: string },
): Promise<{ card?: CardPlace; goalId?: string; material?: CardMaterial }> {
  const draft = await tx.onboardingDraft.findFirst({
    select: {
      goals: {
        orderBy: { createdAt: "desc" },
        select: { id: true },
        take: 1,
        where: { onboardingPlace: card.place, status: { not: "archived" } },
      },
      materialIntent: true,
      sourceIds: true,
    },
    where: { id: card.draftId, userId },
  });

  if (!draft) {
    return {};
  }

  const { goals, ...material } = draft;
  const isMain = card.place === 0 && material.sourceIds.length > 0;

  return { card, goalId: goals[0]?.id, material: isMain ? material : undefined };
}

/** The draft's choice wins over the details a client sends, so a card confirmed as is keeps it. */
function withCardMaterialIntent({
  draft,
  material,
}: {
  draft: GoalDraft;
  material: CardMaterial;
}): GoalDraft {
  const { materialIntent: _sent, ...details } = draft.details ?? {};

  if (material.materialIntent === null) {
    return { ...draft, details };
  }

  const withIntent = { ...details, materialIntent: material.materialIntent };
  const needsPurpose = material.materialIntent === "understand" && !details.purpose;

  return { ...draft, details: needsPurpose ? { ...withIntent, purpose: "other" } : withIntent };
}

/** What resolves is linked: material that no longer names one of the learner's uploads is left out. */
async function linkMaterial(
  tx: TransactionClient,
  { goalId, sourceIds, userId }: { goalId: string; sourceIds: readonly string[]; userId: string },
): Promise<void> {
  const uploads = await findOwnSources({ db: tx, origin: "upload", sourceIds, userId });

  await linkGoalSources(tx, { goalId, origin: "upload", sourceIds: uploads.resolved, userId });
}

/**
 * Claims the goal in its own write, under the plan→user lock, so the claim's active-goal count is
 * the one the insert sees and a refused start charges nothing and leaves the goal it would have
 * paused active. The same lock makes the card lookup and the insert one step, so a card confirmed
 * twice, at once or after a lost response, gets the goal the first confirm made.
 */
export async function createGoal(
  record: NewGoalRecord,
): Promise<UsageDecision | { goalId: string; status: "existing" }> {
  const { draft, id, input, sentSourceIds = [], userId, viewer } = record;
  const isExplanation = draft.kind === "explain";

  return writeLearnerChange<UsageDecision, UsageDecision | { goalId: string; status: "existing" }>(
    { planInputs: true, userId },
    async (transaction) => {
      if (record.courseStart) {
        const goals = await getCourseGoalIds(transaction, userId);
        const existing = goals.get(record.courseStart.courseId);

        if (existing) {
          return unchanged({ goalId: existing, status: "existing" });
        }
      }

      const { card, goalId, material } = record.card
        ? await findCardGoal(transaction, { card: record.card, userId })
        : {};

      if (goalId) {
        return unchanged({ goalId, status: "existing" });
      }

      if (!isExplanation) {
        await pauseGoal(transaction, { goalId: input.pauseGoalId, userId });
      }

      const claims = [
        { generated: isExplanation, kind: isExplanation ? "explanation" : "goal", targetId: id },
      ] as const;

      const ledger = await openUsageLedgerInWrite({ claims, now: new Date(), transaction, viewer });
      const { decision } = await claimBundleInWrite({ claims, ledger, transaction });

      if (decision.status !== "allowed") {
        return unchanged(decision);
      }

      await insertGoalWithPlan(transaction, {
        ...record,
        card,
        draft: material && !isExplanation ? withCardMaterialIntent({ draft, material }) : draft,
      });

      await linkMaterial(transaction, {
        goalId: id,
        sourceIds: material?.sourceIds ?? sentSourceIds,
        userId,
      });

      return decision;
    },
  );
}

export async function setActiveGoal(
  tx: TransactionClient,
  { activeGoalId, userId }: { activeGoalId: string; userId: string },
): Promise<boolean> {
  const current = await tx.userLearningProfile.findUnique({ where: { userId } });

  if (current?.activeGoalId === activeGoalId) {
    return false;
  }

  await tx.userLearningProfile.upsert({
    create: { activeGoalId, userId },
    update: { activeGoalId },
    where: { userId },
  });

  return true;
}

export async function selectCreatedGoal({
  activeGoalId,
  userId,
}: {
  activeGoalId: string;
  userId: string;
}): Promise<void> {
  await writeLearnerChange({ planInputs: true, userId }, async (tx) =>
    (await setActiveGoal(tx, { activeGoalId, userId })) ? null : unchanged(null),
  );
}
