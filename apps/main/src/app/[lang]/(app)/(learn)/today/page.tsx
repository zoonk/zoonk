import { LazyStartClient } from "@/app/[lang]/(app)/(onboarding)/start/lazy-start-client";
import { loadStartView } from "@/app/[lang]/(app)/(onboarding)/start/start-view";
import { LessonPlayerPreload } from "@/app/[lang]/explain/[goalId]/lazy-lesson-player";
import { AuthGatePage } from "@/components/auth-gate";
import { NotFoundPage } from "@/components/errors/not-found-page";
import { hasSessionCookie } from "@zoonk/auth/cookies";
import { listCurrentUserGoals } from "@zoonk/core/goals/list-current-user";
import { type SuggestedGoalView } from "@zoonk/core/goals/suggestions/contract";
import { getUnfinishedOnboardingDraft } from "@zoonk/core/view-models/onboarding/unfinished-draft";
import {
  CURRENT_ROW_CLASS,
  ListGroup,
  ListRowContent,
  ListRowDescription,
  ListRowIcon,
  ListRowLeading,
  ListRowLink,
  ListRowTitle,
} from "@zoonk/learn/list";
import { Page } from "@zoonk/learn/page";
import { TodayPageHeader } from "@zoonk/learn/today/at-rest";
import { TodayShell } from "@zoonk/learn/today/shell";
import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { PlayIcon } from "lucide-react";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { cookies } from "next/headers";
import { Suspense } from "react";
import { LearnNotFound } from "../_components/learn-not-found";
import { type ReminderGoal, ReminderGoalNotice } from "./reminder-goal-notice";
import { SuggestedGoalClient, TodayClient } from "./today-client";
import { TodayGoalPaused } from "./today-goal-paused";
import { TodayOnboardingLeft, readOnboardingLeft } from "./today-onboarding-left";
import { TodayPreparingClient } from "./today-preparing-client";
import { loadTodayScreen } from "./today-view";
import { type UnfinishedGoal, UnfinishedGoalNotice } from "./unfinished-goal-notice";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { title: t("Today") };
}

async function WelcomeBack({ suggestion }: { suggestion: SuggestedGoalView }) {
  const t = await getExtracted();

  return (
    <Page className="gap-5">
      <TodayPageHeader title={t("Welcome back")} />
      <SuggestedGoalClient suggestion={suggestion} />
    </Page>
  );
}

type Explanation = { id: string; title: string };

/**
 * One row the learner taps to pick the explanation up, highlighted like Today's next row: the goal
 * box under it keeps the page's one filled button.
 */
async function ExplanationContinue({ explanation }: { explanation: Explanation }) {
  const t = await getExtracted();

  return (
    <section aria-label={t("Your quick explanation")}>
      <LessonPlayerPreload />
      <ListGroup>
        <ListRowLink className={CURRENT_ROW_CLASS} href={`/explain/${explanation.id}`} prefetch>
          <ListRowLeading>
            <ListRowIcon>
              <PlayIcon />
            </ListRowIcon>
          </ListRowLeading>
          <ListRowContent>
            <ListRowTitle>{explanation.title}</ListRowTitle>
            <ListRowDescription>{t("Quick explanation")}</ListRowDescription>
          </ListRowContent>
        </ListRowLink>
      </ListGroup>
    </section>
  );
}

async function loadOpenExplanation(): Promise<Explanation | null> {
  const list = await listCurrentUserGoals();

  const explanation = list?.goals.findLast(
    (goal) => goal.kind === "explain" && goal.status !== "completed" && goal.status !== "archived",
  );

  return explanation ? { id: explanation.id, title: explanation.title } : null;
}

async function UnfinishedGoalOffer({ goal }: { goal: Promise<UnfinishedGoal | null> }) {
  const unfinished = await goal;
  return unfinished && <UnfinishedGoalNotice goal={unfinished} />;
}

/** The complete no-goal display can prefetch; starting a goal still claims its fresh limit. */
async function loadFirstGoalView(draftId: string | null) {
  "use cache: private";

  const [start, explanation] = await Promise.all([loadStartView(draftId), loadOpenExplanation()]);

  return { explanation, start };
}

async function TodayFirstGoal({ draftId }: { draftId: string | null }) {
  const t = await getExtracted();
  const { start, explanation } = await loadFirstGoalView(draftId);
  const { canAttach, draft, goalLimit, needsAccount } = start;

  return (
    <LazyStartClient
      canAttach={canAttach}
      defaultGoal=""
      embedded
      goalLimit={goalLimit}
      header={
        <>
          <TodayPageHeader title={t("Today")} />
          {explanation && <ExplanationContinue explanation={explanation} />}
        </>
      }
      initialDraft={draft}
      needsAccount={needsAccount}
      planId={null}
    />
  );
}

/** The plan is still in the account, so this leads back to it instead of a first goal built again as a guest. */
async function TodaySessionEnded() {
  const t = await getExtracted();

  return (
    <AuthGatePage
      description={t("Each day's lessons, reviews and practice for your goal.")}
      ended
      next="/today"
      title={t("Today")}
    />
  );
}

/**
 * A reminder's link names the goal with learning left; Today stays on the active goal and offers
 * that one only while it's another of the learner's active goals. Switching is their click.
 */
async function findReminderGoal(goalParam: unknown): Promise<ReminderGoal | null> {
  const goalId = uuidSchema().safeParse(goalParam).data;

  if (!goalId) {
    return null;
  }

  const list = await listCurrentUserGoals();
  const goal = list?.goals.find((candidate) => candidate.id === goalId);

  return goal?.status === "active" && !goal.isActive
    ? { id: goal.id, title: goal.displayName }
    : null;
}

async function TodayContent({ searchParams }: Pick<PageProps<"/[lang]/today">, "searchParams">) {
  const { goal } = await searchParams;

  // Read beside the day, but the day never waits for it.
  const unfinishedGoal = getUnfinishedOnboardingDraft();
  const [result, reminderGoal] = await Promise.all([loadTodayScreen(), findReminderGoal(goal)]);

  const reminder = reminderGoal && <ReminderGoalNotice goal={reminderGoal} />;

  const unfinished = (
    <Suspense>
      <UnfinishedGoalOffer goal={unfinishedGoal} />
    </Suspense>
  );

  // With no day to show, the card leads the page.
  const banner = (
    <>
      {reminder}
      {unfinished}
    </>
  );

  if (result.status === "noGoal" && result.suggestedGoal) {
    return <WelcomeBack suggestion={result.suggestedGoal} />;
  }

  if (result.status === "noGoal") {
    const draft = await unfinishedGoal;
    return <TodayFirstGoal draftId={draft?.draftId ?? null} />;
  }

  // A cookie without a session behind it is a learner whose session ended, not someone new.
  if (result.status === "unauthorized" && hasSessionCookie(await cookies())) {
    return <TodaySessionEnded />;
  }

  if (result.status === "unauthorized") {
    return <TodayFirstGoal draftId={null} />;
  }

  if (result.status === "goalNotActive") {
    return <TodayGoalPaused banner={banner} />;
  }

  if (result.status === "preparing") {
    return <TodayPreparingState banner={banner} goal={result.goal} />;
  }

  if (result.status !== "ready") {
    return (
      <NotFoundPage>
        <LearnNotFound bar={null} />
      </NotFoundPage>
    );
  }

  return (
    <TodayClient
      data={result.data}
      key={result.day}
      banner={reminder}
      readAt={result.readAt}
      unfinishedGoal={unfinished}
      userId={result.userId}
    />
  );
}

async function TodayPreparingState({
  banner,
  goal,
}: {
  banner: React.ReactNode;
  goal: { displayName: string; id: string; title: string };
}) {
  // A goal left halfway through its questions has no plan coming until they're answered, and a
  // made plan is shown once before its first day.
  const left = await readOnboardingLeft(goal.id);

  if (left) {
    return <TodayOnboardingLeft banner={banner} goal={goal} left={left} />;
  }

  return <TodayPreparingClient banner={banner} goalId={goal.id} goalTitle={goal.displayName} />;
}

export default function TodayPage({ searchParams }: PageProps<"/[lang]/today">) {
  return (
    <Suspense fallback={<TodayShell />}>
      <TodayContent searchParams={searchParams} />
    </Suspense>
  );
}
