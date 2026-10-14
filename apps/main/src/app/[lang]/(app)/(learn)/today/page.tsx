import { StartClient } from "@/app/[lang]/(app)/(onboarding)/start/start-client";
import { loadStartView } from "@/app/[lang]/(app)/(onboarding)/start/start-view";
import { AuthGatePage } from "@/components/auth-gate";
import { UploadRequestClient } from "@/components/learn/upload-request-client";
import { Link } from "@/i18n/navigation";
import { getBrainPowerTotal, getLearnerBuddy } from "@/lib/learn/learner-buddy";
import { getReadAt } from "@/lib/learn/read-at";
import { hasSessionCookie } from "@zoonk/auth/cookies";
import { getMockOptions } from "@zoonk/core/exams/mocks/options";
import { listCurrentUserGoals } from "@zoonk/core/goals/list-current-user";
import { type SuggestedGoalView } from "@zoonk/core/goals/suggestions/contract";
import { listGoalChangeNotices } from "@zoonk/core/library/sources/notices";
import { getGoalUploadRequest } from "@zoonk/core/library/sources/upload-request";
import { type MistakeAvailability } from "@zoonk/core/mistakes/contract";
import { listCurrentUserMistakes } from "@zoonk/core/mistakes/list-current-user";
import { getLanguageTodayView } from "@zoonk/core/view-models/language/today";
import { getOnboardingResume } from "@zoonk/core/view-models/onboarding/resume";
import { getPlanTabView } from "@zoonk/core/view-models/plan/get";
import { getSyllabusView } from "@zoonk/core/view-models/syllabus/get";
import { type TodayView, getTodayView } from "@zoonk/core/view-models/today/get";
import { LanguagePracticeRow } from "@zoonk/learn/language/today";
import { Page } from "@zoonk/learn/page";
import { type TodayHostNotices } from "@zoonk/learn/today";
import { TodayPageHeader } from "@zoonk/learn/today/at-rest";
import { TodayChangeNotice } from "@zoonk/learn/today/change-notice";
import { TodaySkeleton } from "@zoonk/learn/today/skeleton";
import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { PlayIcon } from "lucide-react";
import { type Metadata } from "next";
import { getExtracted, getLocale } from "next-intl/server";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SuggestedGoalClient, TodayClient, TodayPreparingClient } from "./today-client";
import { TodayGoalPaused } from "./today-goal-paused";
import { getLocalDay } from "./today-local-day";
import { TodayOnboardingLeft, isOnboardingLeft } from "./today-onboarding-left";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { title: t("Today") };
}

/**
 * A learner back from before goals existed, with no goal yet: their last course comes first, and
 * either answer moves them on to onboarding.
 */
async function WelcomeBack({ suggestion }: { suggestion: SuggestedGoalView }) {
  const t = await getExtracted();

  return (
    <Page className="gap-5">
      <TodayPageHeader date={null} title={t("Welcome back")} />
      <SuggestedGoalClient suggestion={suggestion} />
    </Page>
  );
}

type Explanation = { id: string; title: string };

/**
 * A quick explanation the learner hasn't finished, first on a Today without a goal: Sam came for
 * "What does 'the market is up 2%' mean?", and only search found it again.
 */
async function ExplanationContinue({ explanation }: { explanation: Explanation }) {
  const t = await getExtracted();

  return (
    <section aria-label={t("Your quick explanation")} className="flex flex-col gap-3">
      <div className="bg-muted -mx-2.5 flex items-start gap-3 rounded-[0.625rem] px-2.5 py-2.75">
        <PlayIcon aria-hidden="true" className="text-muted-foreground mt-0.5 size-4 shrink-0" />
        <span className="flex min-w-0 flex-col gap-px">
          <span className="text-sm leading-5 font-medium text-pretty">{explanation.title}</span>
          <span className="text-muted-foreground text-xs leading-4">{t("Quick explanation")}</span>
        </span>
      </div>

      {/* Prefetched with its explanation, like a written lesson's link, so it opens at once. */}
      <Link
        className={cn(buttonVariants({ size: "lg" }), "w-full sm:w-auto sm:self-start")}
        href={`/explain/${explanation.id}`}
        prefetch
      >
        {t("Continue explanation")}
      </Link>
    </section>
  );
}

/**
 * The learner's newest quick explanation not read to the end, and their day's date in its time
 * zone; nothing for a visitor.
 */
async function loadNoGoalContext(locale: string) {
  const list = await listCurrentUserGoals();
  const goals = list?.goals ?? [];

  const explanation = goals.findLast(
    (goal) => goal.kind === "explain" && goal.status !== "completed" && goal.status !== "archived",
  );

  const date = await getLocalDay({
    locale,
    timeZone: goals.find((goal) => goal.timezone)?.timezone ?? null,
  });

  return {
    date,
    explanation: explanation ? { id: explanation.id, title: explanation.title } : null,
  };
}

/** The complete no-goal display can prefetch; starting a goal still claims its fresh limit. */
async function loadFirstGoalView(locale: string) {
  "use cache: private";

  const resume = await getOnboardingResume();

  const draftId =
    resume.status === "ready" && resume.resume?.kind === "draft" ? resume.resume.draftId : null;

  const [start, context] = await Promise.all([loadStartView(draftId), loadNoGoalContext(locale)]);
  return { context, start };
}

/**
 * A learner without a goal, or a visitor, starts one right here, under Today's own title: an
 * unfinished quick explanation first, then "Start a goal" with the start form (or the goal they
 * typed and haven't confirmed yet) on the page's edges, and from 72rem the examples and how it
 * works in Today's aside. The flow lays out the page (`header` is Today's top), since its aside
 * follows the screen. Confirming it goes on to the goal's own questions.
 */
async function TodayFirstGoal() {
  const t = await getExtracted();
  const locale = await getLocale();
  const { start, context } = await loadFirstGoalView(locale);
  const { buddy, canAttach, draft, goalLimit, needsAccount } = start;

  return (
    <StartClient
      buddy={buddy}
      canAttach={canAttach}
      defaultGoal=""
      embedded
      goalLimit={goalLimit}
      header={
        <>
          <TodayPageHeader date={context.date} title={t("Today")} />
          {context.explanation && <ExplanationContinue explanation={context.explanation} />}
        </>
      }
      initialDraft={draft}
      needsAccount={needsAccount}
      planId={null}
    />
  );
}

/**
 * A browser that still carries a session cookie with no session behind it (it expired, or ended
 * on another tab): its plan is still in its account, so Today says so and leads back to it,
 * instead of offering a first goal as to someone new, who'd build the plan again as a guest.
 */
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

/** A language goal's due practice; nothing for other goals. */
async function loadLanguageToday(goal: TodayView["goal"]) {
  if (goal.kind !== "language") {
    return null;
  }

  const result = await getLanguageTodayView({ goalId: goal.id });
  return result.status === "ready" ? result.today : null;
}

/**
 * The notices Today can show that need main's actions, each drawn only when there's something to
 * say. Today shows the most important one.
 */
async function loadHostNotices(goal: TodayView["goal"]) {
  const [changes, upload, language] = await Promise.all([
    listGoalChangeNotices({ goalId: goal.id }),
    getGoalUploadRequest({ goalId: goal.id }),
    loadLanguageToday(goal),
  ]);

  const latestChange = changes.status === "ready" ? changes.notices[0] : undefined;
  const request = upload.status === "ready" ? upload.request : null;
  const hasPractice = Boolean(language?.pattern ?? language?.pronunciation);

  const notices: TodayHostNotices = {
    practice:
      language && hasPractice ? (
        <LanguagePracticeRow
          hrefs={{
            pattern: language.pattern ? `/pattern/${language.pattern.id}` : null,
            pronunciation: `/pronunciation?goal=${goal.id}`,
          }}
          today={language}
        />
      ) : null,
    sourceChange: latestChange ? <TodayChangeNotice message={latestChange.message} /> : null,
    uploadRequest: request ? <UploadRequestClient request={request} /> : null,
  };

  return notices;
}

/**
 * The plan's end as the Plan shows it, read only when Today has a proposed plan change to
 * explain for a plan without a date: that's the one case its sentence names an end.
 */
async function loadPlanEnd(today: TodayView): Promise<string | null> {
  const proposed =
    today.insight?.planChange?.status === "proposed" || today.planChange?.status === "proposed";

  if (!proposed || today.goal.targetDate) {
    return null;
  }

  const result = await getPlanTabView({ goalId: today.goal.id });
  return result.status === "ready" ? result.view.plan.estimate.endDate : null;
}

/**
 * An exam goal's mocks to take any time, which Today offers under "Practice anytime" to every
 * learner: without Plus, the row is marked Plus and its chooser says what Plus unlocks. Nothing
 * while no mock can be built.
 */
async function loadTodayMocks(goal: TodayView["goal"]) {
  if (goal.kind !== "exam") {
    return null;
  }

  const result = await getMockOptions({ goalId: goal.id });
  const view = result.status === "ready" ? result.view : null;

  return view && (view.running || view.options.length > 0) ? view : null;
}

/**
 * The goal's subjects for Today's aside, read as the Plan reads them, so the aside's rows are the
 * Plan's own (the same names, bars and shares) under its "See your plan".
 */
async function loadSyllabus(goalId: string) {
  const result = await getSyllabusView({ goalId });
  return result.status === "ready" ? result.syllabus : null;
}

/** Open entries in the goal's mistakes notebook, which Today offers under "Practice anytime". */
async function countOpenMistakes(goalId: string): Promise<MistakeAvailability> {
  const result = await listCurrentUserMistakes({ goalId, limit: 1, offset: 0, status: "open" });
  return result.status === "ready" ? result.availability : { ready: 0, tomorrow: 0 };
}

async function TodayContent() {
  const result = await getTodayView({});

  if (result.status === "noGoal" && result.suggestedGoal) {
    return <WelcomeBack suggestion={result.suggestedGoal} />;
  }

  // A cookie without a session behind it is a learner whose session ended, not someone new.
  if (result.status === "unauthorized" && hasSessionCookie(await cookies())) {
    return <TodaySessionEnded />;
  }

  // Someone without a session hasn't started anything here either: they start right away, or log
  // in from the frame.
  if (result.status === "noGoal" || result.status === "unauthorized") {
    return <TodayFirstGoal />;
  }

  if (result.status === "goalNotActive") {
    return <TodayGoalPaused />;
  }

  if (result.status === "preparing") {
    // A goal left halfway through its questions has no plan coming until they're answered.
    if (await isOnboardingLeft(result.goal.id)) {
      return <TodayOnboardingLeft goal={result.goal} />;
    }

    return <TodayPreparingClient goalId={result.goal.id} goalTitle={result.goal.title} />;
  }

  if (result.status !== "ready") {
    notFound();
  }

  // The language goal's view is read once per request: the notices read it too.
  const [buddy, notices, planEnd, readAt, mocks, mistakes, languageToday, syllabus, brainPower] =
    await Promise.all([
      getLearnerBuddy(),
      loadHostNotices(result.today.goal),
      loadPlanEnd(result.today),
      getReadAt(),
      loadTodayMocks(result.today.goal),
      countOpenMistakes(result.today.goal.id),
      loadLanguageToday(result.today.goal),
      loadSyllabus(result.today.goal.id),
      getBrainPowerTotal(),
    ]);

  return (
    <TodayClient
      key={`${result.today.goal.id}:${result.today.session.id}`}
      brainPower={brainPower}
      buddy={buddy}
      level={languageToday?.level ?? null}
      mistakes={mistakes}
      mocks={mocks}
      notices={notices}
      planEnd={planEnd}
      readAt={readAt}
      speaking={languageToday?.speaking ?? null}
      syllabus={syllabus}
      today={result.today}
    />
  );
}

/**
 * Today, the screen learners open every day: one next step for the active goal. While it loads,
 * its skeleton is the same frame (`TodaySkeleton`), so nothing moves when it arrives.
 */
export default function TodayPage() {
  return (
    <Suspense fallback={<TodaySkeleton />}>
      <TodayContent />
    </Suspense>
  );
}
