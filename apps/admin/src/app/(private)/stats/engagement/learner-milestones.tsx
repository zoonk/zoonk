import { getLearnerMilestoneSummary } from "@/data/stats/get-learner-milestones";
import {
  DEFAULT_COMPLETED_LESSONS_THRESHOLD,
  DEFAULT_LEARNING_DAYS_THRESHOLD,
  type LearnerMilestoneKind,
  buildLearnerMilestoneUsersHref,
  getLearnerMilestoneCopy,
  parseLearnerMilestoneThreshold,
} from "@/lib/learner-milestone-filters";
import { Button } from "@zoonk/ui/components/button";
import { Input } from "@zoonk/ui/components/input";
import { Label } from "@zoonk/ui/components/label";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { BookCheckIcon, CalendarDaysIcon } from "lucide-react";
import Link from "next/link";
import { AdminMetricCard, AdminMetricCardSkeleton } from "../_components/admin-metric-card";

type EngagementSearchParams = {
  completedLessons?: string | string[];
  learningDays?: string | string[];
  offset?: string | string[];
  period?: string | string[];
};

/**
 * Learner milestones are all-time threshold questions, so they live as a quiet
 * engagement subsection with URL-backed inputs and linked counts.
 */
export async function LearnerMilestones({
  searchParams,
}: {
  searchParams: EngagementSearchParams;
}) {
  const completedLessonsThreshold = parseLearnerMilestoneThreshold({
    defaultValue: DEFAULT_COMPLETED_LESSONS_THRESHOLD,
    value: searchParams.completedLessons,
  });

  const learningDaysThreshold = parseLearnerMilestoneThreshold({
    defaultValue: DEFAULT_LEARNING_DAYS_THRESHOLD,
    value: searchParams.learningDays,
  });

  const summary = await getLearnerMilestoneSummary(
    completedLessonsThreshold,
    learningDaysThreshold,
  );

  return (
    <section className="flex flex-col gap-4">
      <LearnerMilestoneForm
        completedLessonsThreshold={completedLessonsThreshold}
        learningDaysThreshold={learningDaysThreshold}
        offset={searchParams.offset}
        period={searchParams.period}
      />

      <div className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2">
        <LearnerMilestoneCard
          count={summary.completedLessonsUsers}
          icon={<BookCheckIcon />}
          kind="completedLessons"
          threshold={completedLessonsThreshold}
        />

        <LearnerMilestoneCard
          count={summary.learningDaysUsers}
          icon={<CalendarDaysIcon />}
          kind="learningDays"
          threshold={learningDaysThreshold}
        />
      </div>
    </section>
  );
}

/**
 * The threshold form updates the engagement page with a plain GET request, so
 * admins can bookmark or share the exact thresholds they are inspecting.
 */
function LearnerMilestoneForm({
  completedLessonsThreshold,
  learningDaysThreshold,
  offset,
  period,
}: {
  completedLessonsThreshold: number;
  learningDaysThreshold: number;
  offset?: string | string[];
  period?: string | string[];
}) {
  return (
    <form action="/stats/engagement" className="flex flex-col gap-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h3 className="text-base font-semibold tracking-tight">Learner Milestones</h3>
          <p className="text-muted-foreground text-sm">
            All-time learner counts for completion depth and return days.
          </p>
        </div>

        <Button className="self-start" type="submit" variant="outline">
          Apply
        </Button>
      </header>

      <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
        <HiddenInput name="period" value={period} />
        <HiddenInput name="offset" value={offset} />

        <MilestoneThresholdField
          defaultValue={completedLessonsThreshold}
          id="completed-lessons-threshold"
          label="Completed lessons"
          name="completedLessons"
        />

        <MilestoneThresholdField
          defaultValue={learningDaysThreshold}
          id="learning-days-threshold"
          label="Learning days"
          name="learningDays"
        />
      </div>
    </form>
  );
}

/**
 * Threshold inputs share bounds and layout, but each writes to a different
 * query key so both milestone questions can be tuned independently.
 */
function MilestoneThresholdField({
  defaultValue,
  id,
  label,
  name,
}: {
  defaultValue: number;
  id: string;
  label: string;
  name: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input defaultValue={defaultValue} id={id} min={1} name={name} type="number" />
    </div>
  );
}

/**
 * Form submissions should preserve the selected stats period, but repeated
 * query params still need to collapse to one hidden input value.
 */
function HiddenInput({ name, value }: { name: string; value?: string | string[] }) {
  const firstValue = Array.isArray(value) ? value[0] : value;

  if (!firstValue) {
    return null;
  }

  return <input name={name} type="hidden" value={firstValue} />;
}

/**
 * The linked card is the bridge from "how many?" to "who are they?" while
 * keeping the visual treatment consistent with the rest of the stats page.
 */
function LearnerMilestoneCard({
  count,
  icon,
  kind,
  threshold,
}: {
  count: number;
  icon: React.ReactNode;
  kind: LearnerMilestoneKind;
  threshold: number;
}) {
  const copy = getLearnerMilestoneCopy({ kind, threshold });

  return (
    <Link
      className="hover:bg-muted/50 rounded-lg p-2 transition-colors"
      href={buildLearnerMilestoneUsersHref({ kind, threshold })}
    >
      <AdminMetricCard
        description="Open user list"
        help={copy.help}
        icon={icon}
        title={copy.pageTitle}
        value={count.toLocaleString()}
      />
    </Link>
  );
}

/**
 * The milestone section fetches independently from the period metrics, so its
 * skeleton mirrors only the threshold controls and two linked counts.
 */
export function LearnerMilestonesSkeleton() {
  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>

        <Skeleton className="h-9 w-20 rounded-4xl" />
      </header>

      <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
        <Skeleton className="h-16 flex-1 rounded-lg" />
        <Skeleton className="h-16 flex-1 rounded-lg" />
      </div>

      <div className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2">
        <AdminMetricCardSkeleton />
        <AdminMetricCardSkeleton />
      </div>
    </section>
  );
}
