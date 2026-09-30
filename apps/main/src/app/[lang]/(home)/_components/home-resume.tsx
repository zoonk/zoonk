import { getDraftHref } from "@/app/[lang]/start/start-params";
import { Link } from "@/i18n/navigation";
import { type OnboardingResumeView } from "@zoonk/core/view-models/onboarding/contract";
import { getOnboardingResume } from "@zoonk/core/view-models/onboarding/resume";
import { ChevronRightIcon, HistoryIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";

/** Where each kind of progress continues; the day has no words of its own to show. */
function getResumeHref(resume: OnboardingResumeView) {
  switch (resume.kind) {
    case "draft":
      return getDraftHref(resume.draftId);
    case "goal":
      return `/start/${resume.goalId}` as const;
    case "today":
      return "/today";
    default:
      return "/today";
  }
}

/** What the learner will recognize: the words they typed, or their goal's title. */
function readResumeWords(resume: OnboardingResumeView): string | null {
  if (resume.kind === "draft") {
    return resume.prompt;
  }

  return resume.kind === "goal" ? resume.title : null;
}

/**
 * For someone who already started (a guest, or a learner the home page still reaches): the goal
 * they typed, the goal whose questions they were answering, or their day, one tap away. Nothing
 * for a first visit, so the page stays the same for everyone else.
 */
export async function HomeResume() {
  const [result, t] = await Promise.all([getOnboardingResume(), getExtracted()]);

  if (result.status !== "ready" || !result.resume) {
    return null;
  }

  const { resume } = result;

  const title = readResumeWords(resume) ?? t("Today's session");

  return (
    <Link
      className="bg-card hover:bg-muted/60 focus-visible:ring-ring/50 ring-border mb-4 flex min-h-14 items-center gap-3 rounded-2xl px-3 py-2.5 ring-1 transition-colors outline-none ring-inset focus-visible:ring-[3px] sm:mb-5"
      href={getResumeHref(resume)}
      prefetch={false}
    >
      <span
        aria-hidden="true"
        className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-xl"
      >
        <HistoryIcon className="size-5" />
      </span>

      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-muted-foreground text-sm">{t("Continue where you left off")}</span>
        <span className="line-clamp-2 text-base font-medium wrap-break-word">{title}</span>
      </span>

      <ChevronRightIcon aria-hidden="true" className="text-muted-foreground size-5 shrink-0" />
    </Link>
  );
}
